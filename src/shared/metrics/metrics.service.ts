import { Injectable } from "@nestjs/common";

type MetricTags = Record<string, string | undefined>;

interface CounterKey {
  name: string;
  tags: Record<string, string>;
}

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();
  private readonly alertEvents: Array<{
    type: string;
    severity: "warning" | "critical";
    message: string;
    occurredAt: string;
    tags: Record<string, string>;
  }> = [];

  increment(name: string, tags: MetricTags = {}) {
    const key = this.serialize({ name, tags: this.normalizeTags(tags) });
    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
  }

  alert(input: {
    type: string;
    severity: "warning" | "critical";
    message: string;
    tags?: MetricTags;
  }) {
    this.alertEvents.unshift({
      type: input.type,
      severity: input.severity,
      message: input.message,
      occurredAt: new Date().toISOString(),
      tags: this.normalizeTags(input.tags ?? {})
    });
    this.alertEvents.splice(100);
  }

  snapshot() {
    return {
      counters: [...this.counters.entries()].map(([key, value]) => ({
        ...JSON.parse(key) as CounterKey,
        value
      })),
      alerts: this.alertEvents
    };
  }

  private normalizeTags(tags: MetricTags) {
    return Object.fromEntries(
      Object.entries(tags)
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
        .sort(([left], [right]) => left.localeCompare(right)),
    );
  }

  private serialize(key: CounterKey) {
    return JSON.stringify(key);
  }
}
