# AGENTS.md

本文件用于帮助 AI Agent 快速理解 Lingrove 的目标、架构、开发方式与工程约束，适用于仓库根目录及所有子目录。

## 项目概述

Lingrove 是一个沉浸式语言学习 Chrome 扩展（Manifest V3），通过智能替换网页词汇创造双语学习环境。基于「可理解性输入」理论，支持多 LLM API、多节点故障转移、智能缓存等特性。

## 开发命令

```bash
# 安装依赖
npm install

# 生成图标文件（创建 icons/generate_icons.html）
npm run build

# 监听模式（当前仅生成图标）
npm run watch

# 加载扩展到 Chrome
# 1. 访问 chrome://extensions/
# 2. 开启"开发者模式"
# 3. 点击"加载已解压的扩展程序"，选择项目根目录
```

## 核心架构

### 扩展结构

```
Lingrove/
├── manifest.json           # Manifest V3 配置
├── js/
│   ├── background.js       # Service Worker：API 节点管理、故障转移、速率限制
│   ├── popup.js            # 弹出窗口逻辑
│   ├── options.js          # 设置页面主逻辑
│   ├── options-translation.js  # 翻译 API 配置
│   └── content/            # 内容脚本（按加载顺序）
│       ├── constants.js    # 常量定义
│       ├── prompt-rules.js # AI 提示词模板
│       ├── themes.js       # 主题系统
│       ├── utils.js        # 工具函数
│       ├── storage.js      # Chrome Storage 管理
│       ├── translation-types.js    # 翻译类型定义
│       ├── crypto-utils.js         # 加密工具
│       ├── translation-adapters.js # 翻译服务适配器
│       ├── translation-service.js  # 翻译服务编排
│       ├── dom-handler.js  # DOM 操作
│       ├── ui-components.js # UI 组件
│       ├── text-replacer.js # 文本替换逻辑
│       ├── api-client.js   # API 客户端与缓存
│       ├── event-handlers.js # 事件处理
│       └── main.js         # 主入口
├── css/
│   └── content.css         # 内容脚本样式
├── popup.html              # 弹出窗口
├── options.html            # 设置页面
└── _locales/               # 国际化
    ├── zh_CN/
    └── en/
```

### 模块职责

**background.js (Service Worker)**
- 多节点 API 管理：故障转移、健康检查、速率限制
- 节点状态跟踪：HEALTHY, ERROR, RATE_LIMITED, COOLDOWN
- 定时任务：WebDAV 自动同步（每小时）、健康检查（5 分钟）
- 上下文菜单：选中文本翻译

**content scripts 执行流程**
1. `constants.js` - 加载常量（CEFR 等级、停用词等）
2. `storage.js` - 初始化配置和缓存
3. `main.js` - 设置 IntersectionObserver，监听可见元素
4. `api-client.js` - 调用 AI API 翻译文本
5. `text-replacer.js` - 按难度优先级选词并替换
6. `ui-components.js` - 渲染悬停卡片（音标、释义、操作按钮）

### 关键设计模式

**1. 多节点故障转移**
- 配置：`apiNodes` 数组，每个节点包含 endpoint、apiKey、model、enabled
- 策略：按优先级顺序尝试，失败自动切换下一个节点
- 健康检查：5 分钟内 3 次失败标记为 ERROR，定期自动恢复

**2. 速率限制**
- 全局开关：`rateLimitEnabled`
- 节点级配置：`node.rateLimit`（RPM），0 表示无限制
- 冷却机制：达到限制后进入 COOLDOWN 状态（默认 60 秒）

**3. LRU 缓存**
- 容量：默认 10,000 词，可配置 `cacheMaxSize`
- 存储：`chrome.storage.local` 持久化
- 策略：命中直接返回，未命中调用 API 并缓存

**4. IntersectionObserver 懒加载**
- 监听：`rootMargin: '500px'`，提前加载即将可见的内容
- 去重：`data-lingrove-processed` 属性标记已处理元素
- 批处理：按字符数分批（目标 1000 字符，上限 1200 字符）

**5. 难度优先级选词**
- CEFR 等级：A1 < A2 < B1 < B2 < C1 < C2
- 策略：优先选择用户设置等级的词汇，不够再逐级增加
- 同级超额：随机选取

## 数据存储

### chrome.storage.sync（配置，8KB 限制）
- API 配置：`apiNodes`, `apiEndpoint`, `apiKey`, `modelName`
- 语言设置：`nativeLanguage`, `targetLanguage`, `difficultyLevel`
- 显示配置：`translationStyle`, `theme`, `colorTheme`
- 站点规则：`siteMode`, `excludedSites`, `allowedSites`
- 提示词：`customPromptRules`, `customSourceRules`, `customTargetRules`

### chrome.storage.local（大数据）
- 词汇列表：`learnedWords`, `memorizeList`
- 缓存：`wordCache`（LRU Map 序列化）

## 翻译流程

1. **文本检测**：`L.detectLanguage(text)` 判断语言
2. **模式过滤**：根据 `processMode`（both/native-only/target-only）决定是否处理
3. **缓存查询**：检查 `L.wordCache` 是否有缓存结果
4. **API 调用**：
   - 多节点模式：`background.js` 选择可用节点
   - 单节点模式：直接调用配置的 endpoint
   - 翻译 API 降级：优先使用翻译 API，失败降级到 AI
5. **词汇选取**：`L.selectByDifficultyPriority()` 按难度优先级选词
6. **DOM 替换**：`L.replaceTextInElement()` 替换原文为译文
7. **UI 渲染**：悬停显示卡片（音标、释义、操作按钮）

## 快捷键

- `Alt+T` - 处理当前页面（手动触发翻译）
- `Alt+R` - 还原当前页面（移除所有翻译）

## 调试技巧

### 查看扩展日志
```javascript
// 在 DevTools Console 中
chrome.storage.sync.get(null, console.log)  // 查看所有配置
chrome.storage.local.get(null, console.log) // 查看本地数据
```

### 测试 API 节点
```javascript
// 在 options.html 的 Console 中
testConnection()  // 测试当前配置的 API 连接
```

### 清除缓存
```javascript
chrome.storage.local.remove('wordCache')
```

### 查看节点状态
```javascript
// 在 background.js 的 Service Worker Console 中
chrome.storage.local.get('nodeHealthStatus', console.log)
```

## 常见问题

### 翻译不生效
1. 检查扩展是否启用：`chrome.storage.sync.get('enabled')`
2. 检查站点规则：当前域名是否在排除列表中
3. 检查 API 配置：至少有一个启用的节点
4. 检查文本长度：是否达到最小长度阈值

### 节点频繁切换
1. 检查速率限制配置：`rateLimitEnabled`, `globalRateLimit`
2. 检查节点健康状态：`nodeHealthStatus`
3. 增加节点数量或提高 RPM 限制

### 缓存占用过大
1. 调整缓存大小：`cacheMaxSize`（默认 10,000）
2. 手动清理：`chrome.storage.local.remove('wordCache')`

## 代码规范

- **命名空间**：所有内容脚本使用 `L` 全局对象（`window.Lingrove`）
- **异步处理**：使用 `async/await`，避免回调地狱
- **错误处理**：API 调用必须 try-catch，失败自动降级
- **性能优化**：
  - 使用 IntersectionObserver 懒加载
  - 批量处理文本（避免频繁 API 调用）
  - LRU 缓存减少重复请求
- **注释语言**：与现有代码保持一致（中文）

## 发布流程

1. 更新版本号：`manifest.json` 和 `package.json`
2. 测试功能：加载扩展到 Chrome，验证核心功能
3. 打包：压缩项目文件夹（排除 `.git`、`node_modules` 及本地 AI 工具缓存目录）
4. 发布：
   - Edge 商店：https://partner.microsoft.com/dashboard
   - Chrome 商店：https://chrome.google.com/webstore/devconsole
5. 创建 GitHub Release：附上 zip 文件

## 技术债务

- 构建脚本仅生成图标 HTML，未实际构建扩展
- 无单元测试覆盖
- 部分模块耦合度较高（storage.js 与 main.js）
- 缺少 TypeScript 类型定义
