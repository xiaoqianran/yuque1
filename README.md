# yuque1

复刻语雀（Yuque）核心能力的可自托管知识库项目：企业级前后端流程、产品范围与技术方案先行，再迭代交付。

## 运行时

- **Node.js 22**（见 `.nvmrc` / `package.json#engines`）
- 包管理：**pnpm 9 monorepo**（`apps/web` + `apps/api`）

```bash
node -v   # 期望 v22.x
cp .env.example .env
pnpm install
pnpm compose:up          # PostgreSQL + Redis
pnpm run ci
pnpm dev:api             # :3000
pnpm dev:web             # :5173
```

详见 [本地开发与 M0](./docs/ops/本地开发与M0.md)。

## 文档

| 文档 | 说明 |
|------|------|
| [Git 工作流与提交规范](./docs/工程规范/Git工作流与提交规范.md) | Issue → 分支 → Commit → PR → 自动合并 |
| [企业级前后端项目开发流程](./docs/企业级前后端项目开发流程.md) | 研发阶段与质量门禁 |
| [产品愿景与范围](./docs/prd/00-产品愿景与范围.md) | MVP 与冻结决策 |
| [总体技术方案](./docs/design/00-总体技术方案.md) | 架构与选型 |
| [领域模型与数据库](./docs/design/01-领域模型与数据库.md) | 表结构与聚合 |
| [OpenAPI 契约](./docs/api/openapi.yaml) | HTTP API SSOT |
| [本地开发与 M0](./docs/ops/本地开发与M0.md) | Compose / 启动 / CI |

## 协作铁律

1. **先 Issue，再分支**  
2. Commit 遵循 Conventional Commits，**关联 Issue**（`Closes #N`）  
3. 仅通过 PR 合入 `main`，**CI 必须通过**  
4. 满足保护规则后 **自动合并并删除分支**  
5. **禁止**强制推送、绕过检查、直推 `main`  

## License

UNLICENSED（私有项目约定，可后续调整）
