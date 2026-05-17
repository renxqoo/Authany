# AuthAny 源码深度分析

> 分析范围: `/src` 目录全部源码 + `prisma/schema.prisma`
> 技术栈: NestJS + Fastify + PostgreSQL(Prisma) + Redis + jose(JWT)

---

## 一、项目概览

AuthAny 是一个**自托管的企业级身份认证与授权平台**，核心能力包括:

- OAuth 2.0 / OpenID Connect 协议全流程实现
- 令牌委派（Token Delegation）— 两阶段令牌交换
- Agent / Application 双主体身份管理
- 多租户数据隔离
- 密钥轮换、审计日志、限流等安全基础设施

---

## 二、目录结构

```
src/
├── main.ts                          # 入口: NestJS + Fastify 引导
├── app.module.ts                    # 根模块: 注册全部 13 个子模块
├── modules/                         # 业务模块
│   ├── auth/                        # 登录认证 (API + 托管登录页)
│   ├── oidc/                        # OAuth 2.0 / OIDC 全协议实现
│   ├── delegation/                  # 令牌委派 (Requester Token + Target Token)
│   ├── admin/                       # 管理后台 CRUD API
│   └── target-verification/         # 目标资源令牌验证
└── shared/                          # 共享基础设施
    ├── config/                      # 环境配置 (Zod 校验)
    ├── prisma/                      # Prisma ORM 封装
    ├── redis/                       # Redis 客户端封装
    ├── security/                    # 安全服务群
    │   ├── token-signer.service.ts  # JWT 签名/验证 + 密钥轮换
    │   ├── hash.service.ts          # 密码/令牌哈希 (scrypt + SHA-256)
    │   ├── login-session.service.ts # 登录会话 (Redis)
    │   ├── csrf.service.ts          # CSRF 令牌 (HMAC)
    │   ├── secret-encryption.service.ts # AES-256-GCM 加密
    │   ├── token-status.service.ts  # 令牌状态查询
    │   ├── client-ip.service.ts     # IP 解析 (可信代理链)
    │   └── current-user.service.ts  # 当前操作员解析
    ├── audit/                       # 审计事件持久化
    ├── metrics/                     # 内存指标计数
    ├── rate-limit/                  # Redis 滑动窗口限流
    ├── admin/                       # Admin JWT 认证 Guard
    ├── health/                      # 健康检查 (/health, /ready)
    └── http/                        # HTTP 工具 (异常过滤器/响应格式/重定向/安全头)
```

---

## 三、启动与引导流程

### 3.1 入口: `src/main.ts`

```
NestFactory.create<NestFastifyApplication>(AppModule, FastifyAdapter)
  │
  ├─ register @fastify/cookie  → 签名密钥来自 COOKIE_SECRET
  ├─ register @fastify/helmet  → 安全头 (CSP, X-Frame-Options, HSTS 等)
  ├─ enableCors                → 白名单校验 (AUTHANY_CORS_ORIGINS)
  ├─ ValidationPipe (全局)     → transform + whitelist + forbidNonWhitelisted
  ├─ HttpExceptionFilter (全局) → 统一错误格式
  │
  └─ listen(config.port, "0.0.0.0")
```

### 3.2 模块注册: `src/app.module.ts`

| 层级         | 模块                      | 作用                     |
| ------------ | ------------------------- | ------------------------ |
| 基础设施     | `AppConfigModule`         | Zod 校验环境变量         |
|              | `PrismaModule`            | PostgreSQL ORM           |
|              | `RedisModule`             | 缓存/会话/限流           |
|              | `SecurityModule`          | JWT签名/哈希/会话/CSRF/加密 |
|              | `MetricsModule`           | 内存指标计数             |
|              | `RateLimitModule`         | Redis 滑动窗口限流       |
|              | `AuditModule`             | 审计事件持久化           |
|              | `AdminModule`             | Admin JWT 认证 Guard     |
| 业务         | `AuthModule`              | 登录认证                 |
|              | `OidcModule`              | OAuth/OIDC 全流程        |
|              | `DelegationModule`        | 令牌委派                 |
|              | `TargetVerificationModule`| 目标令牌验证             |
|              | `AdminApiModule`          | 管理后台 CRUD            |
| 监控         | `HealthModule`            | 健康检查                 |

---

## 四、数据模型 (`prisma/schema.prisma`)

共 15 张表，核心实体关系:

```
OperatorAccount (操作员)
  ├── OperatorRole (角色, 多对多)
  ├── OAuthAuthorizationCode (授权码)
  ├── OAuthRefreshToken (刷新令牌)
  └── AuditEvent (审计事件)

OAuthClient (应用)
  ├── OAuthClientSecret (密钥, 支持加密存储)
  ├── OAuthRedirectUri (回调地址)
  ├── OAuthAuthorizationCode
  ├── OAuthAccessTokenRecord
  └── OAuthRefreshToken

AgentProfile (Agent 身份)
  ├── RuntimeRegistration (运行时注册)
  │   ├── CallerCredential (调用凭据)
  │   └── TargetConnection (目标连接)
  │       └── AccessGrant (访问授权)
  └── CallerCredential

TargetResourceRegistration (目标资源)
  └── TargetConnection
      └── AccessGrant

KeyRotationRecord (签名密钥轮换)
TokenRevocation (令牌吊销记录)
AuditEvent (审计日志)
```

**多租户设计**: 几乎每张表都有 `tenantId` 字段，实现数据隔离。

---

## 五、共享基础设施层

### 5.1 配置系统 (`AppConfigService`)

用 **Zod schema** 校验全部环境变量，启动即失败:

```
核心配置:
  NODE_ENV, PORT, AUTHANY_BASE_URL, DATABASE_URL, REDIS_URL
  COOKIE_SECRET (>=32字符), TENANT_ID, AUTHANY_APP_SECRET_ENCRYPTION_KEY

令牌 TTL:
  AUTH_CODE (默认 300s / 5分钟)
  ACCESS_TOKEN (默认 3600s / 1小时)
  REFRESH_TOKEN (默认 2592000s / 30天)
  TARGET_TOKEN (默认 900s / 15分钟)
  REPLAY (默认 300s / 5分钟)

安全:
  CORS_ORIGINS, CSP_FORM_ACTION_ORIGINS, TRUSTED_PROXIES
```

生产模式额外检查：禁止弱密钥（内置黑名单校验）。

### 5.2 安全模块 (`SecurityModule`, 全局模块)

#### TokenSignerService — JWT 签名/验证核心

**签名流程:**

1. 从 DB 查询 `status="active"` 的 `KeyRotationRecord`
2. 解密私钥 (AES-256-GCM, 由 `SecretEncryptionService` 完成)
3. 使用 `jose` 库 `SignJWT` → RS256 签名, 携带 `kid/iss/jti/exp/aud`

**验证流程:**

1. 解码 JWT header 获取 `kid`
2. 查询 DB 中 `status ∈ [active, verifying, retired]` 的密钥
3. `retired` 密钥有"宽限期" (最大 token 生命周期 + 60s)
4. `jose` `jwtVerify`

**JWKS 端点:**

导出所有可用公钥为 JWK 格式。

**密钥轮换状态机:**

```
active → verifying → retired (宽限期后自动失效)
```

#### SecretEncryptionService — 应用密钥加密

```
算法: AES-256-GCM
密钥派生:
  v1: SHA-256(master_key)
  v2: HKDF-SHA256(master_key, info="authany.secret-encryption", salt="tenant:{id}:v2")
存储格式: v2.{keyId}.{iv}.{tag}.{ciphertext} (base64url)
```

v2 使用 HKDF 派生租户隔离密钥，比 v1 的简单 SHA-256 更安全。

#### HashService — 密码/令牌哈希

| 方法               | 算法           | 用途                          |
| ------------------ | -------------- | ----------------------------- |
| `hashSecret()`     | scrypt(salt=16bytes, keylen=64) | 密码存储 |
| `verifySecret()`   | scrypt + timingSafeEqual        | 密码验证 |
| `hashOpaqueToken()`| SHA-256                          | auth code / refresh token 哈希存储 |

#### LoginSessionService — 登录会话

```
存储: Redis
TTL: 8 小时
key:  auth:session:{tenantId}:{sessionId}
value: { operatorId, tenantId, expiresAt }
sessionId = randomBytes(32).base64url
```

#### CsrfService — CSRF 令牌

```
格式: {purpose}.{timestamp_base36}.{nonce_base64url}.{hmac_sha256}
TTL: 15 分钟
签名: HMAC-SHA256(cookieSecret)
验证: timingSafeEqual 防时序攻击
```

#### ClientIpService — IP 解析

从 `X-Forwarded-For` 链中，**从右向左**遍历，找到第一个非可信代理的 IP。支持 IPv4-mapped IPv6 地址归一化。

### 5.3 限流 (`RateLimitService`)

基于 Redis 的**滑动窗口计数器**:

- `increment(key, windowSeconds)` → Redis `INCR` + `EXPIRE`
- 超限抛出 `429` 异常 + 记录 metrics
- 支持多维度: IP、客户端 ID、主体 ID 等

### 5.4 审计 (`AuditService`)

所有安全事件写入 `AuditEvent` 表:

```typescript
{
  eventType: string,       // 事件类型
  result: string,          // success / denied
  operatorId?: string,     // 操作员
  clientId?: string,       // OAuth 客户端
  agentId?: string,        // Agent
  targetResource?: string, // 目标资源
  errorCode?: string,      // 错误码
  requestId?: string,      // 请求 ID
  payloadJson?: Json       // 附加上下文
}
```

### 5.5 指标 (`MetricsService`)

内存计数器 + 标签维度，支持 `snapshot()` 供管理端查看。

### 5.6 HTTP 工具层

| 文件                   | 作用                              |
| ---------------------- | --------------------------------- |
| `api-response.ts`      | 统一成功响应格式 `{ data, requestId }` |
| `http-errors.ts`       | 自定义异常工厂 `apiError(status, code, message)` |
| `http-exception.filter.ts` | 全局异常过滤器，输出 `{ code, message, requestId }` |
| `redirect.ts`          | Fastify 重定向工具                |
| `request-context.ts`   | 请求 ID 生成与传递                |
| `security-headers.ts`  | CORS / CSP / Helmet 配置          |

---

## 六、业务模块流程

### 6.1 认证模块 (`AuthModule`)

#### API 登录: `POST /api/auth/login`

```
1. IP 限流 (10次/分钟/IP)
2. 检查账号锁定 (Redis: auth:login:lock:{tenant}:{username})
3. 查询 OperatorAccount
4. 使用 DUMMY_PASSWORD_HASH 防用户枚举
   → 无论用户是否存在都做哈希比较, 防止时序侧信道
5. scrypt 验证密码 (timingSafeEqual)
6. 失败:
   - Redis 计数: auth:login:failure:{tenant}:{username}
   - 5次失败 → 锁定15分钟
7. 成功:
   - 清除失败计数
   - 创建 Redis Session (8h TTL)
   - 设置 HttpOnly/SameSite=Lax Cookie
8. 全程审计记录
```

#### 托管登录: `GET/POST /login`

SSR HTML 登录页，支持 `return_to` 参数，CSRF 保护。用于 OIDC 授权流程中的用户认证。

- `GET /login` — 渲染登录页 (已登录则直接重定向)
- `POST /login` — 处理表单提交, CSRF 校验, 成功后 303 重定向

#### 安全机制

| 机制             | 实现                                            |
| ---------------- | ----------------------------------------------- |
| 用户枚举防护     | 无论用户是否存在都执行 scrypt 比对              |
| 时序攻击防护     | `timingSafeEqual` 比较哈希                      |
| 暴力破解防护     | IP 限流 + 账户锁定 (5次失败锁15分钟)            |
| CSRF 防护        | HMAC-SHA256 签名令牌, 15分钟过期                 |
| 会话安全         | HttpOnly + SameSite=Lax + Secure(生产环境)      |

---

### 6.2 OIDC 模块 (`OidcModule`)

#### 端点矩阵

| 端点                                    | 方法 | 说明          |
| --------------------------------------- | ---- | ------------- |
| `/.well-known/openid-configuration`     | GET  | OIDC 发现文档 |
| `/.well-known/jwks.json`                | GET  | 公钥集        |
| `/oauth/authorize`                      | GET  | 授权端点      |
| `/oauth/consent`                        | POST | 用户同意      |
| `/oauth/token`                          | POST | 令牌端点      |
| `/oauth/revoke`                         | POST | 令牌吊销      |
| `/oauth/introspect`                     | POST | 令牌内省      |
| `/oauth/userinfo`                       | GET  | 用户信息      |

#### 授权码流程 (Authorization Code + PKCE)

```
Client                          AuthAny Server
  │                                  │
  │ GET /oauth/authorize             │
  │ ?response_type=code              │
  │ &client_id=xxx                   │
  │ &redirect_uri=xxx                │
  │ &scope=openid profile ...        │
  │ &code_challenge=xxx              │
  │ &state=xxx                       │
  │─────────────────────────────────>│
  │                                  │ 1. 检查登录态 (Cookie Session)
  │                                  │    未登录 → 302 /login?return_to=...
  │                                  │ 2. prompt=consent → 渲染同意页面
  │                                  │    否则直接签发 code
  │                                  │ 3. 验证 client_id / redirect_uri / scope
  │                                  │ 4. rawCode = randomBytes(32).base64url
  │                                  │ 5. 存储 codeHash(SHA-256) + PKCE challenge
  │                                  │    → OAuthAuthorizationCode 表
  │  302 redirect_uri?code=xxx       │
  │<─────────────────────────────────│
  │                                  │
  │ POST /oauth/token                │
  │ grant_type=authorization_code    │
  │ code=xxx                         │
  │ code_verifier=xxx                │
  │ client_id + client_secret        │
  │─────────────────────────────────>│
  │                                  │ 1. IP限流(60/min) + 客户端限流(120/min)
  │                                  │ 2. 验证 client_secret
  │                                  │ 3. 查找 codeHash → 校验状态/过期/绑定
  │                                  │ 4. PKCE验证: SHA-256(code_verifier) == challenge
  │                                  │ 5. 原子更新 code status=consumed (防重放)
  │                                  │ 6. 签发 Access Token (JWT RS256)
  │                                  │ 7. 生成 Refresh Token (opaque, SHA-256 hash)
  │                                  │ 8. 签发 ID Token (JWT, sub=operator:{id})
  │                                  │ 9. 记录 OAuthAccessTokenRecord
  │                                  │ 10. 审计 + 指标
  │  { access_token,                 │
  │    refresh_token,                │
  │    id_token,                     │
  │    expires_in }                  │
  │<─────────────────────────────────│
```

#### 刷新令牌流程

```
POST /oauth/token
grant_type=refresh_token
refresh_token=xxx
client_id + client_secret

1. 验证 client_secret
2. 查找 refresh token by hash
3. 原子更新旧 token status=rotated
4. 若更新失败 (count≠1) → 吊销该用户全部 refresh token (安全机制)
5. 签发新的 access_token + refresh_token + id_token
```

**Refresh Token Rotation 安全机制**: 旧的 refresh token 只能用一次。若检测到重放（已 rotated 的 token 被再次使用），吊销该用户所有 refresh token，防止令牌窃取。

#### 客户端凭据流程

```
POST /oauth/token
grant_type=client_credentials
client_id + client_secret
scope=...

1. 验证 client_id + client_secret
2. 校验 allowedGrantTypes 包含 client_credentials
3. 校验请求的 scope
4. 签发 access_token (sub=client:{clientId})
5. 不签发 refresh_token 和 id_token
```

#### 令牌吊销 (`POST /oauth/revoke`)

```
1. 验证客户端身份
2. 先尝试匹配 refresh token (by hash)
3. 若不匹配, 尝试解码 JWT → 取 jti → 匹配 access token
4. 创建 TokenRevocation 记录
5. 更新 refresh token status=revoked
```

#### 令牌内省 (`POST /oauth/introspect`)

```
1. 验证客户端身份
2. JWT 签名验证
3. 查 DB 记录 + 检查吊销状态
4. 返回 { active, jti, payload... }
```

#### UserInfo (`GET /oauth/userinfo`)

```
1. 从 Authorization: Bearer 取 token
2. JWT 签名验证
3. 检查 TokenStatusService (未吊销 + 未过期)
4. sub 必须以 "operator:" 开头
5. 查询操作员信息
6. 返回 { sub, preferred_username, name, email }
```

#### Access Token 结构 (JWT Payload)

```json
{
  "alg": "RS256",
  "kid": "key-id",
  "typ": "JWT"
}
{
  "sub": "operator:{operatorId}",
  "scope": "openid profile",
  "client_id": "app-client-id",
  "roles": ["platform_admin"],
  "iss": "https://auth.example.com",
  "aud": "https://auth.example.com",
  "jti": "uuid",
  "iat": 1716000000,
  "exp": 1716003600
}
```

---

### 6.3 委派模块 (`DelegationModule`) — 两阶段令牌交换

这是 AuthAny 最核心的特色功能，实现了 **OAuth 2.0 Token Exchange** 的自定义扩展，支持 Agent 和 Application 两种身份主体。

#### 架构总览

```
┌─────────────┐     ┌───────────────────────┐     ┌──────────────┐
│ Agent / App  │────>│ AuthAny Delegation    │────>│ Target       │
│              │     │                       │     │ Resource     │
│              │     │ 阶段1: Requester Token│     │ Service      │
│              │     │ 阶段2: Target Token   │     │              │
└─────────────┘     └───────────────────────┘     └──────────────┘
```

#### 阶段一: Requester Token (`POST /api/requester-token`)

```
Agent/App                        AuthAny Server
  │                                  │
  │ POST /api/requester-token        │
  │ grant_type=urn:...:requester-token
  │ principal_type=agent/application │
  │ agent_id / app_id                │
  │ target_resource=xxx              │
  │─────────────────────────────────>│
  │                                  │
  │                    ┌─── Agent 路径 ───────────────┐
  │                    │ 1. 限流 (120/min per agent)  │
  │                    │ 2. Bearer token 认证          │
  │                    │    → 查 CallerCredential      │
  │                    │    → 验证 secretHash          │
  │                    │ 3. 验证 runtime 状态 (可选)   │
  │                    └──────────────────────────────┘
  │                    ┌── Application 路径 ──────────┐
  │                    │ 1. 限流 (120/min per app)    │
  │                    │ 2. Bearer token 认证          │
  │                    │    → 查 OAuthClient           │
  │                    │    → 验证 secret hash         │
  │                    └──────────────────────────────┘
  │                                  │
  │                                  │ 4. requireActiveTargetResource
  │                                  │ 5. 签发 JWT (5分钟有效)
  │                                  │    claims:
  │                                  │      sub: "agent:{id}" / "app:{id}"
  │                                  │      token_use: "requester_assertion"
  │                                  │      target_resource: "xxx"
  │                                  │      request_id: UUID
  │                                  │      credential_id / secret_id
  │                                  │      external_context: {...}
  │                                  │
  │  { requester_token,             │
  │    token_type: "Bearer",        │
  │    expires_in }                 │
  │<─────────────────────────────────│
```

#### 阶段二: Target Token Exchange (`POST /api/target-token`)

```
Agent/App                        AuthAny Server
  │                                  │
  │ POST /api/target-token           │
  │ Authorization: Bearer <requester>
  │ grant_type=urn:...:target-access │
  │ target_resource=xxx              │
  │─────────────────────────────────>│
  │                                  │
  │                                  │ 1.  验证 Requester JWT 签名 + claims
  │                                  │ 2.  校验 token_use=requester_assertion
  │                                  │ 3.  校验 target_resource 匹配
  │                                  │ 4.  解析主体 (agent/application)
  │                                  │ 5.  限流 (300/min per principal:target)
  │                                  │ 6.  Replay Protection (Redis, request_id)
  │                                  │ 7.  requireActiveTargetResource
  │                                  │ 8.  查找 TargetConnection
  │                                  │     优先级: runtime级别 > agent级别
  │                                  │ 9.  校验 external_context 策略
  │                                  │     (required/forbidden/provider白名单)
  │                                  │ 10. requireActiveGrant (访问授权)
  │                                  │ 11. Broker: 检查缓存或签发新令牌
  │                                  │     缓存 key = SHA-256(所有context参数)
  │                                  │     缓存值 = AES-256-GCM 加密的 token
  │                                  │ 12. 签发 Target Access Token (JWT)
  │                                  │     claims:
  │                                  │       sub, aud, target_resource
  │                                  │       token_use: "target_access"
  │                                  │       delegation_type: "agent_as_self"
  │                                  │       external_context
  │                                  │ 13. 记录 OAuthAccessTokenRecord
  │                                  │ 14. 审计 + 指标
  │                                  │
  │  { access_token,                │
  │    issued_token_type,           │
  │    cache: "miss"/"hit",         │
  │    jti }                        │
  │<─────────────────────────────────│
```

#### 委派系统的安全机制

| 机制                 | 实现                                                      |
| -------------------- | --------------------------------------------------------- |
| 两阶段隔离           | Requester Token 是短期断言(5min), Target Token 是实际访问令牌 |
| Replay Protection    | Redis 存储已使用的 request_id, TTL 可配置                 |
| 连接优先级           | runtime 级别连接优先于 agent 级别                         |
| External Context     | 支持 required / forbidden / provider 白名单模式           |
| Token 缓存           | 相同参数的 target token 可复用 (阈值可配), 减少签名开销    |
| 缓存值加密           | Redis 中存储的 token 使用 AES-256-GCM 加密                |
| 多维度限流           | 主体 + 目标资源 维度的速率限制                             |

#### 委派模块内部服务分工

```
DelegationService (门面)
  ├── RequesterTokenService
  │     ├── CallerCredentialService  — Agent 凭据认证
  │     ├── DelegationPolicyService  — 目标资源/连接/授权策略
  │     └── TokenSignerService       — JWT 签发
  │
  └── TargetTokenExchangeService
        ├── ReplayProtectionService         — Redis request_id 去重
        ├── DelegationPolicyService         — 连接查找/授权校验/上下文策略
        ├── TargetTokenBrokerService        — 缓存复用/令牌签发
        ├── CallerCredentialService         — 凭据关联校验
        └── TokenSignerService              — JWT 签发
```

---

### 6.4 Admin API (`AdminApiModule`)

REST 风格管理接口，由 `AdminAuthGuard` 保护。

#### Admin 认证流程

```
1. 从 Authorization: Bearer 取 JWT
2. TokenSigner.verify() 签名验证
3. 检查 scope 包含 authany.admin
4. 查 DB OperatorRole 确认 platform_admin 角色
```

#### 管理的实体

| 实体               | 路径前缀                              | 说明               |
| ------------------ | ------------------------------------- | ------------------ |
| Applications       | `/api/admin/applications`             | OAuth 客户端 + 密钥管理 |
| Agents             | `/api/admin/agents`                   | Agent 身份管理     |
| Runtimes           | `/api/admin/agents/:id/runtimes`      | 运行时注册         |
| Credentials        | `/api/admin/agents/:id/credentials`   | 调用凭据           |
| Target Resources   | `/api/admin/target-resources`         | 目标资源注册       |
| Connections        | `/api/admin/target-resources/:id/connections` | 目标连接 |
| Grants             | `/api/admin/connections/:id/grants`   | 访问授权           |
| Keys               | `/api/admin/keys`                     | RSA 密钥对轮换     |
| Audit              | `/api/admin/audit`                    | 审计日志查询       |
| Metrics            | `/api/admin/metrics`                  | 指标快照           |

---

### 6.5 Target Verification (`TargetVerificationModule`)

供目标资源服务验证 target access token:

```
1. JWT 签名验证
2. 检查 audience 匹配
3. 检查 token_use=target_access
4. 验证 TokenStatusService (未吊销 + 未过期)
5. 解析主体身份 (agent/application)
```

---

## 七、请求处理全景流程

```
HTTP Request
  │
  ▼
Fastify (trustProxy: false)
  │
  ├─ @fastify/helmet → 安全头 (CSP, X-Frame-Options, HSTS...)
  ├─ CORS → 白名单校验
  ├─ @fastify/cookie → 解析/签名
  │
  ▼
NestJS Pipeline
  │
  ├─ ValidationPipe → DTO 校验 (whitelist + forbid)
  ├─ [AdminAuthGuard] → 仅 admin 路由
  │
  ▼
Controller → Service
  │
  ├─ RateLimitService → 限流检查
  ├─ PrismaService → DB 操作
  ├─ RedisService → 缓存/会话/计数
  ├─ TokenSignerService → JWT 签发/验证
  ├─ HashService → 密码/令牌哈希
  ├─ AuditService → 审计记录
  ├─ MetricsService → 指标计数
  │
  ▼
HttpExceptionFilter → 统一错误格式 { code, message, requestId }
```

---

## 八、令牌类型汇总

| 令牌类型             | 格式   | 签名   | TTL          | 存储方式            | 用途                    |
| -------------------- | ------ | ------ | ------------ | ------------------- | ----------------------- |
| Access Token         | JWT    | RS256  | 默认 1 小时  | DB Record + jti     | API 访问                |
| Refresh Token        | Opaque | -      | 默认 30 天   | DB hash             | 续签 access token       |
| ID Token             | JWT    | RS256  | 默认 1 小时  | 无存储 (自包含)     | 身份声明                |
| Requester Token      | JWT    | RS256  | 固定 5 分钟  | 无存储 (短期断言)   | 委派阶段一              |
| Target Access Token  | JWT    | RS256  | 默认 15 分钟 | DB Record + Redis缓存 | 委派阶段二, 访问目标资源 |
| Login Session        | Opaque | -      | 固定 8 小时  | Redis               | 浏览器登录态            |
| CSRF Token           | HMAC   | -      | 固定 15 分钟 | 无存储 (无状态验证) | 表单防 CSRF             |

---

## 九、安全设计总结

| 维度         | 设计                                                                |
| ------------ | ------------------------------------------------------------------- |
| 多租户       | 每张表 `tenantId` + 全局 config                                    |
| 认证         | Cookie Session (Redis) + JWT Bearer                                 |
| 密钥管理     | DB 存储 + AES-256-GCM 加密 + 状态机轮换 (active→verifying→retired) |
| 密码安全     | scrypt + timingSafeEqual + 虚假哈希防枚举                          |
| 限流         | Redis 滑动窗口, IP + 客户端 + 主体多维度                           |
| 审计         | 全链路事件记录, 含操作员/Agent/IP/结果                              |
| 防重放       | Auth Code 一次性消费 + Refresh Token Rotation + Request ID Redis 去重 |
| 委派         | 两阶段令牌交换, 连接-授权模型, 缓存复用                            |
| CSRF         | HMAC-SHA256 签名令牌, 无状态验证                                    |
| 配置安全     | Zod schema 启动校验 + 生产弱密钥检测                                |
