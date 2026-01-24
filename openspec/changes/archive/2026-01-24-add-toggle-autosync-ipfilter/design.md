# 技术设计文档

## 背景

Lingrove 是一款 Chrome 浏览器扩展（Manifest V3），提供沉浸式语言学习功能。本次变更添加三个独立的用户体验增强功能。

## 功能 1：翻译切换（Alt+T）

### 当前实现

- `manifest.json` 中定义了 `toggle-translation` 命令，绑定 Alt+T
- `background.js:778` 监听命令，发送 `processPage` 消息到 content script
- `content/main.js:315` 的 `processPage()` 函数触发翻译流程
- 翻译后的元素用 `.lingrove-translated` 类标记，`data-original` 属性存储原文

### 设计方案

#### 状态管理
在 content script 中维护全局状态 `L.isTranslated`（布尔值），表示当前页面是否处于翻译状态。

#### 切换逻辑
```javascript
// content/main.js
L.toggleTranslation = function() {
  if (L.isTranslated) {
    // 恢复原文：调用现有的 restoreAll()
    L.restoreAll();
    L.isTranslated = false;
  } else {
    // 显示翻译：调用 processPage()
    L.processPage();
    L.isTranslated = true;
  }
};
```

#### 消息处理
修改 `event-handlers.js` 中的消息监听：
```javascript
if (message.action === 'processPage') {
  L.toggleTranslation().then(sendResponse);
}
```

#### 页面刷新行为
- 页面刷新后，`L.isTranslated` 重置为 `false`
- 根据 `L.config.autoProcess` 决定是否自动翻译
- 不需要持久化状态，符合"仅限当次"的需求

### 优势
- **零 API 调用**：切换时不重新请求翻译，使用已缓存的 DOM 数据
- **即时响应**：DOM 操作速度快，用户体验流畅
- **代码复用**：利用现有的 `restoreAll()` 和 `processPage()` 函数

## 功能 2：坚果云自动同步

### 当前实现

- `background.js` 已实现 WebDAV 相关函数（`webdavUpload`, `webdavList` 等）
- `options.js` 提供手动上传/下载界面
- 文件命名格式：`Lingrove-data-{YYYYMMDD-HHmmss}.json`

### 设计方案

#### 配置存储
在 `chrome.storage.sync` 中添加：
```javascript
{
  cloudSync: {
    autoSyncEnabled: false,  // 自动同步开关
    lastAutoSyncTime: null   // 上次自动同步时间戳
  }
}
```

#### 定时器实现
使用 Chrome Alarms API（需要在 `manifest.json` 添加 `alarms` 权限）：

```javascript
// background.js
chrome.alarms.create('autoSync', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'autoSync') {
    chrome.storage.sync.get(['cloudSync'], (result) => {
      if (result.cloudSync?.autoSyncEnabled) {
        performAutoSync();
      }
    });
  }
});

async function performAutoSync() {
  const { cloudSync } = await chrome.storage.sync.get(['cloudSync']);
  const { server, username, password } = cloudSync;

  // 生成今天的文件名
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `auto_sync_${today}.json`;

  // 检查今天的文件是否已存在
  const files = await webdavList(server, username, password);
  if (files.some(f => f.name === filename)) {
    console.log('[Lingrove] Auto sync already done today, skipping');
    return;
  }

  // 删除所有旧的自动同步文件
  const oldAutoSyncFiles = files.filter(f => f.name.startsWith('auto_sync_') && f.name !== filename);
  for (const oldFile of oldAutoSyncFiles) {
    await webdavDelete(server, username, password, oldFile.name);
  }

  // 收集数据并上传今天的文件
  const data = await collectAllData();
  await webdavUpload(server, username, password, data, filename);

  // 更新上次同步时间
  await chrome.storage.sync.set({
    cloudSync: { ...cloudSync, lastAutoSyncTime: Date.now() }
  });
}
```

#### 文件命名规则
- **手动同步**：`Lingrove-data-{YYYYMMDD-HHmmss}.json`（保持不变）
- **自动同步**：`auto_sync_{YYYY-MM-DD}.json`（每天一个文件，自动清理旧文件）

#### 同步策略
- 每小时检查一次
- 如果今天的文件已存在，跳过本次同步
- 如果今天的文件不存在：
  1. 删除所有旧的 `auto_sync_*` 文件
  2. 创建今天的新文件
- 始终只保留一个最新的自动同步文件

#### UI 控件
在 `options.html` 的云同步区域添加：
```html
<div class="form-group">
  <label>
    <input type="checkbox" id="autoSyncEnabled">
    启用自动同步（每小时）
  </label>
  <p class="help-text">自动同步文件命名为 auto_sync_YYYY-MM-DD.json，每天同步一次，自动清理旧文件</p>
</div>
```

### 优势
- **非侵入式**：默认关闭，不影响现有用户
- **可靠性**：使用 Chrome Alarms API，即使浏览器重启也能恢复
- **节省空间**：自动清理旧文件，始终只保留一个最新文件
- **避免重复**：每天只同步一次，避免浪费配额

## 功能 3：跳过 IP 地址

### 当前实现

- `content/main.js:320` 检查 `excludedSites` 数组
- `options.html:937` 提供排除站点输入框

### 设计方案

#### IP 地址检测
添加工具函数：
```javascript
// content/utils.js
L.isIPAddress = function(hostname) {
  // IPv4 正则（包括端口）
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;

  // IPv6 正则（简化版，包括 [::1] 格式）
  const ipv6Regex = /^\[?([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\]?(:\d+)?$/;

  // localhost 特殊处理
  if (hostname === 'localhost' || hostname.startsWith('localhost:')) {
    return true;
  }

  return ipv4Regex.test(hostname) || ipv6Regex.test(hostname);
};
```

#### 配置存储
在 `chrome.storage.sync` 中添加：
```javascript
{
  skipIPAddresses: false  // 跳过 IP 地址开关
}
```

#### 过滤逻辑
修改 `content/main.js` 的 `processPage()` 函数：
```javascript
L.processPage = async function(viewportOnly = true) {
  if (!L.config?.enabled) return { processed: 0, disabled: true };

  const hostname = window.location.hostname;

  // 检查 IP 地址过滤
  if (L.config.skipIPAddresses && L.isIPAddress(hostname)) {
    return { processed: 0, excluded: true, reason: 'ip-address' };
  }

  // 原有的 excludedSites 检查
  if (L.config.siteMode === 'all') {
    if (L.config.excludedSites?.some(domain => hostname.includes(domain))) {
      return { processed: 0, excluded: true };
    }
  }
  // ...
};
```

#### UI 控件
在 `options.html` 的排除站点区域添加：
```html
<div class="form-group">
  <label>
    <input type="checkbox" id="skipIPAddresses">
    跳过所有 IP 地址（包括 localhost、192.168.x.x、IPv6 等）
  </label>
</div>
```

### 优势
- **简化配置**：一键跳过所有 IP，无需逐个添加
- **覆盖全面**：支持 IPv4、IPv6、localhost、带端口的地址
- **独立开关**：不影响现有的 excludedSites 功能

## 数据流图

### 翻译切换流程
```
用户按 Alt+T
    ↓
background.js 监听命令
    ↓
发送 processPage 消息
    ↓
content script 接收
    ↓
调用 toggleTranslation()
    ↓
检查 isTranslated 状态
    ├─ true → restoreAll() → 显示原文
    └─ false → processPage() → 显示翻译
```

### 自动同步流程
```
Chrome Alarms 每小时触发
    ↓
检查 autoSyncEnabled
    ↓
生成文件名 auto_YYYY-MM-DD.json
    ↓
检查文件是否存在
    ├─ 存在 → 跳过
    └─ 不存在 → 收集数据 → 上传
```

### IP 过滤流程
```
processPage() 调用
    ↓
获取 hostname
    ↓
检查 skipIPAddresses 开关
    ↓
调用 isIPAddress(hostname)
    ├─ true → 返回 excluded
    └─ false → 继续正常流程
```

## 兼容性考虑

### Manifest V3 权限
需要在 `manifest.json` 添加：
```json
{
  "permissions": [
    "storage",
    "activeTab",
    "contextMenus",
    "tts",
    "alarms"  // 新增
  ]
}
```

### 向后兼容
- 所有新功能默认关闭，不影响现有用户
- 配置项缺失时使用默认值（`false`）
- 不修改现有数据结构，仅添加新字段

## 测试策略

### 翻译切换
- [ ] 按 Alt+T 触发翻译
- [ ] 再次按 Alt+T 恢复原文
- [ ] 第三次按 Alt+T 重新显示翻译（使用缓存）
- [ ] 刷新页面后状态重置

### 自动同步
- [ ] 启用自动同步开关
- [ ] 等待 1 小时后检查文件是否上传
- [ ] 同一天内再次触发，验证跳过逻辑
- [ ] 关闭开关后验证不再同步

### IP 过滤
- [ ] 访问 `http://localhost:3000`，验证不翻译
- [ ] 访问 `http://192.168.1.1`，验证不翻译
- [ ] 访问 `http://[::1]:8080`，验证不翻译
- [ ] 关闭开关后验证正常翻译

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 自动同步消耗配额 | 中 | 默认关闭，用户主动启用 |
| IP 正则匹配错误 | 低 | 使用严格的正则，覆盖常见格式 |
| 切换状态不一致 | 低 | 页面刷新时重置状态 |
| Alarms 权限被拒 | 低 | 权限为标准权限，不需要用户授权 |
