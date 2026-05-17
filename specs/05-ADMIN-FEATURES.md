# 05 - 管理功能

> Admin UI 和 Admin API 只管理 AuthAny 控制面实体，不管理业务用户和业务资源权限。

---

## 1. P0 导航

| 模块 | 目的 |
|------|------|
| Dashboard | 展示健康状态、ready 状态、关键指标和告警。 |
| Applications | 管理 App ID、App Secret、redirect URI 和生命周期。 |
| Agents | 管理 AI / 自动化执行身份。 |
| Runtimes | 管理 Agent 的运行环境。 |
| Caller Credentials | 签发和撤销 Agent / Runtime 调用凭证。 |
| Target Resources | 注册资源服务和信任元数据。 |
| Target Connections | 将 Application / Agent / Runtime 连接到 Target Resource。 |
| Access Grants | 对 Target Connection 做平台级放行。 |
| Signing Keys | 创建、激活、退休 RS256 签名密钥。 |
| Audit Events | 查询治理操作和 Token Exchange 审计事件。 |
| Operator Accounts | 管理 AuthAny 管理员账号。 |

P0 明确移除：

- Business Users。
- 作为业务用户身份源的 Identity Sources。
- User Bindings。
- 终端用户绑定门户。

---

## 2. Applications

必须支持的操作：

- 列表、搜索、创建、更新、停用和逻辑删除 Application。
- 系统生成 App ID。
- 系统生成、按策略查看、轮换和撤销 App Secret。
- 当启用交互式 OAuth 登录时，配置 redirect URI。
- 展示与 Application 相关的 Target Connection 和 Access Grant。

校验规则：

- Application 名称必填。
- App ID 由系统生成，必须唯一，不允许编辑。
- App Secret 不得长期明文存储。
- App Secret 只能暴露给服务端或受控密钥系统使用。

---

## 3. Agents

必须支持的操作：

- 列表、搜索、创建、更新、挂起、停用和逻辑删除 Agent。
- 系统生成 Agent ID。
- 展示关联 Runtime、Caller Credential、Target Connection 和 Access Grant。
- 删除 Agent 前必须要求输入完整 Agent 名称二次确认。

校验规则：

- Agent 名称必填。
- Agent ID 由系统生成，必须唯一，不允许编辑。
- 删除 Agent 必须撤销仍然有效的 Caller Credential。

---

## 4. Runtime Registrations

必须支持的操作：

- 在指定 Agent 下创建 Runtime。
- 配置 runtime type 和 runtime mode。
- 配置缓存和 refresh 策略。
- 停用或挂起 Runtime。

校验规则：

- Runtime 必须属于一个已存在且有效的 Agent。
- `stateless` Runtime 不能启用 refresh。
- Runtime ID 必须唯一。
- Runtime ID 由系统生成，不允许手填或编辑。

---

## 5. Caller Credentials

必须支持的操作：

- 为 Agent 或指定 Runtime 签发 Credential。
- 按一次性展示或可查看策略展示凭证值。
- 撤销 Credential。
- 展示凭证 hint、状态、签发时间、最近使用时间和过期时间。

规则：

- Credential 归属于 Agent，并可选绑定 Runtime。
- Credential 不能发送给 Target Resource。
- Credential 查看、签发、撤销必须写审计。

---

## 6. Target Resources

必须支持的操作：

- 创建和更新 Target Resource。
- 配置 audience 和 token validation mode。
- 展示 Target Resource 接入需要的 issuer、JWKS 等信任元数据。
- 停用或挂起 Target Resource。

规则：

- Target Resource 注册的是信任元数据。
- Target Resource 的本地用户映射和业务权限不属于 AuthAny。

---

## 7. Target Connections

必须支持的操作：

- 创建从 Application / Agent / Runtime 到 Target Resource 的连接。
- 配置环境。
- 配置 external context 模式。
- 配置允许的 external context provider。
- 配置最大 Token TTL。
- 停用、挂起或撤销连接。

必填字段：

- `principal_type`
- `principal_id`
- `target_resource`
- `external_context_mode`
- `status`

规则：

- Target Connection 不是用户绑定。
- Target Connection 不能包含 Target Resource 用户 ID。
- Target Connection 只回答“这个主体是否允许连接到这个 Target Resource”。

---

## 8. Access Grants

必须支持的操作：

- 为 Target Connection 创建 Grant。
- 配置平台级约束。
- 设置过期、撤销或停用 Grant。
- 查看相关 Token Exchange 审计。

必填字段：

- `connection_id`
- `grant_type`
- `effect`
- `status`
- `constraints`
- `expires_at`

规则：

- V1 只支持 allow grant。
- 业务资源 scope 不在这里配置。
- 没有有效 Target Connection 时，不能创建有效 Grant。

---

## 9. Operator Accounts

Operator Accounts 用于 AuthAny 自身管理。

规则：

- Operator 不是业务用户。
- Operator role 用于授权 Admin API 访问。
- Operator 生命周期必须审计。
- Operator 身份不能作为 Target Resource 的业务主体。

---

## 10. 验收标准

| ID | 要求 |
|----|------|
| ADM-01 | 管理员可以安全管理 Applications 和 Secret。 |
| ADM-02 | 管理员可以管理 Agents、Runtimes 和 Caller Credentials。 |
| ADM-03 | 管理员可以管理 Target Resources 和信任元数据。 |
| ADM-04 | 管理员可以管理 Target Connections。 |
| ADM-05 | 管理员可以管理 Access Grants。 |
| ADM-06 | Admin UI 不暴露业务用户绑定流程。 |
| ADM-07 | 高危操作必须二次确认并写审计。 |
