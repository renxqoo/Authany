# 05 - 管理端功能规格

> 本文档定义 AuthAny V1 管理端必须提供的后台能力、操作边界、校验规则和验收标准。

---

## 1. 文档目标

回答：

- 平台管理员到底要能做什么
- 每类后台对象需要哪些管理动作
- 哪些动作必须审计
- 哪些能力属于 P0，哪些留到后续

不回答：

- 每个页面长什么样
- 每个接口的全部字段细节

---

## 2. 管理端定位

AuthAny 管理端不是普通“配置页集合”，而是整个平台的治理入口。

它至少要支撑四类工作：

1. 身份治理
2. Agent 与调用凭证治理
3. Target System 接入治理
4. 审计、密钥、运行状态治理

V1 可以采用：

- 管理 API 优先
- 管理后台 UI 后补

但无论先做 API 还是 UI，下面这些能力都必须作为正式需求存在。

---

## 3. 管理角色与权限边界

| 角色 | 主要职责 | 禁止事项 |
|------|----------|----------|
| 平台超级管理员 | 平台初始化、密钥治理、高危操作审批 | 不应绕过审计直接改库 |
| 接入管理员 | 注册 Agent、注册 Target System、发放调用凭证 | 不应直接修改业务系统资源权限 |
| 身份管理员 | 管理用户、身份源、绑定关系 | 不应代替业务系统做授权裁决 |
| 审计管理员 | 查询、导出、复核审计事件 | 不应拥有签发调用凭证权限 |

规则：

- 所有高危写操作必须记录操作者、对象、变更摘要和时间
- 角色权限可以在实现上简化，但职责边界不能混淆

---

## 4. P0 后台功能清单

| 模块 | P0 是否必须 | 说明 |
|------|-------------|------|
| 用户管理 | 是 | 管平台统一用户，不管业务角色 |
| 身份源管理 | 是 | 至少支持本地兜底和扩展占位 |
| OAuth Client 管理 | 是 | 供标准 OAuth/OIDC 接入使用 |
| Agent 管理 | 是 | 供 Agent delegation 场景使用 |
| Service Subject 管理 | 是 | 供系统任务或无最终用户场景使用 |
| Runtime Registration 管理 | 是 | 供 Runtime 能力治理与 refresh 准入使用 |
| Caller Credential 管理 | 是 | 供 Runtime 向 AuthAny 证明自己是谁 |
| Target System 管理 | 是 | 建立系统级 trust 和 audience 配置 |
| User Binding 管理 | 是 | 查、建、停用绑定关系 |
| Delegation Grant 管理 | 是 | 查、建、停用授权关系 |
| 审计查询 | 是 | 至少可按关键维度检索 |
| 密钥管理 | 是 | 至少支持查看当前 key、启用新 key、轮换状态 |
| 运行配置管理 | 否 | V1 可先走环境配置，不必做全 UI |

---

## 5. 用户管理

### 5.1 必须支持的动作

- 创建本地用户
- 查看用户详情
- 更新用户基础资料
- 启用用户
- 停用用户
- 挂起用户
- 查询用户关联身份

### 5.2 必须展示的信息

- `user_id`
- `status`
- `display_name`
- `email`
- `mobile`
- `primary_identity_source`
- 关联绑定数量
- 关联 grant 数量
- 最近认证时间

### 5.3 规则

- `suspended` 用户不可获得新 token
- 删除用户不是 P0 能力，V1 采用停用或挂起
- 管理端不得直接修改目标系统本地用户信息

### 5.4 失败路径

- 用户已被其他高权限流程锁定时，应拒绝修改并提示原因
- 用户存在活跃绑定或 grant 时，不应允许“硬删除”

---

## 6. 身份源管理

### 6.1 必须支持的动作

- 创建身份源配置
- 启用身份源
- 停用身份源
- 查看身份源状态

### 6.2 V1 最小范围

- `local`
- `oidc_enterprise`
- 可扩展占位类型

### 6.3 规则

- 身份源停用后，不影响已签发 token 的自然过期
- 身份源停用后，依赖该身份源的新登录应被拒绝

---

## 7. OAuth Client 管理

### 7.1 必须支持的动作

- 创建 client
- 配置 `redirect_uri`
- 配置允许的 grant type
- 配置允许的 scope
- 启用或停用 client
- 生成或轮换 client secret
- 撤销旧 secret

### 7.2 规则

- `redirect_uri` 必须严格匹配
- secret 只允许显示一次原文
- 管理端展示 secret 时必须提示“仅本次可见”
- 停用 client 后，不得再发新 token

### 7.3 非目标

- V1 不要求做动态客户端注册

---

## 8. Agent 管理

### 8.1 必须支持的动作

- 创建 Agent Profile
- 编辑 Agent 基础资料
- 启用、停用、挂起 Agent
- 查看 Agent 关联的 caller credential
- 查看 Agent 可访问的 Target System

### 8.2 必须配置的信息

- `agent_id`
- `agent_code`
- `name`
- `status`
- `trust_level`
- 说明信息

### 8.3 规则

- `agent_id` 一旦发放，不应被复用
- Agent 停用后，不得再成功交换 delegation token
- Agent 与 OAuth Client 不是同一个对象，管理端不能把二者混成一张表

---

## 9. Service Subject 管理

### 9.1 必须支持的动作

- 创建 Service Subject
- 编辑 Service Subject 基础资料
- 启用、停用、挂起 Service Subject
- 查看 Service Subject 可访问的 Target System

### 9.2 必须配置的信息

- `service_subject_id`
- `subject_code`
- `name`
- `status`
- `description`

### 9.3 规则

- Service Subject 用于没有最终用户参与的系统任务
- Service Subject 不是 Agent 本身
- 停用 Service Subject 后，不得再签发以其为最终主体的 delegation token

---

## 10. Runtime Registration 管理

### 10.1 必须支持的动作

- 创建 Runtime Registration
- 编辑 Runtime 基础资料
- 启用、停用 Runtime Registration
- 设置 `runtime_mode`
- 设置是否允许 delegation refresh
- 设置是否允许远程缓存复用

### 10.2 必须配置的信息

- `runtime_id`
- `agent_id`
- `runtime_type`
- `runtime_mode`
- `status`
- `allows_delegation_refresh`
- `allows_remote_cache_reuse`

### 10.3 规则

- `runtime_mode` 至少支持 `stateless` 和 `stateful`
- 只有 `stateful` Runtime 才允许开启 `allows_delegation_refresh`
- 是否允许 delegation refresh 必须由平台配置，不允许 Runtime 自报即生效
- 同一个 Agent 可以注册多个 Runtime

### 10.4 推荐判定标准

- `stateless`：一次性 exec、短命进程、无稳定受控存储
- `stateful`：长生命周期进程、受控服务端存储、可接受撤销与轮换

---

## 11. Caller Credential 管理

### 11.1 必须支持的动作

- 为 Agent 签发或登记调用凭证
- 查看凭证状态
- 轮换凭证
- 提前撤销凭证
- 设置过期时间

### 11.2 V1 支持的凭证类型

- `agent_secret`
- `api_key`

其他类型如：

- `private_key`
- `mtls`

作为后续扩展预留。

### 11.3 规则

- 原始凭证值不得二次明文展示
- 轮换时允许短暂双凭证并存窗口
- `revoked` 凭证必须立即不可用
- 凭证属于 Agent，不属于最终用户

### 11.4 审计要求

必须记录：

- 谁创建了凭证
- 为哪个 Agent 创建
- 何时轮换
- 何时撤销

---

## 12. Target System 管理

### 12.1 必须支持的动作

- 注册 Target System
- 更新基础资料
- 配置 `audience`
- 启用或停用
- 配置 trust metadata
- 查看接入状态

### 12.2 必须配置的信息

- `target_system_code`
- `display_name`
- `audience`
- `status`
- `token_validation_mode`
- `allowed_agents`

### 12.3 规则

- `target_system_code` 必须全局唯一
- 停用 Target System 后，平台必须拒绝继续签发以其为 `aud` 的新 token
- 目标系统注册是系统级 trust，不是用户级绑定

---

## 13. User Binding 管理

### 13.1 必须支持的动作

- 查询 binding
- 手工创建 binding
- 失效 binding
- 查看 binding 来源
- 查看 binding 关联用户和目标系统

### 13.2 规则

- binding 表达的是身份映射，不是授权关系
- binding 应支持管理员预绑定和用户自助绑定两种来源
- binding 失效后，依赖该 binding 的 delegation 必须被拒绝

### 13.3 管理风险

- 管理员手工绑定必须有更强审计
- 对高风险系统建议要求双人复核，这属于 P1 增强

---

## 14. Delegation Grant 管理

### 14.1 必须支持的动作

- 创建 grant
- 查询 grant
- 启用或停用 grant
- 设置过期时间
- 提前撤销 grant

### 14.2 最小维度

grant 至少绑定：

- `agent_id`
- `subject_kind`
- `subject_id`
- `target_system`

### 14.3 规则

- grant 解决的是“某 Agent 是否可代表某个主体访问某系统”
- grant 不表达目标系统内的资源权限
- grant 失效后，新的 delegation token 不得再签发

---

## 15. 审计与查询

### 15.1 必须支持的查询维度

- 时间范围
- `user_id`
- `client_id`
- `agent_id`
- `target_system`
- `event_type`
- 成功或失败

### 15.2 必须支持的事件类别

- 登录成功或失败
- token 签发
- token 刷新
- token 撤销
- delegation 放行或拒绝
- binding 创建或失效
- grant 创建或失效
- credential 创建、轮换、撤销
- target system 创建、启停

---

## 16. 密钥管理

### 16.1 必须支持的能力

- 查看当前活跃签名 key
- 新增待切换 key
- 标记 key 生命周期状态
- 查看 `kid`
- 查看轮换计划

### 16.2 规则

- key rotation 不能导致已签发且未过期 token 立即全部失效
- 历史公钥必须保留到对应 token 自然过期或被统一撤销

---

## 17. 后台交付方式

V1 允许两种交付路径：

### 路径 A：API 优先

- 先实现完整管理 API
- UI 由后续迭代补齐

### 路径 B：API + 最小后台

- 在 API 完整基础上提供最小可用后台页面

无论选哪条路径，验收都应以“能力是否存在”为准，不以“页面是否华丽”为准。

---

## 18. 不做的事

V1 管理端不做：

- 业务系统菜单权限配置
- 业务系统数据权限配置
- 审批流引擎
- 复杂工作台编排

---

## 19. 验收标准

| 编号 | 验收项 | 通过标准 |
|------|--------|----------|
| ADM-01 | 用户治理 | 能创建、停用、挂起用户，并可查询用户关联身份 |
| ADM-02 | 身份源治理 | 能配置并启停身份源，停用后新登录被拒绝 |
| ADM-03 | Client 治理 | 能创建 client、配置 redirect_uri、轮换 secret |
| ADM-04 | Agent 治理 | 能创建 Agent、启停 Agent、查看关联凭证 |
| ADM-05 | Service Subject 治理 | 能创建、启停 Service Subject，并用于系统任务授权 |
| ADM-06 | Runtime Registration 治理 | 能配置 Runtime 的 `stateful/stateless` 与 delegation refresh 能力 |
| ADM-07 | Credential 治理 | 能签发、轮换、撤销 caller credential，且原文不二次展示 |
| ADM-08 | Target System 治理 | 能注册 target system、设置 audience、启停系统 |
| ADM-09 | Binding 治理 | 能查、建、失效 binding，并可追踪来源 |
| ADM-10 | Grant 治理 | 能查、建、停用 grant，并影响后续 delegation 放行 |
| ADM-11 | 审计查询 | 可按 user、agent、target_system、时间检索关键事件 |
| ADM-12 | 密钥治理 | 可查看当前 key、识别 kid、支持轮换流程 |
