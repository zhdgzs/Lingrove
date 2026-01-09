# translation-config Specification

## Purpose
TBD - created by archiving change replace-intensity-with-percentage. Update Purpose after archive.
## Requirements
### Requirement: 百分比翻译密度配置

系统 SHALL 提供基于百分比的翻译密度配置。

#### Scenario: 预设档位
- **WHEN** 用户打开配置页面
- **THEN** 系统提供 4 个预设档位：10%、30%、50%、70%

#### Scenario: 自定义百分比
- **WHEN** 用户需要自定义翻译密度
- **THEN** 系统允许输入 1-100 之间的任意整数值

#### Scenario: AI 自主决策
- **WHEN** 用户选择 30% 翻译密度
- **THEN** 系统只将百分比传递给 AI
- **AND** AI 根据语言特性和上下文自行决定翻译哪些词汇

### Requirement: 默认配置

系统 SHALL 为用户提供 30% 的默认翻译密度。

#### Scenario: 默认配置
- **WHEN** 用户未配置翻译密度
- **THEN** 系统使用 `translationDensity: 30` 作为默认值

### Requirement: 配置界面

系统 SHALL 在配置界面中将"替换强度"改为"翻译密度"，并提供百分比选项。

#### Scenario: 配置界面显示
- **WHEN** 用户打开配置页面
- **THEN** 系统显示"翻译密度"配置项
- **AND** 提供预设档位选择：10%、30%、50%、70%
- **AND** 提供自定义输入框

#### Scenario: 预设档位选择
- **WHEN** 用户选择预设档位 50%
- **THEN** 系统保存 `translationDensity: 50` 到配置
- **AND** 立即应用新配置

#### Scenario: 自定义值输入
- **WHEN** 用户输入自定义值 25
- **THEN** 系统验证值在 1-100 范围内
- **AND** 保存 `translationDensity: 25` 到配置
- **AND** 立即应用新配置

#### Scenario: 无效值处理
- **WHEN** 用户输入无效值（如 0、101、负数）
- **THEN** 系统显示错误提示
- **AND** 不保存无效配置

