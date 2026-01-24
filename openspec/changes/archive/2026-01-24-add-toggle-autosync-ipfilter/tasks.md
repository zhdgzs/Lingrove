# 实施任务清单

## 1. 翻译切换功能

- [ ] 1.1 在 `content/main.js` 添加 `L.isTranslated` 状态变量
- [ ] 1.2 实现 `L.toggleTranslation()` 函数
  - 检查 `isTranslated` 状态
  - true 时调用 `L.restoreAll()` 并设置为 false
  - false 时调用 `L.processPage()` 并设置为 true
- [ ] 1.3 修改 `content/event-handlers.js` 的 `processPage` 消息处理
  - 将 `L.processPage()` 改为 `L.toggleTranslation()`
- [ ] 1.4 测��切换功能
  - 验证 Alt+T 触发翻译
  - 验证再次按 Alt+T 恢复原文
  - 验证第三次按 Alt+T 重新显示翻译
  - 验证页面刷新后状态重置

## 2. 坚果云自动同步

- [ ] 2.1 在 `manifest.json` 添加 `alarms` 权限
- [ ] 2.2 在 `background.js` 实现自动同步逻辑
  - 创建 `autoSync` alarm（60 分钟周期）
  - 实现 `performAutoSync()` 函数
  - 生成文件名 `auto_sync_{YYYY-MM-DD}.json`
  - 检查今天的文件是否存在，存在则跳过
  - 不存在则：删除所有旧的 `auto_sync_*` 文件
  - 调用 `webdavUpload()` 上传今天的数据
  - 更新 `lastAutoSyncTime`
- [ ] 2.3 在 `options.html` 添加自动同步 UI
  - 添加 checkbox `autoSyncEnabled`
  - 添加帮助文本说明文件命名规则
- [ ] 2.4 在 `options.js` 实现配置保存/加载
  - 保存 `autoSyncEnabled` 到 `chrome.storage.sync`
  - 加载时恢复 checkbox 状态
- [ ] 2.5 测试自动同步功能
  - 启用开关后验证 alarm 创建
  - 模拟时间推进，验证上传逻辑
  - 验证文件命名为 `auto_sync_YYYY-MM-DD.json`
  - 验证今天已同步时跳过
  - 验证新文件创建时删除旧文件
  - 验证云端始终只有一个 `auto_sync_*` 文件

## 3. IP 地址过滤

- [ ] 3.1 在 `content/utils.js` 实现 `L.isIPAddress()` 函数
  - 支持 IPv4 格式（含端口）
  - 支持 IPv6 格式（含端口）
  - 支持 localhost（含端口）
- [ ] 3.2 在 `content/storage.js` 添加 `skipIPAddresses` 配置加载
- [ ] 3.3 修改 `content/main.js` 的 `processPage()` 函数
  - 在 excludedSites 检查前添加 IP 检测
  - 如果 `skipIPAddresses` 为 true 且是 IP 地址，返回 excluded
- [ ] 3.4 在 `options.html` 添加 IP 过滤 UI
  - 在排除站点区域添加 checkbox `skipIPAddresses`
  - 添加说明文本
- [ ] 3.5 在 `options.js` 实现配置保存/加载
  - 保存 `skipIPAddresses` 到 `chrome.storage.sync`
  - 加载时恢复 checkbox 状态
- [ ] 3.6 测试 IP 过滤功能
  - 访问 `http://localhost:3000`，验证不翻译
  - 访问 `http://192.168.1.1`，验证不翻译
  - 访问 `http://127.0.0.1:8080`，验证不翻译
  - 访问 `http://[::1]:3000`，验证不翻译
  - 关闭开关后验证正常翻译

## 4. 集成测试

- [ ] 4.1 验证三个功能互不干扰
- [ ] 4.2 验证配置持久化
- [ ] 4.3 验证多设备同步（如果启用自动同步）
- [ ] 4.4 验证性能影响（自动同步不应影响浏览体验）

## 5. 文档更新

- [ ] 5.1 更新 README.md，添加新功能说明
- [ ] 5.2 更新 TECHNICAL.md，添加技术实现细节
- [ ] 5.3 更新 i18n 文件（如需要）

## 依赖关系

- 任务 1、2、3 可并行开发
- 任务 4 依赖任务 1、2、3 完成
- 任务 5 依赖任务 4 完成

## 验收标准

- [ ] 所有测试用例通过
- [ ] 代码通过 lint 检查
- [ ] 无控制台错误或警告
- [ ] 配置正确保存和加载
- [ ] 功能符合设计文档描述
