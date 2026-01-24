# site-filtering Specification

## Purpose
TBD - created by archiving change add-toggle-autosync-ipfilter. Update Purpose after archive.
## Requirements
### Requirement: 站点模式选择

系统 SHALL 支持两种站点过滤模式：全局模式和白名单模式。

#### Scenario: 全局模式

- **WHEN** 用户选择"所有网站"模式（`siteMode: 'all'`）
- **THEN** 系统在所有网站启用翻译
- **AND** 仅排除 `excludedSites` ��的网站

#### Scenario: 白名单模式

- **WHEN** 用户选择"指定网站"模式（`siteMode: 'whitelist'`）
- **THEN** 系统仅在 `allowedSites` 中的网站启用翻译
- **AND** 忽略 `excludedSites` 配置

### Requirement: 排除站点列表

系统 SHALL 支持用户配置排除站点列表。

#### Scenario: 添加排除站点

- **WHEN** 用户在"排除站点"输入框中输入域名（每行一个）
- **THEN** 系统保存到 `excludedSites` 数组
- **AND** 匹配时使用 `hostname.includes(domain)` 逻辑

#### Scenario: 排除站点生效

- **WHEN** 用户访问排除列表中的网站
- **AND** 当前为全局模式
- **THEN** 系统不触发翻译
- **AND** 返回 `{ processed: 0, excluded: true }`

### Requirement: IP 地址过滤

系统 SHALL 支持一键跳过所有 IP 地址类型的网站。

#### Scenario: 启用 IP 地址过滤

- **WHEN** 用户勾选"跳过所有 IP 地址"选项
- **THEN** 系统保存 `skipIPAddresses: true` 到配置

#### Scenario: 检测 IPv4 地址

- **WHEN** 用户访问 IPv4 地址（如 `192.168.1.1`、`127.0.0.1:8080`）
- **AND** `skipIPAddresses` 为 `true`
- **THEN** 系统识别为 IP 地址
- **AND** 不触发翻译

#### Scenario: 检测 IPv6 地址

- **WHEN** 用户访问 IPv6 地址（如 `[::1]`、`[2001:db8::1]:3000`）
- **AND** `skipIPAddresses` 为 `true`
- **THEN** 系统识别为 IP 地址
- **AND** 不触发翻译

#### Scenario: 检测 localhost

- **WHEN** 用户访问 `localhost` 或 `localhost:3000`
- **AND** `skipIPAddresses` 为 `true`
- **THEN** 系统识别为 IP 地址
- **AND** 不触发翻译

#### Scenario: 禁用 IP 地址���滤

- **WHEN** 用户取消勾选"跳过所有 IP 地址"
- **THEN** 系统保存 `skipIPAddresses: false`
- **AND** IP 地址网站按正常规则处理

### Requirement: IP 地址检测逻辑

系统 SHALL 准确识别各种格式的 IP 地址。

#### Scenario: IPv4 格式识别

- **WHEN** 系统检测 hostname
- **THEN** 识别以下格式为 IPv4：
  - `192.168.1.1`
  - `10.0.0.1:8080`
  - `127.0.0.1`

#### Scenario: IPv6 格式识别

- **WHEN** 系统检测 hostname
- **THEN** 识别以下格式为 IPv6：
  - `[::1]`
  - `[2001:db8::1]`
  - `[fe80::1]:3000`

#### Scenario: localhost 识别

- **WHEN** 系统检测 hostname
- **THEN** 识别以下格式为 localhost：
  - `localhost`
  - `localhost:3000`
  - `localhost:8080`

### Requirement: 过滤优先级

系统 SHALL 按以下优先级应用过滤规则。

#### Scenario: 过滤规则优先级

- **WHEN** 系统检查是否应翻译页面
- **THEN** 按以下顺序检查：
  1. 检查 `enabled` 配置（总开关）
  2. 检查 `skipIPAddresses` 和 IP 地址匹配
  3. 检查 `siteMode` 和对应的站点列表

#### Scenario: IP 过滤优先于排除列表

- **WHEN** 用户启用了 IP 过滤
- **AND** 访问的 IP 地址也在 `excludedSites` 中
- **THEN** 系统优先应用 IP 过滤规则
- **AND** 返回 `{ excluded: true, reason: 'ip-address' }`

### Requirement: 配置界面

系统 SHALL 在设置页面提供站点过滤配置界面。

#### Scenario: 显示排除站点输入框

- **WHEN** 用户进入设置页面
- **AND** 当前为全局模式
- **THEN** 系统显示"排除站点"输入框
- **AND** 每行显示一个域名

#### Scenario: 显示 IP 过滤选项

- **WHEN** 用户进入设置页面
- **THEN** 系统在排除站点区域显示"跳过所有 IP 地址"复选框
- **AND** 显示帮助文本："包括 localhost、192.168.x.x、IPv6 等"

#### Scenario: 保存配置

- **WHEN** 用户修改站点过滤配置
- **AND** 点击保存按钮
- **THEN** 系统保存到 `chrome.storage.sync`
- **AND** 立即应用新配置

### Requirement: 兼容性

系统 SHALL 确保站点过滤功能向后兼容。

#### Scenario: 旧版本配置迁移

- **WHEN** 用户从旧版本升级
- **AND** 配置中存在 `blacklist` 字段
- **THEN** 系统自动迁移到 `excludedSites`
- **AND** 保留原有配置

#### Scenario: 缺失配置默认值

- **WHEN** 配置中缺少 `skipIPAddresses`
- **THEN** 系统使用默认值 `false`
- **AND** 不影响现有功能

