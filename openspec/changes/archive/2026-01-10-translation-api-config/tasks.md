# Tasks: translation-api-config

## Overview

翻译 API 配置功能的任务拆解，按模块和依赖关系组织。

## Task Groups

### TG1: 基础架构 (Foundation)

| ID | Task | Status | Dependencies | Files |
|----|------|--------|--------------|-------|
| T1.1 | 定义统一数据结构和类型常量 | done | - | `js/content/translation-types.js` |
| T1.2 | 实现适配器基类 BaseAdapter | done | T1.1 | `js/content/translation-adapters.js` |
| T1.3 | 实现 TranslationService 统一入口 | done | T1.2 | `js/content/translation-service.js` |
| T1.4 | 添加翻译节点存储逻辑 | done | T1.1 | `js/content/storage.js` |

### TG2: 提供商适配器 (Provider Adapters)

| ID | Task | Status | Dependencies | Files |
|----|------|--------|--------------|-------|
| T2.1 | 实现谷歌翻译适配器 GoogleAdapter | done | T1.2 | `js/content/translation-adapters.js` |
| T2.2 | 实现百度翻译适配器 BaiduAdapter | done | T1.2 | `js/content/translation-adapters.js` |
| T2.3 | 实现腾讯云翻译适配器 TencentAdapter | done | T1.2 | `js/content/translation-adapters.js` |
| T2.4 | 实现有道智云适配器 YoudaoAdapter | done | T1.2 | `js/content/translation-adapters.js` |
| T2.5 | 实现 DeepL 适配器 DeepLAdapter | done | T1.2 | `js/content/translation-adapters.js` |
| T2.6 | 添加 MD5/SHA256/HMAC 签名工具函数 | done | - | `js/content/crypto-utils.js` |

### TG3: 配置 UI (Configuration UI)

| ID | Task | Status | Dependencies | Files |
|----|------|--------|--------------|-------|
| T3.1 | 添加翻译 API 配置区域 HTML | done | - | `options.html` |
| T3.2 | 添加翻译节点编辑弹窗 HTML | done | T3.1 | `options.html` |
| T3.3 | 添加翻译节点样式（复用 AI 节点） | done | T3.1 | `css/options.css` |
| T3.4 | 实现翻译节点列表渲染 | done | T3.1, T1.4 | `js/options-translation.js` |
| T3.5 | 实现翻译节点添加/编辑功能 | done | T3.2, T3.4 | `js/options-translation.js` |
| T3.6 | 实现翻译节点删除功能 | done | T3.4 | `js/options-translation.js` |
| T3.7 | 实现翻译节点拖拽排序 | done | T3.4 | `js/options-translation.js` |
| T3.8 | 实现快速填充预设按钮 | done | T3.5 | `js/options-translation.js` |
| T3.9 | 实现连通性测试功能 | done | T3.5, TG2 | `js/options-translation.js` |

### TG4: 集成与降级 (Integration & Fallback)

| ID | Task | Status | Dependencies | Files |
|----|------|--------|--------------|-------|
| T4.1 | 修改 api-client.js 使用 TranslationService | done | T1.3 | `js/content/api-client.js` |
| T4.2 | 实现降级到内置免费服务逻辑 | done | T4.1 | `js/content/translation-service.js` |
| T4.3 | 实现节点故障转移机制 | done | T1.3 | `js/content/translation-service.js` |
| T4.4 | 实现速率限制检查 | done | T1.3 | `js/content/translation-service.js` |

### TG5: 测试与优化 (Testing & Polish)

| ID | Task | Status | Dependencies | Files |
|----|------|--------|--------------|-------|
| T5.1 | 更新 manifest.json 添加新文件引用 | done | TG1, TG2 | `manifest.json` |
| T5.2 | 集成测试：配置 UI 流程 | pending | TG3 | - |
| T5.3 | 集成测试：翻译功能端到端 | pending | TG4 | - |
| T5.4 | 集成测试：故障转移场景 | pending | T4.3 | - |
| T5.5 | 错误处理和用户提示优化 | pending | TG4 | 多文件 |

---

## Task Details

### T1.1 定义统一数据结构和类型常量

**目标**: 创建翻译功能的类型定义和常量

**内容**:
- `LanguageCode` 语言编码常量
- `TranslationRequest` 请求结构
- `TranslationResult` 响应结构
- `DictionaryInfo` 词典信息结构
- `ProviderCapabilities` 能力声明结构
- `TranslationNode` 节点配置结构
- 错误码常量

**验收标准**:
- [ ] 所有类型定义完整
- [ ] 常量命名规范
- [ ] 注释清晰

---

### T1.2 实现适配器基类 BaseAdapter

**目标**: 创建所有提供商适配器的基类

**内容**:
- `translate(request)` 统一翻译入口
- `mapLanguageCode(code)` 语言代码映射（抽象）
- `doTranslate(text, from, to)` 实际翻译（抽象）
- `extractTranslation(response)` 提取翻译结果（抽象）
- `parseDict(response)` 解析词典（可选）
- `getCapabilities()` 获取能力声明（抽象）
- 统一错误处理

**验收标准**:
- [ ] 基类方法完整
- [ ] 错误处理统一
- [ ] 子类可正确继承

---

### T1.3 实现 TranslationService 统一入口

**目标**: 创建翻译服务的统一调度入口

**内容**:
- `translate(request)` 统一翻译入口
- `lookup(word)` 词典查询（优先词典服务）
- `testConnection(nodeId)` 测试节点连通性
- `getEnabledNodes()` 获取启用的节点列表
- `createAdapter(node)` 创建适配器实例
- 节点优先级调度
- 故障转移逻辑

**验收标准**:
- [ ] 按优先级调度正确
- [ ] 故障转移正常工作
- [ ] 降级逻辑正确

---

### T1.4 添加翻译节点存储逻辑

**目标**: 在 storage.js 中添加翻译节点的存储和读取

**内容**:
- `getTranslationNodes()` 获取节点列表
- `saveTranslationNodes(nodes)` 保存节点列表
- `getTranslationFallbackEnabled()` 获取降级开关
- `setTranslationFallbackEnabled(enabled)` 设置降级开关
- 密钥加密存储（可选）

**验收标准**:
- [ ] 存储读写正常
- [ ] 数据结构正确
- [ ] 与现有存储逻辑一致

---

### T2.1 实现谷歌翻译适配器 GoogleAdapter

**目标**: 实现 Google Cloud Translation API 的适配器

**内容**:
- 语言代码映射表
- API Key 认证
- API 请求构建
- 响应解析
- 错误处理

**API 文档**: https://cloud.google.com/translate/docs/reference/rest

**验收标准**:
- [ ] 翻译功能正常
- [ ] 错误处理完善
- [ ] 语言映射正确

---

### T2.2 实现百度翻译适配器 BaiduAdapter

**目标**: 实现百度翻译 API 的适配器

**内容**:
- 语言代码映射表
- MD5 签名生成
- API 请求构建
- 响应解析
- 错误码映射

**API 文档**: https://fanyi-api.baidu.com/product/112

**验收标准**:
- [ ] 翻译功能正常
- [ ] 错误处理完善
- [ ] 语言映射正确

---

### T2.3 实现腾讯云翻译适配器 TencentAdapter

**目标**: 实现腾讯云机器翻译 API 的适配器

**内容**:
- 语言代码映射表
- HMAC-SHA256 签名生成（TC3-HMAC-SHA256）
- API 请求构建（POST JSON）
- 响应解析
- 错误码映射

**API 文档**: https://cloud.tencent.com/document/product/551/35017

**验收标准**:
- [ ] 翻译功能正常
- [ ] TC3 签名算法正确
- [ ] 错误处理完善
- [ ] 语言映射正确

---

### T2.4 实现有道智云适配器 YoudaoAdapter

**目标**: 实现有道智云翻译 API 的适配器（含词典功能）

**内容**:
- 语言代码映射表
- SHA256 签名生成
- API 请求构建
- 响应解析（含词典）
- 音标提取
- 词性解析
- 错误码映射

**API 文档**: https://ai.youdao.com/DOCSIRMA/html/trans/api/wbfy/index.html

**验收标准**:
- [ ] 翻译功能正常
- [ ] 词典解析正确
- [ ] 音标提取正确
- [ ] 错误处理完善

---

### T2.5 实现 DeepL 适配器 DeepLAdapter

**目标**: 实现 DeepL API 的适配器

**内容**:
- 语言代码映射表（大写）
- API Key 认证
- Free/Pro API 端点区分
- API 请求构建
- 响应解析
- 错误处理

**API 文档**: https://www.deepl.com/docs-api

**验收标准**:
- [ ] 翻译功能正常
- [ ] Free/Pro 端点正确
- [ ] 错误处理完善

---

### T2.6 添加 MD5/SHA256/HMAC 签名工具函数

**目标**: 提供各翻译 API 所需的签名函数

**内容**:
- `md5(str)` MD5 哈希（百度）
- `sha256(str)` SHA256 哈希（有道）
- `hmacSha256(key, str)` HMAC-SHA256（腾讯云）
- 使用 Web Crypto API 或轻量库

**验收标准**:
- [ ] 签名结果正确
- [ ] 兼容性良好
- [ ] 无外部依赖（优先）

---

### T3.1 添加翻译 API 配置区域 HTML

**目标**: 在 options.html 中添加翻译 API 配置区域

**内容**:
- 翻译 API 区域标题和说明
- 节点列表容器
- 空状态提示
- 添加节点按钮
- 降级开关

**位置**: API 配置 section 内，AI 节点下方

**验收标准**:
- [ ] HTML 结构正确
- [ ] 与 AI 节点风格一致
- [ ] 响应式布局

---

### T3.2 添加翻译节点编辑弹窗 HTML

**目标**: 添加翻译节点的添加/编辑弹窗

**内容**:
- 弹窗容器
- 节点名称输入
- 翻译服务选择下拉框
- 动态认证字段（根据服务类型）
- 速率限制输入
- 快速填充按钮
- 测试连接按钮和结果显示
- 保存/取消按钮

**验收标准**:
- [ ] 弹窗结构完整
- [ ] 字段动态切换正确
- [ ] 与 AI 节点弹窗风格一致

---

### T3.4 实现翻译节点列表渲染

**目标**: 实现翻译节点列表的动态渲染

**内容**:
- 从存储加载节点列表
- 渲染节点卡片
- 显示节点状态（已连接/未测试/失败）
- 显示部分密钥信息（脱敏）
- 空状态处理

**验收标准**:
- [ ] 列表渲染正确
- [ ] 状态显示正确
- [ ] 密钥脱敏显示

---

### T3.5 实现翻译节点添加/编辑功能

**目标**: 实现节点的添加和编辑功能

**内容**:
- 打开弹窗（添加/编辑模式）
- 服务类型切换时动态更新字段
- 表单验证
- 保存到存储
- 刷新列表

**验收标准**:
- [ ] 添加功能正常
- [ ] 编辑功能正常
- [ ] 表单验证完善
- [ ] 字段动态切换正确

---

### T3.7 实现翻译节点拖拽排序

**目标**: 实现节点的拖拽排序功能

**内容**:
- 拖拽手柄
- 拖拽排序逻辑（复用 AI 节点）
- 保存新顺序到存储

**验收标准**:
- [ ] 拖拽流畅
- [ ] 顺序保存正确
- [ ] 视觉反馈清晰

---

### T3.9 实现连通性测试功能

**目标**: 实现节点的连通性测试

**内容**:
- 测试按钮点击处理
- 调用 TranslationService.testConnection()
- 显示测试结果（成功/失败/耗时）
- 更新节点状态

**验收标准**:
- [ ] 测试功能正常
- [ ] 结果显示清晰
- [ ] 错误信息友好

---

### T4.1 修改 api-client.js 使用 TranslationService

**目标**: 将现有翻译调用迁移到 TranslationService

**内容**:
- 修改 `translateText()` 函数
- 修改 `translateWithYoudao()` 函数
- 修改词典查询相关函数
- 保持接口兼容

**验收标准**:
- [ ] 现有功能不受影响
- [ ] 配置节点时使用新服务
- [ ] 无配置时降级正常

---

### T4.2 实现降级到内置免费服务逻辑

**目标**: 无配置或全部失败时降级到现有免费服务

**内容**:
- 检查降级开关
- 调用现有免费 API 逻辑
- 统一返回格式

**验收标准**:
- [ ] 降级逻辑正确
- [ ] 开关控制有效
- [ ] 返回格式统一

---

### T4.3 实现节点故障转移机制

**目标**: 节点失败时自动切换到下一个

**内容**:
- 失败检测
- 自动切换逻辑
- 失败节点临时标记
- 恢复检测（可选）

**验收标准**:
- [ ] 故障转移正常
- [ ] 不会无限重试
- [ ] 日志记录清晰

---

## Execution Order

建议执行顺序：

```
Phase 1: 基础架构
T1.1 → T1.2 → T2.6 → T2.1/T2.2/T2.3/T2.4/T2.5 (并行) → T1.3 → T1.4

Phase 2: 配置 UI
T3.1 → T3.2 → T3.3 → T3.4 → T3.5 → T3.6 → T3.7 → T3.8 → T3.9

Phase 3: 集成
T4.1 → T4.2 → T4.3 → T4.4 → T5.1

Phase 4: 测试
T5.2 → T5.3 → T5.4 → T5.5
```

## Estimated Effort

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1 | 10 tasks | 中等 |
| Phase 2 | 9 tasks | 中等 |
| Phase 3 | 5 tasks | 较小 |
| Phase 4 | 4 tasks | 较小 |
| **Total** | **28 tasks** | **中等** |
