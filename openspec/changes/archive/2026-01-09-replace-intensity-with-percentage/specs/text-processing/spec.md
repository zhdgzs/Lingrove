# text-processing Specification Delta

## ADDED Requirements

### Requirement: 智能文本分块

系统 SHALL 实现智能文本分块机制，按 DOM 段落拼接，目标约 1000 字符，上限 1200 字符。

#### Scenario: 标准分块
- **WHEN** 系统收集到 3 个段落：300 字符、400 字符、200 字符
- **THEN** 系统将这 3 个段落合并为一个批次（总计 900 字符）
- **AND** 发送给 AI 进行翻译

#### Scenario: 超长段落单独处理
- **WHEN** 系统遇到一个 800 字符的段落
- **AND** 前一个批次已有 700 字符
- **THEN** 系统发送前一个批次（700 字符）
- **AND** 将 800 字符段落作为新批次单独发送

#### Scenario: 避免超过上限
- **WHEN** 当前批次已有 1000 字符
- **AND** 下一个段落有 300 字符
- **THEN** 系统发送当前批次（1000 字符）
- **AND** 将 300 字符段落作为新批次的开始

#### Scenario: 不在段落中间切分
- **WHEN** 系统处理任何长度的段落
- **THEN** 系统 SHALL NOT 在段落中间切分文本
- **AND** 保持段落语义完整性

### Requirement: 最小文本长度检查

系统 SHALL 使用 `getMinTextLength()` 函数动态判断文本是否足够长，而不是硬编码固定值。

#### Scenario: 中文文本长度检查
- **WHEN** 系统处理中文文本
- **THEN** 系统使用 20 字符作为最小长度阈值
- **AND** 少于 20 字符的文本不发送给 AI

#### Scenario: 英文文本长度检查
- **WHEN** 系统处理英文文本
- **THEN** 系统使用 50 字符作为最小长度阈值
- **AND** 少于 50 字符的文本不发送给 AI

## ADDED Requirements

### Requirement: 批次大小配置

系统 SHALL 更新批次大小配置常量以支持新的分块策略。

#### Scenario: 配置常量定义
- **WHEN** 系统初始化
- **THEN** 系统定义以下常量：
  - `TARGET_BATCH_SIZE = 1000` （目标批次大小）
  - `MAX_BATCH_SIZE = 1200` （最大批次大小）
  - `MIN_BATCH_SIZE = 100` （最小批次大小，避免过小批次）
