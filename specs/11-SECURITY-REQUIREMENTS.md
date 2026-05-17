# 11 - 安全要求

> 本文档定义 AuthAny 作为 Application / Agent / Runtime 授权控制面的安全要求。

---

## 1. 责任边界

AuthAny 负责保护：

- Application 身份。
- Agent 身份。
- Runtime 所属关系。
- Caller Credential 和 App Secret。
- Target Connection 与 Access Grant 校验。
- Token 签名、密钥轮换、防重放、限流和审计。
- 签发 Target Token 前的 Requester JWT 校验。

Target Resource 负责保护：

- 业务用户映射。
- 业务资源授权。
- 本地风控。
- 资源访问本地审计。

---

## 2. 签名与密钥

要求：

- 访问 Token 只能使用 RS256。
- 每个 JWT 都必须包含 `kid`。
- 必须提供 JWKS endpoint。
- 历史公钥必须保留到相关 Token 全部过期。
- 私钥不能进入源码。
- 生产环境签名密钥不能与测试环境复用。

---

## 3. Secret 处理

敏感值：

- App Secret。
- Caller Credential。
- 启用 refresh 时的 refresh token。
- 签名私钥。

规则：

- App ID、Agent ID 和 Runtime ID 是标识符，不是 Secret。
- App Secret 和 Caller Credential 必须像银行卡密码一样保护。
- App Secret 和 Caller Credential 只能存在于 confidential server-side application、可信 Runtime 或受管密钥系统中。
- 不得长期明文存储。
- 校验优先使用 hash。
- 只有产品需要查看明文时，才允许加密保存可恢复值。
- 所有日志和审计 payload 必须脱敏。
- 查看、轮换、撤销 Secret 的操作必须审计。
- Secret 不能出现在浏览器、URL、聊天消息、CLI stdout、Target Resource 请求、localStorage、sessionStorage 或源码中。

---

## 4. Token Exchange 安全

签发或复用 Token 前，AuthAny 必须校验：

- Requester JWT 签名、issuer、audience、过期时间、subject 和防重放键。
- 适用场景下的 Caller Credential 或 App Secret 证明。
- Application / Agent / Runtime 状态。
- Runtime 所属关系。
- Target Resource 状态。
- Target Connection 状态。
- Access Grant 状态和过期时间。
- external context provider 和大小策略。
- 防重放。
- 限流。

缓存命中不能跳过这些校验。

资源服务不能接受 App Secret、Caller Credential、裸 sender ID、裸 Agent ID 或裸 Runtime ID 作为授权。资源访问必须使用 Bearer Target Token。

---

## 5. External Context 安全

External context 必须：

- 默认可选，除非连接策略要求。
- 有大小限制。
- 受 provider allowlist 限制。
- 被接受后签入 Token。
- 不包含 Secret 或长期业务 Token。

AuthAny 不能把 external context 转换成业务用户身份。

---

## 6. 撤销

可撤销对象：

- App Secret。
- Caller Credential。
- Access Grant。
- Target Connection。
- 启用撤销列表时的 issued token JTI。

规则：

- 撤销会立即阻断新的签发。
- 已签发的短期 Token 默认自然过期，除非 Target Resource 启用 introspection / revocation check。
- 撤销是记录行为，不是物理删除。

---

## 7. 限流与防重放

限流维度：

- IP。
- app id。
- agent id。
- runtime id。
- target resource。

防重放：

- Token 请求必须包含 Requester JWT `jti`、request ID 或等价防重放键。
- 有效防重放窗口内重复使用同一个键必须被拒绝。
- 防重放拒绝必须审计。

---

## 8. 审计

必须审计：

- Application 创建、更新、删除和 Secret 生命周期。
- Agent 创建、更新、删除。
- Runtime 生命周期。
- Caller Credential 生命周期。
- Target Resource 生命周期。
- Target Connection 生命周期。
- Access Grant 生命周期。
- Token 签发、拒绝、缓存命中、防重放拒绝。
- 密钥轮换。

审计不能包含原始 Secret。

---

## 9. 验收标准

| ID | 要求 |
|----|------|
| SEC-01 | 所有 access token 使用 RS256 和 `kid`。 |
| SEC-02 | Secret 和 Credential 不以长期明文存储。 |
| SEC-03 | 撤销会阻断新的签发。 |
| SEC-04 | 防重放会拒绝重复请求。 |
| SEC-05 | Broker 缓存命中仍执行完整授权重新校验。 |
| SEC-06 | External context 被签名，但不会被解释为 AuthAny 用户身份。 |
| SEC-07 | Resource server 只接收 Target Token；Secret 保留在服务端，永不到达 Target Resource。 |
