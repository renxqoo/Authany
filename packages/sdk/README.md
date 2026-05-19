# `@authany/sdk`

AuthAny 的服务端 SDK，提供三类能力：

- 请求端两跳 token exchange：`caller credential -> requester token -> target access token`
- 运行时适配：给一次 CLI / 子进程调用注入短期 token
- 资源服务验签：校验 `target_access` token 并返回 claims

适用场景：

- OpenClaw / agent runtime 调业务 CLI
- 服务端 application 直连下游资源服务
- 资源服务校验 AuthAny 签发的 target token

不适用场景：

- 浏览器前端
- Web middleware 封装
- 长期 token 缓存
- 聊天用户与业务用户绑定逻辑

## 1. 环境要求

- Node.js `>= 18`
- ESM 项目
- 可以访问 AuthAny Server

当前包导出：

- `AuthAnyClient`
- `AuthorizedRuntime`
- `TargetTokenVerifier`
- 错误类型与公开 TypeScript 类型

## 2. 安装

如果在本 monorepo 内使用：

```bash
pnpm --filter @authany/sdk build
```

然后在其他 workspace 里通过：

```json
{
  "dependencies": {
    "@authany/sdk": "workspace:*"
  }
}
```

如果未来发布到 npm，再按普通 npm 包方式安装即可。

## 3. 核心概念

### 3.1 两跳 exchange

SDK 内部调用两个接口：

1. `POST /api/requester-token`
2. `POST /api/target-token`

你只需要调用一个公开方法：

```ts
await client.exchangeTargetToken("order-service");
```

### 3.2 两类主体

- `agent`
- `application`

二选一：

- `principalType: "agent"` 时必须传 `agentId`
- `principalType: "application"` 时必须传 `appId`

### 3.3 长期凭证和短期 token

- `callerCredential` 是长期凭证，只应该保存在宿主 runtime 或服务端
- `target access token` 是短期 token，才允许传给下游 CLI / 资源服务

## 4. 快速开始

### 4.1 Agent 换取 target token

```ts
import { AuthAnyClient } from "@authany/sdk";

const client = new AuthAnyClient({
  issuer: process.env.AUTHANY_ISSUER!,
  callerCredential: process.env.AUTHANY_CALLER_CREDENTIAL!,
  principalType: "agent",
  agentId: process.env.AUTHANY_AGENT_ID!,
  runtimeId: process.env.AUTHANY_RUNTIME_ID
});

const result = await client.exchangeTargetToken("ebfx");

console.log(result.accessToken);
console.log(result.expiresIn);
console.log(result.cache);
```

### 4.2 只取字符串 token

```ts
const accessToken = await client.getAccessToken("ebfx");
```

### 4.3 Application 场景

```ts
import { AuthAnyClient } from "@authany/sdk";

const client = new AuthAnyClient({
  issuer: process.env.AUTHANY_ISSUER!,
  callerCredential: process.env.AUTHANY_CALLER_CREDENTIAL!,
  principalType: "application",
  appId: process.env.AUTHANY_APP_ID!
});

const token = await client.getAccessToken("order-service");
```

## 5. 配置说明

### 5.1 `AuthAnyClient` 配置

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `issuer` | 是 | AuthAny Server 地址，例如 `https://authany.company.com` |
| `callerCredential` | 是 | 长期 caller credential |
| `principalType` | 是 | `"agent"` 或 `"application"` |
| `agentId` | agent 时必填 | Agent ID |
| `appId` | application 时必填 | Application ID |
| `runtimeId` | 否 | Runtime ID，agent 场景常用 |
| `fetch` | 否 | 自定义 `fetch` |
| `timeoutMs` | 否 | 单次 HTTP 请求超时，默认 `10000` |
| `headers` | 否 | 附加静态 header，例如 `User-Agent` |

### 5.2 `exchangeTargetToken()` 参数

```ts
await client.exchangeTargetToken("ebfx", {
  externalContext: {
    provider: "lark",
    subject_type: "open_id",
    subject_value: "ou_xxx",
    message_id: "om_xxx"
  },
  signal
});
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `targetResource` | 是 | 目标资源代码 |
| `externalContext` | 否 | 透传到 target token claims 的上下文 |
| `signal` | 否 | 取消请求 |

## 6. 返回结果

`exchangeTargetToken()` 返回：

```ts
interface TargetTokenResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  issuedTokenType: string;
  cache: "hit" | "miss" | "backend_error";
  jti: string;
}
```

字段含义：

- `accessToken`：下游真正使用的 JWT
- `expiresIn`：剩余有效期，秒
- `cache`：由 AuthAny Server 返回
- `jti`：本次 token 的唯一 ID

## 7. 运行时场景

`AuthorizedRuntime` 用于“先换 token，再调用 CLI / 子进程”。

### 7.1 生成一次性 env

```ts
import { AuthAnyClient, AuthorizedRuntime } from "@authany/sdk";

const client = new AuthAnyClient({
  issuer: process.env.AUTHANY_ISSUER!,
  callerCredential: process.env.AUTHANY_CALLER_CREDENTIAL!,
  principalType: "agent",
  agentId: process.env.AUTHANY_AGENT_ID!,
  runtimeId: process.env.AUTHANY_RUNTIME_ID
});

const runtime = new AuthorizedRuntime({
  client,
  tokenEnvName: "AUTHANY_TARGET_ACCESS_TOKEN"
});

const env = await runtime.buildAuthorizedEnv("ebfx", {
  baseEnv: process.env,
  externalContext: {
    provider: "lark",
    subject_type: "open_id",
    subject_value: "ou_xxx",
    message_id: "om_xxx"
  }
});
```

然后把 `env` 传给你的子进程：

```ts
import { spawn } from "node:child_process";

spawn("ebfx", ["dashboard", "pending"], {
  env,
  stdio: "inherit"
});
```

### 7.2 直接运行命令

```ts
const result = await runtime.runCommand("ebfx", ["dashboard", "pending"], {
  cwd: process.cwd(),
  env: process.env,
  targetResource: "ebfx",
  externalContext: {
    provider: "lark",
    subject_type: "open_id",
    subject_value: "ou_xxx"
  }
});

console.log(result.exitCode);
console.log(result.stdout);
console.log(result.stderr);
```

### 7.3 OpenClaw 集成建议

推荐在 `before_tool_call` 或 `exec` 边界接入：

```ts
const env = await runtime.buildAuthorizedEnv("ebfx", {
  baseEnv: event.params.env,
  externalContext: {
    provider: "lark",
    subject_type: "open_id",
    subject_value: ctx.senderId,
    message_id: ctx.messageId
  }
});

return {
  params: {
    ...event.params,
    env
  }
};
```

正确链路应该是：

```text
Lark / Claude / Codex
  -> OpenClaw
  -> @authany/sdk
  -> 业务 CLI
  -> 资源服务器
```

不要把长期 `callerCredential` 放进 Claude Code / Codex / 业务 CLI 的共享启动环境。

## 8. 资源服务验签

### 8.1 基本用法

```ts
import { TargetTokenVerifier } from "@authany/sdk";

const verifier = new TargetTokenVerifier({
  issuer: process.env.AUTHANY_ISSUER!,
  audience: "order-service",
  targetResource: "order-service"
});

const claims = await verifier.verify(tokenString);
```

### 8.2 Fastify 示例

```ts
app.get("/api/orders", async (request, reply) => {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return reply.status(401).send({ code: "missing_token" });
  }

  const token = authorization.slice("Bearer ".length).trim();
  const claims = await verifier.verify(token);

  return {
    subject: claims.sub,
    agentId: claims.agent_id,
    appId: claims.app_id
  };
});
```

### 8.3 verifier 配置

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `issuer` | 是 | AuthAny Server 地址 |
| `audience` | 是 | 本服务期望的 audience |
| `targetResource` | 否 | 如果传入，会额外校验 `target_resource` |
| `clockToleranceSeconds` | 否 | 时钟容差，默认 `5` |
| `fetch` | 否 | 自定义 `fetch` |
| `jwksTimeoutMs` | 否 | 拉取 JWKS 超时，默认 `5000` |

### 8.4 返回 claims

```ts
interface TargetAccessClaims {
  iss: string;
  aud: string | string[];
  sub: string;
  exp: number;
  iat: number;
  jti: string;
  token_use: "target_access";
  target_resource: string;
  agent_id?: string;
  app_id?: string;
  delegation_type?: string;
  external_context?: Record<string, unknown>;
}
```

SDK 返回的是原始 claims 风格，不做 camelCase 转换。

## 9. 错误处理

### 9.1 请求端错误

```ts
import {
  AuthAnyConnectionError,
  AuthAnyTimeoutError,
  RequesterTokenError,
  TargetTokenError
} from "@authany/sdk";

try {
  await client.getAccessToken("ebfx");
} catch (error) {
  if (error instanceof RequesterTokenError) {
    console.error(error.statusCode, error.code, error.message);
  } else if (error instanceof TargetTokenError) {
    console.error(error.statusCode, error.code, error.message);
  } else if (error instanceof AuthAnyTimeoutError) {
    console.error(error.code);
  } else if (error instanceof AuthAnyConnectionError) {
    console.error(error.code);
  }
}
```

常见服务端错误码：

- `unsupported_grant_type`
- `invalid_caller_credential`
- `invalid_agent`
- `invalid_application`
- `invalid_app_secret`
- `invalid_runtime`
- `invalid_target_resource`
- `invalid_requester_jwt`
- `connection_not_allowed`
- `access_not_allowed`
- `request_replayed`
- `replay_protection_unavailable`

### 9.2 验签错误

`TargetTokenVerifier.verify()` 可能抛出：

- `missing_token`
- `invalid_token`
- `invalid_token_use`
- `invalid_principal`
- `subject_mismatch`
- `target_resource_mismatch`
- `jwks_fetch_failed`

示例：

```ts
import { TokenVerificationError } from "@authany/sdk";

try {
  await verifier.verify(token);
} catch (error) {
  if (error instanceof TokenVerificationError) {
    console.error(error.code, error.message);
  }
}
```

## 10. 最重要的注意事项

这一节最关键，接入前请完整看完。

### 10.1 不要缓存 requester token

`requester token` 是中间产物，不是公开 token，也不是可复用 token。

不要这样做：

- 存数据库
- 放内存缓存
- 打日志
- 第二跳失败后拿它重试

### 10.2 第二跳失败时，必须重走完整 exchange

错误做法：

```text
callerCredential -> requesterToken
requesterToken -> targetToken 失败
只重试第二跳
```

正确做法：

```text
callerCredential -> requesterToken
requesterToken -> targetToken 失败
重新从 callerCredential 开始做一整次 exchange
```

原因是服务端有 replay protection，requester token 不可复用。

### 10.3 不要把长期凭证传给业务 CLI

业务 CLI 只应该拿到短期 `target access token`。

不要把这些变量传给 CLI：

- `AUTHANY_CALLER_CREDENTIAL`
- `AUTHANY_AGENT_ID`
- `AUTHANY_APP_ID`
- `AUTHANY_RUNTIME_ID`

`AuthorizedRuntime.buildAuthorizedEnv()` 会主动剥离这批保留变量。

### 10.4 `externalContext` 不能放敏感信息

只放安全上下文：

- 外部平台 ID
- open_id
- message_id
- workflow_id
- trace_id

不要放：

- secret
- refresh token
- access token
- cookie
- 明文密码

因为它可能进入 token claims，被下游服务看到。

### 10.5 `runCommand()` 的 token env 名称取构造参数

如果 CLI 需要自定义 token 环境变量名，例如 `EBFX_ACCESS_TOKEN`，请在构造 `AuthorizedRuntime` 时传：

```ts
const runtime = new AuthorizedRuntime({
  client,
  tokenEnvName: "EBFX_ACCESS_TOKEN"
});
```

`runCommand()` 当前不会单独接收每次调用的 `tokenEnvName`。

### 10.6 `verify()` 只接收纯 token 字符串

SDK 不负责从 header 里拆 `"Bearer "` 前缀。

正确：

```ts
const token = authorization.slice("Bearer ".length).trim();
await verifier.verify(token);
```

错误：

```ts
await verifier.verify("Bearer xxx");
```

### 10.7 这是 ESM 包

当前 SDK 以 ESM 方式构建和导出。

如果你的项目是 CommonJS，先不要直接假设可以无缝接入，建议先在接入项目里验证模块加载方式。

## 11. 推荐环境变量命名

宿主 runtime / 服务端建议：

- `AUTHANY_ISSUER`
- `AUTHANY_CALLER_CREDENTIAL`
- `AUTHANY_AGENT_ID`
- `AUTHANY_APP_ID`
- `AUTHANY_RUNTIME_ID`

传给业务 CLI 的短期 token：

- `AUTHANY_TARGET_ACCESS_TOKEN`

如果业务 CLI 已有固定命名，也可以在 `AuthorizedRuntime` 构造时改成业务方约定的 env key。

## 12. 调试建议

建议记录这些信息：

- `targetResource`
- `result.jti`
- `result.cache`
- 请求端错误 `code / statusCode`
- 验签错误 `code`

不要记录这些信息：

- `callerCredential`
- `requester token`
- 完整 `target access token`
- 敏感 `externalContext`

## 13. 一个完整示例

```ts
import {
  AuthAnyClient,
  AuthorizedRuntime,
  TargetTokenVerifier
} from "@authany/sdk";

const client = new AuthAnyClient({
  issuer: process.env.AUTHANY_ISSUER!,
  callerCredential: process.env.AUTHANY_CALLER_CREDENTIAL!,
  principalType: "agent",
  agentId: process.env.AUTHANY_AGENT_ID!,
  runtimeId: process.env.AUTHANY_RUNTIME_ID
});

const runtime = new AuthorizedRuntime({ client });

const commandResult = await runtime.runCommand("ebfx", ["dashboard", "pending"], {
  targetResource: "ebfx",
  env: process.env,
  externalContext: {
    provider: "lark",
    subject_type: "open_id",
    subject_value: "ou_xxx"
  }
});

console.log(commandResult.exitCode);

const verifier = new TargetTokenVerifier({
  issuer: process.env.AUTHANY_ISSUER!,
  audience: "ebfx-api",
  targetResource: "ebfx"
});

const claims = await verifier.verify("raw.jwt.token");
console.log(claims.sub);
```

## 14. 相关文件

- 设计文档：[docs/sdk-design.md](/Users/wrr/work/authany/docs/sdk-design.md)
- SDK 入口：[packages/sdk/src/index.ts](/Users/wrr/work/authany/packages/sdk/src/index.ts)
- 请求端实现：[packages/sdk/src/exchange-client.ts](/Users/wrr/work/authany/packages/sdk/src/exchange-client.ts)
- 运行时适配：[packages/sdk/src/runtime-adapter.ts](/Users/wrr/work/authany/packages/sdk/src/runtime-adapter.ts)
- 验签器实现：[packages/sdk/src/verifier.ts](/Users/wrr/work/authany/packages/sdk/src/verifier.ts)
