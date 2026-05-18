# AuthAny V1 实现矩阵

> 本矩阵用于把 V1 验收标准映射到当前实现和测试。它不是产品说明，而是研发和验收时的对照清单。

## 1. 协议能力

| 项目 | 状态 | 实现位置 | 测试 |
|------|------|----------|------|
| OIDC Discovery | 已完成 | `server/src/modules/oidc/oidc.service.ts` | `server/test/oidc.service.test.ts` |
| JWKS | 已完成 | `server/src/shared/security/token-signer.service.ts` | `server/test/shared-infra.test.ts`, `server/test/key-rotation-and-target.test.ts` |
| Authorization Code + PKCE | 已完成 | `server/src/modules/oidc/oidc.service.ts` | `server/test/oidc.service.test.ts`, `server/test/pkce.test.ts` |
| Refresh Rotation | 已完成 | `server/src/modules/oidc/oidc.service.ts` | `server/test/oidc.service.test.ts` |
| Revocation | 已完成 | `server/src/modules/oidc/oidc.service.ts` | `server/test/oidc.service.test.ts` |
| Introspection | 已完成 | `server/src/modules/oidc/oidc.service.ts` | `server/test/oidc.service.test.ts` |
| UserInfo | 已完成 | `server/src/modules/oidc/oidc.service.ts` 的 operator profile endpoint | `server/test/oidc.service.test.ts` |
| Client Credentials | 已完成 | `server/src/modules/oidc/oidc.service.ts` | `server/test/oidc.service.test.ts` |
| Requester JWT 契约 | 已完成 | `POST /api/requester-token` 签发短期 Requester JWT；`POST /api/target-token` 只接受 `token_use=requester_assertion` | `server/test/delegation.service.test.ts` |

## 2. Target Access

| 项目 | 状态 | 实现位置 | 测试 |
|------|------|----------|------|
| Agent Caller Credential 校验 | 已完成 | `server/src/modules/delegation/caller-credential.service.ts` | `server/test/delegation.service.test.ts` |
| Runtime 状态与所属关系校验 | 已完成 | `server/src/modules/delegation/caller-credential.service.ts` | `server/test/delegation.service.test.ts` |
| 防重放 | 已完成 | `server/src/modules/delegation/replay-protection.service.ts` | `server/test/delegation.service.test.ts` |
| Target Connection 校验 | 已完成 | `server/src/modules/delegation/delegation-policy.service.ts`, `server/src/modules/delegation/target-token-exchange.service.ts`, `target_connections` | `server/test/delegation.service.test.ts` |
| Access Grant 校验 | 已完成 | `server/src/modules/delegation/delegation-policy.service.ts`, `server/src/modules/delegation/target-token-exchange.service.ts`, `access_grants` | `server/test/delegation.service.test.ts` |
| Agent Target Token | 已完成 | `POST /api/target-token`，由 `server/src/modules/delegation/target-token-exchange.service.ts` 实现 | `server/test/delegation.service.test.ts` |
| Application Target Token | 已完成 | Application principal 通过 Requester JWT、Target Connection 和 Access Grant 换取 Target Token | `server/test/delegation.service.test.ts` |
| Target Token Broker 缓存 | 已完成 | `server/src/modules/delegation/delegation-token-broker.service.ts` | `server/test/delegation-token-broker.service.test.ts`, `server/test/delegation.service.test.ts` |
| Target Token 缓存命中审计 | 已完成 | `server/src/modules/delegation/target-token-exchange.service.ts` | `server/test/delegation.service.test.ts` |
| Target Token 响应 `cache=hit|miss` | 已完成 | `server/src/modules/delegation/target-token-exchange.service.ts` | `server/test/delegation-token-broker.service.test.ts`, `server/test/delegation.service.test.ts` |
| 缓存命中授权重校验 | 已完成 | `server/src/modules/delegation/target-token-exchange.service.ts` | `server/test/delegation-cache-authorization.test.ts`, `server/test/delegation.service.test.ts` |
| Redis 缓存故障降级 | 已完成 | `server/src/modules/delegation/delegation-token-broker.service.ts` | `server/test/delegation-token-broker.service.test.ts` |

## 3. Admin 管理面

| 项目 | 状态 | 实现位置 | 测试 |
|------|------|----------|------|
| Operator account 管理 | 已完成 | `operator_accounts`, `operator_roles`, `server/src/modules/auth` | `server/test/auth-binding.service.test.ts`, `server/test/shared-infra.test.ts` |
| Application 与 Secret 管理 | 已完成 | `server/src/modules/admin/applications` | `server/test/applications.service.test.ts`, `server/test/admin-services.test.ts` |
| Application 管理产品 UI | 已完成 | `apps/admin-web/features/applications` | `apps/admin-web/features/applications/*.test.tsx` |
| 可查看的加密 App Secret | 已完成 | `server/src/modules/admin/applications`, `server/prisma/schema.prisma` | `server/test/applications.service.test.ts`, `apps/admin-web/components/management/secret-field.test.tsx` |
| Application 逻辑删除 | 已完成 | `server/src/modules/admin/applications`, `apps/admin-web/features/applications` | `server/test/applications.service.test.ts`, `apps/admin-web/features/applications/application-detail-page.test.tsx` |
| Agent 管理 API | 已完成 | `server/src/modules/admin/agents` | `server/test/agents.service.test.ts` |
| Agent 管理产品 UI | 已完成 | `apps/admin-web/features/agents` | `apps/admin-web/features/agents/*.test.tsx` |
| 系统生成 Agent ID | 已完成 | `server/src/modules/admin/agents` | `server/test/agents.service.test.ts` |
| Agent 逻辑删除 | 已完成 | `server/src/modules/admin/agents`, `apps/admin-web/features/agents` | `server/test/agents.service.test.ts`, `apps/admin-web/features/agents/agent-detail-page.test.tsx` |
| Runtime Registration 管理 | 已完成 | `server/src/modules/admin/runtimes` | `server/test/agents.service.test.ts`, 构建检查 |
| Caller Credential 管理 | 已完成 | `server/src/modules/admin/caller-credentials` | `server/test/admin-and-security.service.test.ts` |
| Target Resource 管理 | 已完成 | `server/src/modules/admin/target-resources` | `server/test/admin-services.test.ts` |
| Target Connection 管理 | 已完成 | `server/src/modules/admin/target-connections` | `server/test/admin-services.test.ts`, `apps/admin-web/features/resources/resource-config.test.ts` |
| Access Grant 管理 | 已完成 | `server/src/modules/admin/access-grants` | `server/test/admin-services.test.ts`, `apps/admin-web/features/resources/resource-config.test.ts` |
| Audit 查询 | 已完成 | `server/src/modules/admin/audit-events` | `server/test/user-consents-and-audit-controller.test.ts` |
| Key rotation 生命周期 | 已完成 | `server/src/modules/admin/keys` | `server/test/key-rotation-and-target.test.ts` |
| Admin role 分配 | 已完成 | `server/prisma/schema.prisma` `OperatorRole`, `server/scripts/seed.ts` | `server/test/shared-infra.test.ts` |
| Admin JWT guard | 已完成 | `server/src/shared/admin/admin-auth.guard.ts` | `server/test/shared-infra.test.ts` |
| Admin UI BFF session | 已完成 | `apps/admin-web/app/api/auth/*`, `apps/admin-web/lib/server/session.ts` | `apps/admin-web` Vitest suite |
| Admin Web V1 应用 | 已完成 | `apps/admin-web` | `pnpm --filter @authany/admin-web test` |

## 4. 安全与运维

| 项目 | 状态 | 实现位置 | 测试 |
|------|------|----------|------|
| 带 `kid` 的 RS256 签名 | 已完成 | `server/src/shared/security/token-signer.service.ts` | `server/test/shared-infra.test.ts`, `server/test/key-rotation-and-target.test.ts` |
| 历史 JWKS 验签窗口 | 已完成 | `server/src/shared/security/token-signer.service.ts`，未知 `kid` 拒绝，过期 retired key 拒绝 | `server/test/key-rotation-and-target.test.ts` |
| Secret hash | 已完成 | `server/src/shared/security/hash.service.ts` | `server/test/hash.service.test.ts` |
| Refresh token hash | 已完成 | `server/src/modules/oidc/oidc.service.ts` | `server/test/oidc.service.test.ts` |
| Caller Credential hash | 已完成 | `server/src/modules/admin/caller-credentials` | `server/test/admin-and-security.service.test.ts` |
| 限流 | 已完成 | `server/src/shared/rate-limit/rate-limit.service.ts` | `server/test/rate-limit-and-audit.test.ts` |
| Metrics 与告警 | 已完成 | `server/src/shared/metrics/metrics.service.ts` | `server/test/admin-and-security.service.test.ts`, `server/test/rate-limit-and-audit.test.ts` |
| Health / readiness | 已完成 | `server/src/shared/health/health.controller.ts` | 构建覆盖；有数据库环境时可补 HTTP e2e |
| Redis fallback | 已完成 | `server/src/shared/redis/redis.service.ts` | `server/test/shared-infra.test.ts` |
| Audit trail | 已完成 | `server/src/shared/audit/audit.service.ts` | `server/test/rate-limit-and-audit.test.ts` |

## 5. Target Resource 接入

| 项目 | 状态 | 实现位置 | 测试 |
|------|------|----------|------|
| Target trust metadata | 已完成 | `server/src/modules/admin/target-resources/target-resources.service.ts` | `server/test/admin-services.test.ts` |
| JWT verification helper | 已完成 | `server/src/modules/target-verification/target-token-verifier.service.ts` | `server/test/key-rotation-and-target.test.ts` |
| Application 与 Agent subject 识别 | 已完成 | `server/src/modules/target-verification/target-token-verifier.service.ts`, `example/target-service/src/auth.ts` | `server/test/key-rotation-and-target.test.ts`, `example/target-service` tests |
| 本地权限自治 | 边界已完成 | AuthAny 不建模 Target Resource 资源权限 | `specs/08-TARGET-RESOURCE-INTEGRATION.md` |

## 6. V1 已知边界

- Admin UI V1 已在 `apps/admin-web` 实现，使用 BFF session cookie 和真实 AuthAny Admin APIs。复杂详情抽屉、批量筛选等高级管理体验可在首次产品评审后继续增强。
- 当前限流是进程内实现。多实例生产部署时，应切换为 Redis 原子计数。
- Private-key 和 mTLS Caller Credential 类型预留给后续版本；V1 从 hash 后的服务端 Secret 开始，并用它们生成或校验 Requester JWT。
- Target resource authorization 按设计保留在 Target Resource，不进入 AuthAny。
