---
name: authany-stock-cli
description: 当用户需要通过 authany-stock CLI 在终端查询股票、概念板块、市场行情或 target-service 健康状态时使用此技能。适用于股票列表、个股日线、资金流向、市场总览、指数行情、每日股票池、涨停统计、龙虎榜、概念列表、概念日线等场景；当用户提到“用 CLI 查股票数据”“查某只股票”“查市场行情”“查概念板块”或要求直接通过终端访问 target-service 时，应触发此技能。
---

# authany-stock



## 何时触发

当用户表达以下意图时，优先使用本技能：

- 要求“用 CLI 查股票数据”
- 要求“查股票列表”
- 要求“查某只股票日线”
- 要求“查某只股票资金流向”
- 要求“查市场概览 / 市场总览”
- 要求“查指数日线”
- 要求“查每日股票池”
- 要求“查涨停统计”
- 要求“查龙虎榜”
- 要求“查概念列表”
- 要求“查概念日线”
- 要求“检查 target-service 是否健康”

如果用户明确提到 `authany-stock`，也直接触发本技能。

## 使用规则

- 默认输出 JSON，适合 agent、OpenClaw 和自动化消费
- 如果命令只是探活，优先使用公开接口 `authany-stock healthz`



## 健康检查命令

适用于：

- “检查服务是否活着”
- “看 target-service 健康状态”
- “确认服务地址是否可用”

```bash
authany-stock healthz
```

## 股票命令

适用于：

- “查股票列表”
- “按关键字搜股票”

```bash
authany-stock stock list
authany-stock stock list --keyword 平安
authany-stock stock list --page 1 --page-size 20
```

适用于：

- “查个股日线”
- “查 000001.SZ 最近 30 条行情”

```bash
authany-stock stock daily --code 000001.SZ
authany-stock stock daily --code 000001.SZ --limit 30
```

适用于：

- “查个股资金流向”
- “看 000001.SZ 资金流”

```bash
authany-stock stock fund-flow --code 000001.SZ
authany-stock stock fund-flow --code 000001.SZ --limit 20
```

## 市场命令

适用于：

- “查市场总览”
- “看市场概况”

```bash
authany-stock market overview
```

适用于：

- “查指数日线”
- “看最近 20 条指数数据”

```bash
authany-stock market index-daily
authany-stock market index-daily --limit 20
```

适用于：

- “查每日股票池”
- “按交易日查股票池”

```bash
authany-stock market daily-stock-pool
authany-stock market daily-stock-pool --trade-date 2026-05-18
authany-stock market daily-stock-pool --trade-date 2026-05-18 --limit 50
```

适用于：

- “查涨停统计”

```bash
authany-stock market limit-up-stats
authany-stock market limit-up-stats --limit 30
```

适用于：

- “查龙虎榜”

```bash
authany-stock market dragon-tiger
authany-stock market dragon-tiger --limit 30
```

## 概念命令

适用于：

- “查概念列表”

```bash
authany-stock concept list
authany-stock concept list --page 1 --page-size 20
```

适用于：

- “查概念日线”
- “查 AI001 概念走势”

```bash
authany-stock concept daily --code AI001
authany-stock concept daily --code AI001 --limit 30
```

## 汇总命令

适用于：

- “查金融汇总”
- “看 finance summary”

```bash
authany-stock finance-summary
```


## 结果理解

- `healthz` 返回公开健康状态，不依赖 target token
- 受保护命令成功时会返回 JSON，其中通常包含：
  - `mode`，表示是 `public` 还是 `injected_target_token`
  - `status`，表示 target-service 的 HTTP 状态码
  - `response`，表示实际业务数据
  - `targetServiceUrl`，表示本次调用命中的服务地址
- 如果 `status >= 400`，CLI 会输出错误 JSON，并以非零退出码结束
- 如果用户没有提供 `AUTHANY_TARGET_ACCESS_TOKEN`，受保护命令会直接失败
- 如果用户只说“查一下股票”但没说明维度，优先按上下文判断：
  - 查股票列表，使用 `authany-stock stock list`
  - 查个股行情，使用 `authany-stock stock daily --code <ts_code>`
  - 查市场概览，使用 `authany-stock market overview`
