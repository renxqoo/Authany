# 03 - 协议与 Token

> AuthAny V1 遵循 OAuth 2.1 安全原则，为 Application、Agent 和 Runtime 签发访问 Target Resource 的短期 RS256 Token。

---

## 1. 签名要求

- 访问 Token 只能使用 RS256。
- 每个 JWT 必须包含 `iss`、`sub`、`aud`、`exp`、`iat` 和 `jti`。
- 每个 JWT header 必须包含 `kid`。
- AuthAny 必须通过 `/.well-known/jwks.json` 暴露 JWKS。
- 密钥轮换期间，当前签发密钥和仍需验签的历史公钥必须同时可用。
- 访问 Token 不允许使用 HS256。

---

## 2. Token 类型

| Token | 主体 | 用途 |
|-------|------|------|
| Requester JWT | `app:<app_id>` 或 `agent:<agent_id>` | 请求方向 AuthAny 申请 Target Token 时提交的已签名断言。 |
| Application Target Token | `app:<app_id>` | Application 调用 Target Resource。 |
| Agent Target Token | `agent:<agent_id>` | Agent / Runtime 调用 Target Resource。 |
| Admin Token | `operator:<operator_id>` | Admin UI / Admin API 访问 AuthAny 管理面。 |

AuthAny Core 不签发业务用户 Token。

规则：

- Target Resource 只能收到 Target Token。
- `App Secret` 和 `Caller Credential` 不能发送给 Target Resource。
- Requester JWT 必须是短期 Token，并且 `aud` 绑定到 AuthAny。
- Target Token 必须是短期 Token，并且 `aud` 绑定到对应 Target Resource。
- 如果请求由人、聊天用户、任务或外部事件触发，该上下文只能放在 `external_context`，不能作为 Token 的 `sub`。

---

## 3. Requester JWT

Requester JWT 用来证明“谁正在向 AuthAny 申请 Target Token”。

Application 示例：

```json
{
  "iss": "app:app_live_xxx",
  "sub": "app:app_live_xxx",
  "aud": "https://authany.company.com",
  "jti": "uuid",
  "iat": 1770000000,
  "exp": 1770000300,
  "app_id": "app_live_xxx",
  "target_resource": "ebfx",
  "request_id": "uuid"
}
```

Agent / Runtime 示例：

```json
{
  "iss": "agent:agt_live_xxx",
  "sub": "agent:agt_live_xxx",
  "aud": "https://authany.company.com",
  "jti": "uuid",
  "iat": 1770000000,
  "exp": 1770000300,
  "agent_id": "agt_live_xxx",
  "runtime_id": "rt_openclaw_lark_prod",
  "target_resource": "ebfx",
  "request_id": "uuid",
  "external_context": {
    "provider": "lark",
    "subject_type": "open_id",
    "subject_value": "ou_xxx",
    "message_id": "om_xxx"
  }
}
```

规则：

- Requester JWT 的 `aud` 必须是 AuthAny issuer/base URL。
- Requester JWT 生命周期应很短，通常为 1-5 分钟。
- Requester JWT 必须包含 `jti` 或等价的防重放键。
- AuthAny 在签发 Target Token 前，必须校验 Requester JWT 的签名、时效、受众和防重放键。
- Requester JWT 可以由可信服务端或可信 Runtime 在校验 `app_secret` 或 Caller Credential 后生成。
- 裸 `sender_id`、`agent_id`、`runtime_id` 或 `app_secret` 不能直接作为可信身份断言；必须使用已签名的 Requester JWT 或等价的 OAuth 2.1 客户端认证方式。

---

## 4. Agent Target Token

示例：

```json
{
  "iss": "https://authany.company.com",
  "sub": "agent:agt_live_xxx",
  "aud": "ebfx-api",
  "jti": "uuid",
  "iat": 1770000000,
  "exp": 1770000900,
  "agent_id": "agt_live_xxx",
  "runtime_id": "rt_openclaw_lark_prod",
  "target_resource": "ebfx",
  "delegation_type": "agent_as_self",
  "external_context": {
    "provider": "lark",
    "subject_type": "open_id",
    "subject_value": "ou_xxx"
  }
}
```

规则：

- `sub` 始终保持为 Agent。
- `external_context` 是可选的不透明上下文，AuthAny 不解释其业务含义。
- Target Resource 可以根据 `external_context` 执行自己的本地用户映射和业务授权。

---

## 5. Application Target Token

示例：

```json
{
  "iss": "https://authany.company.com",
  "sub": "app:app_live_xxx",
  "aud": "ebfx-api",
  "jti": "uuid",
  "iat": 1770000000,
  "exp": 1770000900,
  "app_id": "app_live_xxx",
  "target_resource": "ebfx",
  "token_use": "target_access"
}
```

规则：

- Application 身份与 Agent 身份相互独立。
- Application Token 的签发必须依赖有效的 Target Connection 和 Access Grant。
- Application 的 `sub` 只能是 `app:<app_id>`，不能伪装成用户或 Agent。

---

## 6. External Context 契约

External Context 表示触发 Application、Agent、Runtime、CLI、MCP Server、Workflow、Webhook Handler 或设备访问 Target Resource 的入口上下文。

最小支持字段：

- `provider`
- `subject_type`
- `subject_value`

可选字段：

- `message_id`
- `conversation_id`
- `session_id`
- `tenant_hint`
- `metadata`

不同入口示例：

```json
{
  "provider": "lark",
  "subject_type": "open_id",
  "subject_value": "ou_xxx",
  "conversation_id": "oc_xxx",
  "message_id": "om_xxx"
}
```

```json
{
  "provider": "cli",
  "subject_type": "local_user",
  "subject_value": "alice",
  "workspace_id": "workspace_finance_ops",
  "command": "ebfx dashboard pending"
}
```

```json
{
  "provider": "mcp",
  "subject_type": "client_id",
  "subject_value": "claude-desktop",
  "tool_call_id": "toolu_xxx",
  "session_id": "mcp_session_xxx"
}
```

```json
{
  "provider": "workflow",
  "subject_type": "workflow_id",
  "subject_value": "daily_finance_report",
  "step_id": "fetch_pending_deals",
  "operator": "scheduler"
}
```

```json
{
  "provider": "webhook",
  "subject_type": "event_id",
  "subject_value": "evt_xxx",
  "source_system": "github"
}
```

```json
{
  "provider": "iot",
  "subject_type": "device_id",
  "subject_value": "device_store_001",
  "site_id": "store_shanghai_01"
}
```

安全规则：

- 必须限制 `external_context` 的大小。
- 允许的 `provider` 来自 Target Connection / Access Grant 策略。
- AuthAny 接受上下文后，只能原样签入 Token，不解释业务含义。
- `external_context` 不得包含 Secret、refresh token 或长期业务 Token。
- provider 特定字段必须有命名空间或文档说明，方便 Target Resource 安全解析。
- AuthAny 只校验结构、大小和 provider 策略；业务含义由 Target Resource 解释。

---

## 7. Token Exchange 语义

AuthAny 的 exchange 不是“用户 Token 交换”，而是“请求方身份到目标系统访问 Token 的交换”。

AuthAny 必须校验：

- 已签名的 Requester JWT，或等价的 OAuth 2.1 confidential client authentication。
- 适用场景下的 Caller Credential 或 App Secret 证明。
- Application / Agent / Runtime 状态。
- Runtime 所属关系。
- Target Resource 状态。
- Target Connection 状态。
- Access Grant 状态和约束。
- Requester JWT `jti` / `request_id` 防重放。
- 限流策略。
- `external_context` 的结构、大小和 provider 策略。

AuthAny 不校验：

- Target Resource 的业务用户绑定。
- Target Resource 的业务角色。
- Target Resource 的资源权限。
- 分支、dealer、部门、菜单、按钮或数据范围权限。

---

## 8. 验收标准

| ID | 要求 |
|----|------|
| TOK-01 | 所有访问 Token 使用 RS256，并包含 `kid`。 |
| TOK-02 | Requester JWT 与 Target Token 都包含 `iss`、`sub`、`aud`、`exp`、`iat` 和 `jti`。 |
| TOK-03 | Target Resource 只接收 Target Token，不接收 Secret 或裸身份参数。 |
| TOK-04 | `external_context` 可以被签入 Target Token，但不会变成 AuthAny 用户身份。 |
| TOK-05 | 裸 `sender_id`、`agent_id`、`runtime_id` 不能直接通过鉴权。 |
