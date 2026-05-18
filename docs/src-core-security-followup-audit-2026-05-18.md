# AuthAny `server/src/` 核心服务安全复审残项

本文档只记录 `server/src/` 目录中的安全残项。

范围说明：

- 仅包含 `/Users/wrr/work/authany/server/src`
- 不包含：
  - `apps/admin-web`
  - `example/demo-web`
  - `example/target-service`
  - `server/scripts`

审查目标：

- 在主服务代码中继续查找与上一轮同类的问题
- 重点关注：
  - fail-open
  - 静默降级
  - 错误分类污染
  - claims 绑定不完整
  - 状态面与签发面不一致

本文档最初用于记录问题；截至 `2026-05-18` 本文列出的 3 个残项已全部修复并完成测试验证。

---

## 1. 结论摘要

当前状态：

- 高优先级问题 `0` 个
- 中优先级问题 `0` 个

主要集中在：

- `server/src/modules/delegation`
- `server/src/modules/target-verification`

---

## 2. 高优先级问题

### H-1 `verifyRequesterJwt()` 曾把内部异常统一伪装成 `invalid_requester_jwt` `已修复`

文件：

- [server/src/modules/delegation/target-token-exchange.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/target-token-exchange.service.ts:89)

问题描述：

- 当前实现中：
  - `tokenSigner.verify(token, this.config.baseUrl)` 被包在统一 `try/catch`
  - 任意异常都会被改写成：
    - `401`
    - `invalid_requester_jwt`

这意味着以下异常也会被伪装成请求方 JWT 无效：

- signer 内部异常
- 签名密钥加载异常
- 数据库相关异常
- 其他内部运行时异常

风险：

- 真实基础设施故障被污染成客户端认证失败
- 排障方向错误
- 告警与审计语义不真实

与已修问题的关系：

- 这和上一轮已经收掉的：
  - `admin-auth.guard`
  - `oidc introspection`
  - `hosted login`
- 属于同一类残项

修复结果：

- 仅明确的 JWT 无效类错误会映射为 `401 invalid_requester_jwt`
- 非 JWT 内部异常会继续上抛，保留真实 `5xx` 语义

验证：

- `server/test/delegation.service.test.ts`
- 新增用例覆盖 signer 内部异常不再被伪装成认证失败

---

### H-2 `target token` 在缓存后端异常时仍签发，但不会落 token 状态记录 `已修复`

文件：

- [server/src/modules/delegation/delegation-token-broker.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/delegation-token-broker.service.ts:89)
- [server/src/modules/delegation/target-token-exchange.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/target-token-exchange.service.ts:344)

问题描述：

- broker 在 Redis 读/写异常时会返回：
  - `cache = "backend_error"`
- 但 token 仍然会签发返回
- 而 `persistAndAudit()` 当前只有在：
  - `cache === "miss"`
- 时才写入 `oAuthAccessTokenRecord`

结果：

- token 已签发
- 但 access token 状态记录缺失

风险：

- 签发面与状态面不一致
- 可能影响：
  - token 状态检查
  - 审计完整性
  - 吊销/排障能力

为什么这是高优先级：

- 它不是简单的日志问题
- 而是“系统承认这个 token 已发出”，但“状态系统并不知道它存在”
- 这属于认证系统一致性问题

修复结果：

- 只要 token 已签发且不是缓存命中，就会写入 `oAuthAccessTokenRecord`
- `cache = "backend_error"` 不再出现“token 已发出但状态面无记录”的不一致

验证：

- `server/test/delegation.service.test.ts`
- 新增用例覆盖 Redis 读异常下仍签发 token 且强制落状态记录

---

## 3. 中优先级问题

### M-1 主服务 `TargetTokenVerifierService` 曾未校验 `sub` 与 `agent_id/app_id` 一致性 `已修复`

文件：

- [server/src/modules/target-verification/target-token-verifier.service.ts](/Users/wrr/work/authany/server/src/modules/target-verification/target-token-verifier.service.ts:29)

问题描述：

- 当前 verifier 已经补上：
  - `payload.target_resource === targetResourceCode`
- 但仍只检查：
  - `sub` 存在
  - `agent_id` 或 `app_id` 至少有一个

尚未检查：

- `sub = "agent:xxx"` 时 `agent_id === "xxx"`
- `sub = "app:xxx"` 时 `app_id === "xxx"`

风险：

- claims 一致性校验不完整
- 如果将来签发链路出现 bug、脏数据或旁路错误 token，这里不能第一时间拦住

严重度说明：

- 相比前两个问题，它更偏 defense-in-depth
- 不是当前最危险的残项
- 但从认证严谨性上仍建议补齐

修复结果：

- `sub = agent:xxx` 时强制要求 `agent_id === xxx`
- `sub = app:xxx` 时强制要求 `app_id === xxx`

验证：

- `server/test/key-rotation-and-target.test.ts`
- 新增 agent/app subject 与 identity 不一致的拒绝用例

---

## 4. 当前未计入问题的点

以下内容我在 `server/src/` 中看过，但没有计入本轮残项：

### 4.1 `RateLimitService` 遇到 Redis 故障直接失败

文件：

- [server/src/shared/rate-limit/rate-limit.service.ts](/Users/wrr/work/authany/server/src/shared/rate-limit/rate-limit.service.ts:13)

原因：

- 当前行为更接近 fail-closed
- 会影响可用性，但不是静默放开

### 4.2 `AuditService` 失败会让主流程失败

文件：

- [server/src/shared/audit/audit.service.ts](/Users/wrr/work/authany/server/src/shared/audit/audit.service.ts:25)

原因：

- 这是强一致审计策略
- 不是静默吞掉，不属于同类问题

### 4.3 `CurrentOperatorService` 对无效 session 直接返回 `null`

文件：

- [server/src/shared/security/current-user.service.ts](/Users/wrr/work/authany/server/src/shared/security/current-user.service.ts:20)

原因：

- 这是正确的 fail-closed
- 虽然不会主动清理 session，但不构成权限绕过

---

## 5. 建议处理顺序

本轮已按以下顺序完成：

1. `verifyRequesterJwt()` 错误分类收紧
2. `target token` 的签发/状态一致性修复
3. `TargetTokenVerifierService` 的 claims 一致性校验

---

## 6. 当前状态

本文件当前可视为 `server/src/` 核心服务这一轮残项的修复完成记录。

已执行验证：

- `pnpm test -- --runInBand`
- `pnpm build`
- `pnpm admin:typecheck`
