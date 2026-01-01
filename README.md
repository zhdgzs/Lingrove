# Lingrove - 沉浸式语言学习 Chrome 插件

<p align="center">
  <img src="icons/icon.svg" width="128" height="128" alt="Lingrove Logo">
</p>

<p align="center">
  <strong>智能替换网页词汇，创造沉浸式双语学习环境</strong><br>
  <sub>基于「可理解性输入」理论，让语言学习融入日常生活</sub>
</p>

<p align="center">
  <a href="README_EN.md">English</a> | 中文
</p>

<p align="center">
  <img src="assets/demo.png" alt="Lingrove 演示" width="100%">
</p>

## 📸 功能展示

<p align="center">
  <img src="assets/demo2.png" alt="翻译效果展示" width="100%">
</p>

---

>
> 本项目基于 [VocabMeld](https://github.com/lzskyline/VocabMeld) 二次开发。
>
> 由于原项目存在一些问题，功能不完善且迭代更新较慢，故自行 fork 进行维护和功能改进。

---

## ✨ 核心亮点

- **多 LLM 支持** — 兼容 OpenAI、DeepSeek、Moonshot、Groq、Ollama 等主流 AI 服务
- **多节点故障转移** — 支持配置多个 API 节点，自动故障转移和速率限制轮询
- **智能语义分词** — 针对中文、英文等语言优化分词规则，准确识别词组和短语
- **提示词自定义** — 支持自定义 AI 提示词规则，优化翻译效果
- **CEFR 六级难度** — 精准控制学习词汇难度（A1-C2），只学你需要的
- **智能缓存加速** — LRU 缓存（最高 10000 词），二次访问毫秒级响应
- **双向翻译** — 自动检测页面语言，智能决定翻译方向
- **词汇管理** — 已学会词汇不再替换，需记忆词汇随时复习
- **主题定制** — 深色/浅色模式，多种配色方案可选

---

## 🚀 快速开始

### 安装

#### 方式一：从 Release 安装（推荐）

1. 前往 [Releases 页面](https://github.com/zhdgzs/Lingrove/releases) 下载最新版本的 zip 文件
2. 解压下载的 zip 文件到本地目录
3. 打开 Chrome，访问 `chrome://extensions/`
4. 开启右上角"开发者模式"
5. 点击"加载已解压的扩展程序"，选择解压后的文件夹

#### 方式二：从源码安装

1. 克隆本仓库：`git clone https://github.com/zhdgzs/Lingrove.git`
2. 安装依赖并构建：`npm install && npm run build`
3. 打开 Chrome，访问 `chrome://extensions/`
4. 开启"开发者模式"
5. 点击"加载已解压的扩展程序"，选择项目文件夹

### 配置 API

1. 点击扩展图标 → 设置
2. 选择预设服务（**推荐魔搭社区**，免费额度充足）或自定义配置
3. 填入 API 密钥，测试连接

<p align="center">
  <img src="assets/setting-api.png" alt="API 配置界面" width="80%">
</p>

> **魔搭社区使用说明**：
>
> 魔搭社区单账号每天 2000 次总额度，但单模型限制 500 次。可以配置 4 个节点使用不同模型（如 DeepSeek-V3、DeepSeek-V3.2、Qwen2.5-72B、Qwen3-235B），充分利用 2000 次额度
> 
> 必须选择支持"推理 API-Inference"的模型才可使用，如下图所示：
>
> <p align="center">
>   <img src="assets/modelscope.png" alt="魔搭社区模型选择" width="80%">
> </p>

### 支持的 API 服务

| 服务商 | 端点 | 推荐模型 | 备注 |
|--------|------|----------|------|
| **魔搭社区** ⭐ | `https://api-inference.modelscope.cn/v1/chat/completions` | deepseek-ai/DeepSeek-V3.2 | 免费额度充足，推荐 |
| DeepSeek | `https://api.deepseek.com/chat/completions` | deepseek-chat | |
| OpenAI | `https://api.openai.com/v1/chat/completions` | gpt-4o-mini | |
| Moonshot | `https://api.moonshot.cn/v1/chat/completions` | moonshot-v1-8k | |
| Groq | `https://api.groq.com/openai/v1/chat/completions` | llama-3.1-8b-instant | |
| Ollama | `http://localhost:11434/v1/chat/completions` | qwen2.5:7b | 本地部署 |

---

## 📖 使用技巧

| 操作 | 说明 |
|------|------|
| `Alt+T` | 快速处理当前页面 |
| 悬停词汇 | 查看音标、难度、词典释义 |
| 点击音标 | 播放发音 |
| 点击"已学会" | 该词不再替换 |
| 点击"收藏记忆" | 加入记忆列表 |
| 选中生词 | 添加到需记忆列表 |

**推荐配置**：母语中文 + 学习英语 + B1 难度 + 适中强度

---

## 🔧 功能概览

### 替换强度

| 强度 | 每段最大替换 | 适用场景 |
|------|-------------|----------|
| 较少 | 4 词 | 轻度学习，保持阅读流畅 |
| 适中 | 8 词 | 日常学习，平衡阅读与学习 |
| 较多 | 14 词 | 强化学习，最大化词汇接触 |

### 显示样式

| 样式 | 显示格式 |
|------|---------|
| 译文(原文) | `translated(original)` — 默认 |
| 仅译文 | `translated` — 悬停查看原文 |
| 原文(译文) | `original(translated)` |

### 站点规则

- **所有网站模式**：默认在所有网站运行，可设置排除列表
- **仅指定网站模式**：只在指定的网站上运行
- 支持域名模糊匹配，Popup 中快速切换

### 提示词设置

支持自定义 AI 翻译提示词，优化语义分词和翻译效果：

- **分层架构** — 核心规则 + 源语言规则 + 目标语言规则 + 自定义规则
- **智能语义分词** — 针对不同语言优化分词策略：
  - 中文：按语义边界识别，避免「对方面无表情」被错误切分为「方面」
  - 英文：识别短语动词（give up、look forward to）和固定搭配
- **规则可编辑** — 源语言和目标语言规则支持自定义修改
- **完整预览** — 可预览发送给 AI 的完整提示词，包含所有动态参数

<p align="center">
  <img src="assets/setting-prompt.png" alt="提示词设置界面" width="80%">
</p>

### 多节点管理

支持配置多个 API 节点，实现智能故障转移和负载均衡：

- **多节点配置** — 支持配置多个节点，每个节点可独立设置端点、密钥、模型和启用/关闭状态
- **自定义优先级** — 可以按照顺序，配置节点优先级，优先使用最优节点
- **自动故障转移** — 节点失败（网络异常、服务不可用、额度耗尽、RPM限制）时自动切换下一个
- **速率限制轮询** — 多节点轮流处理请求，突破单节点 RPM 限制
- **健康检查** — 5 分钟内 3 次失败标记异常，定期自动恢复

**典型场景**：
- 不够用，可以申请多个魔搭社区账号（每天 2000 次/账号），配置轮询叠加免费额度
- 配置不同服务商（DeepSeek + 魔搭）互为备份，提升可用性
- 免费节点优先，额度用完自动切换付费节点兜底

---

## 🔒 隐私政策

- **本地存储**：所有数据存储在浏览器本地，不上传任何服务器
- **API 请求**：仅在翻译时发送文本片段到您配置的 AI 服务
- **您控制一切**：API 密钥由您自行提供和管理
- **无追踪**：不包含任何分析、追踪或广告代码

---

## 📚 更多文档

- [技术文档](TECHNICAL.md) — 项目架构、核心算法、开发说明

---

## 📈 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=zhdgzs/Lingrove&type=Date)](https://star-history.com/#zhdgzs/Lingrove&Date)

---

## 📄 开源许可

本项目基于 [MIT License](LICENSE) 开源。

你可以自由地使用、复制、修改、分发本项目，包括商业用途。唯一要求是保留原版权声明和许可证。

原项目：[VocabMeld](https://github.com/lzskyline/VocabMeld)

---

## ☕ 赞赏支持

<p align="center">
  <img src="assets/sponsor.png" alt="赞赏码" width="300">
</p>
