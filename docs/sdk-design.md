# AuthAny SDK 设计方案

> 面向两类使用者：
> 1. 请求端：application / agent runtime / CLI / OpenClaw 这类服务端机器调用方
> 2. 验证端：Node.js / Java 资源服务

---

## 一、设计目标

SDK 要解决三件事：

1. **低层 Token Exchange**
   把 `caller credential -> requester token -> target token` 这条链路封装起来。
2. **运行时适配**
   覆盖 OpenClaw / Claude Code / Codex / 自定义服务进程这类“需要先换 token，再调用业务 CLI 或下游服务”的场景。
3. **资源服务验签**
   让资源服务以统一方式校验 `target_access` token。

SDK 的边界是：

- **负责**
  - 调 AuthAny Server
  - 处理两跳 exchange
  - 处理 requester token 不可复用的重放语义
  - 给运行时构建一次性短期授权环境
  - 验签并返回原始 claims
- **不负责**
  - Web 框架中间件
  - 业务权限判定
  - 聊天用户与业务用户绑定
  - 长期 token 缓存
  - 管理 OpenClaw / Claude / Codex 自身的长期启动环境

---

## 二、包结构

一个包：`@authany/sdk`

```
packages/sdk/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── eslint.config.mjs
├── src/
│   ├── index.ts                # barrel export
│   ├── exchange-client.ts      # AuthAnyClient（低层 exchange）
│   ├── runtime-adapter.ts      # AuthorizedRuntime（高层运行时适配）
│   ├── verifier.ts             # TargetTokenVerifier（验证端）
│   ├── types.ts                # 公开类型定义
│   ├── errors.ts               # 错误类型
│   └── grant-types.ts          # grant_type 常量
└── test/
    ├── exchange-client.test.ts
    ├── runtime-adapter.test.ts
    └── verifier.test.ts
```

---

## 三、设计决策

以下为开发前的讨论结论，作为设计约束。

### 3.1 两跳 exchange 对调用方透明

换 token 实际是两步：

```
/api/requester-token -> requester token
/api/target-token    -> target access token
```

但业务方只需要调用一个公开方法。requester token 是内部中间产物，不属于公开 API。

### 3.2 不做客户端 Token 缓存

AuthAny Server 已在 Redis 中缓存 target token，SDK 不再做本地缓存。每次调用都请求 server，由 server 决定是否命中缓存。

### 3.3 requester token 不可复用，重试必须重走全流程

这是本设计最重要的安全约束之一。

- requester token 会进入 replay protection 链路
- SDK **不能**缓存 requester token
- SDK **不能**在第二跳失败时只重试 `/api/target-token`
- 若需要重试，必须重新执行：

```
caller credential
  -> /api/requester-token
  -> /api/target-token
```

换句话说，SDK 可以对“整个 exchange 操作”做有限重试策略，但不能对“第二跳单独重试”。

### 3.4 Claims 直接返回原始对象

不做语义包装层，不提供 `isAgent()`、`principalId()` 这类 helper。调用方直接读取 `agent_id`、`app_id`、`target_resource`、`external_context` 等字段。

### 3.5 合并为一个包

请求端、运行时适配、验证端合并为 `@authany/sdk`，不拆多个包。

理由：

- 使用者都是服务端程序
- 依赖轻量
- 低层 exchange 和高层 runtime adapter 会共享错误模型和类型

### 3.6 不做 Web 框架中间件

SDK 不提供 Express / Fastify / NestJS middleware。只做纯逻辑。

- 请求端：给配置，返回 token 或运行时环境
- 验证端：给 token 字符串，返回 claims

### 3.7 验证端只接收纯 token 字符串

验证端 API 只暴露：

```typescript
verify(token: string)
```

不负责从 `Authorization` header 中提取 `"Bearer "` 前缀。

### 3.8 身份信息放构造时，target 放调用时

一个 runtime 的身份通常是固定的，`target resource` 和 `externalContext` 是动态的。

- **构造参数（我是谁）**
  - issuer
  - callerCredential
  - principalType
  - agentId / appId
  - runtimeId
- **调用参数（我要访问什么）**
  - targetResource
  - externalContext

### 3.9 externalContext 只在调用时传入

构造时不设置默认值。`externalContext` 是运行时动态数据，不是静态配置。

同时强约束：

- 不得放 secret、refresh token、长期凭证
- 只放稳定 ID 和安全的上下文元数据

### 3.10 低层 API 返回丰富对象，同时提供便捷字符串方法

纯字符串 API 太省事，但会丢掉运行时排障所需的元信息。因此：

- 低层 exchange API 返回 `TargetTokenResult`
- 同时提供便捷方法返回纯 JWT 字符串

这样兼顾：

- 简单 CLI 使用体验
- 生产环境日志、观测、调试能力

### 3.11 提供高层运行时适配层

SDK 不只提供低层 HTTP client，还要提供“把短期 token 放到这次业务 CLI 调用里”的高层适配层。

这个适配层的安全目标是：

- 长期 `callerCredential` 只存在于宿主 runtime
- 下游业务 CLI 只拿到短期 `target access token`
- 动态 token 只进入“本次子进程 env”，不进入上层 Claude / Codex / OpenClaw 的共享长进程启动环境

### 3.12 首版运行时范围

首版 Node SDK 目标环境：

- Node.js 18+
- 服务端 / CLI / runtime 场景
- ESM 发布

如果后续需要 CommonJS 双产物，再单独扩展发布配置；首版先保证 AuthAny 设计和运行时语义稳定。

---

## 四、请求端低层 API — AuthAnyClient

### 职责

给 application / runtime / CLI 使用，封装 token exchange 流程：

```
Caller Credential
  -> POST /api/requester-token
  -> requester token（内部中间产物）
  -> POST /api/target-token
  -> target access token（公开结果）
```

### 公开 API

```typescript
import { AuthAnyClient } from "@authany/sdk";

const client = new AuthAnyClient({
  issuer: "https://authany.company.com",
  callerCredential: "agent-secret-xxx",
  principalType: "agent",
  agentId: "cli-agent-1",
  runtimeId: "runtime-001",
});

const result = await client.exchangeTargetToken("order-service");
// {
//   accessToken: "eyJhbGciOiJSUzI1NiIs...",
//   tokenType: "Bearer",
//   expiresIn: 900,
//   issuedTokenType: "target_access_token",
//   cache: "hit",
//   jti: "uuid-xxx"
// }

const token = await client.getAccessToken("order-service");
// "eyJhbGciOiJSUzI1NiIs..."

const withContext = await client.exchangeTargetToken("order-service", {
  externalContext: {
    provider: "lark",
    subject_type: "open_id",
    subject_value: "ou_xxx",
    message_id: "om_xxx",
  },
});
```

### 构造参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `issuer` | `string` | 是 | AuthAny Server 地址 |
| `callerCredential` | `string` | 是 | 运行时持有的 caller credential。对 agent 是 caller secret；对 application 是 app secret |
| `principalType` | `"agent" \| "application"` | 是 | 调用方类型 |
| `agentId` | `string` | agent 时必填 | Agent ID |
| `appId` | `string` | application 时必填 | Application ID |
| `runtimeId` | `string` | 否 | Runtime 注册 ID |
| `fetch` | `typeof fetch` | 否 | 自定义 fetch 实现，默认用全局 `fetch` |
| `timeoutMs` | `number` | 否 | 单次 HTTP 请求超时，默认 10000ms |
| `headers` | `Record<string, string>` | 否 | 每次请求附加的静态 header，例如 `User-Agent` |

### 方法

| 方法 | 返回 | 说明 |
|------|------|------|
| `exchangeTargetToken(targetResource: string, options?: { externalContext?: Record<string, unknown>; signal?: AbortSignal })` | `Promise<TargetTokenResult>` | 执行完整 exchange，返回丰富结果 |
| `getAccessToken(targetResource: string, options?: { externalContext?: Record<string, unknown>; signal?: AbortSignal })` | `Promise<string>` | 便捷方法，只返回 JWT 字符串 |

### 内部流程

```
exchangeTargetToken(targetResource, options?)
  ├── POST /api/requester-token
  │     Header: Authorization: Bearer <callerCredential>
  │     Body: {
  │       grant_type,
  │       principal_type,
  │       agent_id | app_id,
  │       runtime_id,
  │       target_resource,
  │       external_context
  │     }
  │     Response: {
  │       requester_token,
  │       token_type,
  │       expires_in
  │     }
  │
  └── POST /api/target-token
        Header: Authorization: Bearer <requester_token>
        Body: {
          grant_type,
          target_resource
        }
        Response: {
          access_token,
          token_type,
          expires_in,
          issued_token_type,
          cache,
          jti
        }
```

### 重试与失败处理

- `exchangeTargetToken()` 内部不复用 requester token
- `/api/target-token` 失败时，不允许仅重试第二跳
- 如要实现 SDK 内部有限重试，只能对“整个 exchange 操作”做一次新的完整调用
- 网络超时、5xx、`replay_protection_unavailable` 等错误可以被上层策略识别
- `request_replayed` 视为安全失败，不应自动用同一个 requester token 重试

---

## 五、运行时适配层 — AuthorizedRuntime

### 职责

高层适配“先换 token，再调用业务 CLI 或下游服务”的场景。

这层存在的原因不是为了省几行代码，而是为了把安全边界做对：

- `callerCredential` 只留在宿主 runtime
- 下游业务 CLI / 子进程只收到短期 token
- token 只进入“本次调用”的 env
- 不污染上层 Claude / Codex / OpenClaw 的共享长进程启动环境

### 适用场景

- OpenClaw 的 `before_tool_call` / `exec` hook
- OpenClaw 调用业务 CLI（如 `ebfx ...`）
- Claude Code / Codex 作为上层模型 runtime，但真正访问资源服务器仍需经过业务 CLI
- 其他自定义 agent runtime

### 公开 API

```typescript
import { AuthAnyClient, AuthorizedRuntime } from "@authany/sdk";

const client = new AuthAnyClient({
  issuer: process.env.AUTHANY_URL!,
  callerCredential: process.env.AUTHANY_CALLER_CREDENTIAL!,
  principalType: "agent",
  agentId: process.env.AUTHANY_AGENT_ID!,
  runtimeId: process.env.AUTHANY_RUNTIME_ID,
});

const runtime = new AuthorizedRuntime({
  client,
  tokenEnvName: "AUTHANY_TARGET_ACCESS_TOKEN",
});

const env = await runtime.buildAuthorizedEnv("order-service", {
  baseEnv: process.env,
  externalContext: {
    provider: "lark",
    subject_type: "open_id",
    subject_value: "ou_xxx",
    message_id: "om_xxx",
  },
});

// env.AUTHANY_TARGET_ACCESS_TOKEN 已可传给子进程
```

### 构造参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `client` | `AuthAnyClient` | 是 | 低层 exchange client |
| `tokenEnvName` | `string` | 否 | 默认 `AUTHANY_TARGET_ACCESS_TOKEN` |

### 方法

| 方法 | 返回 | 说明 |
|------|------|------|
| `issue(targetResource: string, options?: { externalContext?: Record<string, unknown>; signal?: AbortSignal })` | `Promise<TargetTokenResult>` | 调用低层 exchange |
| `buildAuthorizedEnv(targetResource: string, options?: { baseEnv?: NodeJS.ProcessEnv \| Record<string, string>; externalContext?: Record<string, unknown>; tokenEnvName?: string; signal?: AbortSignal })` | `Promise<Record<string, string>>` | 生成当前调用专用 env |
| `runCommand(command: string, args: string[], options: { cwd?: string; env?: Record<string, string>; externalContext?: Record<string, unknown>; targetResource: string; stdin?: string; signal?: AbortSignal })` | `Promise<CommandRunResult>` | 先换 token，再执行业务 CLI |

```typescript
interface CommandRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  signal?: NodeJS.Signals;
  token: TargetTokenResult;
}
```

### 设计约束

1. `buildAuthorizedEnv()` 只写入短期 target token
2. 不向子进程传递 `callerCredential`
3. 不修改全局 `process.env`
4. 返回的 env 只用于当前一次 spawn / exec

### OpenClaw 集成方式

在 OpenClaw 里，推荐这样用：

```typescript
// 伪代码
api.on("before_tool_call", async (event, ctx) => {
  if (event.toolName !== "exec") return;
  if (!event.params.command.startsWith("ebfx ")) return;

  const env = await runtime.buildAuthorizedEnv("ebfx", {
    baseEnv: event.params.env,
    externalContext: {
      provider: "lark",
      subject_type: "open_id",
      subject_value: ctx.senderId,
      message_id: ctx.messageId,
    },
  });

  return {
    params: {
      ...event.params,
      env,
    },
  };
});
```

### 与 Claude Code / Codex 的关系

Claude Code / Codex 作为上层模型 runtime 时，不应该直接持有 AuthAny caller credential。

正确模式是：

```text
Claude/Codex
  -> 请求 OpenClaw 执行业务 CLI
  -> OpenClaw 调 AuthorizedRuntime
  -> 只把短期 token 注入这次 CLI 子进程
  -> 业务 CLI 调资源服务器
```

---

## 六、验证端 — TargetTokenVerifier

### 职责

给资源服务使用，验签并解析 target token：

```
Token 字符串 -> 拉取 JWKS -> 验签 -> 校验 claims -> 返回 claims
```

与 Web 框架无关。Express、Fastify、NestJS、原生 HTTP 都可直接调用。

### 公开 API

```typescript
import { TargetTokenVerifier } from "@authany/sdk";

const verifier = new TargetTokenVerifier({
  issuer: "https://authany.company.com",
  audience: "order-service",
  targetResource: "order-service",
  clockToleranceSeconds: 5,
});

const claims = await verifier.verify(tokenString);
```

### 配置项

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `issuer` | `string` | 是 | AuthAny Server 地址 |
| `audience` | `string \| string[]` | 是 | 本服务期望的 audience |
| `targetResource` | `string` | 否 | 额外校验 `target_resource` |
| `clockToleranceSeconds` | `number` | 否 | 时钟容差，默认 5 秒 |
| `fetch` | `typeof fetch` | 否 | 自定义 fetch，用于拉 JWKS |
| `jwksTimeoutMs` | `number` | 否 | JWKS 拉取超时，默认 5000ms |

### 方法

| 方法 | 返回 | 说明 |
|------|------|------|
| `verify(token: string, options?: { signal?: AbortSignal })` | `Promise<TargetAccessClaims>` | 验证 JWT，返回 claims |

### 验证规则

按顺序执行：

1. **签名验证**：通过远程 JWKS 验签
2. **iss 校验**：匹配 AuthAny 地址
3. **aud 校验**：匹配本服务 audience
4. **exp / nbf 校验**：含 clock tolerance
5. **token_use 校验**：必须为 `"target_access"`
6. **主体存在性校验**：必须至少有一个主体身份字段
7. **sub 一致性校验**：`sub` 前缀与 `agent_id` / `app_id` 一致
8. **target_resource 校验**：如配置则必须匹配

### JWKS 缓存

`jose` 的 `createRemoteJWKSet` 会根据 HTTP `Cache-Control` 自动缓存。AuthAny Server 当前返回 `Cache-Control: public, max-age=300`，即 5 分钟自动刷新。

### 网络控制

为避免 verifier 的网络行为失控，首版提供：

- 自定义 `fetch`
- `jwksTimeoutMs`
- `AbortSignal`

不提供框架 middleware，但保留资源服务对网络层的控制。

---

## 七、Target Token Claims 结构

SDK 返回的 claims 对象字段：

```typescript
interface TargetAccessClaims {
  // 标准 JWT 字段
  iss: string;
  aud: string | string[];
  sub: string;
  exp: number;
  iat: number;
  jti: string;

  // AuthAny 业务字段
  token_use: "target_access";
  target_resource: string;
  agent_id?: string;
  app_id?: string;
  delegation_type?: string;
  external_context?: Record<string, unknown>;
}
```

claims 保持原始 JWT payload 形态，不做 camelCase 转换。

---

## 八、结果对象与错误类型

### 8.1 exchange 结果对象

```typescript
interface TargetTokenResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  issuedTokenType: string;
  cache: "hit" | "miss" | "backend_error";
  jti: string;
}
```

### 8.2 请求端错误

```typescript
class AuthAnyError extends Error {
  code: string;
}

class AuthAnyApiError extends AuthAnyError {
  statusCode: number;
  data?: unknown;
}

class RequesterTokenError extends AuthAnyApiError {}
class TargetTokenError extends AuthAnyApiError {}
class AuthAnyConnectionError extends AuthAnyError {}
class AuthAnyTimeoutError extends AuthAnyError {}
```

### 8.3 验证端错误

```typescript
class TokenVerificationError extends Error {
  code:
    | "missing_token"
    | "invalid_token"
    | "invalid_token_use"
    | "invalid_principal"
    | "subject_mismatch"
    | "target_resource_mismatch"
    | "jwks_fetch_failed";
}
```

### 8.4 服务端错误码对齐

请求端可能收到的服务端错误码以当前 AuthAny Server 实现为准：

| 错误码 | 含义 |
|--------|------|
| `unsupported_grant_type` | grant_type 不正确 |
| `invalid_caller_credential` | Agent caller credential 无效 |
| `invalid_agent` | Agent 不存在或未激活 |
| `invalid_application` | Application 不存在或未激活 |
| `invalid_app_secret` | Application Secret 无效 |
| `invalid_runtime` | Runtime 不存在、未激活，或不属于该 Agent |
| `invalid_target_resource` | Target resource 不存在或未激活 |
| `invalid_requester_jwt` | requester token 缺失、无效、token_use 不对、主体不一致、target 不匹配 |
| `connection_not_allowed` | 未配置到目标资源的连接 |
| `access_not_allowed` | 无访问授权 |
| `request_replayed` | 请求被重放 |
| `replay_protection_unavailable` | replay protection 后端不可用 |

本地 verifier 抛出的错误码是 SDK 自己的错误面，不要求与服务端 HTTP 错误码完全一致。

---

## 九、使用示例

### 9.1 application / runtime 直接调下游 HTTP 服务

```typescript
import { AuthAnyClient } from "@authany/sdk";

const client = new AuthAnyClient({
  issuer: process.env.AUTHANY_URL!,
  callerCredential: process.env.AUTHANY_CALLER_CREDENTIAL!,
  principalType: "agent",
  agentId: process.env.AUTHANY_AGENT_ID!,
  runtimeId: process.env.AUTHANY_RUNTIME_ID,
});

const token = await client.getAccessToken("order-service", {
  externalContext: {
    provider: "workflow",
    workflow_id: "wf-001",
    event_id: "evt-002",
  },
});

const res = await fetch("https://order.company.com/api/orders", {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 9.2 运行时通过业务 CLI 调资源服务器

```typescript
import { AuthAnyClient, AuthorizedRuntime } from "@authany/sdk";
import { spawn } from "node:child_process";

const client = new AuthAnyClient({
  issuer: process.env.AUTHANY_URL!,
  callerCredential: process.env.AUTHANY_CALLER_CREDENTIAL!,
  principalType: "agent",
  agentId: process.env.AUTHANY_AGENT_ID!,
  runtimeId: process.env.AUTHANY_RUNTIME_ID,
});

const runtime = new AuthorizedRuntime({ client });

const env = await runtime.buildAuthorizedEnv("ebfx", {
  baseEnv: process.env,
  externalContext: {
    provider: "lark",
    subject_type: "open_id",
    subject_value: "ou_xxx",
    message_id: "om_xxx",
  },
});

spawn("ebfx", ["dashboard", "pending"], {
  env,
  stdio: "inherit",
});
```

### 9.3 Node.js 资源服务端

```typescript
import Fastify from "fastify";
import { TargetTokenVerifier } from "@authany/sdk";

const verifier = new TargetTokenVerifier({
  issuer: "https://authany.company.com",
  audience: "order-service",
  targetResource: "order-service",
});

const app = Fastify();

app.get("/api/orders", async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "missing token" });
  }

  const token = authHeader.slice(7);
  const claims = await verifier.verify(token);

  return orderService.queryByAgent(claims.agent_id!);
});
```

---

## 十、Java SDK 规划（后续独立实现）

> 独立 Maven 项目，不在当前 pnpm monorepo 中。先完成 Node.js 版本后再实现。

### 核心范围

- 仅实现 verifier
- 不实现运行时 CLI 适配
- 与 Node SDK 对齐 claims 和校验规则

### 仓库结构

```
authany-java-sdk/
├── pom.xml
├── src/main/java/com/company/authany/
│   ├── AuthAnyTokenVerifier.java
│   ├── TargetAccessClaims.java
│   └── TokenVerificationException.java
└── src/test/java/com/company/authany/
    └── AuthAnyTokenVerifierTest.java
```

### Maven 依赖

- `com.nimbusds:nimbus-jose-jwt:9.37`
- 无其他强依赖

---

## 十一、工程配置

### package.json

```json
{
  "name": "@authany/sdk",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "jose": "^6.0.11"
  },
  "devDependencies": {
    "@eslint/js": "latest",
    "@types/node": "latest",
    "@vitest/coverage-v8": "^3.2.4",
    "eslint": "^9.39.1",
    "typescript": "latest",
    "typescript-eslint": "latest",
    "vitest": "^3.2.4"
  }
}
```

### tsconfig.json

保持 ESM 模式：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "vitest.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 打包输出

- 构建方式：`tsc -p tsconfig.build.json`
- 输出格式：ESM
- 输出目录：`dist/`
- 首版目标：Node.js 18+ 服务端程序

---

## 十二、测试用例

### 12.1 exchange-client.test.ts

测试策略：mock `fetch`，不启动真实 AuthAny Server。

#### 基本功能

| # | 用例名 | 验证点 |
|---|--------|--------|
| 1 | agent 类型完整 exchange | 两次 fetch，返回 `TargetTokenResult` |
| 2 | application 类型完整 exchange | requester body 带 `app_id` |
| 3 | 带 runtimeId | requester body 带 `runtime_id` |
| 4 | 带 externalContext | requester body 带 `external_context` |
| 5 | 便捷方法 `getAccessToken()` | 只返回字符串 |

#### 请求正确性

| # | 用例名 | 验证点 |
|---|--------|--------|
| 6 | requester-token Authorization | `Bearer <callerCredential>` |
| 7 | requester-token grant_type | `urn:authany:params:oauth:grant-type:requester-token` |
| 8 | target-token Authorization | `Bearer <requester_token>` |
| 9 | target-token grant_type | `urn:authany:params:oauth:grant-type:target-access` |
| 10 | target-token 返回字段映射 | `access_token/expires_in/cache/jti/issued_token_type -> TargetTokenResult` |

#### 重试与错误处理

| # | 用例名 | 验证点 |
|---|--------|--------|
| 11 | requester-token 返回 401 | 抛出 `RequesterTokenError` |
| 12 | target-token 返回 403 | 抛出 `TargetTokenError` |
| 13 | 网络不可达 | 抛出 `AuthAnyConnectionError` |
| 14 | 超时 | 抛出 `AuthAnyTimeoutError` |
| 15 | 第二跳失败后再次调用 | 必须重新请求 requester-token，不复用旧 requester token |
| 16 | `principalType="agent"` 但未传 `agentId` | 构造时抛错 |
| 17 | `principalType="application"` 但未传 `appId` | 构造时抛错 |

### 12.2 runtime-adapter.test.ts

| # | 用例名 | 验证点 |
|---|--------|--------|
| 1 | `buildAuthorizedEnv()` 仅注入短期 token | 输出 env 包含 `AUTHANY_TARGET_ACCESS_TOKEN` |
| 2 | 不泄露 callerCredential | 输出 env 不含长期凭证 |
| 3 | 自定义 tokenEnvName | 使用调用时指定 env key |
| 4 | `runCommand()` 调 CLI | 子进程拿到短期 token |
| 5 | 多次调用隔离 | 不共享上一次 token env 对象 |

### 12.3 verifier.test.ts

测试策略：用 `jose.generateKeyPair("RS256")` 生成测试密钥，mock JWKS 端点。

| # | 用例名 | 验证点 |
|---|--------|--------|
| 1 | 合法 agent token | 返回 claims，`agent_id` 正确 |
| 2 | 合法 application token | 返回 claims，`app_id` 正确 |
| 3 | external_context 存在 | 正确返回 |
| 4 | 错误密钥签名 | `invalid_token` |
| 5 | JWT 格式非法 | `invalid_token` |
| 6 | iss 不匹配 | 抛错 |
| 7 | aud 不匹配 | 抛错 |
| 8 | token 已过期 | `invalid_token` |
| 9 | token_use 非 `target_access` | `invalid_token_use` |
| 10 | sub 与 agent_id 不一致 | `subject_mismatch` |
| 11 | sub 与 app_id 不一致 | `subject_mismatch` |
| 12 | 既没有 agent_id 也没有 app_id | `invalid_principal` |
| 13 | targetResource 配置后不匹配 | `target_resource_mismatch` |
| 14 | JWKS 拉取失败 | `jwks_fetch_failed` |
| 15 | clockTolerance 生效 | 刚过期 token 仍可通过 |

---

## 十三、验收规范

### 13.1 构建验收

```bash
pnpm install
pnpm --filter @authany/sdk build
pnpm --filter @authany/sdk typecheck
pnpm --filter @authany/sdk lint
```

要求：

- `tsc` 零错误
- `eslint` 零错误
- `dist/` 目录生成 `.js` + `.d.ts`

### 13.2 测试验收

```bash
pnpm --filter @authany/sdk test
```

要求：

- 全部测试通过
- `src/**/*.ts`（排除 type-only 文件）行覆盖率 ≥ 90%

### 13.3 类型验收

```typescript
import {
  AuthAnyClient,
  AuthorizedRuntime,
  TargetTokenVerifier,
} from "@authany/sdk";
import type {
  AuthAnyClientConfig,
  AuthorizedRuntimeConfig,
  TargetAccessClaims,
  TargetTokenResult,
  TargetTokenVerifierConfig,
} from "@authany/sdk";

const clientConfig: AuthAnyClientConfig = { ... };
const runtimeConfig: AuthorizedRuntimeConfig = { ... };
const result: TargetTokenResult = await client.exchangeTargetToken("order-service");
const claims: TargetAccessClaims = await verifier.verify(token);
```

### 13.4 集成验收

端到端验证完整链路：

```text
① 启动 AuthAny Server + PostgreSQL + Redis
② 启动 example/target-service（改用 @authany/sdk 的 TargetTokenVerifier）
③ 用 @authany/sdk 的 AuthAnyClient 换取 target token
④ 用 token 调用 target-service
⑤ target-service 验签通过，返回业务数据
⑥ 用 AuthorizedRuntime 给一次 CLI 调用注入短期 token
⑦ CLI 使用短期 token 成功访问资源服务器
```

### 13.5 OpenClaw 集成验收

```text
① OpenClaw 持有 AUTHANY_CALLER_CREDENTIAL / AUTHANY_AGENT_ID / AUTHANY_RUNTIME_ID
② before_tool_call 拦截 ebfx exec
③ 用 AuthorizedRuntime.buildAuthorizedEnv() 注入 AUTHANY_TARGET_ACCESS_TOKEN
④ ebfx CLI 能从 env 读取短期 token
⑤ caller credential 不进入 CLI 子进程 env
```

---

## 十四、工作区配置

更新 `pnpm-workspace.yaml`：

```yaml
packages:
  - server
  - apps/*
  - example/*
  - packages/*
```
