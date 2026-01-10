# Design: translation-api-config

## Context

当前翻译功能硬编码依赖有道翻译 API，存在单点故障风险且无法满足用户对翻译质量和服务选择的需求。本设计引入可配置的多翻译服务支持，采用适配器模式统一不同 API 的差异。

### 约束条件
- 浏览器扩展环境，需通过 background script 代理跨域请求
- 需兼容现有翻译逻辑，无配置时保持原有行为
- API 密钥需安全存储

## Goals / Non-Goals

### Goals
- 支持多翻译服务提供商（谷歌、百度、腾讯云、有道、DeepL）
- 提供统一的适配层屏蔽 API 差异
- 支持节点优先级和自动故障转移
- 复用现有 AI 节点配置的 UI 模式

### Non-Goals
- 不支持自定义 API 端点
- 不实现翻译结果缓存（使用现有缓存）
- 不实现翻译质量自动评估

## Decisions

### Decision 1: 适配器模式

**选择**: 使用适配器模式（Adapter Pattern）统一各翻译 API

**理由**:
- 各提供商 API 格式差异大（签名算法、参数名、响应结构）
- 适配器模式允许独立扩展新提供商
- 上层调用方无需关心具体实现

**替代方案**:
- 策略模式：适合算法切换，但本场景更侧重接口适配
- 直接条件分支：难以维护，违反开闭原则

### Decision 2: 统一数据结构

**选择**: 定义 `TranslationRequest` 和 `TranslationResult` 统一结构

```javascript
// 统一请求
{
  text: string,
  from: LanguageCode,  // 'zh-CN' | 'en' | 'auto' | ...
  to: LanguageCode,
  type: 'word' | 'sentence',
  options: { needDict, needPhonetic }
}

// 统一响应
{
  success: boolean,
  provider: string,
  translation: string,
  dictionary?: DictionaryInfo,
  error?: { code, message }
}
```

**理由**: 解耦上层业务与底层 API 实现

### Decision 3: 语言代码映射

**选择**: 使用 ISO 639-1 为基础的统一编码，各适配器内部映射

| 统一编码 | 谷歌 | 百度 | 腾讯云 | 有道 | DeepL |
|----------|------|------|--------|------|-------|
| `zh-CN`  | `zh-CN` | `zh` | `zh` | `zh-CHS` | `ZH` |
| `en`     | `en` | `en` | `en` | `en` | `EN` |
| `ja`     | `ja` | `jp` | `ja` | `ja` | `JA` |

**理由**: 避免上层代码处理各提供商的编码差异

### Decision 4: 密钥存储

**选择**: 使用 Chrome Storage API 存储，敏感字段 Base64 编码（非加密）

**理由**:
- 浏览器扩展环境无法使用真正的加密（密钥无处存放）
- Base64 编码防止明文泄露，满足基本安全需求
- 用户已信任扩展访问其数据

**替代方案**:
- Web Crypto API 加密：需要用户输入主密码，体验差
- 不存储密钥：每次使用需重新输入，不实用

### Decision 5: 故障转移策略

**选择**: 顺序尝试 + 临时标记失败节点

```
节点列表: [A, B, C]
请求 → A 失败 → 标记 A 临时不可用 → B 成功 → 返回结果
下次请求 → 跳过 A（5分钟内）→ B → ...
```

**理由**:
- 避免重复尝试已知失败的节点
- 临时标记允许节点恢复后重新使用
- 简单有效，无需复杂的健康检查机制

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     上层调用方                               │
│              (api-client.js / event-handlers.js)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TranslationService                        │
│  - translate(request): 统一翻译入口                          │
│  - lookup(word): 词典查询（优先词典服务）                     │
│  - testConnection(nodeId): 连通性测试                        │
│  - 节点调度 + 故障转移 + 降级处理                            │
└─────────────────────────────────────────────────────────────┘
                              │
    ┌─────────────┬───────────┼───────────┬─────────────┐
    ▼             ▼           ▼           ▼             ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Google  │ │ Baidu   │ │ Tencent │ │ Youdao  │ │ DeepL   │
│ Adapter │ │ Adapter │ │ Adapter │ │ Adapter │ │ Adapter │
│         │ │         │ │         │ │         │ │         │
│ API Key │ │ MD5签名 │ │HMAC签名 │ │SHA256签名│ │ API Key │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

## File Structure

```
js/content/
├── translation-types.js      # 类型定义和常量
├── translation-adapters.js   # 适配器基类 + 各提供商实现
├── translation-service.js    # 统一服务入口
└── crypto-utils.js           # MD5/SHA256 签名工具

js/
└── options-translation.js    # 配置 UI 逻辑
```

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| API 密钥泄露 | 高 | Base64 编码存储，UI 脱敏显示 |
| 各服务 API 变更 | 中 | 模块化适配器，易于独立更新 |
| 跨域请求限制 | 中 | 通过 background script 代理 |
| 用户配置错误 | 低 | 连通性测试 + 详细错误提示 |

## Migration Plan

1. **Phase 1**: 新增翻译服务层，不影响现有逻辑
2. **Phase 2**: 添加配置 UI，用户可选配置
3. **Phase 3**: 修改 api-client.js 使用新服务层
4. **回滚**: 删除新文件，恢复 api-client.js 原有调用

## Open Questions

- [ ] 是否需要显示 API 配额使用情况（部分 API 支持）？
