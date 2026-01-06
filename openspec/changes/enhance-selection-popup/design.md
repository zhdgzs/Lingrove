# Design: enhance-selection-popup

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Selection Popup System                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │   Event     │───▶│  UI State    │───▶│   Renderer    │  │
│  │  Handlers   │    │   Manager    │    │  (DOM Update) │  │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
│         │                  │                    │           │
│         ▼                  ▼                    ▼           │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  Translate  │    │   TTS        │    │   Clipboard   │  │
│  │   Service   │    │   Service    │    │    Service    │  │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────────────────────────┐                   │
│  │        Translation Strategy          │                   │
│  │  ┌─────────┐      ┌─────────────┐   │                   │
│  │  │  Youdao │      │  AI (LLM)   │   │                   │
│  │  │   API   │      │   Service   │   │                   │
│  │  └─────────┘      └─────────────┘   │                   │
│  └─────────────────────────────────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Selection Popup States

```javascript
const PopupState = {
  IDLE: 'idle',           // 初始工具栏状态
  LOADING: 'loading',     // 翻译加载中
  RESULT: 'result',       // 显示翻译结果
  ERROR: 'error'          // 翻译失败
};

// 文本长度类型
const TextLengthType = {
  SHORT: 'short',         // 1-50 字符（单词/短语）
  PARAGRAPH: 'paragraph', // 50-300 字符（段落）
  TOO_LONG: 'too_long'    // >300 字符（不响应）
};
```

### 2. UI Structure

**短文本工具栏（1-50 字符）**
```html
<div class="lingrove-selection-popup" data-state="idle" data-length="short" data-theme="dark">
  <div class="lingrove-selection-toolbar">
    <button class="lingrove-sel-btn" data-action="translate">
      <svg>...</svg> 翻译
    </button>
    <button class="lingrove-sel-btn" data-action="memorize">
      <svg>...</svg> 记忆
    </button>
    <button class="lingrove-sel-btn" data-action="copy">
      <svg>...</svg> 复制
    </button>
  </div>
  <!-- 翻译结果区域（动态展开） -->
  <div class="lingrove-selection-result">...</div>
</div>
```

**段落工具栏（50-300 字符）**
```html
<div class="lingrove-selection-popup" data-state="idle" data-length="paragraph" data-theme="dark">
  <div class="lingrove-selection-toolbar">
    <button class="lingrove-sel-btn" data-action="translate">
      <svg>...</svg> 翻译
    </button>
    <button class="lingrove-sel-btn" data-action="copy">
      <svg>...</svg> 复制
    </button>
  </div>
  <!-- 翻译结果区域（动态展开） -->
  <div class="lingrove-selection-result">...</div>
</div>
```

**单词翻译结果**
```html
<div class="lingrove-selection-result">
  <div class="lingrove-sel-header">
    <span class="lingrove-sel-word">example</span>
    <span class="lingrove-sel-badge">B1</span>
  </div>
  <div class="lingrove-sel-phonetic lingrove-sel-speak" data-text="example">
    <svg>...</svg> /ɪɡˈzæmpəl/
  </div>
  <div class="lingrove-sel-original">原文: 例子</div>
  <div class="lingrove-sel-dict">
    <!-- 词典内容 -->
  </div>
</div>
```

**句子翻译结果（原文词汇可点击）**
```html
<div class="lingrove-selection-result">
  <div class="lingrove-sel-translation">这是一个复杂的例子</div>
  <div class="lingrove-sel-speak" data-text="This is a complicated example">
    <svg>...</svg> 发音
  </div>
  <div class="lingrove-sel-original-sentence">
    原文:
    <span class="lingrove-sel-clickable-word" data-word="This">This</span>
    <span class="lingrove-sel-clickable-word" data-word="is">is</span>
    <span class="lingrove-sel-clickable-word" data-word="a">a</span>
    <span class="lingrove-sel-clickable-word" data-word="complicated">complicated</span>
    <span class="lingrove-sel-clickable-word" data-word="example">example</span>
  </div>
</div>
```

### 3. Clickable Word Interaction

点击句子中的词汇时，显示小型弹出菜单：

```html
<div class="lingrove-word-action-popup">
  <button class="lingrove-word-action-btn" data-action="memorize">
    <svg>...</svg> 添加到记忆
  </button>
</div>
```

```javascript
/**
 * 分词处理（简单实现）
 */
function tokenizeText(text, lang) {
  if (lang === 'zh' || lang === 'ja') {
    // 中日文按字符分割（简化处理）
    return text.split('');
  }
  // 英文等按空格分词
  return text.split(/\s+/).filter(w => w.length > 0);
}

/**
 * 判断词汇是否值得添加到记忆
 * 过滤掉常见虚词
 */
function isMemorizableWord(word, lang) {
  const stopWords = {
    en: ['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
         'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
         'would', 'could', 'should', 'may', 'might', 'must', 'shall',
         'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
         'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
         'through', 'during', 'before', 'after', 'above', 'below',
         'between', 'under', 'again', 'further', 'then', 'once',
         'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either',
         'neither', 'not', 'only', 'own', 'same', 'than', 'too',
         'very', 'just', 'i', 'me', 'my', 'myself', 'we', 'our',
         'ours', 'ourselves', 'you', 'your', 'yours', 'yourself',
         'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
         'herself', 'it', 'its', 'itself', 'they', 'them', 'their',
         'theirs', 'themselves', 'what', 'which', 'who', 'whom',
         'this', 'that', 'these', 'those', 'am']
  };

  const lowerWord = word.toLowerCase().replace(/[^a-z]/g, '');
  if (lowerWord.length < 2) return false;
  return !stopWords[lang]?.includes(lowerWord);
}
```

```javascript
/**
 * 翻译策略选择逻辑
 */
function selectTranslationStrategy(text, sourceLang, targetLang) {
  const wordCount = text.split(/\s+/).length;
  const isChinese = sourceLang === 'zh';
  const isEnglish = sourceLang === 'en';
  const targetIsChinese = targetLang.startsWith('zh');
  const targetIsEnglish = targetLang === 'en';

  // 中英互译判断
  const isChineseEnglish = (isChinese && targetIsEnglish) ||
                           (isEnglish && targetIsChinese);

  // 短文本 + 中英互译 → 有道
  if (wordCount <= 10 && isChineseEnglish) {
    return 'youdao';
  }

  // 其他情况 → AI
  return 'ai';
}
```

### 4. Youdao Translation API

使用有道翻译 API（非词典 API）：

```javascript
async function translateWithYoudao(text, from, to) {
  // 有道翻译 API 端点
  const url = `https://fanyi.youdao.com/translate?&doctype=json&type=${from}2${to}&i=${encodeURIComponent(text)}`;

  const response = await fetch(url);
  const data = await response.json();

  return data.translateResult?.[0]?.[0]?.tgt || null;
}
```

### 5. AI Translation Prompt

```javascript
const AI_TRANSLATE_PROMPT = `你是一个专业翻译助手。请将以下文本翻译成{targetLanguage}。

要求：
1. 保持原文的语气和风格
2. 翻译要自然流畅
3. 只返回翻译结果，不要解释

原文：{text}`;
```

## Data Flow

### Translation Flow

```
用户点击翻译
    │
    ▼
获取选中文本
    │
    ▼
检测源语言 (detectLanguage)
    │
    ▼
选择翻译策略
    │
    ├─── 有道 ───▶ fetchYoudaoTranslation()
    │                    │
    │                    ▼
    │              成功？─┬─ 是 ──▶ 显示结果
    │                    │
    │                    └─ 否 ──▶ 降级到 AI
    │
    └─── AI ────▶ callLLMTranslation()
                      │
                      ▼
                 显示结果
```

### State Transitions

```
IDLE ──[点击翻译]──▶ LOADING ──[成功]──▶ RESULT
                        │
                        └──[失败]──▶ ERROR

RESULT ──[选中新文本]──▶ IDLE
ERROR ──[重试]──▶ LOADING
```

## Styling Strategy

### CSS Variables (复用 tooltip)

```css
.lingrove-selection-popup {
  /* 复用 tooltip 的颜色变量 */
  --popup-bg: #1e293b;
  --popup-border: #334155;
  --popup-text: #f8fafc;
  --popup-text-secondary: #94a3b8;
  --popup-accent: #818cf8;
}

[data-theme="light"] .lingrove-selection-popup {
  --popup-bg: #ffffff;
  --popup-border: #e2e8f0;
  --popup-text: #1e293b;
  --popup-text-secondary: #64748b;
}
```

### Animation

```css
.lingrove-selection-result {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease, padding 0.3s ease;
}

.lingrove-selection-popup[data-state="result"] .lingrove-selection-result {
  max-height: 300px;
  padding: 12px;
}
```

## Error Handling

| 错误场景 | 处理方式 |
|----------|----------|
| 有道 API 失败 | 自动降级到 AI 翻译 |
| AI 翻译超时 | 显示超时提示，提供重试按钮 |
| 网络错误 | 显示网络错误提示 |
| API Key 未配置 | 提示用户配置 API |

## Performance Considerations

1. **防抖**：选中文本后延迟 10ms 再显示弹框，避免频繁触发
2. **缓存**：翻译结果缓存到内存，相同文本不重复请求
3. **懒加载**：词典数据在翻译完成后异步加载
4. **取消机制**：选中新文本时取消进行中的翻译请求

## Accessibility

- 所有按钮有 `title` 属性
- 支持键盘操作（Tab 切换，Enter 触发）
- 加载状态有视觉反馈
- 颜色对比度符合 WCAG 标准
