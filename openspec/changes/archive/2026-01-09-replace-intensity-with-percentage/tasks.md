# Tasks: 用百分比替换固定强度配置

## 实施顺序

### Phase 0: 清理旧逻辑（先删后建）
- [x] 0.1 删除 `constants.js` 中的旧配置
  - 删除 `INTENSITY_CONFIG`
  - 删除 `MAX_SEGMENTS_PER_BATCH`
  - 删除 `MAX_SEGMENTS_PER_REQUEST`
  - 删除 `REQUEST_INTERVAL_MS`
- [x] 0.2 删除 `api-client.js` 中的旧逻辑
  - 删除 `maxPerParagraph` 相关计算
  - 删除 `targetCount` 和 `maxCount` 参数
  - 删除 `cacheSatisfied` 相关逻辑
- [x] 0.3 删除 `main.js` 中的旧批处理逻辑
  - 删除旧的段落收集和批处理代码
- [x] 0.4 删除 `prompt-rules.js` 中的旧提示词
  - 删除 `targetCount` 和 `maxCount` 参数
- [x] 0.5 删除 `options.js` 和 `options.html` 中的旧配置
  - 删除"替换强度"相关 UI 和逻辑

### Phase 1: 配置层重建
- [x] 1.1 新增 `constants.js` 中的配置常量
  - 新增 `DENSITY_PRESETS` (10%, 30%, 50%, 70%)
  - 新增 `TARGET_BATCH_SIZE = 1000`
  - 新增 `MAX_BATCH_SIZE = 1200`
  - 新增 `MIN_BATCH_SIZE = 100`
- [x] 1.2 设置默认配置
  - `translationDensity` 默认值：30

### Phase 2: 核心逻辑实现
- [x] 2.1 实现 `api-client.js` 新翻译逻辑
  - 只传递百分比给 AI
  - 移除词汇数量计算
  - 修复 bug：使用 `getMinTextLength()` 替代硬编码 50
- [x] 2.2 实现 `main.js` 智能文本分块
  - 按 DOM 段落拼接
  - 目标 1000 字符，上限 1200 字符
  - 不在段落中间切分
  - 保持可视区域优先加载机制
- [x] 2.3 更新 `prompt-rules.js` 提示词
  - 修改 `buildTranslationPrompt` 函数
  - 只传递百分比参数
  - AI 自行决定翻译词汇数量

### Phase 3: UI 实现
- [x] 3.1 更新 `options.html` 配置界面
  - 将"替换强度"改为"翻译密度"
  - 预设档位：10% / 30% / 50% / 70%
  - 支持自定义输入（1-100%）
- [x] 3.2 更新 `options.js` 配置逻辑
  - 处理新的百分比配置
  - 实现配置保存和加载
  - 验证自定义输入值

### Phase 4: 测试与验证
- [ ] 4.1 功能测试
  - 测试不同百分比下的翻译效果
  - 验证文本分块不超过 1200 字符
  - 验证段落语义完整性
- [ ] 4.2 边界测试
  - 测试自定义百分比值（1%, 50%, 100%）
  - 验证中英文文本处理
  - 测试超长段落处理
- [ ] 4.3 性能测试
  - 验证翻译质量未下降
  - 检查 API 调用频率是否合理

## 验证标准

每个任务完成后需验证：
- ✅ 代码通过 lint 检查
- ✅ 功能符合预期行为
- ✅ 无回归问题
- ✅ 性能无明显下降

## 依赖关系

- Phase 1 依赖 Phase 0 完成
- Phase 2 依赖 Phase 1 完成
- Phase 3 依赖 Phase 2 完成
- Phase 4 依赖 Phase 3 完成

## 预估工作量

- Phase 0: 1 小时
- Phase 1: 1 小时
- Phase 2: 3 小时
- Phase 3: 2 小时
- Phase 4: 2 小时

总计：约 9 小时
