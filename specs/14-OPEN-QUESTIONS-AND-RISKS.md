# 14 - 未决问题与风险

> 本文档记录 AuthAny 简化为授权控制面后的未决问题和已知风险。

---

## 1. 未决问题

| ID | 问题 | 当前建议 | 是否阻塞 V1 |
|----|------|----------|-------------|
| Q-01 | V1 是否支持 private-key JWT 作为 requester authentication？ | 先使用系统生成的服务端 Secret + Requester JWT；Credential 类型设计预留 private key。 | 否 |
| Q-02 | V1 的 Target Connection 是否允许 Runtime 级约束？ | 是。企业 Agent 部署需要区分环境和运行形态。 | 是 |
| Q-03 | Application Target Token 使用 `/oauth/token` client credentials，还是统一 `/api/target-token`？ | V1 使用统一 `/api/target-token` + Requester JWT；OAuth 兼容可以后续作为协议适配层暴露。 | 否 |
| Q-04 | 高风险 Target Resource 是否必须 introspection？ | 默认本地 JWT 验签；后续允许按 Target Resource 打开高风险 introspection。 | 否 |
| Q-05 | external context metadata 允许多大？ | V1 使用严格大小限制和 provider allowlist。 | 否 |

---

## 2. 主要风险

### R-01：重新引入业务用户绑定

风险：

- AuthAny 又开始保存 Lark / WeChat / EBFX 用户映射。

影响：

- 平台重新变成业务系统定制。
- Target Resource 自治能力消失。
- 多业务系统推广变难。

缓解：

- 业务用户映射保留在 Target Resource。
- AuthAny 只签名透传可选 external context。

### R-02：混淆 Application 和 Agent

风险：

- 所有东西都被建模成 OAuth Client。

影响：

- Runtime 所属关系和 Caller Credential 语义不清晰。
- Agent 治理变弱。

缓解：

- 保留 Application、Agent、Runtime 和 Caller Credential 四个不同概念。

### R-03：混淆 Target Connection 和 Access Grant

风险：

- 一条记录同时表达“能连上”和“已授权”。

影响：

- 生命周期和审计不清晰。

缓解：

- Target Connection 表达连接关系。
- Access Grant 表达平台放行。

### R-04：Broker 缓存绕过授权

风险：

- Credential 或 Grant 撤销后仍返回缓存 Token。

缓解：

- 每次缓存查询前都重新执行授权校验。

### R-05：External Context 被当成可信用户

风险：

- Target Resource 直接信任 `external_context.subject_value`，不做本地映射或策略校验。

缓解：

- 文档和测试明确 external context 只是已签名输入，不是业务授权。

### R-06：Secret 被当作 Access Token 使用

风险：

- App Secret 或 Caller Credential 被传到 CLI 输出、浏览器、聊天平台或 Target Resource。
- Resource server 开始接受 Secret 或裸 ID，而不是 Target Token。

影响：

- Secret 泄露会等同于资源完全泄露。
- 撤销和防重放能力失效。

缓解：

- ID 视为公开标识，Secret 视为服务端高敏凭证。
- 请求 AuthAny 使用 Requester JWT，访问 Target Resource 使用 Target Token JWT。
- 增加测试和文档，要求 resource server 拒绝除 Bearer Target Token 以外的授权方式。

---

## 3. 验收门禁

V1 不应通过验收，如果：

- AuthAny Core 仍将业务用户 Binding 作为主流程。
- Token 签发可以跳过 Target Connection 或 Access Grant。
- Target resource 权限配置在 AuthAny。
- Broker 缓存可以绕过撤销或非活跃状态。
- Secret 被当作资源访问 Token 使用，或被发送给 Target Resource。
