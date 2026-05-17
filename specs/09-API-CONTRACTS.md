# 09 - API 契约

> 本文档定义 AuthAny 新控制面模型的 API 契约。

---

## 1. 通用响应

成功响应：

```json
{
  "data": {},
  "request_id": "uuid"
}
```

错误响应：

```json
{
  "code": "access_not_allowed",
  "message": "Access grant is not available for this connection.",
  "request_id": "uuid"
}
```

规则：

- `request_id` 必须贯穿日志、审计和错误响应。
- 错误 `code` 必须稳定，`message` 可以本地化。
- 错误响应不得包含 Secret、Credential 或 Token 明文。

---

## 2. Requester Token

Runtime 或 Application 后端先使用服务端高敏凭证向 AuthAny 换取短期 Requester JWT。

Endpoint：

```http
POST /api/requester-token
Authorization: Bearer <caller_credential_or_app_secret>
```

Agent / Runtime Body：

```json
{
  "grant_type": "urn:authany:params:oauth:grant-type:requester-token",
  "principal_type": "agent",
  "agent_id": "agt_live_xxx",
  "runtime_id": "rt_openclaw_lark_prod",
  "target_resource": "ebfx",
  "external_context": {
    "provider": "lark",
    "subject_type": "open_id",
    "subject_value": "ou_xxx"
  }
}
```

Application Body：

```json
{
  "grant_type": "urn:authany:params:oauth:grant-type:requester-token",
  "principal_type": "application",
  "app_id": "app_live_xxx",
  "target_resource": "ebfx"
}
```

Response：

```json
{
  "requester_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 300
}
```

规则：

- Caller Credential 和 App Secret 只用于调用 `/api/requester-token`。
- `/api/requester-token` 返回的 Requester JWT 必须包含 `token_use=requester_assertion`。
- Requester JWT 生命周期应很短，V1 默认 5 分钟。
- Target Resource 不接收 Caller Credential、App Secret 或 Requester JWT。

---

## 3. Agent / Runtime Target Token

Endpoint：

```http
POST /api/target-token
Authorization: Bearer <requester_jwt>
```

Body：

```json
{
  "grant_type": "urn:authany:params:oauth:grant-type:target-access",
  "target_resource": "ebfx"
}
```

可信请求方身份来自 Requester JWT claims，而不是请求体中的裸身份字段。请求体可以重复 `target_resource` 用于路由，但如果 Requester JWT 中也有该字段，AuthAny 必须比较两者是否一致。

响应：

```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 900,
  "issued_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "cache": "hit",
  "jti": "uuid"
}
```

---

## 4. Application Target Token

Endpoint：

```http
POST /api/target-token
Authorization: Bearer <requester_jwt>
```

Body：

```json
{
  "grant_type": "client_credentials",
  "target_resource": "ebfx"
}
```

响应结构与 Agent / Runtime Target Token 相同。

规则：

- `app_id` 是公开标识，可以出现在 JWT claims、日志和配置中。
- `app_secret` 是服务端 Secret，不能发送给浏览器、用户、聊天平台、Target Resource 或日志。
- 如果不用 Requester JWT，而直接使用 OAuth 2.1 client authentication，只能由 confidential server-side client 发起。
- Public client 不能使用 App Secret。

---

## 5. Admin APIs

P0 Admin APIs：

- `GET /api/v1/admin/applications`
- `POST /api/v1/admin/applications`
- `GET /api/v1/admin/applications/:id`
- `PATCH /api/v1/admin/applications/:id`
- `POST /api/v1/admin/applications/:id/delete`
- `POST /api/v1/admin/applications/:id/secrets/rotate`
- `POST /api/v1/admin/applications/:id/secrets/:secretId/reveal`
- `GET /api/v1/admin/agents`
- `POST /api/v1/admin/agents`
- `GET /api/v1/admin/agents/:id`
- `PATCH /api/v1/admin/agents/:id`
- `POST /api/v1/admin/agents/:id/delete`
- `GET /api/v1/admin/runtimes`
- `POST /api/v1/admin/runtimes`
- `PATCH /api/v1/admin/runtimes/:id`
- `GET /api/v1/admin/agents/:id/credentials`
- `POST /api/v1/admin/agents/:id/credentials`
- `POST /api/v1/admin/credentials/:id/revoke`
- `GET /api/v1/admin/target-resources`
- `POST /api/v1/admin/target-resources`
- `PATCH /api/v1/admin/target-resources/:id`
- `GET /api/v1/admin/target-connections`
- `POST /api/v1/admin/target-connections`
- `PATCH /api/v1/admin/target-connections/:id`
- `GET /api/v1/admin/access-grants`
- `POST /api/v1/admin/access-grants`
- `PATCH /api/v1/admin/access-grants/:id`
- `GET /api/v1/admin/keys`
- `POST /api/v1/admin/keys`
- `POST /api/v1/admin/keys/:id/activate`
- `POST /api/v1/admin/keys/:id/retire`
- `GET /api/v1/admin/audit-events`

移除的 Admin APIs：

- `/api/v1/admin/bindings`
- 作为业务用户模块的 `/api/v1/admin/users`

Operator account APIs 可以作为 Admin 登录能力单独存在。

---

## 6. 创建 Target Connection

```json
{
  "principal_type": "agent",
  "principal_id": "agt_live_xxx",
  "runtime_id": "rt_openclaw_lark_prod",
  "target_resource": "ebfx",
  "external_context_mode": "optional",
  "allowed_context_providers": ["lark"],
  "max_token_ttl_seconds": 900
}
```

规则：

- `principal_type` 只能是 `application`、`agent` 或 `runtime`。
- `principal_id` 使用稳定业务 ID，不能使用显示名称。
- `runtime_id` 只用于将 Agent connection 约束到某个 Runtime。
- Target Connection 不能携带 Target Resource 用户 ID。

---

## 7. 创建 Access Grant

```json
{
  "connection_id": "conn_live_xxx",
  "grant_type": "target_access",
  "effect": "allow",
  "constraints": {
    "runtime_mode": "stateless",
    "external_context_required": false
  },
  "expires_at": null
}
```

规则：

- V1 只支持 allow grant。
- 业务资源 scope 不存储在 AuthAny。
- Grant 必须绑定有效 Target Connection。

---

## 8. 错误码

| HTTP | Code | 含义 |
|------|------|------|
| 400 | `unsupported_grant_type` | 不支持该 grant type。 |
| 400 | `invalid_external_context` | External context 结构、大小或 provider 无效。 |
| 401 | `invalid_requester_jwt` | Requester JWT 缺失、无效、过期、重放或受众错误。 |
| 401 | `invalid_caller_credential` | Caller Credential 缺失、无效、过期或已撤销。 |
| 401 | `invalid_app_secret` | App Secret 缺失、无效、过期或已撤销。 |
| 403 | `invalid_application` | Application 非活跃或已删除。 |
| 403 | `invalid_agent` | Agent 非活跃或已删除。 |
| 403 | `invalid_runtime` | Runtime 非活跃，或不属于该 Agent。 |
| 403 | `invalid_target_resource` | Target Resource 非活跃或未知。 |
| 403 | `connection_not_allowed` | Target Connection 缺失或非活跃。 |
| 403 | `access_not_allowed` | Access Grant 缺失、非活跃、已过期或约束失败。 |
| 409 | `request_replayed` | Request ID 已被使用。 |

AuthAny Core 不存在 `binding_required` 错误。

---

## 9. 验收标准

| ID | 要求 |
|----|------|
| API-01 | Target Token API 只信任 Requester JWT 或等价 OAuth 2.1 客户端认证。 |
| API-02 | 请求体中的裸身份字段不能覆盖已签名 claims。 |
| API-03 | Admin API 覆盖 P0 控制面实体。 |
| API-04 | 错误码稳定且不泄露敏感信息。 |
| API-05 | 移除业务用户 Binding API。 |
| API-06 | `/api/requester-token` 使用 Caller Credential / App Secret 生成短期 Requester JWT，`/api/target-token` 不再接收裸身份字段。 |
