# 13 - 验收标准

> 本文档定义简化后的 AuthAny 控制面架构 P0 验收标准。

---

## 1. 产品验收

| ID | 要求 |
|----|------|
| P-01 | AuthAny 可以为 Application 签发 Target Resource Token。 |
| P-02 | AuthAny 可以为 Agent / Runtime 签发 Target Resource Token。 |
| P-03 | AuthAny 在 Token 签发前校验 Target Connection 和 Access Grant。 |
| P-04 | AuthAny 可以签名透传可选 `external_context`，但不拥有业务用户绑定。 |
| P-05 | Target Resource 可以校验 Token，并保留本地权限决策。 |
| P-06 | Admin UI 可以管理全部 P0 控制面实体。 |
| P-07 | AuthAny 支持 Requester JWT，或 OAuth 2.1 confidential client authentication，用于 Token Exchange。 |

---

## 2. Application

| ID | 要求 |
|----|------|
| APP-01 | App ID 由系统生成且全局唯一。 |
| APP-02 | App Secret 由系统生成，可 hash 校验；如需查看则必须加密保存；支持轮换和撤销。 |
| APP-03 | 非活跃或已删除 Application 不能获取 Target Token。 |
| APP-04 | Application Token 的 `sub` 为 `app:<app_id>`。 |
| APP-05 | App Secret 只允许服务端使用，不能到达浏览器、聊天平台、Target Resource 或普通日志。 |

---

## 3. Agent / Runtime

| ID | 要求 |
|----|------|
| AG-01 | Agent ID 由系统生成且全局唯一。 |
| AG-02 | Caller Credential 可以认证 Agent / Runtime 调用。 |
| AG-03 | Runtime 所属关系必须校验。 |
| AG-04 | 非活跃 Agent、Runtime 或 Caller Credential 会阻断 Token 签发。 |
| AG-05 | Agent Token 的 `sub` 为 `agent:<agent_id>`。 |
| AG-06 | `stateless` Runtime 不能使用 refresh 能力。 |
| AG-07 | Agent / Runtime 请求使用已签名 Requester JWT；裸 sender ID / agent ID / runtime ID 不可信。 |

---

## 4. Target Connection / Grant

| ID | 要求 |
|----|------|
| CONN-01 | 缺失或非活跃 Target Connection 会阻断 Token 签发。 |
| CONN-02 | 缺失、非活跃、过期或已撤销 Access Grant 会阻断 Token 签发。 |
| CONN-03 | External context provider allowlist 必须生效。 |
| CONN-04 | Token TTL 不能超过 connection 或 grant 限制。 |

---

## 5. Target Resource

| ID | 要求 |
|----|------|
| TS-01 | Target Resource 可以使用 issuer、audience 和 JWKS 元数据。 |
| TS-02 | Target Resource 会拒绝无效 issuer、audience、signature、expiry 和 subject。 |
| TS-03 | Target Resource 可以区分 `app:*` 和 `agent:*`。 |
| TS-04 | Target Resource 可以接收已签名 `external_context`。 |
| TS-05 | Target Resource 在本地处理业务用户映射。 |
| TS-06 | Target Resource 拒绝 App Secret、Caller Credential 和裸身份参数作为资源授权。 |

---

## 6. 安全 / 运维

| ID | 要求 |
|----|------|
| SEC-01 | RS256 签名和 JWKS 发布可用。 |
| SEC-02 | 密钥轮换期间，当前签发密钥和历史验签密钥同时可用。 |
| SEC-03 | 防重放可以拒绝重复 request ID。 |
| SEC-04 | Token Broker 缓存不会绕过 Credential、实体状态、Connection、Grant、Target、Replay 或 Context 校验。 |
| SEC-05 | 审计记录覆盖成功、拒绝、缓存命中、Credential 生命周期和 Grant 生命周期事件。 |
| SEC-06 | AuthAny Core 不暴露业务用户 Binding endpoint。 |
| SEC-07 | Requester JWT 和 Target Token 都包含 `iss`、`sub`、`aud`、`exp`、`iat` 和 `jti`。 |
