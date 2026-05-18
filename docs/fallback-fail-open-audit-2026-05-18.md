# AuthAny 回退默认路径 / 静默降级 / Fail-Open 专项审查

> 2026-05-18 修复收口状态：
>
> - 本文档列出的 P1 / P2 项已完成代码修复
> - 已完成构建验证：`pnpm build`
> - 已完成后端测试验证：`pnpm test -- --runInBand`
> - 已完成 Admin Web 类型验证：`pnpm admin:typecheck`
> - 已完成真实数据收紧：
>   - 关闭重复 active `audience`：`1` 组
>   - 补齐长期有效 grant 过期时间：`3` 条
>   - 收紧空 provider 的 active target connection：`1` 条
> - 已完成运行态检查：`GET /ready -> 200 {"status":"ready","checks":{"db":true,"redis":true}}`

---

## 修复总览

本轮不是只做“代码看起来更安全”，而是同时完成了 4 层收口：

1. 运行时逻辑改成 fail-close
2. 管理后台表单契约与后端显式对齐
3. 单元测试补齐，防止未来回归
4. 历史数据库危险数据与 schema 默认值一并清理

新增/关键修复文件：

- [server/src/modules/delegation/caller-credential.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/caller-credential.service.ts)
- [server/src/modules/target-verification/target-token-verifier.service.ts](/Users/wrr/work/authany/server/src/modules/target-verification/target-token-verifier.service.ts)
- [server/src/shared/health/health.controller.ts](/Users/wrr/work/authany/server/src/shared/health/health.controller.ts)
- [server/src/modules/admin/access-grants/access-grants.service.ts](/Users/wrr/work/authany/server/src/modules/admin/access-grants/access-grants.service.ts)
- [server/src/modules/admin/target-connections/target-connections.service.ts](/Users/wrr/work/authany/server/src/modules/admin/target-connections/target-connections.service.ts)
- [server/src/modules/admin/target-resources/target-resources.service.ts](/Users/wrr/work/authany/server/src/modules/admin/target-resources/target-resources.service.ts)
- [server/src/modules/delegation/delegation-token-broker.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/delegation-token-broker.service.ts)
- [server/src/modules/delegation/replay-protection.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/replay-protection.service.ts)
- [server/src/modules/oidc/oidc.service.ts](/Users/wrr/work/authany/server/src/modules/oidc/oidc.service.ts)
- [server/src/shared/admin/admin-auth.guard.ts](/Users/wrr/work/authany/server/src/shared/admin/admin-auth.guard.ts)
- [server/src/shared/http/http-exception.filter.ts](/Users/wrr/work/authany/server/src/shared/http/http-exception.filter.ts)
- [server/src/shared/http/request-context.ts](/Users/wrr/work/authany/server/src/shared/http/request-context.ts)
- [server/src/shared/config/app-config.service.ts](/Users/wrr/work/authany/server/src/shared/config/app-config.service.ts)
- [server/prisma/schema.prisma](/Users/wrr/work/authany/server/prisma/schema.prisma)
- [server/scripts/security-tighten-data.ts](/Users/wrr/work/authany/server/scripts/security-tighten-data.ts)
- [server/scripts/seed.ts](/Users/wrr/work/authany/server/scripts/seed.ts)
- [apps/admin-web/features/admin-v2/resource-definitions.tsx](/Users/wrr/work/authany/apps/admin-web/features/admin-v2/resource-definitions.tsx)
- [apps/admin-web/features/admin-v2/resource-display.tsx](/Users/wrr/work/authany/apps/admin-web/features/admin-v2/resource-display.tsx)

---

本文档记录 2026-05-18 对 `server/src/` 的专项静态审查结果。

审查重点不是一般代码风格，而是以下高风险逻辑：

- 回退默认路径
- 静默降级
- fail-open
- 隐式兜底默认值
- 把真实基础设施故障伪装成业务拒绝

本文档的目标是：

1. 在正式修改前，把风险点集中收口
2. 区分“已确认的真实行为”和“修改前还需要再次运行态确认的行为”
3. 作为后续逐项修复时的执行清单

---

## 1. 审查范围

本次覆盖：

- `server/src/shared`
- `server/src/modules/auth`
- `server/src/modules/oidc`
- `server/src/modules/admin`
- `server/src/modules/delegation`
- `server/src/modules/target-verification`

审查方式：

- 全局模式检索
- 逐文件静态阅读
- 并行子审查汇总

未做的事：

- 未对所有问题逐项做完整动态攻击复现
- 未对每一条都做数据库状态验证
- 未开始批量修复

---

## 2. 总结结论

当前代码里真正危险的，不只是显性的权限绕过，更突出的是两类问题：

1. 安全敏感配置或业务安全边界存在宽松默认值  
   结果是“漏配 == 放开”或“漏配 == 继续跑”

2. 真实依赖故障被静默伪装成认证失败、token 无效、token inactive、缓存 miss、请求重放  
   结果是事故定位极难，监控与审计也会被误导

本轮最值得优先修复的点有 5 个：

1. runtime 绑定 credential 在缺失 `runtimeId` 时被放宽
2. target token 验证未强绑定 `target_resource`
3. `/ready` 依赖异常仍返回 200
4. `access_grants`、`target_connections` 存在默认放行配置
5. 多处把基础设施故障伪装成认证失败或 token inactive

---

## 3. 高风险问题（P1）

### P1-1 Runtime 绑定的 Caller Credential 可因缺失 `runtimeId` 被放宽

文件：

- [server/src/modules/delegation/caller-credential.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/caller-credential.service.ts)
- [server/src/modules/delegation/requester-token.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/requester-token.service.ts)
- [server/src/modules/delegation/target-token-exchange.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/target-token-exchange.service.ts)
- [server/src/modules/delegation/delegation-policy.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/delegation-policy.service.ts)

问题描述：

- agent 请求如果不带 `runtimeId`
- `authenticateAgentSecret()` 中 `runtimeRegistrationId: runtime?.id ?? undefined`
- Prisma 会去掉 runtime 过滤
- 有机会命中本来绑定到某个 runtime 的 credential
- 后续 requester token 因为没有 runtime 信息，继续走更宽的 agent 级匹配

风险：

- runtime 隔离边界被削弱
- 泄露的 runtime secret 更容易被脱离 runtime 环境复用
- 原本应限制在单 runtime 内的能力可能被扩大到 agent 范围

建议：

- 当 credential 记录绑定了 `runtimeRegistrationId` 时，必须强制请求携带并匹配 `runtimeId`
- 当请求未提供 `runtimeId` 时，只允许命中 `runtimeRegistrationId = null` 的全局 credential
- exchange 阶段再次复核 runtime 与 credential 绑定关系

状态：

- 已修复
- 已将 runtime 缺失时的查询语义从“放宽过滤”改为“只允许命中 runtimeRegistrationId = null 的 credential”
- 已有测试覆盖

---

### P1-2 Target Token 验证没有强绑定 `target_resource`

文件：

- [server/src/modules/target-verification/target-token-verifier.service.ts](/Users/wrr/work/authany/server/src/modules/target-verification/target-token-verifier.service.ts)
- [server/prisma/schema.prisma](/Users/wrr/work/authany/server/prisma/schema.prisma)

问题描述：

- 验证逻辑主要按目标资源的 `audience` 验 JWT
- 但没有显式要求 `payload.target_resource === 当前 targetResourceCode`
- 同时数据模型没有强制 `audience` 唯一

风险：

- 如果两个 target resource 共用同一个 audience
- 为 A 签发的 token 可能被 B 接受
- 形成跨目标资源误用

建议：

- 验证时强制校验 `target_resource` claim
- 如果设计上 audience 应一对一，数据库或管理接口也要强制该约束

状态：

- 已修复
- 验证侧已强制校验 `payload.target_resource === targetResourceCode`
- active target resource 的 `audience` 创建时已限制唯一
- 已有测试覆盖 target mismatch 拒绝路径

---

### P1-3 `/ready` 对关键依赖异常仍返回 HTTP 200

文件：

- [server/src/shared/health/health.controller.ts](/Users/wrr/work/authany/server/src/shared/health/health.controller.ts)

问题描述：

- DB / Redis 异常时，body 会写成 `degraded`
- 但 HTTP 状态仍然是 `200`

风险：

- K8s / LB / readiness probe 通常只看状态码
- 实例会继续接流量
- 但认证限流、重放防护、缓存等安全关键路径可能已经部分失效

建议：

- 对关键依赖异常返回 `503`
- 如果某些依赖只是“部分能力必须”，也至少拆分 readiness 级别

状态：

- 已修复
- `/ready` 现在在关键依赖失败时返回 `503`
- 正常运行态已实测返回 `200 {"status":"ready","checks":{"db":true,"redis":true}}`

---

### P1-4 Access Grant 创建时存在默认放行

文件：

- [server/src/modules/admin/access-grants/access-grants.service.ts](/Users/wrr/work/authany/server/src/modules/admin/access-grants/access-grants.service.ts)

问题描述：

- `grant_type` 默认 `target_access`
- `effect` 默认 `allow`
- `constraints` 默认 `{}` 
- `expires_at` 默认 `null`

风险：

- 漏填配置时，不是“创建失败”
- 而是“创建出长期、无约束、有效的授权”

建议：

- `effect`、关键约束、有效期改成显式必填
- 最少也要默认短 TTL，而不是永久有效
- 审计记录应标记是否使用了默认值

状态：

- 已修复
- 创建路径不再默认补 `grant_type / effect / constraints / expires_at`
- `AccessGrant.expiresAt` 已在 schema 中改为必填
- 历史 `active + expires_at is null` 数据已清理完毕

---

### P1-5 Target Connection 创建时存在默认放行

文件：

- [server/src/modules/admin/target-connections/target-connections.service.ts](/Users/wrr/work/authany/server/src/modules/admin/target-connections/target-connections.service.ts)

问题描述：

- `external_context_mode` 默认 `optional`
- `allowed_context_providers` 缺省归一成空数组

风险：

- 如果消费侧把空 provider 列表理解成“不限制 provider”
- 那么“未配置”就等于“允许任意来源 external context”

建议：

- 默认改成 `forbidden`
- 或者至少要求显式选择模式
- 若选择 `optional/required`，必须同时显式填写 provider allowlist

状态：

- 已修复
- 创建路径不再默认补 `external_context_mode`
- `optional / required` 模式下必须显式提供 provider allowlist
- 历史 `required + []` 数据已收紧为 `forbidden`
- `schema.prisma` 已移除 `@default("optional")`

---

### P1-6 安全敏感运行配置存在宽松默认值

文件：

- [server/src/shared/config/app-config.service.ts](/Users/wrr/work/authany/server/src/shared/config/app-config.service.ts)

问题描述：

- `NODE_ENV` 默认 `development`
- `AUTHANY_BASE_URL` 默认 `http://127.0.0.1:3000`
- `REDIS_URL` 默认本地
- `TENANT_ID` 默认 `default`
- 非 `production` 自动加本地 demo CORS/CSP origin
- `secureCookies` 也完全依赖 `NODE_ENV === "production"`

风险：

- 环境变量漏配时系统继续运行
- 但会悄悄退回开发姿态
- 这类问题最难排查，因为不是 fail-fast，而是“配置错了但服务还能跑”

建议：

- 对安全敏感配置改成缺失即启动失败
- 至少在非 `test` 环境下必须显式配置
- 本地 demo origins 只在明确 local-dev 开关下启用

状态：

- 已修复
- `NODE_ENV / AUTHANY_BASE_URL / REDIS_URL / TENANT_ID` 改为缺失即失败
- 本地 demo CORS/CSP 默认值已移除

---

### P1-7 Hosted Login 把真实异常统一伪装成“用户名密码错误”

文件：

- [server/src/modules/auth/hosted-auth.controller.ts](/Users/wrr/work/authany/server/src/modules/auth/hosted-auth.controller.ts)

问题描述：

- `POST /login` 对 `authService.login()` 用裸 `catch {}`
- 所有异常都回 `401`
- 页面提示统一成“用户名或密码错误”

风险：

- 限流
- 账户锁定
- Redis/DB 故障
- 审计写入失败

以上都会被伪装成密码错误。

建议：

- 只把明确的凭证错误映射成 `401`
- `429`、锁定等应保留原语义
- 基础设施异常应抛 `5xx`

状态：

- 已修复
- Hosted Login 只把明确的 `401` 认证失败映射成用户名密码错误
- 其他异常保留真实语义

---

### P1-8 Admin 鉴权把内部异常伪装成 `invalid_admin_token`

文件：

- [server/src/shared/admin/admin-auth.guard.ts](/Users/wrr/work/authany/server/src/shared/admin/admin-auth.guard.ts)

问题描述：

- 验签、token 状态校验、角色查询都包在一个大 `try/catch`
- 除 `HttpException` 外全部改写成 `401 invalid_admin_token`

风险：

- DB 故障
- token 状态查询异常
- 签名服务异常
- 角色表异常

都会被伪装成 token 无效，严重误导排障。

建议：

- 只把明确的鉴权失败保留为 `401/403`
- 内部故障改为 `5xx`
- 补结构化错误日志与 request id

状态：

- 已修复
- Admin 鉴权内部故障不再统一伪装成 `invalid_admin_token`
- 当前会返回 `500 admin_auth_failed`

---

### P1-9 Introspection 把内部异常静默降级成 `active: false`

文件：

- [server/src/modules/oidc/oidc.service.ts](/Users/wrr/work/authany/server/src/modules/oidc/oidc.service.ts)

问题描述：

- `/oauth/introspect` 总兜底 `catch { return { active: false } }`

风险：

- token 解析失败与内部服务故障无法区分
- 下游只会看到“token inactive”
- 事故时会表现成大面积鉴权失败，但没有真实故障信号

建议：

- 仅 token 本身无效时返回 `active: false`
- DB / signer / 查询异常应保留 `5xx`

状态：

- 已修复
- Introspection 仅在 token 本身无效时返回 `active:false`
- 内部异常保留真实错误路径

---

## 4. 中风险问题（P2）

### P2-1 Target Token 缓存层把 Redis 异常和正常 miss 混在一起

文件：

- [server/src/modules/delegation/delegation-token-broker.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/delegation-token-broker.service.ts)
- [server/src/shared/redis/redis.service.ts](/Users/wrr/work/authany/server/src/shared/redis/redis.service.ts)

问题描述：

- Redis 读失败直接按 miss 处理
- 写失败/删失败吞掉继续
- 解密失败还会退回按明文 JSON 解析

风险：

- 缓存后端故障与正常未命中不可区分
- 容易导致签发风暴、审计噪声、定位困难

建议：

- 区分 `miss / backend_error / invalid_entry`
- Redis 连接状态要更准确同步
- 明文缓存回退应尽快删除

状态：

- 已修复
- 当前已区分 `hit / miss / backend_error`
- Redis 读失败不再和普通 miss 混淆
- 已有测试覆盖 `backend_error`

---

### P2-2 Replay Protection 把依赖异常伪装成重放攻击

文件：

- [server/src/modules/delegation/target-token-exchange.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/target-token-exchange.service.ts)
- [server/src/modules/delegation/replay-protection.service.ts](/Users/wrr/work/authany/server/src/modules/delegation/replay-protection.service.ts)

问题描述：

- replay 校验异常时统一记成 `request_replayed`

风险：

- Redis 超时、断连等基础设施故障会被当成攻击事件
- 审计和调查方向都会被带偏

建议：

- 真重放与依赖故障必须分开记录

状态：

- 已修复
- Redis 故障现在返回 `503 replay_protection_unavailable`
- 审计与 metrics 已区分 `request_replayed` 和 `backend_error`

---

### P2-3 Audit Events 查询参数非法时静默回退

文件：

- [server/src/modules/admin/audit-events/audit-events.controller.ts](/Users/wrr/work/authany/server/src/modules/admin/audit-events/audit-events.controller.ts)

问题描述：

- `limit` 非法时回退到默认值
- 空字符串过滤会变成 `undefined`
- 日期参数缺少显式校验

风险：

- 调用方误以为过滤生效
- 实际返回更宽结果集

建议：

- 改 DTO 显式校验
- 非法输入直接 `400`

状态：

- 已修复
- 已改 DTO 校验，测试已同步

---

### P2-4 `/oauth/token` 某些错误可能返回 HTTP 200

文件：

- [server/src/modules/oidc/oidc.controller.ts](/Users/wrr/work/authany/server/src/modules/oidc/oidc.controller.ts)

问题描述：

- 不支持的 `grant_type` 直接返回错误对象
- 未走统一异常路径

风险：

- 客户端和代理可能把 OAuth 失败误判为成功响应

建议：

- 按 OAuth 规范明确返回 `400`

状态：

- 已修复
- 不支持的 `grant_type` 现在走统一异常路径并返回 `400 unsupported_grant_type`

---

### P2-5 Target Resource 配置缺失时继续展示默认 Trust Metadata

文件：

- [server/src/modules/admin/target-resources/target-resources.service.ts](/Users/wrr/work/authany/server/src/modules/admin/target-resources/target-resources.service.ts)

问题描述：

- `token_validation_mode` 默认 `jwks`
- `trust_config_json` 默认 `{}` 
- 展示层也继续回退成看起来完整的 trust metadata

风险：

- “未配置”会被伪装成“合法配置”

建议：

- 关键 trust 配置改成显式配置
- 缺失时应报错或标记 invalid

状态：

- 已修复
- `token_validation_mode` 与 `trust_config_json` 创建时都必须显式提交
- Admin Web 在未显式配置时不再伪装展示“完整可信 metadata”

---

### P2-6 未知异常日志缺少 stack / request id

文件：

- [server/src/shared/http/http-exception.filter.ts](/Users/wrr/work/authany/server/src/shared/http/http-exception.filter.ts)

问题描述：

- 只 `console.error(message)`
- 不带 stack
- 不带 request id

风险：

- 线上定位成本很高

建议：

- 日志必须带 stack、request id、路由和关键上下文

状态：

- 已修复
- 未知异常日志已包含 `requestId / method / path / stack`

---

### P2-7 外部 `x-request-id` 被直接信任

文件：

- [server/src/shared/http/request-context.ts](/Users/wrr/work/authany/server/src/shared/http/request-context.ts)

问题描述：

- 外部请求可以直接决定主 request id

风险：

- 污染日志关联链路
- 混淆排障和审计

建议：

- 服务端自己生成主 request id
- 外部 id 仅作附加字段保留

状态：

- 已修复
- 主 request id 由服务端生成
- 外部值仅保存在 `x-external-request-id`

---

## 5. 可接受的安全兜底（保留）

以下逻辑方向正确，不建议删除：

### 5.1 Dummy Password Hash

文件：

- [server/src/modules/auth/auth.service.ts](/Users/wrr/work/authany/server/src/modules/auth/auth.service.ts)

说明：

- 用户不存在时使用固定 `DUMMY_PASSWORD_HASH`
- 用于抗用户名枚举和时序侧信道

结论：

- 应保留

---

### 5.2 非法 return_to 回退到站内首页

文件：

- [server/src/modules/auth/hosted-login.ts](/Users/wrr/work/authany/server/src/modules/auth/hosted-login.ts)

说明：

- 非相对路径一律回退到 `/`
- 避免开放重定向

结论：

- 应保留

---

### 5.3 非法 Session / 过期 Session 视为未登录

文件：

- [server/src/shared/security/login-session.service.ts](/Users/wrr/work/authany/server/src/shared/security/login-session.service.ts)

说明：

- cookie 缺失、损坏、过期、tenant 不匹配统一返回 `null`

结论：

- 这是正确的 fail-closed
- 可保留

---

### 5.4 CSRF / Token Status 失败直接拒绝

文件：

- [server/src/shared/security/csrf.service.ts](/Users/wrr/work/authany/server/src/shared/security/csrf.service.ts)
- [server/src/shared/security/token-status.service.ts](/Users/wrr/work/authany/server/src/shared/security/token-status.service.ts)

说明：

- token 不合法、过期、缺失、无状态记录时直接拒绝

结论：

- 可保留

---

## 6. 修改前必须确认的真实运行态 / 真实存储行为

下面这些点已于 2026-05-18 在本地环境做过真实验证。结论分为：

- `已证实`：已通过真实数据库查询或真实 HTTP 请求确认
- `部分证实`：已经确认部分关键行为，但仍建议在更受控故障环境补一次
- `未验证`：本轮尚未实际验证

### 6.1 Runtime 绑定 Credential 的真实存储与真实绕过链路

验证结果：`已证实`

真实证据：

- 直接查库确认当前真实数据里同时存在：
  - `runtime_registration_id is null` 的 caller credential
  - `runtime_registration_id is not null` 的 caller credential
- 本地现有 `agent_demo` 真实数据中，既存在 runtime 绑定 credential，也存在 agent 级 credential
- 为避免旧数据干扰，本轮额外临时创建了一组仅绑定 runtime 的最小验证数据：
  - `agent_id = agt_verify_akJABhhY`
  - `runtime_id = rt_verify_akJABhhY`
  - `target_resource = tr_verify_akJABhhY`
- 使用同一个 runtime 绑定 secret：
  - 带 `runtime_id` 请求 `POST /api/requester-token`，返回 `201`
  - 不带 `runtime_id` 请求 `POST /api/requester-token`，仍返回 `201`
  - 此时签发出的 requester token 不再包含 `runtime_id`
  - 再用这个“不带 runtime_id”的 requester token 请求 `POST /api/target-token`，返回 `403 connection_not_allowed`

结论：

- 漏洞的关键部分已经被真实证实：
  - runtime 绑定 caller credential 在不传 `runtimeId` 时，确实仍可被命中
  - 且签发出的 requester token 会丢失 runtime 绑定信息
- 本次临时验证数据因未配置对应的 agent 级 target connection，最终未成功换出 target token
- 但认证边界已经在 requester token 阶段被放宽，因此该问题是实锤，不是静态误报

补充说明：

- 本轮临时创建的验证数据已在验证后清理，不残留到当前数据库

---

### 6.2 Target Token 是否始终包含 `target_resource` claim

验证结果：`已证实`

真实证据：

- 真实走通 `agent_demo -> requester token -> target token` 链路后，返回的 target token 可解出：
  - `aud = "demo-target"`
  - `target_resource = "demo-target"`
  - `token_use = "target_access"`
- 查库确认 `oauth_access_token_records.claims_json` 中也写入了 `{"target_resource":"demo-target"}`
- 直接查库确认当前 active target resource 存在重复 audience：
  - `audience = "eqweqweq"` 被两个 active target resource 共用

结论：

- 当前 target token 签发链路确实会写入 `target_resource` claim
- 但当前验证侧仍未强校验 `payload.target_resource === 当前 targetResourceCode`
- 同时数据库里已经存在真实的 `audience` 重复数据，因此这不是纯理论风险，而是已落地的危险组合

---

### 6.3 `/ready` 被探针如何消费

验证结果：`部分证实`

真实证据：

- 正常状态下，`GET /ready` 返回：
  - HTTP `200`
  - body: `{"status":"ready","checks":{"db":true,"redis":true}}`
- 本轮尝试通过本地停 Redis 做运行时故障注入：
  - 使用 `brew services stop redis` 后，Redis 监听端口确实消失
  - 紧接着请求 `/ready` 时，后端请求出现明显卡顿，未在预期时间内稳定返回可采信的 degraded 响应
  - 恢复 Redis 后，`/ready` 恢复为 HTTP `200` 且 `db/redis=true`

结论：

- 代码静态上可明确看出 `/ready` 无论 `db/redis` 检查结果如何都会返回 `200`
- 本地真实故障注入进一步说明：Redis 运行时故障下，系统表现并不稳定，不能依赖当前 `/ready` 提供清晰探针语义
- 仍建议在更受控环境下补一次：
  - 单独 mock Redis `ping()` 失败但不让请求线程卡住
  - 或在集成测试里直接 stub `redis.healthcheck() = false`

当前判定：

- “状态码不反映 not ready” 这一设计问题可视为已成立
- “Redis 故障时实例是否继续接流量” 仍需结合编排层 probe 配置做最终确认

---

### 6.4 Access Grant 默认值是否已经落入真实数据

验证结果：`已证实`

真实证据：

- 直接查库结果：
  - active grant 总数：`4`
  - 其中 `expires_at is null` 且 `constraints_json = {}` 的 active grant：`3`
- 抽样可见真实记录包括：
  - `ag_demo_agent_target`
  - `ag_live_t0jaSHTop4UR1TL2UaFUfPmG`
  - `ag_demo_application_target`

结论：

- “无过期 + 空约束”的长期放行 grant 不仅存在，而且在当前库里占 active grant 的大多数
- 该问题已经是现实数据状态，不需要再做额外确认

---

### 6.5 Target Connection 的空 provider 列表真实语义

验证结果：`已证实`

真实证据：

- 当前库里存在真实连接：
  - `connection_id = tc_live_OaK4fFXpYjo7hvZxL9NyYydw`
  - `target_resource = 321312`
  - `external_context_mode = required`
  - `allowed_context_providers_json = []`
- 使用真实请求：
  - `POST /api/requester-token`
  - `agent_id = agent_demo`
  - `runtime_id = runtime_demo_cli`
  - `target_resource = 321312`
  - `external_context.provider = "evil-provider"`
- 返回结果：`201 Created`

结论：

- `allowed_context_providers = []` 的当前真实语义是“不限制 provider”
- 它不是“拒绝所有 provider”
- 因为当前实现只有在 `allowedProviders.length > 0` 时才启用白名单限制

---

### 6.6 Introspection 的真实 HTTP 行为

验证结果：`大部分已证实`

真实证据：

- 使用从后台真实 reveal 出来的 `demo-web` 当前有效 secret：
  - `POST /oauth/introspect` + `token = "not-a-jwt"`，返回 `201 {"active":false}`
- 使用真实签发出的 target access token：
  - `POST /oauth/introspect` 返回 `201`
  - body 中 `active = true`
- 使用错误 client secret：
  - `POST /oauth/introspect` 返回 `401 invalid_client`

结论：

- 已确认三种外部可见行为至少分为：
  - 请求体合法且 client 认证成功，但 token 无效 -> `201 active:false`
  - token 有效 -> `201 active:true`
  - introspection client 认证失败 -> `401 invalid_client`
- 代码静态上已经确认：
  - `tokenSigner.verify()`、access token record 查询、revocation 查询等异常都会被统一吞成 `active:false`
- 本轮尚未对 signer/DB 故障做受控注入，但根据代码结构，这类异常在 `try/catch` 内会被静默混入 `active:false`

当前判定：

- “token 无效”和“try/catch 内部异常混在一起”这一风险基本成立
- 仅剩“DB 故障是否一定落入该 catch”这一点建议在受控 stub 环境下补一次测试

---

### 6.7 Audit Events 查询参数非法时的真实结果

验证结果：`已证实`

真实证据：

- 使用真实管理员会话调用：
  - `GET /api/v1/admin/audit-events?limit=abc`
  - 返回 `200` 且正常返回结果集
  - 说明非法 `limit` 被静默回退，而不是返回 `400`
- 调用：
  - `GET /api/v1/admin/audit-events?from=not-a-date`
  - 返回 `500 internal_error`
  - 说明非法日期没有在控制器层显式拦截
- 调用：
  - `GET /api/v1/admin/audit-events?event_type=&operator_id=`
  - 返回 `200` 且结果集未缩小
  - 说明空字符串过滤值被当成 `undefined`，过滤静默失效

结论：

- 该问题已完全被真实请求证实：
  - 非法 `limit` -> 静默放宽
  - 非法日期 -> `500`
  - 空过滤值 -> 静默取消过滤

---

## 7. 建议的修复顺序

### 第一批：必须先修

1. runtime 绑定 credential 的 runtime 约束
2. target token 与 `target_resource` 的强绑定
3. `/ready` 改为真实反映关键依赖状态
4. access grant / target connection 去掉默认放行

### 第二批：强烈建议紧接着修

5. hosted login / admin guard / introspection 不再吞真实异常
6. replay protection 与 cache 异常分类
7. 配置缺失改 fail-fast

### 第三批：提升可观测性与排障能力

8. request id 服务端主导
9. exception filter 结构化日志
10. audit 查询参数显式校验

---

## 8. 已确认的真实行为

以下几项是当前已经通过真实运行或之前修复确认过的：

1. Signing Key 私钥不再以明文 `private_key_pem` 持久化存储  
   当前正常落库的是 `key_rotation_records.metadata_json.private_key_ciphertext`

2. Signing Key 已改为 fail-closed  
   没有 `active` Signing Key 时，不再允许 fallback 默认签名密钥

3. 当前本地库已有一条 `active` Signing Key  
   用于本地登录和 token 签发

4. `http://127.0.0.1:3005/login` 当前已验证可正常登录

5. `caller_credentials.runtime_registration_id` 的运行时放宽问题已被真实复现  
   runtime 绑定 secret 在不带 `runtime_id` 时仍可成功签发 requester token

6. active target resource 中已存在重复 `audience`  
   当前本地库里 `eqweqweq` 被两个 active target resource 共用

7. active access grant 中已存在大量 `expires_at is null` 且 `constraints_json = {}` 的长期放行记录

8. `allowed_context_providers = []` 的真实运行语义已确认是“不限制 provider”

9. `audit-events` 非法查询参数行为已确认：
   非法 `limit` 返回 `200`，非法日期返回 `500`，空过滤值静默取消过滤

10. `oauth/introspect` 真实行为已确认：
    client 认证失败返回 `401`，token 无效返回 `201 active:false`，有效 token 返回 `201 active:true`

---

## 9. 本轮真实验证结果

### 9.1 构建与测试

- `pnpm build`：通过
- `pnpm test -- --runInBand`：`18/18` 测试文件通过，`75/75` 测试通过
- `pnpm admin:typecheck`：通过

### 9.2 真实数据清理

执行脚本：

- [server/scripts/security-tighten-data.ts](/Users/wrr/work/authany/server/scripts/security-tighten-data.ts)

执行结果：

- `duplicateAudiencesDisabled = 1`
- `indefiniteGrantsUpdated = 3`
- `weakConnectionsTightened = 1`

清理后再次查库结果：

- active duplicate `audience`：`0`
- active indefinite grant：`0`
- active weak target connection：`0`

### 9.3 运行态接口

- `GET http://127.0.0.1:3000/ready`
- 返回：`200`
- body：`{"status":"ready","checks":{"db":true,"redis":true}}`

---

## 10. 后续执行说明

建议后续修复时遵循以下原则：

- 不做兼容层
- 不保留“静默兜底”
- 安全边界缺失时直接失败
- 基础设施异常与业务拒绝必须分开
- 数据模型和运行时行为同时收口

如果后续开始逐项修改，建议以本文档为 checklist，每修完一项就在文档中补：

- 修改文件
- 测试结果
- 真实回归结果
- 是否涉及数据库数据修复
