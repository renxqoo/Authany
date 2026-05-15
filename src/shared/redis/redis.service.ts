import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";
import { AppConfigService } from "../config/app-config.service";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: RedisClientType;
  private readonly memoryStore = new Map<string, string>();
  private connected = false;

  constructor(private readonly config: AppConfigService) {}

  async onModuleInit() {
    try {
      this.client = createClient({ url: this.config.redisUrl });
      this.client.on("error", (error) => this.logger.warn(`Redis error: ${String(error)}`));
      await this.client.connect();
      this.connected = true;
    } catch (error) {
      this.logger.warn(`Redis unavailable, falling back to in-memory store: ${String(error)}`);
      this.connected = false;
    }
  }

  async onModuleDestroy() {
    if (this.client && this.connected) {
      await this.client.quit();
    }
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (this.client && this.connected) {
      if (ttlSeconds) {
        await this.client.set(key, value, { EX: ttlSeconds });
        return;
      }
      await this.client.set(key, value);
      return;
    }

    this.memoryStore.set(key, value);
    if (ttlSeconds) {
      setTimeout(() => this.memoryStore.delete(key), ttlSeconds * 1000).unref();
    }
  }

  async get(key: string) {
    if (this.client && this.connected) {
      return this.client.get(key);
    }
    return this.memoryStore.get(key) ?? null;
  }

  async delete(key: string) {
    if (this.client && this.connected) {
      await this.client.del(key);
      return;
    }
    this.memoryStore.delete(key);
  }

  async setIfAbsent(key: string, value: string, ttlSeconds: number) {
    if (this.client && this.connected) {
      const result = await this.client.set(key, value, { EX: ttlSeconds, NX: true });
      return result === "OK";
    }

    if (this.memoryStore.has(key)) {
      return false;
    }
    this.memoryStore.set(key, value);
    setTimeout(() => this.memoryStore.delete(key), ttlSeconds * 1000).unref();
    return true;
  }

  async healthcheck() {
    if (this.client && this.connected) {
      try {
        await this.client.ping();
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }
}
