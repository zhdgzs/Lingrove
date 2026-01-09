# text-processing Specification

## Purpose
TBD - created by archiving change replace-intensity-with-percentage. Update Purpose after archive.
## Requirements
### Requirement: 批次大小配置

系统 SHALL 更新批次大小配置常量以支持新的分块策略。

#### Scenario: 配置常量定义
- **WHEN** 系统初始化
- **THEN** 系统定义以下常量：
  - `TARGET_BATCH_SIZE = 1000` （目标批次大小）
  - `MAX_BATCH_SIZE = 1200` （最大批次大小）
  - `MIN_BATCH_SIZE = 100` （最小批次大小，避免过小批次）

