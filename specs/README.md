# AuthAny 正式规格

> 本目录是 AuthAny 的全新正式规格文档集。它不是讨论纪要，也不是零散草稿，而是后续产品评审、技术设计、研发实现、测试验收的统一基线。

---

## 1. 这套文档解决什么问题

旧的 `demand/` 更像讨论与演进记录，适合梳理方向。

新的 `specs/` 负责回答另外一件事：

- AuthAny V1 到底要实现什么
- 各模块边界是什么
- 哪些能力属于 P0
- 接入方需要做到什么
- 完成后怎么验收

一句话：

- `demand/` 偏讨论
- `specs/` 偏定稿

---

## 2. 阅读建议

### 第一步：先看总需求

1. [00-PRODUCT-REQUIREMENTS.md](00-PRODUCT-REQUIREMENTS.md)

适合产品、项目负责人、架构师先读，先把范围和边界定住。

### 第二步：看核心模型

2. [01-ARCHITECTURE.md](01-ARCHITECTURE.md)
3. [02-DOMAIN-MODEL.md](02-DOMAIN-MODEL.md)
4. [03-PROTOCOLS-AND-TOKENS.md](03-PROTOCOLS-AND-TOKENS.md)
5. [04-STATE-MACHINES.md](04-STATE-MACHINES.md)

适合后端、架构、安全先统一词汇和协议语义。

### 第三步：看四类功能规格

6. [05-ADMIN-FEATURES.md](05-ADMIN-FEATURES.md)
7. [06-END-USER-FLOWS.md](06-END-USER-FLOWS.md)
8. [07-AGENT-RUNTIME-INTEGRATION.md](07-AGENT-RUNTIME-INTEGRATION.md)
9. [08-TARGET-RESOURCE-INTEGRATION.md](08-TARGET-RESOURCE-INTEGRATION.md)

这一层最适合拿去做实施拆解。

### 第四步：看接口、数据、安全、运维和验收

10. [09-API-CONTRACTS.md](09-API-CONTRACTS.md)
11. [10-DATA-MODEL.md](10-DATA-MODEL.md)
12. [11-SECURITY-REQUIREMENTS.md](11-SECURITY-REQUIREMENTS.md)
13. [12-OPS-AND-DEPLOYMENT.md](12-OPS-AND-DEPLOYMENT.md)
14. [13-ACCEPTANCE-CRITERIA.md](13-ACCEPTANCE-CRITERIA.md)
15. [14-OPEN-QUESTIONS-AND-RISKS.md](14-OPEN-QUESTIONS-AND-RISKS.md)
16. [15-ALL-FLOWS.md](15-ALL-FLOWS.md)
17. [16-ADMIN-UI-V1.md](16-ADMIN-UI-V1.md)
18. [17-DELEGATION-TOKEN-BROKER.md](17-DELEGATION-TOKEN-BROKER.md)
19. [18-APPLICATION-MANAGEMENT.md](18-APPLICATION-MANAGEMENT.md)
20. [19-AGENT-MANAGEMENT.md](19-AGENT-MANAGEMENT.md)

---

## 3. 文档使用规则

- 本目录优先级高于旧的 `demand/`
- 实现前，以本目录为准
- 如果旧讨论与新规格冲突，以新规格为准
- 如果后续方案有重大调整，应直接改 `specs/`，而不是在外面再补一份“临时说明”

---

## 4. 推荐的评审顺序

| 角色 | 建议重点阅读 |
|------|--------------|
| 产品 | `00`、`05`、`13`、`16`、`18`、`19` |
| 后端 | `01`、`02`、`03`、`07`、`08`、`09`、`10` |
| 安全 | `03`、`04`、`11`、`13`、`14` |
| 运维 | `12`、`13`、`14`、`16` |
| 接入方 | `07`、`08`、`09`、`15` |
