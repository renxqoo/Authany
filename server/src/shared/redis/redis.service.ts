import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";
import { AppConfigService } from "../config/app-config.service";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: RedisClientType;
  private connected = false;

  constructor(private readonly config: AppConfigService) {}

  async onModuleInit() {
    this.client = createClient({ url: this.config.redisUrl });
    this.client.on("error", (error) => this.logger.warn(`Redis error: ${String(error)}`));
    await this.client.connect();
    this.connected = true;
  }

  async onModuleDestroy() {
    if (this.client && this.connected) {
      await this.client.quit();
    }
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    const client = this.requireClient();
    if (ttlSeconds) {
      await client.set(key, value, { EX: ttlSeconds });
      return;
    }
    await client.set(key, value);
  }

  async get(key: string) {
    return this.requireClient().get(key);
  }

  async delete(key: string) {
    await this.requireClient().del(key);
  }

  async setIfAbsent(key: string, value: string, ttlSeconds: number) {
    const result = await this.requireClient().set(key, value, { EX: ttlSeconds, NX: true });
    return result === "OK";
  }

  async increment(key: string, ttlSeconds: number) {
    const client = this.requireClient();
    const value = await client.incr(key);
    if (value === 1) {
      await client.expire(key, ttlSeconds);
    }
    return value;
  }

  async healthcheck() {
    if (!this.client || !this.connected) {
      return false;
    }
    try {
      await this.requireClient().ping();
      return true;
    } catch {
      this.connected = false;
      return false;
    }
  }

  private requireClient() {
    if (!this.client || !this.connected) {
      throw new Error("Redis is unavailable.");
    }
    return this.client;
  }
}
