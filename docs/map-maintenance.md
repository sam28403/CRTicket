# 地图数据与坐标维护

[返回 README](../README.md)

文中源码路径和命令均以仓库根目录为基准。

## 地图数据与坐标维护

地图相关文件按用途集中管理：前端工具在 `src/utils/maps/`，维护脚本在 `scripts/maps/`，数据与核查证据在 `data/maps/`，浏览器使用的边界资源在 `public/maps/`。根目录的旧版查询和匹配文件已原样移入 `data/maps/legacy/`，当前流程不读取这些归档数据。

### 数据范围与来源

坐标来自 OpenStreetMap 原始节点或完整几何，采用 WGS84 `[经度, 纬度]`。依据 OpenRailwayMap 的类型和状态规则，现役候选接受 **Type: train 或 suburban、State: present**；明确仅为地铁或有轨电车的对象及生命周期冲突对象不纳入。`present` 表示源标签状态，不单独证明某日期提供客运服务。数据遵循 [OpenStreetMap 的 ODbL 许可](https://www.openstreetmap.org/copyright)。

2026-10-09 快照覆盖 CN、HK、LA，按 OSM 对象 ID 去重后保留 11,846 个符合条件的设施，查找表支持 28,403 个名称及别名；名称数量不是实际车站数，CN 已覆盖 HK，地域计数不可直接相加。另保留 75 个经核实的原有旧站名称，仅供 `/user` 历史轨迹使用。官方站名索引中仍有 47 项无法可靠定位，详见[核查报告](../data/maps/station-coordinate-audit/report.md)和[未解决站名清单](../data/maps/station-coordinate-audit/unresolved-official-stations.json)。

同名站通过电报码、地域、线路证据或明确指定的 OSM 节点核对身份，不以旧坐标作为唯一选点依据，也不估算补齐未知坐标。新桥按指定的上海金山铁路节点定位；云山、西湖东以 `suburban` 类型纳入。完整源目录仍保留其它同名设施和无名称设施。

共用底图加载时仅展示海南省最大多边形（本岛），过滤广东省数据中的东沙多边形，并隐藏 ECharts 自动添加的南海诸岛插图。原始 `public/maps/` 边界文件保留，显示过滤集中在 `src/utils/maps/stationCoordinates.js` 中。

### 文件分工

| 目录或文件                                                                     | 用途                                                                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `data/maps/station-coordinate-audit/raw/`                                      | 三个地域的压缩原始响应、确切 Overpass 查询、源时间及完整性校验记录。 |
| `catalog.json.gz`、`excluded.json.gz`                                          | 完整候选设施和排除对象；位于上述核查目录。                           |
| `previous-coordinates.json.gz`、`previous-coordinate-audit.json`               | 更新前的坐标基线与逐项审核记录。                                     |
| `coordinate-provenance.json`、`historical-provenance.json`                     | 每个现役／历史名称对应的源对象和匹配依据。                           |
| `reviewed-name-resolutions.json`、`blocked-name-resolutions.json`、`identity/` | 已审阅同名站决策、身份冲突及节点／线路核查证据。                     |
| `summary.json`、`report.md`                                                    | 最新生成的统计与可读报告。                                           |

### 更新与验证

在仓库根目录使用 PowerShell 执行以下命令。下载需要网络，简繁变体脚本使用 Windows 内置转换；应用运行时直接加载生成的坐标表，不请求 Overpass。

```powershell
./scripts/maps/fetch-railway-stations.ps1
./scripts/maps/simplify-railway-names.ps1
node scripts/maps/rebuild-station-coordinates.js --write
node --test scripts/maps/lib/railway-station-audit.test.js src/utils/maps/stationCoordinates.test.js src/utils/maps/trainRouteMap.test.js
npm run build
```

不加 `--write` 时，重建脚本只更新核查输出，不改前端坐标表。公共 Overpass 服务可能限流；单个地域失败可稍后用 `-Regions CN`、`-Regions HK` 或 `-Regions LA` 单独重试。原始响应必须通过完成计数和 SHA-256 检查；更新后应审阅同名决策、未解决清单和报告，保持历史坐标基线，避免将归档的旧版匹配结果覆盖到现役表。
