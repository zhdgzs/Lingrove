# selection-toolbar Specification

## Purpose
TBD - created by archiving change enhance-selection-popup. Update Purpose after archive.
## Requirements
### Requirement: 工具栏显示

系统 SHALL 根据选中文本长度显示不同的工具栏弹框。

**Acceptance Criteria:**
- 短文本（1-50 字符）：显示翻译、记忆、复制按钮
- 段落文本（50-300 字符）：显示翻译、复制按钮
- 超长文本（>300 字符）：不响应
- 不在已翻译词汇（`.lingrove-translated`）上触发
- 支持 dark/light 主题

#### Scenario: 选中短文本显示完整工具栏

```gherkin
Given 用户在网页上选中了 "hello world"
And 选中文本长度在 1-50 字符之间
And 选中区域不在已翻译词汇上
When 鼠标释放
Then 在选中文本下方显示工具栏弹框
And 工具栏包含翻译、记忆、复制三个按钮
```

#### Scenario: 选中段落文本显示精简工具栏

```gherkin
Given 用户在网页上选中了一段 100 字符的文本
And 选中文本长度在 50-300 字符之间
When 鼠标释放
Then 在选中文本下方显示工具栏弹框
And 工具栏仅包含翻译、复制两个按钮
And 不显示记忆按钮
```

#### Scenario: 选中超长文本不响应

```gherkin
Given 用户在网页上选中了超过 300 字符的文本
When 鼠标释放
Then 不显示选中工具栏
```

#### Scenario: 选中已翻译词汇不显示工具栏

```gherkin
Given 用户在网页上选中了已被 Lingrove 翻译的词汇
When 鼠标释放
Then 不显示选中工具栏
And 保持原有的 tooltip 悬停行为
```

---

### Requirement: 翻译功能

系统 SHALL 在用户点击翻译按钮时，调用翻译服务并展示结果。

**Acceptance Criteria:**
- 采用混合翻译策略（有道 + AI）
- 短文本（≤10词）+ 中英互译使用有道 API
- 长文本或非中英语言使用 AI 翻译
- 显示 loading 状态
- 翻译结果包含：译文、发音按钮
- 单词翻译额外显示：音标、词典释义
- 有道失败自动降级到 AI

#### Scenario: 短文本中英翻译使用有道

```gherkin
Given 用户选中了 "example"（1个单词）
And 用户的目标语言是中文
When 点击翻译按钮
Then 使用有道 API 进行翻译
And 显示翻译结果 "例子"
And 显示音标 "/ɪɡˈzæmpəl/"
And 显示发音按钮
And 加载并显示词典释义
```

#### Scenario: 长文本翻译使用 AI

```gherkin
Given 用户选中了 "This is a very long sentence that contains more than ten words."
And 用户的目标语言是中文
When 点击翻译按钮
Then 使用 AI (LLM) 进行翻译
And 显示翻译结果
And 显示发音按钮
```

#### Scenario: 非中英语言翻译使用 AI

```gherkin
Given 用户选中了 "Bonjour"（法语）
And 用户的目标语言是中文
When 点击翻译按钮
Then 使用 AI (LLM) 进行翻译
And 显示翻译结果 "你好"
```

#### Scenario: 有道翻译失败降级到 AI

```gherkin
Given 用户选中了 "hello"
And 有道 API 返回错误
When 翻译请求失败
Then 自动使用 AI 进行翻译
And 用户无感知地获得翻译结果
```

---

### Requirement: 翻译结果发音

系统 SHALL 在翻译结果区域提供发音功能。

**Acceptance Criteria:**
- 翻译结果区域显示发音按钮
- 自动检测文本语言
- 使用 Chrome TTS API 朗读
- 支持中文、英文、日文、韩文

#### Scenario: 朗读翻译结果

```gherkin
Given 用户翻译了 "hello world"
And 翻译结果已展示
When 点击翻译结果区域的发音按钮
Then 检测到原文语言为英文
And 使用英文 TTS 朗读 "hello world"
```

#### Scenario: 朗读中文翻译结果

```gherkin
Given 用户翻译了 "example" 得到 "例子"
And 翻译结果已展示
When 点击翻译结果区域的发音按钮
Then 朗读原文 "example"
```

---

### Requirement: 记忆功能

系统 SHALL 在用户点击记忆按钮时，将选中文本添加到需记忆列表。

**Acceptance Criteria:**
- 仅短文本（1-50 字符）工具栏显示记忆按钮
- 复用现有 `addToMemorizeList()` 逻辑
- 添加成功后按钮状态变为已激活
- 显示 toast 提示
- 已在列表中的词汇显示已激活状态

#### Scenario: 添加新词到记忆列表

```gherkin
Given 用户选中了 "vocabulary"
And 该词不在记忆列表中
When 点击记忆按钮
Then 将 "vocabulary" 添加到需记忆列表
And 按钮变为已激活状态（实心图标）
And 显示 toast "vocabulary 已添加到需记忆列表"
```

#### Scenario: 词汇已在记忆列表

```gherkin
Given 用户选中了 "vocabulary"
And 该词已在记忆列表中
When 工具栏显示
Then 记忆按钮显示为已激活状态
```

---

### Requirement: 复制功能

系统 SHALL 在用户点击复制按钮时，将选中文本复制到剪贴板。

**Acceptance Criteria:**
- 使用 Clipboard API 复制
- 显示复制成功提示

#### Scenario: 复制选中文本

```gherkin
Given 用户选中了 "hello world"
When 点击复制按钮
Then 将 "hello world" 复制到剪贴板
And 显示 toast "已复制到剪贴板"
```

---

### Requirement: 翻译结果展示

系统 SHALL 在翻译完成后，在工具栏下方展开结果区域。

**Acceptance Criteria:**
- 平滑展开动画
- 显示译文、原文、发音按钮
- 单词翻译显示音标和词典释义
- 句子翻译的原文词汇可点击

#### Scenario: 单词翻译结果展示

```gherkin
Given 用户翻译了单词 "example"
When 翻译完成
Then 工具栏下方展开结果区域
And 显示译文 "例子"
And 显示难度标签 "B1"
And 显示音标 "/ɪɡˈzæmpəl/"
And 显示发音按钮
And 显示原文 "example"
And 加载并显示词典释义
```

#### Scenario: 句子翻译结果展示

```gherkin
Given 用户翻译了句子 "How are you?"
When 翻译完成
Then 工具栏下方展开结果区域
And 显示译文 "你好吗？"
And 显示发音按钮
And 显示原文 "How are you?"
And 原文中的每个词汇可点击
And 不显示词典释义
```

---

### Requirement: 句子词汇点击添加记忆

系统 SHALL 支持用户点击句子翻译结果中的原文词汇，将其添加到记忆列表。

**Acceptance Criteria:**
- 句子翻译结果中，原文的每个词汇可点击
- 点击词汇后显示「添加到记忆」选项
- 过滤常见虚词（a, the, is, are 等）不显示为可点击
- 添加成功后显示 toast 提示

#### Scenario: 点击句子中的词汇添加到记忆

```gherkin
Given 用户翻译了句子 "This is a complicated example"
And 翻译结果已展示
When 点击原文中的 "complicated"
Then 显示「添加到记忆」按钮
When 点击「添加到记忆」
Then 将 "complicated" 添加到需记忆列表
And 显示 toast "complicated 已添加到需记忆列表"
```

#### Scenario: 虚词不可点击

```gherkin
Given 用户翻译了句子 "This is a test"
And 翻译结果已展示
Then 原文中的 "This", "is", "a" 显示为普通文本（不可点击）
And 原文中的 "test" 显示为可点击词汇
```

---

