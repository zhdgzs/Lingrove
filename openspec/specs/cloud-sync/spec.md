# cloud-sync Specification

## Purpose
TBD - created by archiving change add-cloud-sync. Update Purpose after archive.
## Requirements
### Requirement: Cloud Sync Provider Selection

系统 SHALL 提供云同步方式选择器，允许用户选择同步服务提供商。

#### Scenario: 用户选择同步方式

- **WHEN** 用户进入设置页面的云同步区域
- **THEN** 系统显示同步方式下拉选择器
- **AND** 首期仅显示"坚果云"选项
- **AND** 选择不同提供商时显示对应的配置表单

### Requirement: WebDAV Cloud Sync Configuration

系统 SHALL 提供坚果云 WebDAV 同步配置界面，允许用户配置云同步参数。

#### Scenario: 用户配置坚果云 WebDAV 连接

- **WHEN** 用户选择"坚果云"作为同步方式
- **THEN** 系统显示以下配置项：
  - WebDAV 服务器地址（默认填充坚果云地址）
  - 用户名输入框
  - 应用密码输入框（密码类型，可切换显示）
  - 测试连接按钮

#### Scenario: 用户测试 WebDAV 连接

- **WHEN** 用户填写完配置并点击"测试连接"按钮
- **THEN** 系统向 WebDAV 服务器发送 PROPFIND 请求验证凭据
- **AND** 显示连接成功或失败的提示信息

### Requirement: Manual Cloud Upload

系统 SHALL 支持手动将本地数据上传到云端。

#### Scenario: 用户上传数据到云端

- **WHEN** 用户点击"上传到云端"按钮
- **THEN** 系统收集当前所有数据（配置、词汇、统计、缓存）
- **AND** 生成文件名 `Lingrove-data-{YYYYMMDD-HHmmss}.json`
- **AND** 将数据上传到 WebDAV 服务器的 `/Lingrove/` 目录
- **AND** 显示上传成功或失败的提示
- **AND** 更新上次同步时间和状态

### Requirement: Cloud Backup List

系统 SHALL 支持查看云端备份文件列表。

#### Scenario: 用户查看云端备份列表

- **WHEN** 用户点击"刷新列表"或配置保存后
- **THEN** 系统从 WebDAV 服务器获取 `/Lingrove/` 目录下的文件列表
- **AND** 显示文件名、大小、修改时间
- **AND** 按修改时间倒序排列（最新在前）

#### Scenario: 云端无备份文件

- **WHEN** 云端 `/Lingrove/` 目录为空或不存在
- **THEN** 系统显示"暂无云端备份"的提示

### Requirement: Manual Cloud Download

系统 SHALL 支持从云端下载指定备份文件。

#### Scenario: 用户从云端下载数据

- **WHEN** 用户在备份列表中选择一个文件并点击"下载"
- **THEN** 系统从 WebDAV 服务器下载该文件
- **AND** 提示用户确认是否覆盖本地数据
- **AND** 用户确认后导入数据并刷新页面
- **AND** 更新上次同步时间和状态

### Requirement: Cloud Backup Deletion

系统 SHALL 支持删除云端备份文件。

#### Scenario: 用户删除云端备份

- **WHEN** 用户在备份列表中选择一个文件并点击"删除"
- **THEN** 系统提示用户确认删除操作
- **AND** 用户确认后从 WebDAV 服务器删除该文件
- **AND** 刷新备份列表

### Requirement: Sync Status Display

系统 SHALL 显示云同步状态信息。

#### Scenario: 显示上次同步信息

- **WHEN** 用户查看云同步设置区域
- **THEN** 系统显示上次同步时间（如有）
- **AND** 显示上次同步类型（上传/下载）
- **AND** 显示上次同步状态（成功/失败）

### Requirement: WebDAV Proxy via Background Script

系统 SHALL 通过 Background Script 代理所有 WebDAV 请求以绑过 CORS 限制。

#### Scenario: Options 页面发起 WebDAV 请求

- **WHEN** Options 页面需要执行 WebDAV 操作
- **THEN** 通过 `chrome.runtime.sendMessage` 发送请求到 Background Script
- **AND** Background Script 使用 `fetch` 执行实际的 HTTP 请求
- **AND** 将结果返回给 Options 页面

### Requirement: Secure Credential Storage

系统 SHALL 安全存储 WebDAV 凭据。

#### Scenario: 存储 WebDAV 密码

- **WHEN** 用户保存 WebDAV 配置
- **THEN** 密码使用 Base64 编码后存储在 `chrome.storage.sync`
- **AND** 界面显示密码时默认隐藏

#### Scenario: 提示使用应用密码

- **WHEN** 用户配置坚果云 WebDAV
- **THEN** 系统提示用户使用坚果云"应用密码"而非账户密码
- **AND** 提供获取应用密码的帮助链接

### Requirement: 自动同步配置

系统 SHALL 提供可选的自动同步功能，定期将数据上传到云端。

#### Scenario: 用户启用自动同步

- **WHEN** 用户在设置页面勾选"启用自动同步"
- **THEN** 系统保存 `autoSyncEnabled: true` 到配置
- **AND** 创建每小时触发的定时器

#### Scenario: 用户禁用自动同步

- **WHEN** 用户取消勾选"启用自动同步"
- **THEN** 系统保存 `autoSyncEnabled: false` 到配置
- **AND** 停止自动同步定时器

### Requirement: 自动同步执行

系统 SHALL 在启用自动同步时，每小时检查并上传数据。

#### Scenario: 定时器触发自动同步

- **WHEN** 自动同步定时器触发
- **AND** `autoSyncEnabled` 为 `true`
- **THEN** 系统生成今天的文件名 `auto_sync_{YYYY-MM-DD}.json`
- **AND** 检查云端是否已存在该文件

#### Scenario: 今天已同步则跳过

- **WHEN** 云端已存在今天的自动同步文件
- **THEN** 系统跳过本次同步
- **AND** 记录日志 "Auto sync already done today, skipping"

#### Scenario: 今天未同步则执行

- **WHEN** 云端不存在今天的自动同步文件
- **THEN** 系统删除所有旧的 `auto_sync_*` 文件
- **AND** 收集所有数据
- **AND** 上传到 WebDAV 服务器的 `/Lingrove/` 目录
- **AND** 使用文件名 `auto_sync_{YYYY-MM-DD}.json`
- **AND** 更新 `lastAutoSyncTime` 为当前时间戳

### Requirement: 文件命名规则

系统 SHALL 区分手动同步和自动同步的文件命名。

#### Scenario: 手动同步文件命名

- **WHEN** 用户点击"上传到云端"按钮
- **THEN** 系统生成文件名 `Lingrove-data-{YYYYMMDD-HHmmss}.json`
- **AND** 文件名包含精确到秒的时间戳

#### Scenario: 自动同步文件命名

- **WHEN** 自动同步触发上传
- **THEN** 系统生成文件名 `auto_sync_{YYYY-MM-DD}.json`
- **AND** 文件名包含当天日期
- **AND** 每天只创建一个文件

### Requirement: 自动清理旧文件

系统 SHALL 在创建新的自动同步文件前，删除所有旧的自动同步文件。

#### Scenario: 清理旧的自动同步文件

- **WHEN** 系统准备创建今天的自动同步文件
- **THEN** 系统列出云端所有文件
- **AND** 筛选出所有以 `auto_sync_` 开头的文件
- **AND** 排除今天的文件名
- **AND** 删除所有匹配的旧文件

#### Scenario: 确保只保留一个文件

- **WHEN** 自动同步完成
- **THEN** 云端仅存在一个 `auto_sync_*` 文件
- **AND** 该文件为今天的日期

### Requirement: 自动同步 UI

系统 SHALL 在设置页面提供自动同步配置界面。

#### Scenario: 显示自动同步选项

- **WHEN** 用户进入云同步设置区域
- **THEN** 系统显示"启用自动同步（每小时）"复选框
- **AND** 显示帮助文本："自动同步文件命名为 auto_sync_YYYY-MM-DD.json，每天同步一次，自动清理旧文件"

#### Scenario: 显示上次同步时间

- **WHEN** 用户查看云同步设置
- **AND** 存在 `lastAutoSyncTime`
- **THEN** 系统显示上次自动同步的时间
- **AND** 格式为 "上次自动同步：YYYY-MM-DD HH:mm:ss"

### Requirement: 权限要求

系统 SHALL 使用 Chrome Alarms API 实现定时功能。

#### Scenario: 添加 alarms 权限

- **WHEN** 扩展安装或更新
- **THEN** 系统请求 `alarms` 权限
- **AND** 权限为标准权限，不需要用户额外授权

#### Scenario: 定时器持久化

- **WHEN** 浏览器重启
- **THEN** Chrome Alarms 自动恢复定时器
- **AND** 自动同步功能继续正常工作

### Requirement: 错误处理

系统 SHALL 妥善处理自动同步过程中的错误。

#### Scenario: 网络错误

- **WHEN** 自动同步时网络不可用
- **THEN** 系统记录错误日志
- **AND** 不显示用户提示（静默失败）
- **AND** 下次定时器触发时重试

#### Scenario: 认证失败

- **WHEN** 自动同步时 WebDAV 认证失败
- **THEN** 系统记录错误日志
- **AND** 不显示用户提示
- **AND** 下次定时器触发时重试

#### Scenario: 配额不足

- **WHEN** 自动同步时云端存储空间不足
- **THEN** 系统记录错误日志
- **AND** 不显示用户提示
- **AND** 下次定时器触发时重试

