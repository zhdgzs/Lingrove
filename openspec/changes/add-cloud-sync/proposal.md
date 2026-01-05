# Change: 添加数据同步功能（离线文件 + 坚果云 WebDAV）

## Why

用户在多设备使用 Lingrove 时，需要手动导出/导入数据来同步学习进度和配置。这个过程繁琐且容易遗忘，导致学习数据丢失或不一致。通过整合数据同步功能，用户可以选择离线文件同步或云端同步，实现多设备数据共享。

## What Changes

- 整合"数据导入导出"和"云同步"为统一的"数据同步"区域
- 新增同步方式选择器（离线文件同步、坚果云），默认选中离线文件同步
- 离线文件同步：保留原有导入导出功能
- 坚果云同步：WebDAV 配置界面、手动上传/下载、备份列表管理
- 同步文件命名为 `Lingrove-data-{datetime}.json`
- 同步内容复用现有导出数据格式（JSON）

## Impact

- Affected specs: 新增 `cloud-sync` 能力规范
- Affected code:
  - `js/options.js` - 添加云同步配置 UI 和切换逻辑
  - `js/background.js` - 添加 WebDAV 请求代理
  - `options.html` - 整合数据同步设置区域
  - `options.css` - 添加相关样式
  - `js/core/config.js` - 添加云同步默认配置
