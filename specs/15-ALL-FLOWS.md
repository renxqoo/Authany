# 15 - 全流程

> 本文档定义 AuthAny V1 移除业务用户绑定后的端到端流程。

---

## 1. Agent / Runtime 访问 Target

```mermaid
sequenceDiagram
    participant H as Agent Host
    participant R as Runtime
    participant A as AuthAny
    participant T as Target Resource

    H->>R: task + Requester JWT
    R->>A: POST /api/target-token，携带 Requester JWT
    A->>A: 校验 Requester JWT
    A->>A: 校验 Caller Credential 绑定
    A->>A: 校验 Agent 和 Runtime
    A->>A: 校验 Target Resource
    A->>A: 校验 Target Connection
    A->>A: 校验 Access Grant
    A->>A: 校验 external context 策略
    A-->>R: Target Token
    R->>T: Bearer Target Token
    T->>T: 本地授权
    T-->>R: 资源响应
```

---

## 2. Application 访问 Target

```mermaid
sequenceDiagram
    participant APP as Application
    participant A as AuthAny
    participant T as Target Resource

    APP->>A: Requester JWT + target_resource
    A->>A: 校验 Requester JWT 或 OAuth 2.1 confidential client auth
    A->>A: 校验 Application
    A->>A: 校验 Target Connection
    A->>A: 校验 Access Grant
    A-->>APP: Application Target Token
    APP->>T: Bearer Target Token
    T-->>APP: 资源响应
```

---

## 3. External Context 透传

```mermaid
flowchart TD
    U["Lark / WeChat / Web 用户"] --> H["Agent Host"]
    H --> R["Runtime"]
    R --> A["AuthAny"]
    A --> TOK["带 external_context 的已签名 Token"]
    TOK --> T["Target Resource"]
    T --> MAP["本地映射和权限判断"]
```

AuthAny 负责签名上下文，Target Resource 负责解释上下文。

---

## 4. User -> Agent -> CLI -> Resource

```mermaid
sequenceDiagram
    participant U as 用户或触发器
    participant AG as Agent
    participant CLI as CLI / Tool
    participant A as AuthAny
    participant T as Target Resource

    U->>AG: 自然语言请求
    AG->>CLI: tool call + Requester JWT
    CLI->>A: exchange Requester JWT
    A->>A: 校验 requester / runtime / grant
    A-->>CLI: Target Token
    CLI->>T: Bearer Target Token
    T->>T: 本地业务授权
    T-->>CLI: 数据或目标系统自己的授权链接
    CLI-->>AG: 执行结果
    AG-->>U: 回复
```

入口来源可以是 Chat、Web、CLI、MCP、Webhook、Workflow、Scheduler、IoT 或 RPA。只要入口被归一化为已签名 requester context，后续流程保持一致。

---

## 5. 拒绝流程

```mermaid
flowchart TD
    A["Token 请求"] --> B{"Credential 是否有效?"}
    B -- "否" --> E0["invalid_requester_jwt / invalid_caller_credential / invalid_app_secret"]
    B -- "是" --> C{"Principal 是否 active?"}
    C -- "否" --> E2["invalid_application / invalid_agent / invalid_runtime"]
    C -- "是" --> D{"Target 是否 active?"}
    D -- "否" --> E3["invalid_target_resource"]
    D -- "是" --> F{"Connection 是否 active?"}
    F -- "否" --> E4["connection_not_allowed"]
    F -- "是" --> G{"Grant 是否 active 且有效?"}
    G -- "否" --> E5["access_not_allowed"]
    G -- "是" --> H{"External context 是否允许?"}
    H -- "否" --> E6["invalid_external_context"]
    H -- "是" --> I["签发或复用 Token"]
```

---

## 6. 密钥轮换流程

```mermaid
sequenceDiagram
    participant OP as Operator
    participant A as AuthAny
    participant T as Target Resource

    OP->>A: 创建 pending key
    OP->>A: 激活 key
    A-->>T: JWKS 包含 active + verifying keys
    T->>A: 拉取 JWKS
    OP->>A: 验签窗口结束后 retire old key
```

---

## 7. 已移除流程

AuthAny V1 不再包含：

- End-user binding。
- `binding_required`。
- AuthAny 拥有的 Target User mapping。
- `sub=user:<id>` 的 User OBO Token。

---

## 8. 验收标准

| ID | 要求 |
|----|------|
| FLOW-01 | Agent / Runtime 到 Target Resource 的完整链路可以走通。 |
| FLOW-02 | Application 到 Target Resource 的完整链路可以走通。 |
| FLOW-03 | External context 可以透传，但不触发 AuthAny 用户绑定。 |
| FLOW-04 | 拒绝流程返回稳定错误码。 |
| FLOW-05 | 密钥轮换不影响仍未过期 Token 的验签。 |
