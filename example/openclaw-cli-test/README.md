# AuthAny Stock CLI Test

一个可发布的 Node CLI 包，用于通过 AuthAny 访问 `example/target-service` 的股票与行情数据接口。

## 开发

```bash
pnpm dev -- finance-summary
```

如果本地要复用 monorepo 示例环境：

```bash
pnpm dev -- --env-file ../.env finance-summary
```

## 打包

```bash
pnpm build
```

## npm 入口

发布后默认命令名：

```bash
authany-stock finance-summary
```

## 已实现接口

公开接口：

- `authany-stock healthz`

受保护接口：

- `authany-stock finance-summary`
- `authany-stock stock list`
- `authany-stock stock daily --code 000001.SZ`
- `authany-stock stock fund-flow --code 000001.SZ`
- `authany-stock market overview`
- `authany-stock market index-daily`
- `authany-stock market daily-stock-pool`
- `authany-stock market limit-up-stats`
- `authany-stock market dragon-tiger`
- `authany-stock concept list`
- `authany-stock concept daily --code AI001`

## 运行模式

### 1. Agent 注入模式

CLI 优先读取：

- `AUTHANY_TARGET_ACCESS_TOKEN`
- `TARGET_SERVICE_URL` 或内置默认 `http://127.0.0.1:3006`

这时 CLI 不持有长期凭证，只消费本次调用注入的短期 token。

### 2. 本地调试模式

如果不是从 OpenClaw 调用，而是本地手工调试，也只支持显式提供短期 token：

```bash
export AUTHANY_TARGET_ACCESS_TOKEN=your-short-lived-token
authany-stock finance-summary
```

如果缺少 `AUTHANY_TARGET_ACCESS_TOKEN`，所有受保护命令都会直接失败。CLI 不会自己做 token exchange。
