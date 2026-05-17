# 20 - Admin UI V2

> Admin UI V2 是一套全新管理端，不依赖旧的通用资源页实现，不在旧 UI 上做兼容式迭代。

---

## 1. 目标

### 1.1 设计目标

- 用统一的信息架构重建 AuthAny 管理端。
- 所有控制面资源遵循同一套列表页、详情页、创建、编辑、危险操作规范。
- 消除旧版“手填 ID + 手写 JSON Patch”的运维式交互。
- 让后续新增资源页时，只需要增加资源定义和少量特例面板，而不是复制页面代码。

### 1.2 范围

V2 首批覆盖以下 7 类资源：

- Application Management
- Agent Management
- Runtime Registrations
- Target Resources
- Target Connections
- Access Grants
- Signing Keys

### 1.3 非目标

- 不管理业务用户。
- 不管理业务系统内部的用户映射或业务资源 scope。
- 不兼容旧的 `features/resources` 页面拼装方式。
- 不保留旧的动态资源路由作为主要入口。

---

## 2. 问题定义

当前 Admin UI 的核心问题不是视觉样式，而是页面模型已经分裂：

- `Applications` 和 `Agents` 已有单独的列表页与详情页。
- `Runtimes`、`Target Resources`、`Target Connections`、`Access Grants`、`Keys` 仍使用旧的通用资源页。
- 旧通用资源页将“更新”建模为手动输入记录 ID 和 JSON payload。
- 旧通用资源页缺乏真正的详情页、关系视图、危险操作语义和统一筛选。

结论：

- V2 必须整体重建页面层。
- V2 允许复用 API、基础 UI 组件和安全能力。
- V2 不继续扩展旧的通用 CRUD 页面抽象。

---

## 3. 信息架构

### 3.1 一级导航

- Overview
  - Dashboard
- Access Clients
  - Applications
  - Agents
  - Runtime Registrations
- Target Access
  - Target Resources
  - Target Connections
  - Access Grants
- Security
  - Signing Keys
  - Audit Events

### 3.2 路由规范

每类资源统一采用两级路由：

- 列表页：`/<resource>`
- 详情页：`/<resource>/<id>`

V2 资源路由：

- `/applications`
- `/applications/:id`
- `/agents`
- `/agents/:id`
- `/runtimes`
- `/runtimes/:id`
- `/target-resources`
- `/target-resources/:id`
- `/target-connections`
- `/target-connections/:id`
- `/access-grants`
- `/access-grants/:id`
- `/keys`
- `/keys/:id`

### 3.3 页面模型

所有资源遵循统一骨架：

1. 页面头部
2. 列表筛选区
3. 列表表格
4. 新增入口
5. 详情页
6. 编辑入口
7. 危险操作区

---

## 4. 统一交互规范

### 4.1 列表页

所有列表页必须包含：

- 页面标题和资源说明
- 搜索框
- 状态筛选
- 资源特有筛选项
- 刷新按钮
- 新增按钮
- 表格或空状态

列表行行为：

- 点击主字段进入详情页
- 行尾保留操作入口
- 不允许要求用户手动输入记录 ID 才能操作

### 4.2 详情页

所有详情页必须包含：

- 返回列表入口
- 名称、主标识、状态摘要
- 基础信息区
- 配置区
- 关联资源区
- 审计/时间信息区
- 危险操作区

### 4.3 新增和编辑

统一规范：

- 新增和编辑优先使用抽屉或模态层。
- 表单字段使用结构化表单组件，不暴露 JSON patch 输入框。
- 字段必须有 label、说明、校验反馈。
- 关联字段必须使用选择器，而不是自由手填 ID。

### 4.4 危险操作

统一危险操作承载方式：

- 详情页底部固定危险操作区
- 所有高危操作必须二次确认
- 对于真正删除的资源，需要名称确认
- 对于非删除语义的终止动作，应使用领域词汇

领域词汇示例：

- Application / Agent：删除
- Runtime / Target Resource / Target Connection：停用或删除
- Access Grant：撤销或删除
- Signing Key：激活、退役

### 4.5 Secret 与敏感信息

- Secret 默认隐藏
- Reveal 操作必须显式触发
- Copy 操作必须清晰可见
- 一次性密钥展示必须带风险提示
- 相关操作必须写审计

---

## 5. 数据与交互要求

### 5.1 Applications

列表字段：

- `name`
- `app_id`
- `status`
- `redirect_uri_count`
- `secret_count`
- `updated_at`

筛选：

- keyword
- status

详情字段：

- `name`
- `app_id`
- `description`
- `status`
- `redirect_uris`
- `allowed_grant_types`
- `allowed_scopes`
- `created_at`
- `updated_at`

详情扩展区：

- Secret 管理
- 关联 Target Connections
- 关联 Access Grants

操作：

- 创建
- 编辑
- 停用
- 删除
- reveal secret
- rotate secret

### 5.2 Agents

列表字段：

- `name`
- `agent_id`
- `status`
- `runtime_count`
- `credential_count`
- `grant_count`

筛选：

- keyword
- status
- trust level

详情字段：

- `name`
- `agent_id`
- `status`
- `description`
- `created_at`
- `updated_at`

详情扩展区：

- Caller Credentials
- Runtime Registrations
- Target Connections
- Access Grants

操作：

- 创建
- 编辑
- 挂起
- 停用
- 删除
- issue credential
- revoke credential

### 5.3 Runtime Registrations

列表字段：

- `runtime_id`
- `agent_id`
- `runtime_type`
- `runtime_mode`
- `status`
- `allows_delegation_refresh`
- `allows_remote_cache_reuse`
- `updated_at`

筛选：

- keyword
- status
- agent
- runtime mode

详情字段：

- `runtime_id`
- `agent_id`
- `runtime_type`
- `runtime_mode`
- `credential_delivery_mode`
- `allows_delegation_refresh`
- `allows_remote_cache_reuse`
- `status`
- `created_at`
- `updated_at`

详情扩展区：

- 关联 Agent
- 关联 Target Connections
- 关联 Caller Credentials

操作：

- 创建
- 编辑策略
- 挂起
- 创建时 `runtime_id` 由系统自动生成，不在表单中输入。
- 停用
- 删除

### 5.4 Target Resources

列表字段：

- `target_resource_code`
- `display_name`
- `audience`
- `token_validation_mode`
- `status`
- `updated_at`

筛选：

- keyword
- status

详情字段：

- `target_resource_code`
- `display_name`
- `audience`
- `token_validation_mode`
- `status`
- `trust_metadata`
- `created_at`
- `updated_at`

详情扩展区：

- 关联 Target Connections

操作：

- 创建
- 编辑
- 挂起
- 停用
- 删除

### 5.5 Target Connections

列表字段：

- `connection_id`
- `principal_type`
- `principal_id`
- `runtime_id`
- `target_resource`
- `external_context_mode`
- `max_token_ttl_seconds`
- `status`
- `expires_at`

筛选：

- keyword
- principal type
- principal id
- target resource
- status

详情字段：

- `connection_id`
- `principal_type`
- `principal_id`
- `runtime_id`
- `target_resource`
- `external_context_mode`
- `allowed_context_providers`
- `max_token_ttl_seconds`
- `status`
- `expires_at`
- `created_at`
- `updated_at`

详情扩展区：

- 关联 Target Resource
- 关联 Runtime
- 关联 Access Grants

操作：

- 创建
- 编辑策略
- 挂起
- 停用
- 删除

### 5.6 Access Grants

列表字段：

- `grant_id`
- `connection_id`
- `grant_type`
- `effect`
- `status`
- `expires_at`
- `updated_at`

筛选：

- keyword
- connection
- target resource
- principal
- status

详情字段：

- `grant_id`
- `connection_id`
- `grant_type`
- `effect`
- `constraints`
- `status`
- `expires_at`
- `created_at`
- `updated_at`

详情扩展区：

- 关联 Target Connection
- 关联主体摘要

操作：

- 创建
- 编辑约束
- 设置过期
- 停用
- 撤销
- 删除

### 5.7 Signing Keys

列表字段：

- `kid`
- `algorithm`
- `status`
- `activated_at`
- `retired_at`
- `created_at`

筛选：

- keyword
- status
- algorithm

详情字段：

- `kid`
- `algorithm`
- `status`
- `metadata_json`
- `activated_at`
- `retired_at`
- `created_at`

详情扩展区：

- 公钥信息
- 私钥存在状态
- 生命周期记录

操作：

- 创建
- 激活
- 退役

---

## 6. 前端架构要求

### 6.1 总原则

- 不使用旧的动态资源通用页作为基础。
- 页面层与资源配置层分离。
- 通用列表、详情、表单、危险操作组件只负责结构和交互，不直接绑定具体业务名称。
- 资源差异通过 v2 资源定义和特例扩展面板表达。

### 6.2 目标结构

建议结构：

```txt
apps/admin-web/features/admin-v2/
  config/
    resource-definitions.ts
    navigation.ts
  api/
    resource-client.ts
  hooks/
    use-resource-list.ts
    use-resource-detail.ts
  components/
    resource-list-page.tsx
    resource-detail-page.tsx
    resource-form-dialog.tsx
    resource-danger-zone.tsx
    resource-table.tsx
    resource-overview.tsx
  sections/
    application-secret-section.tsx
    agent-credentials-section.tsx
    related-records-section.tsx
```

### 6.3 共享组件职责

- `resource-list-page`
  负责标题、筛选、表格、创建入口。
- `resource-detail-page`
  负责详情骨架、编辑入口、危险操作入口。
- `resource-form-dialog`
  负责统一新增与编辑表单。
- `resource-danger-zone`
  负责统一危险操作样式和确认流程。
- `resource-table`
  负责列表渲染、状态标签、空态。

### 6.4 资源定义层

资源定义至少包含：

- route key
- endpoint
- list columns
- filter schema
- create form schema
- edit form schema
- detail field groups
- dangerous action schema
- optional custom section renderers

---

## 7. 后端契约要求

V2 依赖更完整的资源接口。

### 7.1 必须具备

对于以下资源，必须提供 `GET /:id`：

- runtimes
- target-resources
- target-connections
- access-grants
- keys

### 7.2 建议能力

- 列表支持筛选参数
- 详情返回关联摘要，避免前端自行拼接关系
- 状态变更使用明确 action 或可控的 update contract

### 7.3 禁止

- 禁止以 UI 交互为前提要求用户手填数据库主键
- 禁止要求用户手写 JSON patch 才能完成常规运维操作

---

## 8. 迁移策略

### 8.1 删除对象

V2 完成后，以下旧实现应停止作为主入口：

- `features/resources/resource-page.tsx`
- `features/resources/resource-actions.tsx`
- `features/resources/resource-config.ts`
- `app/(admin)/[resource]/page.tsx`

### 8.2 可复用对象

- `adminFetch`
- 安全相关 API
- `SecretField`
- `CopyableField`
- 基础 Button / Card / Table / Input 组件

### 8.3 迁移顺序

1. 先建新资源定义和共享骨架
2. 再接入 7 类资源
3. 再切换路由入口
4. 最后下线旧通用资源页

---

## 9. 验证要求

至少验证：

- 列表加载
- 搜索和筛选
- 新增
- 编辑
- 详情展示
- 危险操作确认
- Secret 展示流程
- 错误反馈
- 空状态
- 会话过期跳转

测试覆盖建议：

- 资源定义和字段配置测试
- 统一表单测试
- 统一列表页测试
- 关键详情页特例测试

---

## 10. 验收标准

| ID | 要求 |
|----|------|
| V2-01 | 7 类资源均使用统一列表页与详情页模型。 |
| V2-02 | 不再存在手填 ID + 手写 JSON patch 的主交互。 |
| V2-03 | 新增、编辑、危险操作遵循统一 UI 规范。 |
| V2-04 | Secret 和敏感值默认隐藏，操作明确。 |
| V2-05 | 资源差异通过配置和特例区表达，而不是复制页面。 |
| V2-06 | 旧通用资源页不再作为主要资源入口。 |
| V2-07 | V2 页面层不依赖旧 `features/resources` 页面模型。 |
