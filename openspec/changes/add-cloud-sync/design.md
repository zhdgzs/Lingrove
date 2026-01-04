## Context

Lingrove 是一款 Chrome 浏览器扩展，当前支持本地导入/导出 JSON 格式的备份数据。用户希望能够通过云服务同步数据，首选坚果云（国内用户友好，支持 WebDAV 协议）。后续可能扩展支持其他云服务。

**约束条件：**
- Chrome Extension Manifest V3 限制：Content Script 无法直接发起跨域请求
- 坚果云 WebDAV 需要应用密码（非账户密码）
- 同步数据格式需与现有导出格式兼容

## Goals / Non-Goals

**Goals:**
- 提供同步方式选择器，预留扩展能力（首期仅坚果云）
- 支持坚果云 WebDAV 手动上传/下载数据
- 提供清晰的配置界面和状态反馈
- 复用现有导出数据格式，保持兼容性
- 支持查看云端备份文件列表

**Non-Goals:**
- 本阶段不支持其他云服务（百度云盘、OneDrive 等）
- 不实现自动同步（用户手动触发）
- 不实现增量同步（每次全量同步）
- 不实现冲突解决（以用户选择为准：覆盖本地或覆盖云端）

## Decisions

### 1. WebDAV 请求通过 Background Script 代理

**决定：** 所有 WebDAV 请求通过 `chrome.runtime.sendMessage` 发送到 Background Script，由其代理执行。

**原因：**
- Content Script 和 Options 页面受 CORS 限制
- Background Script (Service Worker) 可以使用 `fetch` 发起跨域请求
- 统一管理请求，便于错误处理和重试

### 2. 凭据存储在 chrome.storage.sync

**决定：** WebDAV 配置（服务器地址、用户名、密码）存储在 `chrome.storage.sync`。

**原因：**
- 配置数据量小，不会超过 sync 配额
- 用户在同一 Chrome 账户的不同设备可共享配置
- 密码使用 Base64 编码存储（非加密，但避免明文）

### 3. 同步文件命名带时间戳

**决定：** 同步文件命名为 `Lingrove-data-{datetime}.json`，存储在 `/Lingrove/` 目录下。

**原因：**
- 保留历史备份，用户可选择恢复到特定时间点
- 避免单文件覆盖导致数据丢失
- datetime 格式：`YYYYMMDD-HHmmss`（如 `Lingrove-data-20260104-163000.json`）

### 4. 同步数据格式复用导出格式

**决定：** 同步的 JSON 数据结构与现有 `exportData` 完全一致。

**原因：**
- 减少代码重复
- 用户可以手动下载云端文件作为备份
- 便于调试和问题排查

### 5. 同步方式选择器预留扩展

**决定：** UI 提供同步方式下拉选择器，首期仅显示"坚果云"选项。

**原因：**
- 为后续扩展（百度云盘、WebDAV 通用等）预留接口
- 不同云服务可能有不同的配置项和认证方式

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Options Page                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  云同步设置区域                                       │    │
│  │  - 同步方式选择器 [坚果云 ▼]                         │    │
│  │  - WebDAV 服务器地址（坚果云默认填充）               │    │
│  │  - 用户名 / 应用密码                                 │    │
│  │  - 测试连接按钮                                      │    │
│  │  - 上传到云端 / 从云端下载 按钮                      │    │
│  │  - 云端备份列表（显示已有备份文件）                  │    │
│  │  - 同步状态显示                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           │ chrome.runtime.sendMessage       │
│                           ▼                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Background Script                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  WebDAV 代理服务                                     │    │
│  │  - webdavTest: 测试连接                             │    │
│  │  - webdavUpload: 上传数据                           │    │
│  │  - webdavList: 列出备份文件                         │    │
│  │  - webdavDownload: 下载指定文件                     │    │
│  │  - webdavDelete: 删除指定文件（可选）               │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           │ fetch (跨域)                     │
│                           ▼                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              坚果云 WebDAV 服务器                             │
│              https://dav.jianguoyun.com/dav/                │
│              /Lingrove/                                      │
│                ├── Lingrove-data-20260104-163000.json       │
│                ├── Lingrove-data-20260103-120000.json       │
│                └── ...                                       │
└─────────────────────────────────────────────────────────────┘
```

## API Design

### Background Script 消息接口

```javascript
// 测试 WebDAV 连接
{ action: 'webdavTest', server, username, password }
// 返回: { success: boolean, message?: string }

// 上传数据到 WebDAV（自动生成带时间戳的文件名）
{ action: 'webdavUpload', server, username, password, data }
// 返回: { success: boolean, filename?: string, message?: string }

// 列出云端备份文件
{ action: 'webdavList', server, username, password }
// 返回: { success: boolean, files?: Array<{name, size, lastModified}>, message?: string }

// 从 WebDAV 下载指定文件
{ action: 'webdavDownload', server, username, password, filename }
// 返回: { success: boolean, data?: object, message?: string }

// 删除云端备份文件（可选功能）
{ action: 'webdavDelete', server, username, password, filename }
// 返回: { success: boolean, message?: string }
```

### 存储结构

```javascript
// chrome.storage.sync 新增字段
{
  cloudSync: {
    provider: 'jianguoyun',   // 云服务提供商（预留扩展）
    server: 'https://dav.jianguoyun.com/dav/',
    username: '',
    password: '',             // Base64 编码
    lastSyncTime: null,       // 上次同步时间戳
    lastSyncType: null,       // 上次同步类型：'upload' | 'download'
    lastSyncStatus: null      // 上次同步状态：'success' | 'failed'
  }
}
```

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 密码明文存储 | 安全性较低 | 使用 Base64 编码，提示用户使用应用密码而非账户密码 |
| 网络请求失败 | 同步中断 | 显示详细错误信息，支持手动重试 |
| 数据覆盖冲突 | 数据丢失 | 下载前提示确认，显示云端文件时间戳 |
| 坚果云服务不可用 | 功能不可用 | 提供测试连接功能，错误时给出排查建议 |
| 备份文件过多 | 占用云端空间 | 显示文件列表，用户可手动删除旧备份 |

## Open Questions

1. ~~是否需要支持自动同步？~~ → 不需要，用户手动触发
2. ~~同步冲突如何处理？~~ → 用户手动选择覆盖方向
3. 是否需要限制备份文件数量？ → 暂不限制，用户自行管理
