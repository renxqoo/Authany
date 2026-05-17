<p align="center">
  <strong>AuthAny</strong>
</p>

<p align="center">
  Self-hosted identity & authorization platform for the AI era.<br/>
  OAuth 2.0 / OpenID Connect + Delegated Token Exchange for agents, applications, and services.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11-red" alt="NestJS" />
  <img src="https://img.shields.io/badge/Fastify-5-000000" alt="Fastify" />
  <img src="https://img.shields.io/badge/PostgreSQL-Prisma-336791" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-5-DC382D" alt="Redis" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-UNLICENSED-lightgrey" alt="License" />
</p>

---

## Why AuthAny?

Traditional OAuth servers solve user login. AuthAny goes further:

- **Agent as first-class identity** -- AI agents, CLI tools, and MCP servers get their own credentials and token lifecycle, separate from human users.
- **Two-phase token delegation** -- A Requester Token (short-lived assertion) is exchanged for a Target Access Token (audience-scoped), preventing credential leakage to downstream services.
- **Connection & Grant model** -- Fine-grained control over which agent/app can talk to which target resource, with optional external context (Lark, WeChat, CLI, etc.) baked into the token.
- **Self-hosted & multi-tenant** -- Runs in your own infrastructure. All data stays in your PostgreSQL and Redis.

## Features

- **OAuth 2.0 / OpenID Connect**
  - Authorization Code flow with PKCE (S256)
  - Refresh Token rotation (one-time-use, auto-revoke on replay)
  - Client Credentials flow
  - Token introspection & revocation
  - OIDC Discovery & JWKS endpoints
- **Delegated Token Exchange**
  - Requester Token issuance (Agent or Application identity)
  - Target Access Token exchange (audience-scoped, cacheable)
  - Replay protection (Redis-based request ID deduplication)
  - External context propagation (signed into JWT claims)
- **Admin API**
  - Manage applications, agents, runtimes, credentials
  - Register target resources and configure connections
  - Issue and revoke access grants
  - RSA key pair rotation
  - Audit log queries
- **Security**
  - RS256 JWT signing with key rotation (active / verifying / retired lifecycle)
  - scrypt password hashing with timing-safe comparison
  - AES-256-GCM encryption for stored secrets (HKDF tenant-isolated keys)
  - Redis sliding-window rate limiting (IP + client + principal dimensions)
  - CSRF protection (HMAC-SHA256 stateless tokens)
  - Account lockout after repeated login failures
  - Comprehensive audit logging

## Architecture

```
┌──────────────┐    ┌───────────────────────────────────┐    ┌──────────────────┐
│              │    │           AuthAny Server            │    │                  │
│  Web App     │───>│  OAuth 2.0 / OIDC                  │    │  Target Resource  │
│  (browser)   │<───│  (login / authorize / tokens)      │    │  (ERP / EBFX)    │
│              │    │                                    │    │                  │
├──────────────┤    │  Delegated Token Exchange          │    │  Verify JWT       │
│              │    │  ┌───────────────────────────────┐ │    │  Check aud/iss    │
│  AI Agent    │───>│  │ Phase 1: Requester Token      │ │    │  Resolve claims   │
│  / CLI / MCP │    │  │ Phase 2: Target Access Token  │─┼───>│  Business auth    │
│              │<───│  └───────────────────────────────┘ │    │                  │
└──────────────┘    └───────────────────────────────────┘    └──────────────────┘
                         │         │         │
                    PostgreSQL   Redis     JWKS
```

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 9
- PostgreSQL >= 14
- Redis >= 6

### 1. Clone & Install

```bash
git clone https://github.com/your-org/authany.git
cd authany
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit root `.env` for the AuthAny API service. If you also run Admin Web or the example apps, copy their own env examples separately:

```bash
cp apps/admin-web/.env.example apps/admin-web/.env.local
cp example/.env.example example/.env.local
```

At minimum, set these root `.env` values:

```bash
AUTHANY_BASE_URL=http://127.0.0.1:3000
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/authany
REDIS_URL=redis://127.0.0.1:6379
COOKIE_SECRET=<openssl rand -base64 48>          # at least 32 bytes
AUTHANY_APP_SECRET_ENCRYPTION_KEY=<openssl rand -base64 48>  # at least 32 bytes
TENANT_ID=default
```

### 3. Initialize Database

```bash
pnpm prisma:migrate:dev
```

### 4. Seed Initial Data

```bash
pnpm seed
```

This creates the first operator account, signs an RSA key pair, and registers the admin web client.

### 5. Start the Server

```bash
# Production build
pnpm build && pnpm start

# Development
pnpm dev
```

The AuthAny API listens on `http://127.0.0.1:3000` by default.

### 6. Start Admin Web (Optional)

```bash
# In a separate terminal
pnpm admin:dev
```

The admin console opens at `http://127.0.0.1:3005`.

### 7. Run the Full Demo (Optional)

```bash
# Starts API + Admin Web + Demo Web + Target Service
pnpm dev:all
```

| Service           | URL                          |
| ----------------- | ---------------------------- |
| AuthAny API       | http://127.0.0.1:3000        |
| Admin Web         | http://127.0.0.1:3005        |
| Demo Web          | http://127.0.0.1:5173        |
| Target Service    | http://127.0.0.1:3006        |

## Project Structure

```
authany/
├── src/                          # AuthAny core server (NestJS + Fastify)
│   ├── main.ts                   # Bootstrap entry point
│   ├── app.module.ts             # Root module (13 sub-modules)
│   ├── modules/
│   │   ├── auth/                 # Login (API + hosted login page)
│   │   ├── oidc/                 # OAuth 2.0 / OIDC full implementation
│   │   ├── delegation/           # Two-phase token delegation
│   │   ├── admin/                # Admin CRUD API
│   │   └── target-verification/  # Target token verification
│   └── shared/
│       ├── config/               # Zod-validated env config
│       ├── prisma/               # Prisma ORM
│       ├── redis/                # Redis client
│       ├── security/             # JWT signing, hashing, session, CSRF, encryption
│       ├── audit/                # Audit logging
│       ├── metrics/              # In-memory metrics
│       ├── rate-limit/           # Sliding-window rate limiting
│       ├── admin/                # Admin auth guard
│       ├── health/               # Health & readiness probes
│       └── http/                 # HTTP utilities (filters, responses, headers)
├── apps/
│   └── admin-web/                # Admin console (Next.js)
├── example/
│   ├── demo-web/                 # Demo business app (Next.js)
│   └── target-service/           # Demo target resource (Fastify)
├── prisma/
│   └── schema.prisma             # Database schema (15 tables)
├── scripts/
│   ├── seed.ts                   # Database seeder
│   ├── security-verify.ts        # Security audit verification
│   ├── security-tighten-data.ts  # Data tightening script
│   └── security-attack-harness.ts # Attack simulation harness
├── docs/                         # Documentation
├── specs/                        # Product requirements & specifications
└── test/                         # Integration tests
```

## Integration Guide

AuthAny supports three integration patterns. See [docs/integration-guide.md](docs/integration-guide.md) for the full guide with code examples.

### Pattern 1: Web Application (OAuth 2.0 / OIDC)

Standard Authorization Code + PKCE flow for browser-based apps:

```
1. Register an OAuth Client via Admin API
2. Redirect user to /oauth/authorize
3. User authenticates on AuthAny hosted login page
4. Exchange authorization code for tokens at /oauth/token
5. Call /oauth/userinfo with access_token to get user profile
```

### Pattern 2: Agent / Runtime (Delegated Token Exchange)

Two-phase token exchange for AI agents, CLI tools, and MCP servers:

```typescript
// Phase 1: Get Requester Token (5-minute assertion)
const requester = await fetch("/api/requester-token", {
  method: "POST",
  headers: { authorization: `Bearer ${credential}` },
  body: JSON.stringify({
    grant_type: "urn:authany:params:oauth:grant-type:requester-token",
    principal_type: "agent",
    agent_id: "agent_prod_search",
    target_resource: "erp-api"
  })
});

// Phase 2: Exchange for Target Access Token (audience-scoped)
const target = await fetch("/api/target-token", {
  method: "POST",
  headers: { authorization: `Bearer ${requester.requester_token}` },
  body: JSON.stringify({
    grant_type: "urn:authany:params:oauth:grant-type:target-access",
    target_resource: "erp-api"
  })
});

// Call target resource with the target access token
const result = await fetch("https://erp-api.internal/api/orders", {
  headers: { authorization: `Bearer ${target.access_token}` }
});
```

### Pattern 3: Target Resource Service (Token Verification)

Backend services verify Target Access Tokens using JWKS:

```typescript
import { jwtVerify, createRemoteJWKSet } from "jose";

const JWKS = createRemoteJWKSet(
  new URL("https://auth.example.com/.well-known/jwks.json")
);

const { payload } = await jwtVerify(token, JWKS, {
  issuer: "https://auth.example.com",
  audience: "https://your-service.internal"
});

// payload.token_use === "target_access"
// payload.agent_id or payload.app_id tells you who is calling
// payload.external_context carries the invocation context
```

## API Endpoints

### OAuth 2.0 / OIDC

| Method | Endpoint                                | Description          |
| ------ | --------------------------------------- | -------------------- |
| GET    | `/.well-known/openid-configuration`     | OIDC Discovery       |
| GET    | `/.well-known/jwks.json`                | JSON Web Key Set     |
| GET    | `/oauth/authorize`                      | Authorization        |
| POST   | `/oauth/consent`                        | User consent         |
| POST   | `/oauth/token`                          | Token endpoint       |
| POST   | `/oauth/revoke`                         | Token revocation     |
| POST   | `/oauth/introspect`                     | Token introspection  |
| GET    | `/oauth/userinfo`                       | User info            |

### Delegated Token Exchange

| Method | Endpoint                 | Description               |
| ------ | ------------------------ | ------------------------- |
| POST   | `/api/requester-token`   | Issue Requester Token     |
| POST   | `/api/target-token`      | Exchange for Target Token |

### Authentication

| Method | Endpoint             | Description      |
| ------ | -------------------- | ---------------- |
| POST   | `/api/auth/login`    | API login        |
| GET    | `/login`             | Hosted login page|
| POST   | `/login`             | Hosted login POST|

### Health

| Method | Endpoint    | Description                          |
| ------ | ----------- | ------------------------------------ |
| GET    | `/health`   | Liveness probe                       |
| GET    | `/ready`    | Readiness probe (DB + Redis check)   |

### Admin API

All admin endpoints require a valid admin JWT (scope: `authany.admin`). See [docs/integration-guide.md](docs/integration-guide.md) for the full list.

## Scripts

| Command                | Description                                        |
| ---------------------- | -------------------------------------------------- |
| `pnpm build`           | Build the core server                              |
| `pnpm dev`             | Start core server in development mode              |
| `pnpm dev:all`         | Start all services (API + Admin + Demo + Target)   |
| `pnpm start`           | Start production server                            |
| `pnpm prisma:generate` | Generate Prisma client                             |
| `pnpm prisma:migrate:dev` | Run database migrations                         |
| `pnpm seed`            | Seed initial data                                  |
| `pnpm test`            | Run tests                                          |
| `pnpm test:watch`      | Run tests in watch mode                            |
| `pnpm test:coverage`   | Run tests with coverage                            |
| `pnpm admin:dev`       | Start Admin Web in development mode                |
| `pnpm admin:build`     | Build Admin Web                                    |
| `pnpm demo:dev`        | Start Demo Web in development mode                 |
| `pnpm target:dev`      | Start Target Service in development mode           |

## Configuration Reference

Configuration is split by runtime boundary:

- Root AuthAny API service: [.env.example](.env.example)
- Admin Web: [apps/admin-web/.env.example](apps/admin-web/.env.example)
- Example apps and example target resource service: [example/.env.example](example/.env.example)

### Core

| Variable                                | Default     | Description                       |
| --------------------------------------- | ----------- | --------------------------------- |
| `NODE_ENV`                              | -           | `development` / `test` / `production` |
| `PORT`                                  | `3000`      | Server listen port                |
| `AUTHANY_BASE_URL`                      | -           | Public base URL (used as JWT issuer) |
| `DATABASE_URL`                          | -           | PostgreSQL connection string      |
| `REDIS_URL`                             | -           | Redis connection string           |
| `COOKIE_SECRET`                         | -           | Session cookie signing key (>= 32 bytes) |
| `TENANT_ID`                             | -           | Tenant identifier                 |
| `AUTHANY_APP_SECRET_ENCRYPTION_KEY`     | -           | Master key for secret encryption (>= 32 bytes) |

### Token TTL

| Variable                                  | Default    | Description                    |
| ----------------------------------------- | ---------- | ------------------------------ |
| `AUTHANY_AUTH_CODE_TTL_SECONDS`           | `300`      | Authorization code lifetime    |
| `AUTHANY_ACCESS_TOKEN_TTL_SECONDS`        | `3600`     | Access token lifetime          |
| `AUTHANY_REFRESH_TOKEN_TTL_SECONDS`       | `2592000`  | Refresh token lifetime (30d)   |
| `AUTHANY_TARGET_TOKEN_TTL_SECONDS`        | `900`      | Target access token lifetime   |
| `AUTHANY_TARGET_TOKEN_REUSE_THRESHOLD_SECONDS` | `60`  | Cache reuse threshold          |
| `AUTHANY_REPLAY_TTL_SECONDS`              | `300`      | Replay protection window       |

### Security

| Variable                           | Default | Description                       |
| ---------------------------------- | ------- | --------------------------------- |
| `AUTHANY_LOGIN_COOKIE_NAME`        | `authany_session` | Login cookie name        |
| `AUTHANY_CORS_ORIGINS`             | -       | Comma-separated allowed origins   |
| `AUTHANY_CSP_FORM_ACTION_ORIGINS`  | -       | Comma-separated CSP form-action   |
| `AUTHANY_TRUSTED_PROXIES`          | -       | Comma-separated trusted proxy IPs |

## Token Types

| Token                | Format  | Signing | Lifetime  | Purpose                         |
| -------------------- | ------- | ------- | --------- | ------------------------------- |
| Access Token         | JWT     | RS256   | 1 hour    | API access                      |
| Refresh Token        | Opaque  | -       | 30 days   | Renew access token (rotation)   |
| ID Token             | JWT     | RS256   | 1 hour    | Identity claims (OIDC)          |
| Requester Token      | JWT     | RS256   | 5 minutes | Delegation phase 1 assertion    |
| Target Access Token  | JWT     | RS256   | 15 minutes| Delegation phase 2, resource access |

## Database Schema

AuthAny uses 15 tables with multi-tenant isolation. Key entities:

- **OperatorAccount** / **OperatorRole** -- Human administrators
- **OAuthClient** / **OAuthClientSecret** / **OAuthRedirectUri** -- Registered applications
- **OAuthAuthorizationCode** -- One-time-use auth codes
- **OAuthAccessTokenRecord** -- Issued access token records
- **OAuthRefreshToken** -- Refresh tokens with rotation tracking
- **TokenRevocation** -- Revocation registry
- **AgentProfile** / **RuntimeRegistration** / **CallerCredential** -- Agent identities
- **TargetResourceRegistration** -- Protected backend services
- **TargetConnection** / **AccessGrant** -- Agent-to-resource authorization
- **KeyRotationRecord** -- RSA signing key lifecycle
- **AuditEvent** -- Comprehensive audit trail

See [prisma/schema.prisma](prisma/schema.prisma) for the full schema.

## Tech Stack

| Layer          | Technology                         |
| -------------- | ---------------------------------- |
| Framework      | NestJS 11 + Fastify 5              |
| Language       | TypeScript 5.8                     |
| Database       | PostgreSQL via Prisma 6            |
| Cache / Session| Redis 5                            |
| JWT            | jose 6 (RS256 signing, JWKS)       |
| Validation     | Zod (env) + class-validator (DTO)  |
| Frontend       | Next.js (Admin Web, Demo Web)      |
| Testing        | Vitest                             |

## Documentation

| Document                                       | Description                     |
| ---------------------------------------------- | ------------------------------- |
| [docs/integration-guide.md](docs/integration-guide.md) | Integration guide with code examples |
| [docs/src-deep-analysis.md](docs/src-deep-analysis.md) | Source code deep analysis       |
| [specs/](specs/)                               | Product requirements & specifications |
| [.env.example](.env.example)                   | AuthAny API service environment reference |
| [apps/admin-web/.env.example](apps/admin-web/.env.example) | Admin Web environment reference |
| [example/.env.example](example/.env.example)   | Example apps and target service environment reference |

## License

All rights reserved. See the [license field](package.json) in package.json.
