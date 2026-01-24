# translation-toggle Specification

## Purpose
TBD - created by archiving change add-toggle-autosync-ipfilter. Update Purpose after archive.
## Requirements
### Requirement: 快捷键切换翻译状态

系统 SHALL 支持通过 Alt+T 快捷键在翻译和原文之间切换。

#### Scenario: 用户首次按下 Alt+T

- **WHEN** 用户在未翻译的页面按下 Alt+T
- **THEN** 系统触发翻译流程
- **AND** 将页面标记为"已翻译"状态

#### Scenario: 用户在已翻译页面按下 Alt+T

- **WHEN** 用户在已翻译的页面按下 Alt+T
- **THEN** 系统恢复所有翻译元素为原文
- **AND** 将页面标记为"未翻译"状态

#### Scenario: 用户再次按下 Alt+T 重新翻译

- **WHEN** 用户在恢复原文后再次按下 Alt+T
- **THEN** 系统重新显示翻译内容
- **AND** 不重新请求 AI 翻译（使用已缓存的翻译）

### Requirement: 翻译状态管理

系统 SHALL 维护当前页面的翻译状态。

#### Scenario: 页面加载时初始化状态

- **WHEN** 页面加载完成
- **THEN** 系统将翻译状态初始化为 `false`（未翻译）

#### Scenario: 页面刷新后状态重置

- **WHEN** 用户刷新页面
- **THEN** 系统重置翻译状态为 `false`
- **AND** 根据 `autoProcess` 配置决定是否自动翻译

### Requirement: 零 API 调用切换

系统 SHALL 在切换翻译时不重新请求 AI 翻译服务。

#### Scenario: 使用缓存的翻译数据

- **WHEN** 用户切换回翻译状态
- **THEN** 系统使用 DOM 中已存储的翻译数据（`data-original` 属性）
- **AND** 不发送新的 API 请求

#### Scenario: 即时响应

- **WHEN** 用户按下 Alt+T
- **THEN** 系统在 100ms 内完成切换
- **AND** 不显示加载指示器

### Requirement: 兼容现有功能

系统 SHALL 确保切换功能不影响现有翻译流程。

#### Scenario: 自动翻译不受影响

- **WHEN** 用户启用了自动翻译（`autoProcess`）
- **THEN** 页面加载时仍正常触发翻译
- **AND** 翻译状态正确设置为 `true`

#### Scenario: 手动翻译不受影响

- **WHEN** 用户通过其他方式触发翻译（如右键菜单）
- **THEN** 翻译功能正常工作
- **AND** 翻译状态正确更新

