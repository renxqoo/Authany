# 16 - Admin UI V1

> Admin UI V1 管理 AuthAny 控制面资源，不能暴露业务用户绑定流程。

---

## 1. 视觉方向

- 浅色企业后台。
- 信息层级清晰。
- 适合运维和管理场景，信息密度要足够，但不能像裸数据库控制台。
- 所有高危操作必须二次确认。
- 所有 Secret 使用查看 / 复制模式，并写审计。

---

## 2. 路由

| Route | 页面 | P0 |
|-------|------|----|
| `/login` | Operator 登录 | 是 |
| `/` 或 `/dashboard` | Dashboard | 是 |
| `/applications` | Application 列表 | 是 |
| `/applications/:id` | Application 详情 | 是 |
| `/agents` | Agent 列表 | 是 |
| `/agents/:id` | Agent 详情 | 是 |
| `/agents/:id/credentials` | Caller Credential 管理 | 是 |
| `/runtimes` | Runtime Registration 管理 | 是 |
| `/target-resources` | Target Resource 管理 | 是 |
| `/target-connections` | Target Connection 管理 | 是 |
| `/access-grants` | Access Grant 管理 | 是 |
| `/keys` | Signing Key 管理 | 是 |
| `/audit-events` | Audit Events | 是 |
| `/metrics` | Metrics 和告警 | 是 |
| `/operators` | Operator Accounts | P1 |

移除的路由：

- 作为业务用户管理的 `/users`。
- 作为业务用户身份管理的 `/identity-sources`。
- `/bindings`。
- 终端用户绑定页面。

---

## 3. 导航分组

- Overview：Dashboard、Metrics。
- Access Clients：Applications、Agents、Runtimes、Caller Credentials。
- Target Access：Target Resources、Target Connections、Access Grants。
- Security：Signing Keys、Audit Events、Operators。

---

## 4. Target Connections 页面

必须支持的操作：

- 列表展示 connection。
- 创建 connection。
- 更新状态和策略字段。
- 按 principal type、principal id、target resource、status 筛选。

必须展示的字段：

- `principal_type`
- `principal_id`
- `runtime_id`
- `target_resource`
- `external_context_mode`
- `allowed_context_providers`
- `max_token_ttl`
- `status`

规则：

- 页面文案必须使用“连接”，不能使用“用户绑定”。
- 页面必须解释：Target Resource 拥有业务用户映射。

---

## 5. Access Grants 页面

必须支持的操作：

- 列表展示 grant。
- 为现有 connection 创建 grant。
- 更新状态和过期时间。
- 按 connection、principal、target resource、status 筛选。

必须展示的字段：

- `connection_id`
- `grant_type`
- `effect`
- `constraints`
- `expires_at`
- `status`

规则：

- V1 UI 只支持 allow grant。
- UI 不能建模 Target Resource 业务资源 scope。

---

## 6. 错误文案映射

| API error | UI 含义 |
|-----------|---------|
| `invalid_admin_token` | Admin session 已过期或 Token 无效。 |
| `invalid_application` | Application 缺失或已停用。 |
| `invalid_agent` | Agent 缺失或已停用。 |
| `invalid_runtime` | Runtime 缺失、已停用，或不属于该 Agent。 |
| `invalid_target_resource` | Target Resource 缺失或已停用。 |
| `connection_not_allowed` | Target Connection 缺失或非活跃。 |
| `access_not_allowed` | Access Grant 缺失、非活跃、过期或约束失败。 |
| `invalid_external_context` | External context 不被连接策略接受。 |
| `request_replayed` | 请求已处理过。 |
| `rate_limited` | 请求过多，请稍后重试。 |

---

## 7. 质量门禁

- TypeScript strictness。
- ESLint。
- Vitest 覆盖页面组件、表单、API helper、Secret UI、校验和高危操作。
- 前端文件应遵守项目文件大小限制。
- 页面不能依赖硬编码 demo ID。
- 表单必填字段必须前端校验和后端校验同时存在。

---

## 8. 验收标准

| ID | 要求 |
|----|------|
| UI-01 | Admin UI 使用浅色企业后台风格。 |
| UI-02 | P0 控制面资源均有可用页面。 |
| UI-03 | 不存在业务用户绑定入口。 |
| UI-04 | Secret 默认隐藏，查看和复制有明确交互。 |
| UI-05 | 高危操作有二次确认和错误反馈。 |
