# AuthAny 深度安全复审（第二轮）

本文档记录 2026-05-18 在上一轮修复完成后，对代码库继续进行深度审查得到的新增问题。

说明：

- 本轮只做审查与记录
- 本文档中的问题尚未修改
- 目标是把“和前一轮同类的残项”集中列出，供后续逐项决策

---

## 1. 审查范围

本轮重点覆盖：

- `server/src/modules/delegation`
- `server/src/modules/target-verification`
- `example/target-service`
- `apps/admin-web`
- `example/demo-web`
- `server/scripts/seed.ts`

审查重点：

- fail-open
- 静默降级
- 基础设施故障伪装成业务拒绝
- 安全敏感配置 fallback
- claim 绑定不完整

---

## 2. 结论摘要

本轮新增发现主要分为 3 类：

1. `target-service` 消费侧校验仍弱于主服务校验
2. delegation 主链路里仍有少量“内部异常伪装成认证失败”的残项
3. 配套应用与脚本仍保留“漏配即进入本地 demo 姿态”的默认配置

其中最值得优先处理的有 3 个：

1. `target-service` 未强绑定 `target_resource`
2. `target token` 在缓存后端异常时仍签发，但不落 token 状态记录
3. `verifyRequesterJwt()` 仍会把内部异常统一伪装成 `invalid_requester_jwt`

---

## 3. 高优先级问题

### H-1 `target-service` 未强绑定 `target_resource`

文件：

- [example/target-service/src/auth.ts](/Users/wrr/work/authany/example/target-service/src/auth.ts:30)
- [example/target-service/src/resource.ts](/Users/wrr/work/authany/example/target-service/src/resource.ts:4)

问题描述：

- `target-service` 只校验：
  - `issuer`
  - `audience`
  - `token_use === "target_access"`
- 但没有校验：
  - `payload.target_resource === env.targetResource`

风险：

- 如果多个 target resource 共用同一 `audience`
- 或目标服务配置与资源注册关系不严
- 则存在跨 target resource 误接受 token 的风险

与上一轮关系：

- 主服务侧 verifier 已补 `target_resource` 强绑定
- 但消费侧 `target-service` 仍残留同类问题

建议是否修改：

- 建议修改
- 优先级高

---

### H-2 `target-service` 未校验 `sub` 与 `agent_id/app_id` 一致性

文件：

- [example/target-service/src/auth.ts](/Users/wrr/work/authany/example/target-service/src/auth.ts:40)

问题描述：

- 当前只要求：
  - 有 `sub`
  - `agent_id` 或 `app_id` 至少存在一个
- 但没有要求：
  - `sub = "agent:xxx"` 时 `agent_id` 必须等于 `xxx`
  - `sub = "app:xxx"` 时 `app_id` 必须等于 `xxx`

风险：

- claims 间一致性校验不完整
- 如果将来上游签发链路出现 bug 或旁路签发错误 claims，消费侧不能第一时间拦住

建议是否修改：

- 建议修改
- 优先级高

---

### H-3 `target token` 在缓存后端异常时仍签发，但不会落状态记录

文件：

- [server/src/modules/delegation/delegation-token-broker.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/delegation-token-broker.service.ts:89)
- [server/src/modules/delegation/target-token-exchange.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/target-token-exchange.service.ts:344)

问题描述：

- 当 Redis 读/写异常时，broker 会返回 `cache = "backend_error"`
- 但 token 仍然会签发给调用方
- 另一方面，`oAuthAccessTokenRecord.create()` 仅在 `cache === "miss"` 时执行
- 所以 `backend_error` 路径下：
  - token 已签发
  - 但没有 access token 状态记录

风险：

- token 签发面与状态面脱节
- 可能影响：
  - token 状态检查
  - 审计完整性
  - 后续吊销/排障
- 在某些验证模式下，目标服务仍可能接受这个 token

建议是否修改：

- 强烈建议修改
- 这是当前最像“半 fail-open”残项的问题之一

---

### H-4 `verifyRequesterJwt()` 仍把内部异常统一伪装成 `invalid_requester_jwt`

文件：

- [server/src/modules/delegation/target-token-exchange.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/target-token-exchange.service.ts:89)

问题描述：

- `tokenSigner.verify()` 外层使用了：
  - `try { ... } catch { throw invalid_requester_jwt }`
- 这意味着 signer 内部异常、密钥加载异常、数据库相关异常都会被伪装成请求方 JWT 无效

风险：

- 与上一轮已修复的 `admin guard / introspection / hosted login` 属于同类问题
- 真实基础设施故障会被误判为客户端认证失败
- 排障与告警都会被误导

建议是否修改：

- 建议修改
- 优先级高

---

## 4. 中优先级问题

### M-1 `target-service` 把基础设施异常统一伪装成 `401 invalid_token`

文件：

- [example/target-service/src/app.ts](/Users/wrr/work/authany/example/target-service/src/app.ts:16)

问题描述：

- 路由里任何非 `TargetAuthError` 的异常
- 最终都会被 `normalizeAuthError()` 转成：
  - `401`
  - `invalid_token`

典型场景：

- JWKS 拉取失败
- 上游不可达
- 网络抖动
- verifier 内部异常

风险：

- 真实基础设施错误被伪装成 token 无效
- 属于明显的静默降级 / 错误分类污染

建议是否修改：

- 建议修改
- 优先级中高

---

### M-2 主服务 `TargetTokenVerifierService` 仍未校验 `sub` 与 identity claim 一致性

文件：

- [server/src/modules/target-verification/target-token-verifier.service.ts](/Users/wrr/work/authany/server/src/modules/target-verification/target-token-verifier.service.ts:29)

问题描述：

- 该 verifier 已经补上了：
  - `target_resource` 强绑定
- 但仍未校验：
  - `sub` 是否与 `agent_id / app_id` 一致

风险：

- 这是 defense-in-depth 问题
- 严重度低于 `target-service` 同类问题
- 但从“claims 一致性”角度仍建议补齐

建议是否修改：

- 建议修改
- 优先级中

---

### M-3 配套应用 env 仍存在“漏配即本地 demo”默认值

文件：

- [apps/admin-web/lib/server/env.ts](/Users/wrr/work/authany/apps/admin-web/lib/server/env.ts:1)
- [example/demo-web/lib/server/env.ts](/Users/wrr/work/authany/example/demo-web/lib/server/env.ts:1)
- [example/target-service/src/env.ts](/Users/wrr/work/authany/example/target-service/src/env.ts:8)

问题描述：

- `admin-web` 默认：
  - `AUTHANY_INTERNAL_URL ?? http://127.0.0.1:3000`
  - `AUTHANY_ADMIN_CLIENT_ID ?? authany-admin-web`
  - `ADMIN_WEB_PUBLIC_URL ?? http://127.0.0.1:3005`
- `demo-web` 默认：
  - 本地 authany 地址
  - `demo-web`
  - `agent_demo`
  - `runtime_demo_cli`
  - `demo-target`
- `target-service` 默认：
  - `issuer = http://127.0.0.1:3000`
  - `audience = demo-target`
  - `targetResource = demo-target`

风险：

- 如果部署时漏配环境变量
- 配套应用不会 fail-fast
- 而是静默进入本地/演示姿态

说明：

- 这类问题更偏部署与环境安全
- 不属于核心鉴权逻辑漏洞
- 但和上一轮主服务配置 fallback 是同类风险

建议是否修改：

- 建议修改
- 优先级中

---

### M-4 `seed.ts` 仍保留运维层 fallback 默认值

文件：

- [server/scripts/seed.ts](/Users/wrr/work/authany/server/scripts/seed.ts:41)
- [server/scripts/seed.ts](/Users/wrr/work/authany/server/scripts/seed.ts:177)

问题描述：

- 仍存在：
  - `TENANT_ID ?? "default"`
  - `AUTHANY_BASE_URL ?? "http://127.0.0.1:3000"`

风险：

- 运行 seed 时如果环境未准备好
- 可能把数据写进默认租户
- 或把 target resource trust 信息写成错误 issuer

说明：

- 这不是线上请求链路漏洞
- 但属于初始化路径里的隐式默认风险

建议是否修改：

- 建议修改
- 优先级中

---

## 5. 低优先级问题

### L-1 失效/停用操作员的 session 不会主动清理

文件：

- [server/src/shared/security/current-user.service.ts](/Users/wrr/work/authany/server/src/shared/security/current-user.service.ts:20)
- [server/src/shared/security/login-session.service.ts](/Users/wrr/work/authany/server/src/shared/security/login-session.service.ts:28)

问题描述：

- 当前逻辑是：
  - session 仍然存在 Redis 中
  - 但读取后如果操作员不是 `active`，则返回 `null`
- 也就是 fail-closed 没问题
- 但不会顺手清理无效 session

风险：

- 主要是会话垃圾与运维卫生问题
- 不是权限绕过

建议是否修改：

- 可改可不改
- 优先级低

---

## 6. 明确不计为漏洞的问题

以下点本轮看起来像“异常路径”，但我没有计入问题清单：

### 6.1 `RateLimitService` 遇到 Redis 故障直接抛异常

文件：

- [server/src/shared/rate-limit/rate-limit.service.ts](/Users/wrr/work/authany/server/src/shared/rate-limit/rate-limit.service.ts:13)

原因：

- 它不是静默放开
- 当前行为更接近 fail-closed
- 影响更多是可用性而不是安全边界失守

### 6.2 `AuditService` 写失败会让主流程失败

文件：

- [server/src/shared/audit/audit.service.ts](/Users/wrr/work/authany/server/src/shared/audit/audit.service.ts:25)

原因：

- 这是强审计策略
- 不是静默吞掉
- 属于可用性/一致性取舍，不是同类漏洞

---

## 7. 建议的处理顺序

如果后续要继续修改，我建议按这个顺序：

1. `target-service` 补齐 `target_resource` 强绑定与 subject/identity 一致性校验
2. `target-service` 不再把内部异常统一伪装成 `invalid_token`
3. `target token` 在 `backend_error` 路径下的状态记录一致性
4. `verifyRequesterJwt()` 内部异常分类收紧
5. 配套应用 env 改为显式配置 / fail-fast
6. `seed.ts` 去掉默认租户和默认 issuer fallback
7. 低优先级的 session 垃圾清理

---

## 8. 当前状态

当前文档仅记录问题，不代表已经批准修改。

后续如果你决定继续收这些残项，建议直接基于本文档逐项处理，并在每一项下补：

- 修改文件
- 测试结果
- 真实验证结果
- 是否涉及数据迁移或环境变量变更
