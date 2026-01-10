## ADDED Requirements

### Requirement: 翻译 API 节点配置

系统 SHALL 支持用户配置多个翻译 API 节点，每个节点包含服务提供商、认证信息和速率限制。

#### Scenario: 添加翻译节点
- **WHEN** 用户点击"添加节点"按钮
- **THEN** 系统显示节点编辑弹窗
- **AND** 用户可选择翻译服务（谷歌翻译、百度翻译、腾讯云翻译、有道智云、DeepL）
- **AND** 用户可输入对应的认证信息（API Key/Secret）
- **AND** 用户可设置速率限制（QPS）

#### Scenario: 编辑翻译节点
- **WHEN** 用户点击节点的"编辑"按钮
- **THEN** 系统显示预填充的节点编辑弹窗
- **AND** 用户可修改节点配置
- **AND** 保存后立即生效

#### Scenario: 删除翻译节点
- **WHEN** 用户点击节点的"删除"按钮
- **THEN** 系统请求确认
- **AND** 确认后从列表中移除该节点

#### Scenario: 节点优先级排序
- **WHEN** 用户拖拽节点卡片
- **THEN** 系统更新节点顺序
- **AND** 翻译时按新顺序依次尝试

### Requirement: 翻译服务提供商适配

系统 SHALL 通过统一适配层支持多个翻译服务提供商，屏蔽各 API 的差异。

#### Scenario: 谷歌翻译适配
- **WHEN** 用户配置谷歌翻译节点
- **THEN** 系统使用 API Key 进行认证
- **AND** 正确映射语言代码

#### Scenario: 百度翻译适配
- **WHEN** 用户配置百度翻译节点
- **THEN** 系统使用 APP ID + Secret Key + MD5 签名进行认证
- **AND** 正确映射语言代码（如 zh-CN → zh）

#### Scenario: 腾讯云翻译适配
- **WHEN** 用户配置腾讯云翻译节点
- **THEN** 系统使用 SecretId + SecretKey + HMAC-SHA256 签名进行认证
- **AND** 正确映射语言代码

#### Scenario: 有道智云适配
- **WHEN** 用户配置有道智云节点
- **THEN** 系统使用 App Key + App Secret + SHA256 签名进行认证
- **AND** 支持词典功能和音标提取

#### Scenario: DeepL 适配
- **WHEN** 用户配置 DeepL 节点
- **THEN** 系统使用 API Key 进行认证
- **AND** 自动区分 Free/Pro API 端点

### Requirement: 连通性测试

系统 SHALL 提供翻译节点的连通性测试功能。

#### Scenario: 测试节点连接
- **WHEN** 用户点击"测试连接"按钮
- **THEN** 系统发送测试请求到对应翻译 API
- **AND** 显示测试结果（成功/失败/耗时）
- **AND** 更新节点状态标识

#### Scenario: 测试失败处理
- **WHEN** 连通性测试失败
- **THEN** 系统显示具体错误信息（如认证失败、配额用尽）
- **AND** 节点状态标记为"失败"

### Requirement: 自动故障转移

系统 SHALL 在翻译节点失败时自动切换到下一个可用节点。

#### Scenario: 节点故障转移
- **WHEN** 当前翻译节点请求失败
- **THEN** 系统自动尝试下一优先级节点
- **AND** 记录失败日志
- **AND** 临时标记失败节点

#### Scenario: 所有节点失败
- **WHEN** 所有配置的翻译节点均失败
- **THEN** 系统根据降级开关决定是否使用内置免费服务
- **AND** 向用户显示适当的错误提示

### Requirement: 降级策略

系统 SHALL 在无配置或全部失败时支持降级到内置免费翻译服务。

#### Scenario: 无配置降级
- **WHEN** 用户未配置任何翻译节点
- **AND** 降级开关已启用
- **THEN** 系统使用内置免费翻译服务

#### Scenario: 禁用降级
- **WHEN** 用户关闭降级开关
- **AND** 所有配置节点均不可用
- **THEN** 系统返回错误提示而非使用免费服务

### Requirement: 翻译节点数据存储

系统 SHALL 安全存储翻译节点配置，包括加密存储敏感信息。

#### Scenario: 节点配置存储
- **WHEN** 用户保存翻译节点配置
- **THEN** 系统将配置存储到本地存储
- **AND** API 密钥等敏感信息加密存储

#### Scenario: 密钥脱敏显示
- **WHEN** 用户查看节点列表
- **THEN** 系统仅显示部分密钥信息（如 abc***）
- **AND** 完整密钥仅在编辑时可见（可选显示）
