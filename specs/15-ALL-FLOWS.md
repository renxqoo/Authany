# 15 - 全量流程图

> 本文档汇总 AuthAny V1 的关键流程图，供产品、架构、研发、安全、接入方快速对齐全局链路。

---

## 1. 使用说明

这份文档是“全景图集合”，不是替代正文的简版说明。

阅读方式建议：

- 先看本文件把全局过一遍
- 再回到各专题文档看规则、失败路径和验收标准

---

## 2. 总体架构流

```mermaid
flowchart LR
    U["End User"] --> E["Entry / Runtime Layer"]
    E --> A["AuthAny Core"]
    A --> T["Target System"]
    T --> R["Business Result"]
```

说明：

- 上层负责发起
- 平台负责身份和 token
- 目标系统负责本地授权

---

## 3. 标准登录流

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client App
    participant A as AuthAny

    U->>C: 访问应用
    C->>A: /oauth/authorize + PKCE
    A->>U: 认证
    U->>A: 同意授权
    A-->>C: authorization code
    C->>A: /oauth/token
    A-->>C: access_token / refresh_token / id_token
```

---

## 4. Refresh Rotation 流

```mermaid
sequenceDiagram
    participant C as Client
    participant A as AuthAny

    C->>A: grant_type=refresh_token
    A->>A: 校验 refresh token
    A->>A: 旧 refresh token 标记不可再用
    A->>A: 签发新 access token
    A-->>C: new access token
```

---

## 5. Agent 注册与凭证下发流

```mermaid
flowchart LR
    ADMIN["接入管理员"] --> A["AuthAny"]
    A --> AG["创建 Agent"]
    AG --> C["签发或登记 Caller Credential"]
    C --> STORE["安全存储到 Runtime 可访问位置"]
```

---

## 6. Target System 注册流

```mermaid
flowchart LR
    ADMIN["接入管理员"] --> A["AuthAny"]
    ADMIN --> T["Target System"]
    A --> REG["注册 target_system_code / audience / status"]
    REG --> CONF["下发 issuer / JWKS / trust metadata"]
    CONF --> T
    T --> READY["建立系统级 trust"]
```

---

## 7. Runtime Registration 流

```mermaid
flowchart LR
    ADMIN["接入管理员"] --> A["AuthAny"]
    A --> R["创建 Runtime Registration"]
    R --> CONF["配置 runtime_mode / refresh / cache policy"]
    CONF --> READY["Runtime 可参与 delegation exchange"]
```

---

## 8. 首次 binding 流

```mermaid
sequenceDiagram
    participant U as User
    participant R as Runtime
    participant A as AuthAny
    participant T as Target System

    U->>R: 发起业务请求
    R->>A: delegation exchange
    A-->>R: binding_required + binding_url
    R-->>U: 返回授权绑定入口
    U->>A: 打开 binding_url
    A->>U: 完成认证和同意
    A->>T: 校验或确认本地映射
    A->>A: 建立 binding + grant
    A-->>U: 绑定成功
```

---

## 9. 已绑定用户 delegation 流

```mermaid
sequenceDiagram
    participant U as User
    participant R as Runtime
    participant A as AuthAny
    participant T as Target System

    U->>R: 发起业务请求
    R->>A: delegation exchange
    A->>A: 校验 credential / agent / binding / grant / target
    A-->>R: delegation token
    R->>T: Bearer token
    T->>T: 本地验签 + 本地授权
    T-->>R: 业务结果
```

---

## 10. Runtime delegation 校验流

```mermaid
flowchart TD
    A["收到 delegation request"] --> B["校验 caller credential"]
    B --> C["找到 Runtime Registration"]
    C --> D["校验 agent 状态"]
    D --> E["校验 target system 状态"]
    E --> F["解析 subject_context 或 service_subject_id"]
    F --> G["查询 binding 或 service subject"]
    G --> H["查询 grant"]
    H --> I["replay 检查"]
    I --> J["签发 delegation token"]
```

---

## 11. 无用户系统任务流

```mermaid
flowchart TD
    J["Scheduler / System Trigger"] --> R["Runtime"]
    R --> A["AuthAny"]
    A --> CHECK["校验 service subject + grant"]
    CHECK --> TOK["签发系统级 token 或拒绝"]
    TOK --> T["Target System"]
```

说明：

- 该流程不应伪造人类用户
- V1 正式支持 service subject 模型

---

## 12. Target System 消费 token 流

```mermaid
sequenceDiagram
    participant R as Runtime
    participant T as Target System
    participant J as AuthAny JWKS

    R->>T: Bearer token
    T->>J: 获取或使用缓存 JWKS
    T->>T: 校验签名 / iss / aud / exp
    T->>T: 识别 sub / agent_id / jti
    T->>T: 查本地主体映射
    T->>T: 做本地主体授权
    T-->>R: 返回结果
```

---

## 13. Revocation 判定流

```mermaid
flowchart LR
    ISSUE["签发 Token"] --> USE["请求携带 Token"]
    USE --> CHECK["校验签名 / exp / revocation"]
    CHECK --> OK["允许"]
    CHECK --> DENY["拒绝"]
```

---

## 14. Key Rotation 流

```mermaid
flowchart LR
    OLD["当前活跃 Key"] --> NEW["新增待切换 Key"]
    NEW --> SIGN["新 token 使用新 key 签发"]
    SIGN --> KEEP["保留旧公钥供历史 token 验签"]
    KEEP --> RETIRE["窗口结束后退役旧 key"]
```

---

## 15. 审计流

```mermaid
flowchart LR
    EVT["认证/授权/委托/治理事件"] --> AUD["Audit Module"]
    AUD --> MASK["脱敏"]
    MASK --> STORE["异步落库"]
    STORE --> QUERY["查询/导出"]
    STORE --> RISK["风控/排障"]
```

---

## 16. 失败路径总览

```mermaid
flowchart TD
    REQ["请求进入"] --> AUTH{"caller credential 有效?"}
    AUTH -- 否 --> E1["invalid_caller_credential"]
    AUTH -- 是 --> BIND{"binding 存在?"}
    BIND -- 否 --> E2["binding_required"]
    BIND -- 是 --> GRT{"grant 有效?"}
    GRT -- 否 --> E3["delegation_not_allowed"]
    GRT -- 是 --> TS{"target system 有效?"}
    TS -- 否 --> E4["invalid_target_system"]
    TS -- 是 --> PASS["签发 token"]
```
