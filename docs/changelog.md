# 更新日志维护

[返回 README](../README.md)

首页“更新内容”弹窗从 `src/content/changelog/` 读取 Markdown 文件，
将普通更新和重要提示统一展示，不再单独弹出重要通知。
首页首次进入时沿用每个浏览器会话自动弹出一次的行为，
也可随时点击“更新内容”重新打开。

## 编辑与新增

- 修改已有版本：直接编辑对应的 `.md` 文件。
- 新增版本：在目录内新建 `YYYY-MM-DD.md`，例如 `2026-10-25.md`。
- 同一天多次发布可用 `YYYY-MM-DD-02.md`、`YYYY-MM-DD-03.md` 区分。
- 文件名按降序展示；同日编号使用两位数字，确保新版本在前。
- 文件中写标题、发布日期、更新列表和重要提示，内容全部使用 Markdown。
- 目录只放日志正文，不放 README 或编辑说明，避免它们出现在弹窗里。

```markdown
# 版本号

2026-10-25

## 更新内容

- 修复的问题或新增的功能。

## 重要提示

需要用户关注的变更、时间安排或兼容性说明。
```

支持标题、列表、加粗、引用、链接、代码块和表格。
渲染后的 HTML 会经 DOMPurify 清理，不能嵌入脚本或事件处理器。
图片建议放在 `public/`，通过站点内的资源路径引用。

日志由 Vite 在构建时打包，开发模式下修改文件会触发热更新；
线上修改后需要重新构建和部署，GitHub Pages 静态演示版同样支持。
不需要启动后端，也不需要修改 Vue 组件或手动维护文件索引。

## GitHub Release 发布

`.github/workflows/release.yml` 在推送 `v*` 标签时执行测试与构建，
然后等待 `release` 环境的审批，通过后发布 Release。
请先在仓库 Settings → Environments → release 中设置 Required reviewers；
若由自己触发并审批，不要开启 Prevent self-review。

- Release 标题沿用标签，例如 `v261024`。
- `package.json` 的版本必须为去掉 `v` 后的标签值，例如 `261024`。
- 正文取自 `src/content/changelog/` 中一级标题为 `261024` 或 `v261024` 的唯一文件，保留完整 Markdown。
- 缺失、重复日志或版本不一致会终止发布，避免使用其他版本的更新说明。
- 构建任务摘要可预览标题和 changelog 正文。
- 审批后，在正文下方追加 `Release notes`，调用 GitHub 自动生成更新记录。
- 比较起点默认使用按发布时间最近的正式 Release 标签，忽略草稿和预发布；首次发布时由 GitHub 生成首版记录。
- 附件为普通前端构建的 `CRTicket-frontend.zip`，包含 `dist/`，后端需要单独部署。

例如将以上文件提交并推送后，在待发布的提交上执行：

```bash
git tag v261024
git push origin v261024
```

在 Actions 中打开本次 Publish Release 运行，查看构建摘要后，
点击 Review deployments，选择 release，再点击 Approve and deploy。
