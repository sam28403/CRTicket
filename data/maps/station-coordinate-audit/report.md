# 铁路站点坐标核查结果

已按 OpenRailwayMap 的 train 或 suburban / present 分类规则完成 CN、HK、LA 三个地域的原始对象拉取，并逐项审核原有 6939 个坐标名称。根据用户补充要求，现役城际、市郊铁路的 suburban 类型也纳入应用。

## 数据范围与完成性

| 地域 | 原始对象数（含其它类型与历史状态，用于核查） | train 或 suburban/present 对象数 | OSM 源时间（UTC） |
| --- | ---: | ---: | --- |
| CN | 23612 | 11823 | 2026-10-09T14:11:06Z |
| HK | 379 | 13 | 2026-10-09T14:13:06Z |
| LA | 32 | 23 | 2026-10-09T14:15:09Z |

按 OSM 对象 ID 去重后共有 11846 个符合条件的设施。CN 范围已经覆盖 HK，因此不可把三个地域的数量直接相加。所有 215 个无名称设施也保留在完整目录中。
按优先类型统计：train 11844 个、suburban 2 个；多类型中含 train 的设施计入 train。源标签 types 完整保留。

地图查找表支持 28429 个名称及别名；其中 9 个名称使用明确的用户补充坐标，其余来自符合现役筛选的 OSM 对象。该数量不是实际车站数。官方站名索引共 3404 项，已匹配 3360 项，尚未确认 44 项。

三个原始响应均检查了末尾完成计数、JSON 完整性、无运行错误 remark、SHA-256。坐标均为 WGS84，经度在前、纬度在后。

## 原有坐标逐项核查

| 当前审核状态 | 名称数 |
| --- | ---: |
| verified-within-50m | 6514 |
| corrected-over-1km | 60 |
| updated-50m-to-1km | 84 |
| verified-historical-only | 35 |
| ambiguous | 89 |
| unverified | 157 |

按用户确认，另保留 75 个已核实旧站名称，其中 35 个补充现役查找表没有的历史名称，仅用于 /user。旧站只能来自实际 OSM 几何及现有旧名称，不生成估算坐标。

## 较大的现役坐标修正（前 20 项）

| 站名 | 原坐标 [经度,纬度] | 新坐标 [经度,纬度] | 两位置距离 km | OSM 源对象 |
| --- | --- | --- | ---: | --- |
| 新和 | [113.4615955,23.4157329] | [82.6174477,41.5739118] | 3496.961 | [node/7365718251](https://www.openstreetmap.org/node/7365718251) |
| 金山 | [119.2574677,26.0505965] | [85.3586032,38.1934159] | 3441.583 | [node/8204071014](https://www.openstreetmap.org/node/8204071014) |
| 友好 | [87.5856957,43.8232355] | [128.834449,47.856315] | 3188.003 | [node/9129186230](https://www.openstreetmap.org/node/9129186230) |
| 南山 | [113.9187026,22.527154] | [130.2818498,47.3040584] | 3118.505 | [node/14156675337](https://www.openstreetmap.org/node/14156675337) |
| 庆安 | [104.0316132,30.6008356] | [127.496433,46.8859539] | 2704.708 | [node/9137876529](https://www.openstreetmap.org/node/9137876529) |
| 世博园 | [102.7529183,25.072067] | [123.6344761,41.8603669] | 2676.113 | [node/9763069258](https://www.openstreetmap.org/node/9763069258) |
| 龙井 | [113.9697761,22.5671739] | [129.4242212,42.7770103] | 2662.711 | [node/9171411668](https://www.openstreetmap.org/node/9171411668) |
| 建安 | [113.9689004,22.3951744] | [125.0767869,43.0944532] | 2519.796 | [node/9174163157](https://www.openstreetmap.org/node/9174163157) |
| 铁厂 | [107.2138708,27.4377916] | [126.1974225,41.7147998] | 2343.927 | [node/1550539301](https://www.openstreetmap.org/node/1550539301) |
| 迎宾路 | [123.3036492,41.7992557] | [103.6399233,30.9835351] | 2123.513 | [node/4531094400](https://www.openstreetmap.org/node/4531094400) |
| 万荣 | [110.6233227,35.4088847] | [102.4563909,18.9538961] | 1998.036 | [node/9811136979](https://www.openstreetmap.org/node/9811136979) |
| 安定 | [113.9751,22.3876044] | [116.4816523,39.617375] | 1930.469 | [node/8455171488](https://www.openstreetmap.org/node/8455171488) |
| 向阳 | [113.3151121,34.1277062] | [130.0808024,45.1877526] | 1883.279 | [node/9497085064](https://www.openstreetmap.org/node/9497085064) |
| 永安镇 | [111.9873697,38.4901312] | [108.0487631,24.2896625] | 1622.204 | [node/10925994944](https://www.openstreetmap.org/node/10925994944) |
| 康城 | [114.2687519,22.2955588] | [114.286066,36.6567688] | 1596.897 | [node/2329019140](https://www.openstreetmap.org/node/2329019140) |
| 康庄 | [106.4750953,29.6375118] | [115.892027,40.3785643] | 1468.394 | [node/7805038907](https://www.openstreetmap.org/node/7805038907) |
| 东光 | [104.095889,30.6220368] | [116.5253183,37.8918185] | 1397.336 | [node/8410481231](https://www.openstreetmap.org/node/8410481231) |
| 明光 | [103.8662776,30.6612522] | [117.9830213,32.7716118] | 1354.672 | [node/8454361472](https://www.openstreetmap.org/node/8454361472) |
| 存车场 | [127.1261956,46.4496061] | [118.2570371,36.7862008] | 1301.289 | [node/12611343965](https://www.openstreetmap.org/node/12611343965) |
| 东升 | [103.9233341,30.5740226] | [113.2793078,22.6073119] | 1283.499 | [node/7710011720](https://www.openstreetmap.org/node/7710011720) |

该距离是旧值与当前源坐标的距离，不是 OSM 自身的测量精度。逐条记录含旧值、新值、源对象、匹配依据及旧坐标匹配到的地铁/其它状态证据。

## 匹配规则与限制

- 按 ORM 导入代码解释 station、多交通模式标签及默认 train 类型，不要求每个车站必须写 train=yes；接受 train 和 suburban，仍排除明确只有 subway、tram 等类型的设施。
- 新桥使用用户明确提供的 node/7742242697（上海金山铁路）；其余异地同名新桥保留在完整目录中。云山 node/3677430195、西湖东 node/3693383858 按 suburban/present 纳入；identity/supplement-stations.json 保存三个节点的当前 OSM API 核查响应，标签、坐标均与全量快照一致。
- 常村、古城子、遥林、铁厂、桥头、青沟子、三家子使用用户指定的 OSM 节点消歧；林子头对应遥林（林头子为用户确认的笔误，已更正），该别名标记为 user-confirmed-alias，不改写 OSM 原始标签。天桥按用户更正使用凤城市 node/7527334064，不再作为古城子 node/8840528310 的别名；两站在 4317/4320、4318/4319 中分别停靠。确认依据保存在 reviewed-name-resolutions.json。
- 龙池使用用户指定的 node/1681825098 消歧；大柴旦东 node/7276945325 的饮马峡旧名按用户确认加入匹配，其余未经确认的 old_name 仍不自动加入。蒋村使用用户提供的 38.532911N/113.027942E，保存于 user-provided-coordinates.json；附近 node/1668749941 的生命周期标签矛盾，不将其标记为已核实现役 OSM 对象。
- 惠农南使用用户核查后指定的 node/10908472608，沙湾使用 node/1588514487，共和使用 node/1588514366；同名冲突的其他源对象继续保留。前山使用用户提供的 GeoHack 经纬度；房山东使用用户指定 node/13706600750 的坐标，该节点现役/建设中标签矛盾，按用户确认单独补入，原始分类不变。来源分别保存于 reviewed-name-resolutions.json 和 user-provided-coordinates.json。
- 当前候选必须只有 present 状态；同时具有多个生命周期标签的矛盾对象留在排除清单中。present 表示地图标签状态，不能单独证明某日期有客运列车。
- 名称支持简繁、多语言、站名后缀；不将站场编号截成车站名，不把 old_name 自动混入现役名称。
- 同名异地站核对官方电报码、地域或已审阅的线路证据；不会用原来的错误坐标作为唯一选点依据。
- 原始节点优先；面、线对象使用完整几何的 Web Mercator 中心。应用坐标不保证与 ORM 把出入口、站台聚合后的图标像素中心完全相同。
- /user 优先使用现役坐标，再使用已核实旧站；同名新旧站不会自动按票据日期切换地址。
- 尚未确认名称见 unresolved-official-stations.json，尚未解决的同名冲突见 ambiguous-names.json，包括原始源有重复节点的狼尾山，以及地域身份冲突的建设。已由用户确认选点的惠农南等名称的所有候选仍保留在完整目录和 coordinate-provenance.json。
- identity/yuzhou.json 的 ORM 搜索响应在这次查询中把 latitude/longitude 字段的数值顺序反置；本流程只用原始 OSM lon/lat，不从该响应取坐标。

## 证据文件

- raw/*.json.gz：三个地域的完整原始响应；*.overpassql：确切查询；*.receipt.json：源时间、计数和校验值。
- catalog.json.gz：全部符合条件的设施、源 ID、原始标签、坐标和别名；excluded.json.gz：被排除对象及原因。
- previous-coordinates.json.gz：原有坐标备份；previous-coordinate-audit.json：全部原有坐标的逐项核查。
- coordinate-provenance.json：每个地图查找名称的源对象或用户补充依据及匹配理由；historical-provenance.json：旧站来源。
- user-provided-coordinates.json：用户明确提供的精确坐标及别名，单独标记来源；该补充不修改 OSM 原始快照或现役分类。
- reviewed-name-resolutions.json：郏县、禹州的线路核查、用户指定的站点节点及别名；blocked-name-resolutions.json：仍有身份冲突的名称。
- upstream/station-identifiers.json：仅用于核对站点身份的 Wikidata 标识，不从 Wikidata 取应用坐标。

## 复现与更新

```powershell
./scripts/maps/fetch-railway-stations.ps1
./scripts/maps/simplify-railway-names.ps1
node scripts/maps/rebuild-station-coordinates.js --write
node --test scripts/maps/lib/railway-station-audit.test.js src/utils/maps/stationCoordinates.test.js src/utils/maps/trainRouteMap.test.js
npm run build
```

公共 Overpass 服务可能限流。若一个地域失败，保留已完成响应，等待服务允许查询后用 -Regions CN、HK 或 LA 单独重试；不把错误或截断响应当作全量完成。Wikidata 标识与手工核查是本次快照的证据，后续同名站变化需重新审阅。

筛选定义：[ORM 导入代码](https://github.com/hiddewie/OpenRailwayMap-vector/blob/106d97af12e5b34af8396ca898682345925dec2c/import/openrailwaymap.lua)。源数据：[OpenStreetMap](https://www.openstreetmap.org/copyright)，© OpenStreetMap contributors，ODbL 1.0。
