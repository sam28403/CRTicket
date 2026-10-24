# 历史记录备份互通

[返回 README](../README.md)

网页版与 CRTicket Android 可以通过 JSON 文件互相迁移车票历史记录。
网页版入口位于用户页面的“导入备份”和“导出备份”。

## 数据范围

- 网页版只导入、导出车票历史记录，包括车票字段与有效的创建时间。
- Android 导出时需勾选“车票历史记录”；可以使用仅历史备份或包含历史的完整备份。
- 网页版忽略文件中的个人资料、头像、主题、搜索记录、设置、到访记录、轨迹、草稿和监控配置。
- 导入的数据归属于当前网页账户或 Android 本机用户，不使用文件中的用户 ID 和记录 ID。
- 零票价、积分标记、空调标记、多行提示语及里程会保留。
- 相同车票按车票字段去重，创建时间和记录 ID 不参与重复判断。

## 格式与限制

网页导出使用 Android 支持的 `schemaVersion: 2`、`app: "CRTicket"`，
以 `contents: ["tickets"]` 明确表示仅历史记录。
`settings: {}` 是 Android 解析器需要的空兼容字段，不包含任何设置。
不导出用户名、头像或账户标识。

网页也兼容旧版纯车票数组和 `schemaVersion: 1` 的备份。
单文件最大 20 MB、最多 10000 条，导入请求每批 100 条。
无效或缺少必要车票字段的记录计为“未处理”，不补造缺失数据。
创建时间缺失或无效时由目标端生成，已有重复记录保持原样。
历史备份不使用当前开行规则校验车次，避免旧记录无法迁移。

## 验证

在网页仓库根目录运行：

```powershell
npm test
node scripts/verify-backup-compatibility.js C:/Users/SAM-LAB/AndroidStudioProjects/CRTicket
npm run build
```

兼容性脚本读取指定 Android 项目的实际 WebView 备份导出、解析、恢复模块，
通过网页实际 Express API 完成往返，并比对全部车票字段和创建时间。
验证使用独立内存 SQLite 数据库与模拟本机存储，不修改两个项目的真实历史记录，
也不会修改 Android 项目源码。
这覆盖应用共用的备份代码与网页 HTTP 接口，不等同于 Android 实机文件选择器检查。
