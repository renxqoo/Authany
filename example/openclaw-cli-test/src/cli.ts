#!/usr/bin/env node

import { Command } from "commander";
import { runConceptDailyCommand } from "./commands/concept-daily.js";
import { runConceptListCommand } from "./commands/concept-list.js";
import { runDailyStockPoolCommand } from "./commands/daily-stock-pool.js";
import { runDragonTigerCommand } from "./commands/dragon-tiger.js";
import { runFinanceSummaryCommand } from "./commands/finance-summary.js";
import { runFundFlowCommand } from "./commands/fund-flow.js";
import { runHealthzCommand } from "./commands/healthz.js";
import { runIndexDailyCommand } from "./commands/index-daily.js";
import { runLimitUpStatsCommand } from "./commands/limit-up-stats.js";
import { runMarketOverviewCommand } from "./commands/market-overview.js";
import { runStockDailyCommand } from "./commands/stock-daily.js";
import { runStockListCommand } from "./commands/stock-list.js";
import { loadEnvFile } from "./services/env-file.js";

const CLI_VERSION = "0.1.0";

export async function runCli(argv = process.argv) {
  const program = new Command();

  program
    .name("authany-stock")
    .description("Fetch protected stock and market data through AuthAny.")
    .version(CLI_VERSION)
    .option("-e, --env-file <path>", "load env values from a file before resolving runtime config");

  program
    .command("finance-summary")
    .description("fetch finance-summary data from example target-service")
    .option("--target-service-url <url>", "override the target-service base URL")
    .action(async (options) => {
      applyRootEnvFile(program);
      await runFinanceSummaryCommand({
        targetServiceUrl: options.targetServiceUrl
      });
    });

  program
    .command("healthz")
    .description("check target-service health")
    .option("--target-service-url <url>", "override the target-service base URL")
    .action(async (options) => {
      applyRootEnvFile(program);
      await runHealthzCommand({
        targetServiceUrl: options.targetServiceUrl
      });
    });

  const stock = program.command("stock").description("stock resource queries");
  const market = program.command("market").description("market resource queries");
  const concept = program.command("concept").description("concept resource queries");

  stock
    .command("list")
    .description("query stock list")
    .option("--keyword <keyword>", "keyword filter")
    .option("--page <number>", "page number", parseOptionalInteger)
    .option("--page-size <number>", "page size", parseOptionalInteger)
    .option("--target-service-url <url>", "override the target-service base URL")
    .action(async (options) => {
      applyRootEnvFile(program);
      await runStockListCommand({
        keyword: options.keyword,
        page: options.page,
        pageSize: options.pageSize,
        targetServiceUrl: options.targetServiceUrl
      });
    });

  stock
    .command("daily")
    .description("query stock daily candles")
    .requiredOption("--code <code>", "stock ts_code, e.g. 000001.SZ")
    .option("--limit <number>", "row limit", parseOptionalInteger)
    .option("--target-service-url <url>", "override the target-service base URL")
    .action(async (options) => {
      applyRootEnvFile(program);
      await runStockDailyCommand({
        code: options.code,
        limit: options.limit,
        targetServiceUrl: options.targetServiceUrl
      });
    });

  stock
    .command("fund-flow")
    .description("query stock fund flow")
    .requiredOption("--code <code>", "stock ts_code, e.g. 000001.SZ")
    .option("--limit <number>", "row limit", parseOptionalInteger)
    .option("--target-service-url <url>", "override the target-service base URL")
    .action(async (options) => {
      applyRootEnvFile(program);
      await runFundFlowCommand({
        code: options.code,
        limit: options.limit,
        targetServiceUrl: options.targetServiceUrl
      });
    });

  market
    .command("overview")
    .description("query market overview")
    .option("--target-service-url <url>", "override the target-service base URL")
    .action(async (options) => {
      applyRootEnvFile(program);
      await runMarketOverviewCommand({
        targetServiceUrl: options.targetServiceUrl
      });
    });

  market
    .command("index-daily")
    .description("query index daily data")
    .option("--limit <number>", "row limit", parseOptionalInteger)
    .option("--target-service-url <url>", "override the target-service base URL")
    .action(async (options) => {
      applyRootEnvFile(program);
      await runIndexDailyCommand({
        limit: options.limit,
        targetServiceUrl: options.targetServiceUrl
      });
    });

  market
    .command("daily-stock-pool")
    .description("query daily stock pool")
    .option("--trade-date <yyyy-mm-dd>", "trade date filter")
    .option("--limit <number>", "row limit", parseOptionalInteger)
    .option("--target-service-url <url>", "override the target-service base URL")
    .action(async (options) => {
      applyRootEnvFile(program);
      await runDailyStockPoolCommand({
        tradeDate: options.tradeDate,
        limit: options.limit,
        targetServiceUrl: options.targetServiceUrl
      });
    });

  market
    .command("limit-up-stats")
    .description("query limit-up statistics")
    .option("--limit <number>", "row limit", parseOptionalInteger)
    .option("--target-service-url <url>", "override the target-service base URL")
    .action(async (options) => {
      applyRootEnvFile(program);
      await runLimitUpStatsCommand({
        limit: options.limit,
        targetServiceUrl: options.targetServiceUrl
      });
    });

  market
    .command("dragon-tiger")
    .description("query dragon tiger榜 data")
    .option("--limit <number>", "row limit", parseOptionalInteger)
    .option("--target-service-url <url>", "override the target-service base URL")
    .action(async (options) => {
      applyRootEnvFile(program);
      await runDragonTigerCommand({
        limit: options.limit,
        targetServiceUrl: options.targetServiceUrl
      });
    });

  concept
    .command("list")
    .description("query concept list")
    .option("--page <number>", "page number", parseOptionalInteger)
    .option("--page-size <number>", "page size", parseOptionalInteger)
    .option("--target-service-url <url>", "override the target-service base URL")
    .action(async (options) => {
      applyRootEnvFile(program);
      await runConceptListCommand({
        page: options.page,
        pageSize: options.pageSize,
        targetServiceUrl: options.targetServiceUrl
      });
    });

  concept
    .command("daily")
    .description("query concept daily data")
    .requiredOption("--code <code>", "concept code")
    .option("--limit <number>", "row limit", parseOptionalInteger)
    .option("--target-service-url <url>", "override the target-service base URL")
    .action(async (options) => {
      applyRootEnvFile(program);
      await runConceptDailyCommand({
        code: options.code,
        limit: options.limit,
        targetServiceUrl: options.targetServiceUrl
      });
    });

  await program.parseAsync(argv);
}

function applyRootEnvFile(program: Command) {
  const rootOptions = program.opts<{ envFile?: string }>();
  if (rootOptions.envFile) {
    loadEnvFile(rootOptions.envFile);
  }
}

function parseOptionalInteger(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got "${value}".`);
  }
  return parsed;
}

runCli().catch((error) => {
  console.error(
    JSON.stringify(
      {
        code: "stock_cli_failed",
        message: error instanceof Error ? error.message : String(error)
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
