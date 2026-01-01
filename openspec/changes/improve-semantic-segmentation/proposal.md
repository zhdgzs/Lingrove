# Change: 优化语义分词和提示词系统

## Why

当前 AI 提示词缺乏语义分词指导，导致中文等语言出现错误切分问题。例如「对方面无表情」被错误识别为「方面」，而非正确的「对方」「面无表情」。

## What Changes

- 新增 `js/core/prompt-rules.js` 文件，集中管理提示词规则
- 重构提示词架构：核心提示词 + 源语言规则 + 目标语言规则 + 用户自定义规则
- 新增「提示词设置」标签页，支持用户自定义提示词规则
- 提供默认预设和重置功能

## Impact

- Affected specs: 新增 `prompt-system` 能力
- Affected code:
  - `js/core/prompt-rules.js` (新增)
  - `js/core/config.js` (修改)
  - `js/content.js` (修改)
  - `js/options.js` (修改)
  - `options.html` (修改)
