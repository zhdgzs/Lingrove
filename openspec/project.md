# Project Context

## Purpose
Lingrove 是一款沉浸式语言学习 Chrome 浏览器扩展，通过智能替换网页词汇创造双语学习环境。基于「可理解性输入」理论，让语言学习融入日常浏览。

核心功能：
- 多 LLM 支持（OpenAI、DeepSeek、Moonshot、Groq、Ollama）
- CEFR 六级难度控制（A1-C2）
- LRU 智能缓存（最高 10000 词）
- 双向翻译（自动检测页面语言）
- 词汇管理（已学会/需记忆）

## Tech Stack
- Chrome Extension Manifest V3
- Vanilla JavaScript (ES6+) - 无框架依赖
- CSS Variables + Modern CSS - 动态主题支持
- Chrome Storage API - sync(配置同步) + local(本地缓存)
- Chrome TTS API - 文本转语音
- Intersection Observer API - 视口检测懒加载
- MutationObserver API - DOM 变化监听
- esbuild - 构建工具

## Project Conventions

### Code Style
- 纯 JavaScript，无框架依赖，便于维护
- CSS 类名使用 `vocabmeld-` 前缀
- 日志输出使用 `[VocabMeld]` 前缀
- 文件路径使用双引号包裹
- 优先使用正斜杠 `/` 作为路径分隔符

### Architecture Patterns
```
┌─────────────────┬───────────────────────┬───────────────────────┐
│   Background    │    Content Script     │     Options/Popup     │
│   (Service      │    (注入到网页)        │     (扩展页面)         │
│    Worker)      │                       │                       │
├─────────────────┼───────────────────────┼───────────────────────┤
│ • API 代理      │ • DOM 处理            │ • 配置管理            │
│ • TTS 朗读      │ • 文本分段            │ • 词汇管理            │
│ • 右键菜单      │ • LLM 调用            │ • 统计展示            │
│ • 快捷键        │ • 缓存管理            │ • 主题设置            │
│ • 消息路由      │ • 用户交互            │                       │
└─────────────────┴───────────────────────┴───────────────────────┘
```

核心模块：
- `js/services/content-segmenter.js` - 页面内容分段器
- `js/services/cache-service.js` - LRU 缓存服务
- `js/services/text-replacer.js` - DOM 文本替换器
- `js/core/config.js` - 配置常量
- `js/core/storage.js` - 存储服务封装

### Testing Strategy
- 本地调试：Chrome 开发者模式加载扩展
- 修改 content/popup/options.js 后需刷新扩展和目标页面
- 修改 background.js 后需刷新扩展
- 修改 CSS 后仅需刷新目标页面

### Git Workflow
- 主分支：main
- Commit 风格：conventional commits
- 示例：`feat: 支持多API节点配置`、`fix: 解决存储限制问题`

## Domain Context
- CEFR 难度体系：A1(入门) → A2(初级) → B1(中级) → B2(中高级) → C1(高级) → C2(精通)
- 替换强度：较少(4词/段) / 适中(8词/段) / 较多(14词/段)
- 显示样式：译文(原文) / 仅译文 / 原文(译文)
- 站点规则：所有网站模式(排除列表) / 仅指定网站模式(允许列表)

## Important Constraints
- Chrome 浏览器 88+ 版本要求
- Node.js 16+ 用于构建
- chrome.storage.sync 有配额限制（约 100KB）
- 词汇列表存储使用 local 而非 sync（避免 8KB 限制）
- Content Script 无法直接跨域请求，需通过 Background Script 代理

## External Dependencies
- LLM API 服务（用户自行配置）：
  - DeepSeek: `https://api.deepseek.com/chat/completions`
  - OpenAI: `https://api.openai.com/v1/chat/completions`
  - Moonshot: `https://api.moonshot.cn/v1/chat/completions`
  - Groq: `https://api.groq.com/openai/v1/chat/completions`
  - Ollama: `http://localhost:11434/v1/chat/completions`
- 无第三方 npm 运行时依赖
- 开发依赖：esbuild（构建打包）
