# 17 - Token Broker

> AuthAny Token Broker 可以复用短期 Target Token，但缓存命中不能绕过授权。

---

## 1. Broker 范围

Broker 支持：

- Agent / Runtime Target Token。
- Application Target Token。
- `cache=hit|miss` 响应。
- Redis-backed cache。
- Redis 故障时安全降级。

Broker 不缓存：

- 长期 Target Resource 用户 Token。
- 业务用户绑定结果。
- Target Resource 资源权限。

---

## 2. 缓存查询前重新校验

每次请求必须重新校验：

- Requester JWT，或等价 OAuth 2.1 confidential client authentication。
- 适用场景下的 Caller Credential 或 App Secret 绑定。
- Application / Agent / Runtime 状态。
- Target Resource 状态。
- Target Connection 状态。
- Access Grant 状态和约束。
- external context 策略。
- 防重放。
- 限流。

只有完成这些校验后，AuthAny 才能返回缓存 Token。

---

## 3. Cache Key 输入

Cache key 必须包含：

- tenant id。
- principal type。
- principal id。
- 存在时的 runtime id。
- credential 或 secret id。
- target resource id。
- audience。
- connection id。
- grant id。
- 包含 external context 时的 context digest。
- 可用时的 token TTL policy version。

不能只用 `agent_id + target_resource` 作为 cache key。

---

## 4. Cache Value

```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "issued_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "expires_at": 1778900000000,
  "jti": "uuid",
  "version": 1
}
```

---

## 5. 失效边界

以下情况不能复用缓存：

- Credential 或 Secret 被撤销 / 过期。
- Principal 非活跃。
- Runtime 非活跃。
- Target 非活跃。
- Connection 非活跃。
- Grant 非活跃 / 撤销 / 过期。
- External context 策略变化。
- 签名策略变化。

实现可以不做显式缓存清理，只要每次查询前都重新校验。

---

## 6. 验收标准

| ID | 要求 |
|----|------|
| BROKER-01 | 第一次有效请求返回 `cache=miss`。 |
| BROKER-02 | 重复有效请求在 Token 可复用时返回 `cache=hit`。 |
| BROKER-03 | 缓存命中仍执行完整授权重新校验。 |
| BROKER-04 | 撤销 Credential、停用 Connection 或 Grant 过期会阻断缓存 Token 复用。 |
| BROKER-05 | Redis 读写失败不会绕过授权。 |
