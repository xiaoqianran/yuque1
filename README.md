# yuque1

复刻语雀（Yuque）核心能力的可自托管知识库：企业级研发流程、OpenAPI 契约先行，前后端迭代交付。

**当前发布**：**[v0.6.3](https://github.com/xiaoqianran/yuque1/releases/tag/v0.6.3)**（OpenAPI **0.1.10**）  
**开发主干 `dev`**：工作区信息架构、拖拽排序、复制文档等已合入（待下一正式 release）

## 能力一览

| 能力 | 说明 |
|------|------|
| 短信登录 | Mock 验证码；Cookie `sid` 会话 |
| 个人资料 | 昵称更新；可选邮箱绑定（不验证） |
| 知识库 | 创建/列表/改名/简介/软删；删除确认 Dialog |
| 文档树 | folder/doc、搜索、重命名、移动、折叠、**拖拽排序**、**复制文档**、键盘上下选择 |
| 回收站 | 软删列表、恢复、永久删除、**清空回收站** |
| 工作区 IA | 侧栏仅导航+树；设置/成员/分享/历史进 Dialog/Drawer；默认打开最近/首篇文档 |
| 正文 | CodeMirror 编辑 / **react-markdown GFM 预览** / 大纲 / 字数 / 导入·导出 MD / **导入·导出知识库 ZIP** / 专注 / Ctrl+S / 自动保存 |
| 分享 | token 公开只读；有效期；分享页 MD 渲染 |
| 成员 | owner 添加 editor/reader；转让 owner |
| UI | 平面内容优先工作区 · 系统中文字体 · 可访问确认 Dialog |

## 快速启动

- **Node.js 22**（`.nvmrc`）
- **pnpm 9** monorepo（`apps/web` + `apps/api`）
- Docker：PostgreSQL 16 + Redis 7

```bash
node -v   # 期望 v22.x
cp .env.example .env
pnpm install
pnpm compose:up
pnpm db:migrate          # 若 localhost:5432 不可达（DinD）：pnpm db:migrate:docker
pnpm db:generate
pnpm dev:api             # :3000
pnpm dev:web             # :5173（code-server 见 ops 文档 /proxy/5173）
```

本地联调登录（mock）：

- 手机号示例：`+8613800138000`
- 验证码：`.env` 中 `SMS_MOCK_CODE`（默认 `123456`）

## 质量与冒烟

```bash
pnpm run ci              # typecheck + unit + build
pnpm smoke               # health/ready（含 compose/migrate）
pnpm smoke:e2e           # 业务链路：登录→资料→建库→正文/快照→分享过期→成员→转让
```

CI 在 build 后会自动跑 `scripts/smoke-e2e-api.mjs`。

## 文档

| 文档 | 说明 |
|------|------|
| [本地开发与 M0](./docs/ops/本地开发与M0.md) | Compose / DinD / 启动 / smoke |
| [Git 工作流与提交规范](./docs/工程规范/Git工作流与提交规范.md) | Issue → 分支 → PR → 自动合并 |
| [企业级前后端项目开发流程](./docs/企业级前后端项目开发流程.md) | 研发阶段与质量门禁 |
| [产品愿景与范围](./docs/prd/00-产品愿景与范围.md) | MVP 与冻结决策 |
| [总体技术方案](./docs/design/00-总体技术方案.md) | 架构与选型 |
| [领域模型与数据库](./docs/design/01-领域模型与数据库.md) | 表结构与聚合 |
| [OpenAPI 契约](./docs/api/openapi.yaml) | HTTP API SSOT |

## 协作铁律

1. **先 Issue，再分支**  
2. Commit 遵循 Conventional Commits，**关联 Issue**（`Closes #N`）  
3. 仅通过 PR 合入受保护分支，**CI 必须通过**  
4. 满足保护规则后 **自动合并并删除分支**  
5. **禁止**强制推送、绕过检查、直推 `main` / `dev`  

## License

UNLICENSED（私有项目约定，可后续调整）
