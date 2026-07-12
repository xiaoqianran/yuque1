# Git 工作流与提交规范（阿里实践对齐）

> 本仓库强制：**Issue → 分支 → Commit → PR → CI 通过 → 自动合并**，禁止直推 `main`、禁止 force-push 绕过保护。

## 1. 分支命名

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能 | `feat/<short-desc>-<issue>` | `feat/sms-login-12` |
| 修复 | `fix/<short-desc>-<issue>` | `fix/tree-cycle-34` |
| 文档 | `docs/<short-desc>-<issue>` | `docs/prd-scope-3` |
| 工程 | `chore/<short-desc>-<issue>` | `chore/init-engineering-baseline-1` |
| 重构 | `refactor/<short-desc>-<issue>` | `refactor/doc-save-56` |

规则：

1. **基于 Issue 建分支**，分支名带 Issue 号便于追溯  
2. 从最新 `main` 拉出，生命周期尽量短  
3. 合并后删除远端分支（仓库已开启 delete on merge）

## 2. Commit 信息（Conventional Commits）

```
<type>(<scope>): <subject>

<body>

<footer>
```

### type

| type | 含义 |
|------|------|
| `feat` | 新功能 |
| `fix` | 缺陷修复 |
| `docs` | 仅文档 |
| `style` | 格式（不影响逻辑） |
| `refactor` | 重构 |
| `perf` | 性能 |
| `test` | 测试 |
| `chore` | 工程/杂项 |
| `ci` | CI 配置 |
| `build` | 构建/依赖 |

### 要求

- `subject` 使用祈使句、中文或英文均可，**清晰说明意图**  
- **必须关联 Issue**：footer 使用 `Closes #N` 或 `Fixes #N` 或 `Refs #N`  
- 一次 commit 只做一件事；禁止 `update` / `fix stuff` 等含糊信息  
- 禁止 `--no-verify` 绕过钩子（若后续启用 husky）  
- **禁止** `git push --force` 到 `main`；个人分支改基仅限未进 PR 审查前且无人协作时  

### 示例

```
docs(prd): 冻结产品愿景与 MVP 范围

- 明确手机号强制验证、冲突三选一、doc 子树
- 补充验收标准与 Open Questions

Closes #3
```

## 3. PR 规范

1. 标题与主 commit 风格一致，可带 `#N`  
2. 描述必须包含：**改动内容、影响范围、验证结果**（见 PR 模板）  
3. 合并条件：  
   - CI 全绿  
   - 满足分支保护（Review / 状态检查，以仓库设置为准）  
   - 使用 **Enable auto-merge**，通过后合并并删分支  
4. 推荐 **Squash and merge**，保持 `main` 线性可读  

## 4. 禁止事项

- 直接向 `main` commit / push  
- `--force` / `--force-with-lease` 推送到受保护分支  
- 空过 CI、管理员临时关保护来合并（紧急事故须事后补审计）  
- Commit 中包含密钥、`.env`、个人信息明文  

## 5. 推荐本地命令流

```bash
git checkout main
git pull origin main
git checkout -b docs/your-topic-123

# ... 修改 ...
git add <paths>
git commit -m "$(cat <<'EOF'
docs(scope): 简明说明

Closes #123
EOF
)"

git push -u origin HEAD
gh pr create --fill   # 或按模板填写
gh pr merge --auto --squash
```
