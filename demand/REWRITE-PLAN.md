# AuthAny 文档重构计划

> 本文档用于说明：为什么现有 `demand/` 文档体系需要重构、应该如何拆分、每份文档应该承载什么内容、统一模板如何定义，以及后续重写顺序。

---

## 1. 重构目标

当前 `authany/demand` 目录已经具备正确的大方向：

- 平台定位基本正确
- 抽象层级已经从特定产品提升到通用模型
- 核心概念已经初步建立
- 关键流程图已经补齐

但它还不是一套真正适合开工、评审、交付和验收的需求规格。

当前的主要问题是：

- 更像“方案讨论记录 + 架构说明 + 流程草图”
- 不是“可执行的产品需求与技术规格”
- 功能边界、实现深度、验收标准还不够硬
- 各文档之间有重复、散点和层级不统一的问题

本次重构的目标是把文档升级成：

1. 可以给产品看
2. 可以给后端和架构师看
3. 可以给安全与运维看
4. 可以直接作为研发实现前的规格基线
5. 可以在后续扩展时不依赖补丁式兼容文档

---

## 2. 当前文档体系的问题

## 2.1 结构问题

当前文档虽然已经分成 `00-13`，但整体仍有这些结构性问题：

- 总控文档像架构摘要，不像真正的产品需求入口
- 有些文档是“模块说明”，但没有明确交付范围
- 有些文档是“流程说明”，但没有明确实现要求
- 验收标准还不够逐项
- 开放问题、风险、依赖尚未单独收敛

## 2.2 内容问题

与一份成熟需求文档相比，当前内容还缺：

- P0 / P1 / P2 的正式功能清单
- 平台管理员功能的完整列表
- Target Resource 注册的正式规格
- Caller Credential 生命周期规格
- Binding 与 Grant 的清晰区分及状态机
- 非功能性目标
- 测试、性能、安全、部署的量化验收
- 不做的事
- 统一的开放问题清单

## 2.3 表达问题

当前文档仍存在：

- 有些内容偏“概念正确”，但还不够“实现可执行”
- 有些章节偏“描述”，没有落成必须实现的规则
- 有些地方的验收还是摘要，不是 checklist

---

## 3. 重构原则

文档重构必须遵守以下原则：

### 3.1 先定产品需求，再定技术细节

顺序必须是：

- 先明确做什么
- 再明确怎么设计
- 最后明确怎么验收

### 3.2 一份文档只回答一类问题

例如：

- 产品范围归产品范围
- 协议归协议
- 数据模型归数据模型
- 安全归安全
- 验收归验收

不要混装。

### 3.3 统一写法

所有文档采用统一模板，这样：

- 更容易审阅
- 更容易补充
- 更容易后续维护

### 3.4 每份文档都要可执行

不能只讲“原则正确”，还要讲：

- 具体要做什么
- 允许怎么做
- 不允许怎么做
- 怎么算完成

### 3.5 流程图是辅助，不是正文替代

流程图必须有，但不能只有图。

每个图必须对应：

- 目标
- 输入输出
- 规则
- 失败路径

---

## 4. 新文档结构

建议将 `demand/` 重构为以下体系：

### 4.1 总控层

- `00-PRODUCT-REQUIREMENTS.md`
- `README.md`

### 4.2 核心设计层

- `01-ARCHITECTURE.md`
- `02-DOMAIN-MODEL.md`
- `03-PROTOCOLS-AND-TOKENS.md`
- `04-STATE-MACHINES.md`

### 4.3 功能规格层

- `05-ADMIN-FEATURES.md`
- `06-END-USER-FLOWS.md`
- `07-AGENT-RUNTIME-INTEGRATION.md`
- `08-TARGET-RESOURCE-INTEGRATION.md`
- `09-API-CONTRACTS.md`
- `10-DATA-MODEL.md`

### 4.4 工程与交付层

- `11-SECURITY-REQUIREMENTS.md`
- `12-OPS-AND-DEPLOYMENT.md`
- `13-ACCEPTANCE-CRITERIA.md`
- `14-OPEN-QUESTIONS-AND-RISKS.md`
- `15-ALL-FLOWS.md`

---

## 5. 每份文档应该承载什么

## 5.1 `00-PRODUCT-REQUIREMENTS.md`

这是唯一总入口。

必须包含：

- 项目定位
- 目标与非目标
- 用户角色
- 系统角色
- P0 / P1 / P2 范围
- 不做的事
- 核心业务流程总览
- 总体验收标准
- 文档导航

它不能变成：

- 技术细节大全
- 数据表大全
- API 契约大全

## 5.2 `01-ARCHITECTURE.md`

必须包含：

- 系统分层
- 信任边界
- 运行时角色
- 调用链路
- 平台与目标系统边界
- 平台与 Agent Host / Tool Runtime 边界

## 5.3 `02-DOMAIN-MODEL.md`

必须包含：

- User
- Identity Source
- OAuth Client
- Agent Profile
- Caller Credential
- User Binding
- Delegation Grant
- Target Resource Registration
- Audit Event

每个对象都要写：

- 定义
- 职责
- 关键字段
- 与其他对象关系
- 不应该承担什么职责

## 5.4 `03-PROTOCOLS-AND-TOKENS.md`

必须包含：

- OAuth / OIDC 范围
- delegation 协议
- token claim
- refresh 语义
- revoke 语义
- token 不可变模型
- audience / issuer / actor 约定

## 5.5 `04-STATE-MACHINES.md`

必须包含：

- User 状态机
- Agent 状态机
- Caller Credential 状态机
- User Binding 状态机
- Delegation Grant 状态机
- Authorization Code 状态机
- Refresh Token 状态机
- Revocation 事件语义

## 5.6 `05-ADMIN-FEATURES.md`

必须包含：

- 平台管理员能力
- Agent 注册
- Caller Credential 管理
- Target Resource 注册
- Binding 管理
- Delegation Grant 管理
- 审计查看
- 配置管理

## 5.7 `06-END-USER-FLOWS.md`

必须包含：

- 首次授权
- 已授权调用
- 绑定失效
- 重新授权
- 多渠道触发
- 用户看得见的页面与返回结果

## 5.8 `07-AGENT-RUNTIME-INTEGRATION.md`

必须包含：

- Agent Host 如何接入
- Tool Runtime 如何接入
- 运行时上下文协议
- Caller Credential 读取方式
- delegation token 获取方式
- 错误处理

## 5.9 `08-TARGET-RESOURCE-INTEGRATION.md`

必须包含：

- Target Resource 注册
- trust config
- audience 约定
- JWKS 验签
- 平台用户映射到本地用户
- 本地授权衔接
- 标准接入模式

## 5.10 `09-API-CONTRACTS.md`

必须包含：

- 标准协议 API
- 管理 API
- delegation API
- 请求结构
- 响应结构
- 错误码
- 拒绝条件
- 安全要求

## 5.11 `10-DATA-MODEL.md`

必须包含：

- 数据表建议
- 索引策略
- 唯一约束
- 审计字段
- token 不可变建模
- 数据保留策略
- 不允许的建模方式

## 5.12 `11-SECURITY-REQUIREMENTS.md`

必须包含：

- 签名算法
- key rotation
- caller credential 安全
- replay 防护
- revocation 语义
- 限流
- 审计
- 敏感信息存储要求

## 5.13 `12-OPS-AND-DEPLOYMENT.md`

必须包含：

- 环境划分
- 配置管理
- 密钥管理
- 部署拓扑
- 健康检查
- metrics
- 告警
- 降级策略

## 5.14 `13-ACCEPTANCE-CRITERIA.md`

必须包含：

- 环境与工程验收
- P0 功能验收
- 安全验收
- 集成验收
- 性能验收
- 运维验收
- 测试验收

必须用表格写。

## 5.15 `14-OPEN-QUESTIONS-AND-RISKS.md`

必须包含：

- 待确认问题
- 风险项
- 假设
- 决策备选方案
- 后续演进提醒

## 5.16 `15-ALL-FLOWS.md`

必须包含：

- 所有关键流程图汇总
- 每张图一句话说明
- 方便产品、架构、后端、安全统一阅读

---

## 6. 统一标准模板

建议所有文档默认使用以下模板：

```md
# 标题

> 一句话说明这份文档解决什么问题

---

## 1. 文档目标
- 这份文档回答什么
- 不回答什么

## 2. 背景与上下文
- 当前问题
- 为什么需要这一块
- 与其他文档关系

## 3. 范围
### 3.1 本文覆盖
- ...

### 3.2 本文不覆盖
- ...

## 4. 核心定义
- 名词
- 对象
- 状态
- 边界术语

## 5. 功能 / 规则 / 设计
- 主体内容
- 分模块写
- 每条规则尽量可执行

## 6. 流程
```mermaid
flowchart LR
```

## 7. 实现要求
- 必须实现什么
- 推荐实现什么
- 明确不允许怎么实现

## 8. 异常与失败路径
- 失败场景
- 拒绝条件
- 降级策略

## 9. 依赖与前置条件
- 依赖哪个模块
- 依赖哪个配置
- 依赖哪个外部系统

## 10. 验收标准
- 功能验收
- 安全验收
- 工程验收
- 性能验收

## 11. 开放问题
- 还没定的点
- 待确认项

## 12. 关联文档
- ...
```

---

## 7. 特殊文档模板

## 7.1 `00-PRODUCT-REQUIREMENTS.md`

建议模板：

```md
# AuthAny - 产品需求文档

## 1. 项目定位
## 2. 目标与非目标
## 3. 用户角色
## 4. 系统角色
## 5. P0 / P1 / P2 功能范围
## 6. 不做的事
## 7. 核心业务流程总览
## 8. 核心设计原则
## 9. 交付边界
## 10. 总体验收标准
## 11. 依赖与约束
## 12. 风险与开放问题
## 13. 文档导航
```

## 7.2 `04-STATE-MACHINES.md`

建议模板：

```md
## 对象名

### 状态列表
- draft
- active
- revoked
- expired

### 状态流转图
```mermaid
stateDiagram-v2
```

### 进入条件
- ...

### 退出条件
- ...

### 非法状态
- ...

### 验收点
- ...
```

## 7.3 `13-ACCEPTANCE-CRITERIA.md`

建议模板：

```md
# 验收标准

## 1. 环境与工程验收
| 编号 | 验收项 | 通过标准 |

## 2. P0 功能验收
| 编号 | 验收项 | 通过标准 |

## 3. 安全验收
| 编号 | 验收项 | 通过标准 |

## 4. 集成验收
| 编号 | 验收项 | 通过标准 |

## 5. 性能验收
| 编号 | 验收项 | 通过标准 |

## 6. 运维验收
| 编号 | 验收项 | 通过标准 |

## 7. 测试验收
| 编号 | 验收项 | 通过标准 |
```

## 7.4 `15-ALL-FLOWS.md`

建议模板：

```md
# 全量流程图

## 1. 总体架构流
> 一句话说明

## 2. 标准登录流
> 一句话说明

## 3. refresh 流
> 一句话说明

## 4. Agent 注册与凭证下发流
> 一句话说明

## 5. delegation token 签发流
> 一句话说明

## 6. 首次绑定流
> 一句话说明

## 7. Target Resource 注册流
> 一句话说明

## 8. Target Resource 消费 token 流
> 一句话说明

## 9. revoke 判定流
> 一句话说明

## 10. 审计流
> 一句话说明
```

---

## 8. 功能重拆建议

为了让需求和实现更对齐，建议把功能重新归成 5 大域：

### 8.1 身份与认证

- 本地兜底账号
- 上游身份源接入
- 标准登录
- 用户标准化身份

### 8.2 Agent 与调用凭证

- Agent 注册
- Caller Credential 签发 / 登记
- Caller Credential 轮换
- Caller Credential 撤销

### 8.3 Target Resource 接入

- Target Resource 注册
- audience / issuer / JWKS 信任配置
- 本地用户映射
- 本地授权衔接

### 8.4 委托访问

- delegation token 申请
- binding 检查
- grant 检查
- token 签发
- revoke / rotation / replay protection

### 8.5 治理与运维

- 审计
- 管理后台能力
- 监控告警
- 配置管理
- 环境部署

---

## 9. 文档重写顺序

建议不要直接从头到尾平铺重写，而是按依赖顺序推进：

### Phase 1

- `00-PRODUCT-REQUIREMENTS.md`

### Phase 2

- `01-ARCHITECTURE.md`
- `02-DOMAIN-MODEL.md`
- `03-PROTOCOLS-AND-TOKENS.md`
- `04-STATE-MACHINES.md`

### Phase 3

- `09-API-CONTRACTS.md`
- `10-DATA-MODEL.md`
- `11-SECURITY-REQUIREMENTS.md`

### Phase 4

- `05-ADMIN-FEATURES.md`
- `06-END-USER-FLOWS.md`
- `07-AGENT-RUNTIME-INTEGRATION.md`
- `08-TARGET-RESOURCE-INTEGRATION.md`

### Phase 5

- `12-OPS-AND-DEPLOYMENT.md`
- `13-ACCEPTANCE-CRITERIA.md`
- `14-OPEN-QUESTIONS-AND-RISKS.md`
- `15-ALL-FLOWS.md`

---

## 10. 重写时必须补上的内容

这些是现有文档体系明显还不够的部分，重写时必须正式补齐：

- 平台角色模型
- Target Resource Registration 规格
- Caller Credential 生命周期
- Binding 与 Grant 的严格区别
- token 不可变模型
- 状态机
- 失败路径
- 非功能性要求
- 测试与验收矩阵
- 不做的事
- 开放问题清单

---

## 11. 旧文档与新文档映射

当前 `00-13` 不建议继续作为最终形态长期维护。

建议策略：

- 旧文档内容作为重写输入材料
- 新文档作为正式规格
- 待新文档稳定后，旧文档可归档或重定向

大致映射：

| 旧文档 | 新文档去向 |
|--------|-----------|
| `00-authany-executable-plan.md` | 拆入 `00/01/02/03/13/14` |
| `01-overview.md` | `00/01` |
| `02-database.md` | `02/10/04` |
| `03-oauth-core.md` | `03/09/04` |
| `04-security.md` | `11/13/14` |
| `05-api-design.md` | `09` |
| `06-module-auth.md` | `05/06/01` |
| `07-module-user.md` | `02/05/06` |
| `08-module-app.md` | `02/05/07` |
| `09-module-audit.md` | `05/11/12/13` |
| `10-module-ebfx.md` | `08/15` |
| `11-cache-performance.md` | `11/12/13` |
| `12-deployment.md` | `12/13` |
| `13-integration.md` | `08/07/15` |

---

## 12. 下一步建议

建议按以下顺序推进：

1. 先确认本重构计划
2. 基于本计划，重写 `README.md`
3. 先落 `00-PRODUCT-REQUIREMENTS.md`
4. 再按重写顺序逐份替换旧文档

本阶段先不写代码，只重构需求和规格文档。
