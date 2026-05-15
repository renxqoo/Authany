# 13 - 验收标准

> 本文档定义 AuthAny V1 的正式验收清单。验收目标不是“能跑起来”，而是确认范围、边界、安全和接入能力都达到可交付状态。

---

## 1. 验收原则

本项目验收分为 8 类：

1. 需求完整性验收
2. 协议能力验收
3. 管理能力验收
4. 用户流程验收
5. Agent Runtime 接入验收
6. Target System 接入验收
7. 安全与运维验收
8. 工程与测试验收

规则：

- 所有 P0 验收项必须通过，V1 才能视为完成
- P1、P2 只做记录，不作为本轮上线阻塞项

---

## 2. 需求与文档验收

| 编号 | 验收项 | 通过标准 |
|------|--------|----------|
| DOC-01 | 新规格目录完整 | `specs/` 文档结构完整，覆盖产品、架构、流程、API、数据、安全、运维、验收 |
| DOC-02 | 文档角色明确 | 产品、研发、安全、运维可按文档快速找到对应章节 |
| DOC-03 | 术语一致 | `Agent`、`Caller Credential`、`Binding`、`Grant`、`Target System` 等术语在全文一致 |
| DOC-04 | 边界清晰 | 文档中明确区分平台负责和目标系统负责的能力 |

---

## 3. 协议能力验收

| 编号 | 验收项 | 通过标准 |
|------|--------|----------|
| PRO-01 | OIDC Discovery | 可返回完整 discovery metadata |
| PRO-02 | JWKS | 可返回可消费的 JWKS |
| PRO-03 | Authorization Code + PKCE | 标准登录主链路可用，`state` 和 PKCE 校验生效 |
| PRO-04 | Refresh Rotation | refresh 成功后签发新 token，旧 refresh token 不可再用 |
| PRO-05 | Revocation | 支持标准 revoke，且 revoke 语义为提前失效 |
| PRO-06 | Introspection | 可对 token 做在线有效性查询 |
| PRO-07 | Delegation Token | Runtime 可通过统一接口换取 delegation token |
| PRO-08 | Delegation 生命周期策略 | delegation token 过期后可重新 exchange，V1 默认不要求 delegation refresh token |

---

## 4. 管理能力验收

| 编号 | 验收项 | 通过标准 |
|------|--------|----------|
| ADM-01 | 用户管理 | 可创建、查询、更新、停用、挂起用户 |
| ADM-02 | 身份源管理 | 可创建和启停身份源 |
| ADM-03 | OAuth Client 管理 | 可创建 client、配置 redirect_uri、轮换 secret |
| ADM-04 | Agent 管理 | 可创建、启停 Agent，并查看基本状态 |
| ADM-05 | Service Subject 管理 | 可创建、启停 Service Subject，并参与系统任务授权 |
| ADM-06 | Runtime Registration 管理 | 可配置 Runtime 的 `stateful/stateless` 与 delegation refresh 能力 |
| ADM-07 | Caller Credential 管理 | 可签发、轮换、撤销调用凭证，且原文只展示一次 |
| ADM-08 | Target System 管理 | 可注册、更新、启停 Target System，并配置 audience |
| ADM-09 | Binding 管理 | 可查询、创建、失效 binding |
| ADM-10 | Grant 管理 | 可查询、创建、停用 grant |
| ADM-11 | 审计查询 | 可按时间、user、agent、target_system、event_type 查询关键事件 |

---

## 5. 用户流程验收

| 编号 | 验收项 | 通过标准 |
|------|--------|----------|
| USER-01 | 标准登录 | 最终用户可完成登录并获取标准 token |
| USER-02 | 首次绑定 | 未绑定用户访问 Agent 时可收到明确 binding 入口 |
| USER-03 | 再次访问免重复授权 | binding 与 grant 有效时，不需要再次人工授权 |
| USER-04 | 重新绑定边界正确 | 只有 binding 或 grant 失效时才触发重新绑定 |
| USER-05 | 错误反馈可理解 | 用户能区分需要授权、需要重试、需要管理员介入三类错误 |
| USER-06 | Binding 页面 P0 | V1 提供正式 binding 页面或等价授权入口 |

---

## 6. Agent Runtime 接入验收

| 编号 | 验收项 | 通过标准 |
|------|--------|----------|
| RT-01 | 通用集成模型 | CLI、MCP、HTTP Runtime 均可使用统一 delegation exchange 模型 |
| RT-02 | 上下文表达 | Runtime 能提交 `agent_id`、`target_system`，并按场景提交 `subject_context` 或 `service_subject_id` |
| RT-03 | caller credential 安全 | caller credential 不进入源码，不写普通日志 |
| RT-04 | binding_required 处理 | Runtime 能把 binding URL 返回给最终用户入口 |
| RT-05 | token 缓存边界 | Runtime 只缓存短期 token，不保存业务用户长期秘密 |
| RT-06 | 无用户场景区分 | 定时任务或系统任务不会伪造人类用户上下文 |
| RT-07 | Stateless 运行时策略 | OpenClaw/CLI 等无状态 Runtime 可按次 exchange 获取 delegation token |

---

## 7. Target System 接入验收

| 编号 | 验收项 | 通过标准 |
|------|--------|----------|
| TS-01 | Trust 建立 | Target System 可完成注册并拿到 issuer、audience、JWKS 配置 |
| TS-02 | JWT 验签 | Target System 能验证签名、iss、aud、exp、kid |
| TS-03 | 主体识别 | Target System 能识别 `sub` 与 `agent_id` |
| TS-04 | 本地主体映射 | Target System 能将平台用户或服务主体映射到本地主体 |
| TS-05 | 系统任务主体识别 | Target System 能识别并处理 `service:*` 主体 |
| TS-06 | 本地权限自治 | 目标系统继续使用自己的资源权限模型 |
| TS-07 | 拒绝逻辑正确 | 无映射、无权限、aud 错误等场景能明确拒绝 |

---

## 8. 安全验收

| 编号 | 验收项 | 通过标准 |
|------|--------|----------|
| SEC-01 | 非对称签名 | 所有 JWT 使用 RS256 且带 `kid` |
| SEC-02 | Key Rotation | 具备密钥轮换流程，历史 token 在窗口期内仍可验证 |
| SEC-03 | Credential Rotation | caller credential 可轮换，旧凭证可撤销 |
| SEC-04 | Replay Protection | delegation 请求具备防重放能力 |
| SEC-05 | Revocation 语义 | revoke 不是 delete，撤销事件可追溯 |
| SEC-06 | 敏感数据保护 | secret、refresh token、caller credential 不明文长期存储 |
| SEC-07 | 审计链路 | 认证、delegation、高危管理动作均可追踪 |

---

## 9. 运维验收

| 编号 | 验收项 | 通过标准 |
|------|--------|----------|
| OPS-01 | 部署模型 | 单体模块化部署可落地 |
| OPS-02 | 环境隔离 | local、dev、staging、production 配置和密钥隔离 |
| OPS-03 | 健康检查 | app、db、redis、readiness、liveness 可用 |
| OPS-04 | 监控 | token、delegation、错误率、时延等核心指标可观测 |
| OPS-05 | 告警 | token 失败、delegation 异常、Redis 或 DB 故障可告警 |
| OPS-06 | 降级正确 | 故障降级不绕过核心安全校验 |

---

## 10. 性能与稳定性验收

| 编号 | 验收项 | 通过标准 |
|------|--------|----------|
| PERF-01 | delegation 热路径 | 具备 binding、grant、防重放等缓存优化路径 |
| PERF-02 | revoke 判定 | 可快速判断 token 是否已撤销 |
| PERF-03 | JWKS 消费 | 目标系统可缓存消费 JWKS，不必每次在线查询 |
| PERF-04 | 异常恢复 | Redis 缓存失效后平台可回源数据库维持正确性 |

---

## 11. 工程与测试验收

| 编号 | 验收项 | 通过标准 |
|------|--------|----------|
| ENG-01 | 模块边界 | 用户、协议、Agent、Target、审计等模块边界清晰 |
| ENG-02 | 配置治理 | 关键配置项、密钥来源、环境变量说明完整 |
| ENG-03 | 单元测试 | 核心领域对象和协议逻辑具备单元测试 |
| ENG-04 | 集成测试 | 标准登录和 delegation 主链路具备集成测试 |
| ENG-05 | 安全测试 | replay、revoke、invalid credential、invalid audience 等场景具备测试 |
| ENG-06 | 文档与实现一致 | 对外接口、流程和文档描述一致 |

---

## 12. 不能算通过的情况

即使系统“基本能跑”，以下情况也不能视为 V1 完成：

- 只能支持单一 Agent 平台
- 只能支持单一聊天平台上下文
- 把业务系统资源权限写进平台 token
- 没有 binding 与 grant 的清晰边界
- revoke 直接做成 delete
- caller credential 明文落库或出现在日志

---

## 13. 最终交付判定

AuthAny V1 只有在以下四件事同时成立时，才算真正完成：

1. 标准 OAuth/OIDC 登录链路可用
2. Agent delegation 链路可用
3. 系统任务可通过 Service Subject 模型访问 Target System
4. Target System 能在不迁移本地权限体系的前提下接入
