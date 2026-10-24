# 开发与项目结构

[返回 README](../README.md)

文中源码路径和命令均以仓库根目录为基准。

## 项目文件结构

下面按仓库中的项目文件说明用途。`node_modules/` 是 npm 安装目录，`dist/` 是 Vite 构建目录，均为生成内容，不属于源码结构；`server/db/train.db` 是运行时 SQLite 数据库并由 Git 忽略。

<details>
<summary><strong>根目录</strong></summary>

| 文件                                         | 用途                                                             |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `index.html`                                 | Vite 应用入口 HTML，提供 Vue 挂载节点。                          |
| `package.json`                               | 项目元数据、Node.js 版本要求、依赖和 npm 命令。                  |
| `package-lock.json`                          | 锁定 npm 依赖的具体版本，供安装时复现依赖树。                    |
| `vite.config.js`                             | Vue 插件、`@` 源码别名，以及开发／预览时转发 `/api` 到本地后端。 |
| `jsconfig.json`                              | JavaScript 编辑器和 `@` 路径别名的项目配置。                     |
| `.env.ghpages`                               | GitHub Pages 静态构建环境标记。                                  |
| `.gitattributes`                             | Git 对文本和换行符等文件属性的设置。                             |
| `.gitignore`                                 | 排除依赖、构建结果、数据库和本地环境文件等。                     |
| `LICENSE`                                    | 项目许可证。                                                     |
| `SECURITY.md`                                | 安全问题报告指引。                                               |
| `README.md`                                  | 项目简介、快速启动和详细文档入口。                   |
| `scripts/run-full.js`                        | 同时启动 Vite 前端与 Express 后端的开发／预览进程管理脚本。      |
| `.github/workflows/deploy-to-pages-repo.yml` | GitHub Actions 的 Pages 部署工作流。                             |
| `.github/workflows/node-26.yml`              | Ubuntu／Windows 的 Node.js 26 安装、测试与构建兼容检查。         |
| `.vscode/extensions.json`                    | 推荐的 VS Code 扩展列表。                                        |

</details>

<details>
<summary><strong>前端：<code>src/</code></strong></summary>

| 文件或目录                                                           | 用途                                                                             |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/main.js`                                                        | 初始化主题、样式、Vue、Element Plus、Pinia 和路由，并挂载应用。                  |
| `src/App.vue`                                                        | 应用外层组件，渲染当前路由页面。                                                 |
| `src/api.js`                                                         | 前端 API 请求封装。                                                              |
| `src/router/index.js`                                                | 页面路由、部署模式下的访问限制和页面映射。                                       |
| `src/station_name.js`                                                | 车站名称和电报码等车站主数据。                                                   |
| `src/stores/user.js`                                                 | Pinia 用户状态。                                                                 |
| `src/config/deploy.js`                                               | 读取部署目标和 API 地址等部署配置。                                              |
| `src/views/MainView.vue`                                             | 车票生成首页和表单。                                                             |
| `src/views/Monitor.vue`                                              | 余票查询、筛选、定时监控和提醒页面。                                             |
| `src/views/TrainQuery.vue`                                           | 车次经停、时间和里程查询页面，结果下方展示途经站点线路图。                       |
| `src/views/TrainList.vue`                                            | 路路通离线车次列表，支持按日期筛选、排序和跳转经停详情。                         |
| `src/views/Station.Vue`                                              | 当天车站大屏，提供全部信息、出发与到达标签，以及当前时间定位。                   |
| `src/views/HistoryView.vue`                                          | 已保存车票历史及记录操作页面。                                                   |
| `src/views/Login.vue`                                                | 登录页面。                                                                       |
| `src/views/Register.vue`                                             | 注册页面。                                                                       |
| `src/views/User.vue`                                                 | 用户资料、车票统计和运转地图页面。                                               |
| `src/views/Debug.vue`                                                | 调试和诊断页面。                                                                 |
| `src/components/LeftTicketCard.vue`                                  | 余票查询结果卡片。                                                               |
| `src/components/AppBrand.vue`                                        | 登录、注册、历史记录和用户页面共用的品牌标题。                                   |
| `src/components/ThemeSelect.vue`                                     | 外观主题选择控件。                                                               |
| `src/components/TrainRouteMap.vue`                                   | 车次途经站点地图，支持线路居中、全画布拖动缩放和到发时间提示。                   |
| `src/components/StationBoardTable.vue`                               | 车站大屏虚拟表格、桌面与手机布局切换及当前车次定位。                             |
| `src/components/StationBoardMobileRow.vue`                           | 手机端车次信息卡片，字段分列排列，长内容自动换行。                               |
| `src/components/StationLink.vue`                                     | 站名链接，跳转并查询目标车站的当天大屏。                                         |
| `src/composables/useTheme.js`                                        | 主题状态、系统配色同步和持久化逻辑。                                             |
| `src/composables/useTicketShared.js`                                 | 车票和余票页面共用的车站搜索及表单逻辑。                                         |
| `src/composables/useStationBoard.js`                                 | 车站查询、路由站名参数同步、系统时间与跨日刷新。                                 |
| `src/utils/captcha.js`                                               | 验证码相关工具。                                                                 |
| `src/utils/seatAvailability.js`                                      | 余票席别数量及状态解析工具。                                                     |
| `src/utils/stations.js`                                              | 车站名称搜索和匹配工具。                                                         |
| `src/utils/stationName.js`                                           | 站名空白归一化，以及前后端共用的自由输入校验。                                   |
| `src/utils/maps/stationCoordinates.js`                               | 现役车站及别名的 WGS84 坐标、已核实旧站坐标，以及共用底图加载和显示过滤。        |
| `src/utils/maps/railwayMap.js`                                       | `/user`、`/train` 共用的底图样式及全画布拖动缩放设置。                           |
| `src/utils/maps/trainRouteMap.js`                                    | 按查询站序生成站点和连线，计算默认线路居中视图。                                 |
| `src/utils/maps/stationCoordinates.test.js`、`trainRouteMap.test.js` | 坐标来源、缺失站点、线路适配及地图交互回归测试。                                 |
| `src/utils/ticketShared.js`                                          | 前端车票数据共用处理逻辑。                                                       |
| `src/utils/ticketFields.js`                                          | 前后端共用的车票字段顺序、原始字段取值和备份比较值。                             |
| `src/utils/ticketExport.js`                                          | 车票离屏渲染、PNG 数据生成和下载，供首页预览及 PNG／PDF 导出、历史车票下载复用。 |
| `src/utils/trainTime.js`                                             | 车次经停时间和跨日展示工具。                                                     |
| `src/utils/trainQueryDate.js`                                        | 车次查询日期范围及格式处理。                                                     |
| `src/utils/trainDisplay.js`                                          | 去除离线方案后缀，统一车次页面及导出文档的显示名称。                             |
| `src/utils/stationBoard.js`                                          | 大屏标签字段、到发时刻排序、北京时间及当前车次索引。                             |
| `src/utils/stationNavigation.js`                                     | 车站与车次跳转，保留列车始发日期及完整离线记录号。                               |
| `src/utils/stationBoard.test.js`、`stationNavigation.test.js`        | 大屏日期、排序、可选字段、时间定位及跨日／双车次跳转测试。                       |
| `src/utils/trainInfoPdf.js`                                          | 车次经停信息 PDF 排版与导出。                                                    |
| `src/utils/trainInfoPdf.test.js`                                     | 车次 PDF 导出工具的测试。                                                        |
| `src/assets/styles/App.css`                                          | 应用通用样式。                                                                   |
| `src/assets/styles/theme.css`                                        | 主题色及亮／暗色样式变量。                                                       |
| `src/assets/styles/fonts.css`                                        | 前端字体定义。                                                                   |
| `src/assets/styles/station.css`                                      | 车站大屏标题栏、查询控件及响应式页面布局。                                       |
| `src/assets/styles/History.css`                                      | 历史车票页面样式。                                                               |
| `src/assets/styles/Login.css`                                        | 登录和注册页面样式。                                                             |

</details>

<details>
<summary><strong>后端：<code>server/</code></strong></summary>

| 文件或目录                                              | 用途                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `server/app.js`                                         | Express 服务入口，安装安全中间件并挂载各 API 路由；直接运行时监听 `127.0.0.1:3000`。 |
| `server/auth.js`                                        | 登录身份验证和密码处理辅助逻辑。                                                     |
| `server/security.js`                                    | 请求来源、跨域和安全响应头等服务端安全配置。                                         |
| `server/security.test.js`                               | 服务端安全配置测试。                                                                 |
| `server/db/db.js`                                       | SQLite 数据库连接、初始化和共享数据库设置。                                          |
| `server/db/ticketQueries.js`                            | 添加车票与导入备份共用的车票插入 SQL。                                               |
| `server/db/train.db`                                    | 本地运行生成的 SQLite 数据库文件，包含用户和车票记录；被 `.gitignore` 忽略。         |
| `server/routes/user.js`                                 | 注册、登录、用户资料和账户相关 API。                                                 |
| `server/routes/ticket.js`                               | 车票记录的增删改查 API。                                                             |
| `server/routes/ticketValidation.js`                     | 车票输入数据校验规则。                                                               |
| `server/routes/leftTicket.js`                           | 12306 余票查询 API 及官网查询流程。                                                  |
| `server/routes/leftTicketSeats.js`                      | 余票席别字段解析和归一化。                                                           |
| `server/routes/leftTicket.test.js`                      | 余票查询路由测试。                                                                   |
| `server/routes/lltskb.js`                               | 路路通车次数据库获取、缓存和经停／里程查询。                                         |
| `server/routes/lltskb.test.js`                          | 路路通数据处理测试。                                                                 |
| `server/routes/lltTrains.js`                            | 离线车次列表和详情 API，按生效日期及循环开行规则筛选。                               |
| `server/routes/lltTrains.test.js`                       | 离线日期筛选、车次排序和详情接口测试。                                               |
| `server/routes/trainInfo.js`                            | 车次信息 API，组合 12306 与路路通查询结果。                                          |
| `server/routes/trainClock.js`                           | 车次信息与离线车次列表共用的时刻转分钟工具。                                         |
| `server/routes/trainInfo.test.js`                       | 车次信息路由测试。                                                                   |
| `server/routes/station.js`                              | 当天车站查询 API、输入校验、数据源降级、缓存与并发请求合并。                         |
| `server/routes/station12306.js`                         | 12306 车站查询及本站到发时刻、可选动态字段归一化。                                   |
| `server/routes/stationLlt.js`                           | 路路通车站索引，按本站到发日反推始发日并筛选开行记录。                               |
| `server/routes/station.test.js`、`stationNames.test.js` | 车站接口、数据源优先级、跨午夜停车、列表外站名及缓存隔离测试。                       |

</details>

<details>
<summary><strong>静态资源：<code>public/</code></strong></summary>

| 文件或目录                                                                                                                                                                                  | 用途                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `public/Blank.jpg`、`Blue_Sister.jpg`、`CIT_Yellow.jpg`、`CR400BF.jpg`、`DF11.jpg`、`DF11G.jpg`、`EMU_Green.jpg`、`FXN5C.jpg`、`Harmony_White.jpg`、`Red.jpg`、`Sanya_1.jpg`、`Sanya_2.jpg` | 车票背景／装饰图片资源。                                                        |
| `public/Picture1.png`                                                                                                                                                                       | 项目页面使用的 PNG 图片资源。                                                   |
| `public/GitHub.gif`                                                                                                                                                                         | GitHub 动画图片资源。                                                           |
| `public/consola.ttf`、`FZCDXK.TTF`、`OCRB.ttf`、`Roboto.ttf`、`google_sans_rounded_regular.ttf`、`simsun.ttf`、`times.ttf`                                                                  | 页面、车票或 PDF 使用的字体文件。                                               |
| `public/maps/china.json`、`laos.json`、`countries.geojson`                                                                                                                                  | 地理边界资源；`china.json` 与 `laos.json` 用于 `/user` 和 `/train` 的共用底图。 |

</details>

<details>
<summary><strong>仓库图片与数据文件</strong></summary>

| 文件或目录                                                                                                            | 用途                                                                     |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `Screenshot/`                                                                                                         | README 使用的网页版截图。                           |
| `Ticket.png` | README 中展示的车票生成样例。 |
| `data/maps/legacy/overpass_station_statuses.json`、`overpass_train_all_statuses.json`、`overpass_train_trainyes.json` | 从根目录归档的旧版 Overpass 查询数据，原样保存，不用于当前地图定位。     |
| `data/maps/legacy/station_exact_results.json`、`station_exact_progress.json`、`station_exact_missing_progress.json`   | 从根目录归档的旧版精确匹配结果和处理进度，不作为现役坐标来源。           |
| `data/maps/station-coordinate-audit/`                                                                                 | 当前原始快照、完整设施目录、逐项核查、来源记录、同名站决策和核查报告。   |
| `scripts/maps/fetch-railway-stations.ps1`                                                                             | 从 Overpass 获取 CN、HK、LA 的站点设施快照，检查完成计数并记录 SHA-256。 |
| `scripts/maps/simplify-railway-names.ps1`                                                                             | 用 Windows 内置简繁转换生成站名变体。                                    |
| `scripts/maps/rebuild-station-coordinates.js`                                                                         | 筛选、匹配和核查源数据，生成报告；加 `--write` 时更新前端坐标查找表。    |
| `scripts/maps/lib/railway-station-audit.js`、`railway-station-audit.test.js`                                          | 设施类型和状态分类、几何坐标、别名及同名地点聚类工具与测试。             |

</details>

> 站名、坐标、地图和这些 JSON 文件属于数据资源；修改前应确认数据来源和用途，避免无关的批量重写。

### 代码维护约定

- 重复的数据处理和导出逻辑优先放入现有工具文件复用；车票字段顺序统一在
  `src/utils/ticketFields.js` 中维护，数据库写入与备份比较使用相同顺序。
- 二维码的尺寸、边距和颜色统一由 `src/utils/ticketShared.js` 提供，页面保留各自的生成与错误处理流程。
- 前端备份比较仍用 `||` 拼接，后端仍用 JSON 数组序列化；各处默认值、空值处理和备份格式保持原有规则。
- 过长的组件属性、参数列表、对象和条件表达式分行书写，保留中文文案、模板文本空白和样式值。
- 整理代码不改变功能、界面、API 路径或数据库结构；不要批量重写站点、坐标、JSON 和地图数据。

整理后可运行以下命令检查现有回归测试和两种前端构建。后端安全测试使用独立内存数据库：

```bash
npm test
npm run build
npm run build:ghpages
```
