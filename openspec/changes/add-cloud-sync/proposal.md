# Change: 添加云同步功能（首期支持坚果云 WebDAV）

## Why

用户在多设备使用 Lingrove 时，需要手动导出/导入数据来同步学习进度和配置。这个过程繁琐且容易遗忘，导致学习数据丢失或不一致。通过集成云同步功能，用户可以手动将数据同步到云端，实现多设备数据共享。

## What Changes

- 新增同步方式选择器（预留扩展，首期仅支持坚果云）
- 新增坚果云 WebDAV 配置界面（服务器地址、用户名、密码）
- 新增手动同步功能（上传到云端/从云端下载）
- 同步文件命名为 `Lingrove-data-{datetime}.json`，支持查看云端备份列表
- 同步内容复用现有导出数据格式（JSON）
- 新增同步状态显示和错误提示

## Impact

- Affected specs: 新增 `cloud-sync` 能力规范
- Affected code:
  - `js/options.js` - 添加云同步配置 UI
  - `js/background.js` - 添加 WebDAV 请求代理
  - `options.html` - 添加云同步设置区域
  - `options.css` - 添加相关样式
  - `js/core/config.js` - 添加云同步默认配置
