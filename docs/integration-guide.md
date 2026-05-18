# AuthAny 接入指南

> 本文档面向三类接入方：**业务应用开发者**、**Agent/Runtime 开发者**、**目标资源服务开发者**。

---

## 一、整体架构

```
┌──────────────┐         ┌─────────────────────────────────────────┐         ┌──────────────────┐
│              │         │              AuthAny                     │         │                  │
│  业务应用     │────────>│  OAuth 2.0 / OIDC                       │         │  目标资源服务      │
│  (Web/App)   │<────────│  (登录 / 授权 / 令牌)                    │         │  (EBFX / ERP ...) │
│              │         │                                         │         │                  │
├──────────────┤         │  委派令牌系统                            │         │  验证 JWT 签名     │
│              │         │  ┌─────────────────────────────┐        │         │  校验 aud / iss   │
│  Agent       │────────>│  │ 阶段1: Requester Token      │        │         │  解析 claims      │
│  / Runtime   │         │  │ 阶段2: Target Access Token  │───────>│────────>│  执行业务授权      │
│  (AI/CLI/MCP)│<────────│  └─────────────────────────────┘        │         │                  │
│              │         │                                         │         │                  │
└──────────────┘         └─────────────────────────────────────────┘         └──────────────────┘
```

**三种接入角色:**

| 角色                   | 说明                                  | 典型场景                      |
| ---------------------- | ------------------------------------- | ----------------------------- |
| **业务应用**           | 通过 OAuth 登录 + 可选委派令牌        | Web 前端、移动端、SPA         |
| **Agent / Runtime**    | 通过委派令牌访问目标资源              | AI Agent、CLI、MCP Server     |
| **目标资源服务**       | 接收并验证 Target Access Token        | ERP、EBFX、内部 API           |

---

## 二、前置准备

### 2.1 部署 AuthAny 服务

需要以下基础设施:

| 依赖         | 说明                          |
| ------------ | ----------------------------- |
| PostgreSQL   | 主数据库, 存储全部业务数据     |
| Redis        | 会话/缓存/限流/重放防护        |
| Node.js 18+  | 运行环境                      |

### 2.2 配置环境变量

主服务配置参考 [server/.env.example](/Users/wrr/work/authany/server/.env.example:1)。

如果你要运行 Admin Web，再额外参考 [apps/admin-web/.env.example](/Users/wrr/work/authany/apps/admin-web/.env.example:1)。

如果你要同时运行示例应用和示例目标资源服务，再额外参考 [example/.env.example](/Users/wrr/work/authany/example/.env.example:1)。

主服务关键配置示例:

```bash
# 必填 — 基础配置
NODE_ENV=production
PORT=3000
AUTHANY_BASE_URL=https://auth.your-company.com   # 对外可访问地址
DATABASE_URL=postgresql://user:pass@host:5432/authany
REDIS_URL=redis://host:6379

# 必填 — 安全密钥 (至少32字节随机值)
COOKIE_SECRET=<openssl rand -base64 48>
AUTHANY_APP_SECRET_ENCRYPTION_KEY=<openssl rand -base64 48>

# 必填 — 租户
TENANT_ID=your-company

# 可选 — 令牌 TTL (括号内为默认值)
AUTHANY_AUTH_CODE_TTL_SECONDS=300          # 授权码有效期 (5分钟)
AUTHANY_ACCESS_TOKEN_TTL_SECONDS=3600      # Access Token 有效期 (1小时)
AUTHANY_REFRESH_TOKEN_TTL_SECONDS=2592000  # Refresh Token 有效期 (30天)
AUTHANY_TARGET_TOKEN_TTL_SECONDS=900       # Target Token 有效期 (15分钟)

# 可选 — 安全策略
AUTHANY_CORS_ORIGINS=https://app.your-company.com
AUTHANY_CSP_FORM_ACTION_ORIGINS=https://app.your-company.com
AUTHANY_TRUSTED_PROXIES=10.0.0.1,10.0.0.2
```

### 2.3 初始化数据库

```bash
pnpm prisma:migrate:deploy
```

### 2.4 生成签名密钥

首次部署需要通过 Admin API 生成 RSA 密钥对。
前提是数据库中已经存在可登录的管理员账号，并且你已经拿到了 `admin_access_token`:

```bash
POST /api/v1/admin/keys
Authorization: Bearer <admin_access_token>

# 响应包含 kid, 用于后续 JWT 验证
```

---

## 三、接入方式一: 业务应用 (OAuth 2.0 + OIDC)

适用于: Web 前端、移动端、SPA 等需要用户登录的场景。

### 3.1 管理员注册应用

通过 Admin API 创建 OAuth Client:

```http
POST /api/v1/admin/applications
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "name": "我的业务应用",
  "description": "公司内部 ERP 前端",
  "client_type": "confidential",
  "allowed_grant_types": ["authorization_code", "refresh_token"],
  "allowed_scopes": ["openid", "profile", "email", "offline_access"],
  "redirect_uris": ["https://erp.your-company.com/callback"]
}
```

响应:

```json
{
  "data": {
    "id": "clx...",
    "client_id": "app_live_abc123",
    "name": "我的业务应用",
    "secrets": [
      {
        "id": "clx...",
        "secret": "sk_live_xxxxxxxxxxxx",   // 仅此一次可见, 务必保存
        "hint": "sk_live_...xxxx"
      }
    ]
  }
}
```

> **重要**: `secret` 仅在创建时返回一次, 无法再次查看。

### 3.2 Authorization Code + PKCE 流程

#### 第一步: 构造授权 URL, 引导用户登录

```typescript
// 生成 PKCE code_verifier 和 code_challenge
import { randomBytes, createHash } from "crypto";

const codeVerifier = randomBytes(32).toString("base64url");
const codeChallenge = createHash("sha256")
  .update(codeVerifier)
  .digest("base64url");

// 生成 state (防 CSRF)
const state = randomBytes(16).toString("base64url");

// 保存 codeVerifier 和 state 到 cookie/session
// ...

// 构造授权 URL
const authorizeUrl = new URL("https://auth.your-company.com/oauth/authorize");
authorizeUrl.searchParams.set("response_type", "code");
authorizeUrl.searchParams.set("client_id", "app_live_abc123");
authorizeUrl.searchParams.set("redirect_uri", "https://erp.your-company.com/callback");
authorizeUrl.searchParams.set("scope", "openid profile email offline_access");
authorizeUrl.searchParams.set("state", state);
authorizeUrl.searchParams.set("code_challenge", codeChallenge);
authorizeUrl.searchParams.set("code_challenge_method", "S256");

// 重定向用户到授权 URL
window.location.href = authorizeUrl.toString();
```

#### 第二步: 用户在 AuthAny 登录并授权

用户将被引导到 AuthAny 托管登录页:

1. 输入用户名和密码
2. 看到授权同意页面 (显示应用名称和请求的 scope)
3. 点击"允许"后, AuthAny 重定向回 `redirect_uri`

#### 第三步: 用授权码换取令牌

```typescript
// 回调 URL: https://erp.your-company.com/callback?code=xxx&state=xxx

// 验证 state 匹配
if (query.state !== savedState) {
  throw new Error("CSRF state mismatch");
}

// 用 code 换取令牌
const tokenResponse = await fetch("https://auth.your-company.com/oauth/token", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    grant_type: "authorization_code",
    client_id: "app_live_abc123",
    client_secret: "sk_live_xxxxxxxxxxxx",
    code: query.code,
    redirect_uri: "https://erp.your-company.com/callback",
    code_verifier: savedCodeVerifier   // PKCE
  })
});

const tokens = await tokenResponse.json();
```

响应:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g...",
  "id_token": "eyJhbGciOiJSUzI1NiIs...",
  "scope": "openid profile email offline_access"
}
```

#### 第四步: 使用令牌

**调用 AuthAny UserInfo 获取用户信息:**

```http
GET https://auth.your-company.com/oauth/userinfo
Authorization: Bearer <access_token>
```

响应:

```json
{
  "sub": "operator:clx123456",
  "preferred_username": "zhangsan",
  "name": "张三",
  "email": "zhangsan@company.com"
}
```

**刷新令牌 (access_token 过期后):**

```http
POST https://auth.your-company.com/oauth/token
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "client_id": "app_live_abc123",
  "client_secret": "sk_live_xxxxxxxxxxxx",
  "refresh_token": "<refresh_token>"
}
```

### 3.3 Client Credentials 流程 (服务间调用)

适用于无用户参与的服务间通信:

```http
POST https://auth.your-company.com/oauth/token
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "client_id": "app_live_abc123",
  "client_secret": "sk_live_xxxxxxxxxxxx",
  "scope": "openid"
}
```

响应 (无 refresh_token 和 id_token):

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "openid"
}
```

---

## 四、接入方式二: Agent / Runtime (委派令牌)

适用于: AI Agent、CLI 工具、MCP Server、自动化脚本等。

Agent 接入使用**两阶段令牌交换**: 先获取 Requester Token, 再换取 Target Access Token。

### 4.1 管理员准备

#### 创建 Agent

```http
POST /api/v1/admin/agents
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "agent_id": "agent_prod_search",
  "name": "生产环境搜索 Agent",
  "description": "负责企业知识库检索"
}
```

#### 创建 Runtime (可选, 推荐)

```http
POST /api/v1/admin/runtimes
Content-Type: application/json

{
  "agent_id": "agt_live_xxxxx",
  "runtime_type": "cli",
  "runtime_mode": "stateless",
  "allows_delegation_refresh": false,
  "allows_remote_cache_reuse": false
}
```

#### 签发调用凭据

```http
POST /api/v1/admin/agents/{agentDbId}/credentials
Content-Type: application/json

{}
```

响应:

```json
{
  "data": {
    "id": "clx...",
    "credential_type": "agent_secret",
    "credential_hint": "agent...",
    "secret": "agent_live_abc123def456"    // 仅此一次可见
  }
}
```

#### 注册目标资源

```http
POST /api/v1/admin/target-resources
Content-Type: application/json

{
  "target_resource_code": "erp-api",
  "display_name": "ERP API 服务",
  "audience": "https://erp-api.internal",
  "token_validation_mode": "jwks",
  "trust_config_json": {}
}
```

#### 创建连接 + 授权

```http
# 创建连接: Agent → 目标资源
POST /api/v1/admin/target-connections
Content-Type: application/json

{
  "principal_type": "agent",
  "principal_id": "agent_prod_search",
  "runtime_id": "rt_live_xxxxx",
  "target_resource": "erp-api",
  "external_context_mode": "optional",
  "allowed_context_providers": [],
  "max_token_ttl_seconds": 900
}

# 创建授权: 允许该连接访问
POST /api/v1/admin/access-grants
Content-Type: application/json

{
  "connection_id": "tc_live_xxxxx",
  "grant_type": "target_access",
  "effect": "allow",
  "constraints": {},
  "expires_at": "2026-12-31T23:59:59Z"
}
```

### 4.2 Agent 接入代码

#### 阶段一: 获取 Requester Token

```typescript
async function getRequesterToken(config: {
  authanyBaseUrl: string;
  agentId: string;
  runtimeId?: string;
  credential: string;
  targetResource: string;
  externalContext?: Record<string, unknown>;
}) {
  const response = await fetch(`${config.authanyBaseUrl}/api/requester-token`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${config.credential}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "urn:authany:params:oauth:grant-type:requester-token",
      principal_type: "agent",
      agent_id: config.agentId,
      runtime_id: config.runtimeId,
      target_resource: config.targetResource,
      external_context: config.externalContext
    })
  });

  if (!response.ok) {
    throw new Error(`Requester token failed: ${response.status}`);
  }

  return response.json();
  // { requester_token: "eyJ...", token_type: "Bearer", expires_in: 300 }
}
```

#### 阶段二: 换取 Target Access Token

```typescript
async function getTargetToken(config: {
  authanyBaseUrl: string;
  requesterToken: string;
  targetResource: string;
}) {
  const response = await fetch(`${config.authanyBaseUrl}/api/target-token`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${config.requesterToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "urn:authany:params:oauth:grant-type:target-access",
      target_resource: config.targetResource
    })
  });

  if (!response.ok) {
    throw new Error(`Target token failed: ${response.status}`);
  }

  return response.json();
  // { access_token: "eyJ...", token_type: "Bearer", expires_in: 900,
  //   issued_token_type: "urn:ietf:params:oauth:token-type:access_token",
  //   cache: "miss", jti: "uuid" }
}
```

#### 完整调用流程

```typescript
// 1. 获取 requester token
const requester = await getRequesterToken({
  authanyBaseUrl: "https://auth.your-company.com",
  agentId: "agent_prod_search",
  runtimeId: "runtime_search_cli",
  credential: "sk_live_abc123def456",
  targetResource: "erp-api",
  externalContext: {
    provider: "cli",
    subject_type: "user_id",
    subject_value: "user_12345"
  }
});

// 2. 换取 target access token
const target = await getTargetToken({
  authanyBaseUrl: "https://auth.your-company.com",
  requesterToken: requester.requester_token,
  targetResource: "erp-api"
});

// 3. 用 target token 调用目标资源
const result = await fetch("https://erp-api.internal/api/orders", {
  headers: {
    "authorization": `Bearer ${target.access_token}`
  }
});
```

### 4.3 Application 身份的委派

应用也可以作为委派主体 (不经过 Agent):

```typescript
// 阶段一: 应用身份获取 requester token
const requester = await fetch("https://auth.your-company.com/api/requester-token", {
  method: "POST",
  headers: {
    "authorization": `Bearer ${APP_SECRET}`,    // 应用密钥作为 Bearer token
    "content-type": "application/json"
  },
  body: JSON.stringify({
    grant_type: "urn:authany:params:oauth:grant-type:requester-token",
    principal_type: "application",
    app_id: "app_live_abc123",
    target_resource: "erp-api"
  })
});

// 阶段二: 与 Agent 相同
const target = await getTargetToken({
  authanyBaseUrl: "https://auth.your-company.com",
  requesterToken: requester.requester_token,
  targetResource: "erp-api"
});
```

### 4.4 External Context 说明

External Context 用于在令牌中携带调用上下文, 由目标资源服务解释:

```typescript
external_context: {
  provider: "lark" | "wechat" | "web" | "cli" | "mcp" | "webhook" | "workflow" | "scheduler",
  subject_type: "open_id" | "user_id" | "session_id" | "message_id" | "event_id",
  subject_value: "ou_xxx",          // 具体标识
  message_id: "msg_xxx",            // 可选
  session_id: "sess_xxx"            // 可选
}
```

- AuthAny 只负责将 context 签名进 JWT, **不解释** 其含义
- 目标资源服务负责解释 context 并执行业务授权
- 连接的 `external_context_mode` 控制策略:
  - `optional`: 允许有也允许无
  - `required`: 必须提供
  - `forbidden`: 不允许携带
  - 也可配合 `allowed_context_providers` 白名单

---

## 五、接入方式三: 目标资源服务 (验证令牌)

适用于: 接收 AuthAny Target Access Token 的后端 API 服务。

### 5.1 获取 JWKS 公钥

目标资源服务需要从 AuthAny 拉取公钥来验证 JWT 签名:

```
GET https://auth.your-company.com/.well-known/jwks.json
```

响应:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "alg": "RS256",
      "kid": "key-2026-001",
      "use": "sig",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

也可通过 OIDC Discovery 自动发现:

```
GET https://auth.your-company.com/.well-known/openid-configuration
```

### 5.2 验证 Target Access Token

以 Node.js (jose 库) 为例:

```typescript
import { jwtVerify, createRemoteJWKSet } from "jose";

// 从 AuthAny JWKS 端点拉取公钥
const JWKS = createRemoteJWKSet(
  new URL("https://auth.your-company.com/.well-known/jwks.json")
);

interface TargetAccessClaims {
  sub: string;          // "agent:agent_prod_search" 或 "app:app_live_abc123"
  aud: string;          // 目标资源的 audience
  iss: string;          // AuthAny base URL
  jti: string;          // 令牌唯一 ID
  exp: number;          // 过期时间
  token_use: string;    // 必须是 "target_access"
  target_resource: string;
  agent_id?: string;
  app_id?: string;
  delegation_type?: string;
  external_context?: Record<string, unknown>;
}

async function verifyTargetToken(
  authorization: string | undefined
): Promise<TargetAccessClaims> {
  // 1. 提取 Bearer token
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing Bearer token", { cause: 401 });
  }
  const token = authorization.slice(7);

  // 2. 验证 JWT 签名 + issuer + audience
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: "https://auth.your-company.com",
    audience: "https://erp-api.internal"    // 你的 audience
  });

  // 3. 校验必须的 claims
  if (payload.token_use !== "target_access") {
    throw new Error("Token is not a target access token", { cause: 401 });
  }

  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const agentId = typeof payload.agent_id === "string" ? payload.agent_id : "";
  const appId = typeof payload.app_id === "string" ? payload.app_id : "";

  if (!sub || (!agentId && !appId)) {
    throw new Error("Token missing subject or principal", { cause: 401 });
  }

  // 4. (可选) 通过内省端点检查令牌是否被吊销
  // POST https://auth.your-company.com/oauth/introspect

  return {
    ...payload,
    sub,
    agent_id: agentId || undefined,
    app_id: appId || undefined,
    token_use: "target_access"
  } as TargetAccessClaims;
}
```

### 5.3 在路由中使用

```typescript
// Fastify 示例
app.get("/api/resources/finance-summary", async (request, reply) => {
  try {
    const claims = await verifyTargetToken(request.headers.authorization);

    // 根据 claims 执行业务授权
    // claims.agent_id  → 哪个 Agent 在调用
    // claims.app_id    → 哪个应用在调用
    // claims.external_context → 调用上下文 (谁触发的, 通过什么渠道)

    return {
      resource: "finance-summary",
      access: {
        subject: claims.sub,
        agentId: claims.agent_id,
        appId: claims.app_id,
        externalContext: claims.external_context
      },
      data: { /* 业务数据 */ }
    };
  } catch (error) {
    reply.status(401);
    return { code: "invalid_token", message: "Token validation failed" };
  }
});
```

### 5.4 Token Introspection (可选, 更严格)

如果需要实时检查令牌是否被吊销:

```http
POST https://auth.your-company.com/oauth/introspect
Content-Type: application/json

{
  "token": "<target_access_token>",
  "client_id": "<your_client_id>",
  "client_secret": "<your_client_secret>"
}
```

响应:

```json
{
  "active": true,
  "sub": "agent:agent_prod_search",
  "aud": "https://erp-api.internal",
  "iss": "https://auth.your-company.com",
  "jti": "uuid",
  "exp": 1716000900,
  "token_use": "target_access",
  "target_resource": "erp-api",
  "agent_id": "agent_prod_search"
}
```

> 如果 `active` 为 `false`, 表示令牌已过期或被吊销。

---

## 六、Admin API 接口汇总

所有 Admin API 需要 Bearer Token (通过 OAuth 获取, scope 包含 `authany.admin`):

```http
POST https://auth.your-company.com/oauth/token
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "client_id": "<admin_client_id>",
  "client_secret": "<admin_client_secret>",
  "scope": "openid authany.admin"
}
```

### 应用管理

| 操作       | 方法   | 路径                                    |
| ---------- | ------ | --------------------------------------- |
| 列表       | GET    | `/api/v1/admin/applications`            |
| 创建       | POST   | `/api/v1/admin/applications`            |
| 详情       | GET    | `/api/v1/admin/applications/:id`        |
| 更新       | PATCH  | `/api/v1/admin/applications/:id`        |
| 轮换密钥   | POST   | `/api/v1/admin/applications/:id/secrets/rotate` |

### Agent 管理

| 操作         | 方法   | 路径                                          |
| ------------ | ------ | --------------------------------------------- |
| 列表         | GET    | `/api/v1/admin/agents`                        |
| 创建         | POST   | `/api/v1/admin/agents`                        |
| 详情         | GET    | `/api/v1/admin/agents/:id`                    |
| Runtime 列表 | GET    | `/api/v1/admin/runtimes?agent_id=:agentId`   |
| Runtime 创建 | POST   | `/api/v1/admin/runtimes`                      |
| 凭据列表     | GET    | `/api/v1/admin/agents/:id/credentials`        |
| 签发凭据     | POST   | `/api/v1/admin/agents/:id/credentials`        |
| 吊销凭据     | POST   | `/api/v1/admin/credentials/:id/revoke`        |

### 目标资源管理

| 操作     | 方法   | 路径                                                    |
| -------- | ------ | ------------------------------------------------------- |
| 列表     | GET    | `/api/v1/admin/target-resources`                    |
| 创建     | POST   | `/api/v1/admin/target-resources`                    |
| 详情     | GET    | `/api/v1/admin/target-resources/:id`                |
| 连接列表 | GET    | `/api/v1/admin/target-connections`                  |
| 创建连接 | POST   | `/api/v1/admin/target-connections`                  |
| 授权列表 | GET    | `/api/v1/admin/access-grants`                       |
| 创建授权 | POST   | `/api/v1/admin/access-grants`                       |
| 更新授权 | PATCH  | `/api/v1/admin/access-grants/:id`                   |

### 密钥管理

| 操作     | 方法   | 路径                         |
| -------- | ------ | ---------------------------- |
| 列表     | GET    | `/api/v1/admin/keys`          |
| 生成     | POST   | `/api/v1/admin/keys`          |
| 激活     | POST   | `/api/v1/admin/keys/:id/activate` |
| 退役     | POST   | `/api/v1/admin/keys/:id/retire` |

### 审计日志

| 操作 | 方法 | 路径                    |
| ---- | ---- | ----------------------- |
| 查询 | GET  | `/api/v1/admin/audit-events` |

### 健康检查 (无需认证)

| 端点       | 说明                                  |
| ---------- | ------------------------------------- |
| `GET /health` | 存活探针                            |
| `GET /ready`  | 就绪探针 (检查 DB + Redis 连接)     |

---

## 七、OIDC Discovery 端点

标准 OIDC 发现端点, 供兼容库自动配置:

```
GET /.well-known/openid-configuration
```

响应示例:

```json
{
  "issuer": "https://auth.your-company.com",
  "authorization_endpoint": "https://auth.your-company.com/oauth/authorize",
  "token_endpoint": "https://auth.your-company.com/oauth/token",
  "userinfo_endpoint": "https://auth.your-company.com/oauth/userinfo",
  "jwks_uri": "https://auth.your-company.com/.well-known/jwks.json",
  "revocation_endpoint": "https://auth.your-company.com/oauth/revoke",
  "introspection_endpoint": "https://auth.your-company.com/oauth/introspect",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token", "client_credentials"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["openid", "profile", "email", "offline_access"],
  "token_endpoint_auth_methods_supported": ["client_secret_post"]
}
```

---

## 八、常见场景速查

### 场景 A: Web 应用用户登录

```
1. 管理员创建 OAuth Client (redirect_uri 指向应用)
2. 应用实现 Authorization Code + PKCE 流程
3. 拿到 access_token 后调用 /oauth/userinfo 获取用户信息
4. 建立本地 session
```

### 场景 B: 后端服务调用目标 API

```
1. 管理员创建 OAuth Client + 注册目标资源 + 创建连接和授权
2. 服务用 client_credentials 获取 access_token (管理用)
   或用两阶段委派获取 target_access_token (访问目标资源)
3. 用 target_access_token 调用目标 API
```

### 场景 C: AI Agent 访问内部系统

```
1. 管理员创建 Agent + Runtime + 签发凭据
2. 注册目标资源 + 创建 Agent→目标资源的连接 + 授权
3. Agent 运行时:
   a. 用凭据获取 requester_token (5分钟)
   b. 用 requester_token 换取 target_access_token (15分钟)
   c. 用 target_access_token 调用目标 API
4. target_access_token 支持缓存复用 (相同参数不会重复签发)
```

### 场景 D: MCP Server 接入

```
1. 按 "场景 C" 准备 Agent / Runtime / 连接 / 授权
2. MCP Server 在 tool 执行时:
   a. 携带 external_context (用户来源: lark/wechat/web...)
   b. 获取 requester_token → target_access_token
   c. 调用目标 API 并返回结果
```

---

## 九、错误码参考

| HTTP 状态 | 错误码                       | 说明                          |
| --------- | ---------------------------- | ----------------------------- |
| 400       | `unsupported_grant_type`     | 不支持的 grant_type           |
| 400       | `invalid_grant`              | 授权码/refresh token 无效     |
| 400       | `invalid_scope`              | 请求的 scope 不被允许         |
| 401       | `invalid_credentials`        | 用户名或密码错误              |
| 401       | `invalid_client`             | client_id 或 client_secret 错误 |
| 401       | `invalid_requester_jwt`      | requester token 无效          |
| 401       | `invalid_app_secret`         | 应用密钥无效                  |
| 401       | `invalid_token`              | access token 无效或过期       |
| 403       | `insufficient_scope`         | 权限不足                      |
| 403       | `invalid_agent`              | Agent 无效或未激活            |
| 403       | `invalid_runtime`            | Runtime 无效或未激活          |
| 403       | `connection_not_allowed`     | 主体与目标资源之间无有效连接  |
| 403       | `access_not_allowed`         | 连接无有效授权                |
| 429       | `account_locked`             | 登录失败次数过多, 账户锁定    |
| 429       | `rate_limit_exceeded`        | 请求频率超限                  |

---

## 十、安全最佳实践

### 对于业务应用

- `client_id` 可以出现在日志和配置中
- `client_secret` 绝不能暴露在前端代码中
- 生产环境必须使用 HTTPS
- 严格验证 `redirect_uri`
- 始终使用 PKCE (S256)

### 对于 Agent / Runtime

- `agent_id` 是公开的, 可以出现在日志和 token claims 中
- `caller_credential` 是私密的, 绝不能暴露
- Requester Token 有效期仅 5 分钟, 不可复用 (replay protection)
- Target Access Token 支持缓存复用, 避免不必要的签名开销
- 不要信任未经签名的 `sender_id`, 必须通过 JWT claims 验证

### 对于目标资源服务

- 必须验证 JWT 签名 (RS256 + JWKS)
- 必须校验 `iss` (AuthAny URL) 和 `aud` (你的 audience)
- 必须检查 `token_use === "target_access"`
- 检查 `exp` 确保未过期
- 根据 `external_context` 执行业务级授权
- 不要直接接受 secret 或 api_key, 只接受签发的 JWT
