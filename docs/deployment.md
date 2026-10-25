# 构建与部署

[返回 README](../README.md)

文中源码路径和命令均以仓库根目录为基准。

## 构建

### 环境要求

- Node.js：最低 `22.12.0`，推荐使用 `26.x`
- npm：建议使用与 Node.js 配套的最新版本

Node.js 26 的兼容检查覆盖依赖安装、全部 Node.js 回归测试、普通构建与 GitHub Pages 构建；后端使用的 `better-sqlite3` 保留在安装与测试范围内。`.github/workflows/node-26.yml` 在 Ubuntu 和 Windows 上执行这些检查，Pages 部署工作流也使用 Node.js 26。

### 安装依赖

```bash
npm install
```

### 开发模式（前端）

```bash
npm run dev
```

默认启动 Vite 开发服务器（通常为 `http://localhost:5173`）。

### 启动后端服务

```bash
node server/app.js
```

后端默认地址：`http://localhost:3000`，接口前缀如下：

- `/api/user`
- `/api/ticket`
- `/api/left-ticket`
- `/api/train-info`
- `/api/llt-trains`
- `/api/station`

### 生产构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

### GitHub Pages 演示版构建（受限功能）

> GitHub Pages 仅托管静态前端。12306 余票接口不允许来自 `sam28403.github.io` 的跨域请求，也不提供可用的预检响应；浏览器会按同源策略拦截请求。Service Worker、前端 JavaScript 或把解析脚本放进仓库都不能绕过这一限制。车次查询与车站大屏还需要后端访问 12306 和路路通，因此演示版冻结余票监控、车次查询与车站大屏入口。

该模式下会做如下限制：

- 允许访问生成车票首页（`#/`）、票价计算（`#/price`）和价格列表（`#/price/list`），票价计算与列表均在前端本地完成，无需后端；
- `#/monitor`、`#/train`、`#/list`、`#/station`、`#/history`、`#/login`、`#/register`、`#/user`、`#/debug` 及其他路径均重定向回首页，带查询参数的地址同样受限；
- 首页“票价计算”入口可用，票价计算页面保留“价格列表”入口，隐藏需要后端的“车次查询”按钮；
- `MainView` 右上角“余票监控”、“车次查询”、“车站大屏”和“历史记录”按钮均禁用；
- 车票预览下方“存储到账户”按钮禁用。

构建方式：

```bash
npm run build:ghpages
```

其本质是使用 Vite 的 `--mode ghpages` 加载根目录下的 `.env.ghpages`，其中包含：

```bash
VITE_DEPLOY_TARGET=github
```

余票监控、车次查询与车站大屏仍可在本地完整服务中使用。若未来另行部署 HTTPS 后端代理，可在构建时将 `VITE_API_BASE_URL` 指向该服务，并在后端 `ALLOWED_ORIGINS` 中加入 Pages 域名；完成部署和安全验证后，再单独放开 `/monitor`、`/train` 和 `/station`。不要使用公开 CORS 代理：查询内容和访问来源会交给第三方，稳定性与限流也无法控制。

仓库现有 GitHub Actions 工作流为 `.github/workflows/deploy-to-pages-repo.yml`。当前工作流不部署 `server/app.js`，GitHub Pages 也不会提供本地 Vite 的 `/api` 代理，所以构建产物会保持余票监控、车次查询与车站大屏入口冻结。

### 本地预览构建产物

```bash
npm run preview
```
