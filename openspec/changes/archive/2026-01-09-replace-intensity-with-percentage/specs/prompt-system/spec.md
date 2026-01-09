# prompt-system Specification Delta

## ADDED Requirements

### Requirement: 翻译提示词参数

系统 SHALL 更新翻译提示词以支持基于百分比的词汇选择，而不是固定词数。

#### Scenario: 百分比参数传递
- **WHEN** 系统调用 `buildTranslationPrompt` 函数
- **THEN** 系统传递以下参数：
  - `text`: 待翻译文本
  - `translationDensity`: 翻译密度百分比（10/30/50/70 或自定义 1-100）
  - `sourceLang`: 源语言
  - `targetLang`: 目标语言

#### Scenario: AI 提示词内容
- **WHEN** 系统生成翻译提示词
- **THEN** 提示词仅包含翻译密度百分比：
  - "翻译密度：{translationDensity}%"
  - "请根据文本内容和语言特征，选择约 {translationDensity}% 的词汇进行翻译"
  - AI 根据语言特征自主决定翻译词汇数量（中文：2-4字符/词，英文：4-10字符/词）

#### Scenario: 30% 密度提示词示例
- **WHEN** 翻译密度为 30%
- **THEN** 提示词指导 AI：
  - "翻译密度：30%"
  - "请根据文本内容和语言特征，选择约 30% 的词汇进行翻译"

#### Scenario: 70% 密度提示词示例
- **WHEN** 翻译密度为 70%
- **THEN** 提示词指导 AI：
  - "翻译密度：70%"
  - "请根据文本内容和语言特征，选择约 70% 的词汇进行翻译"
