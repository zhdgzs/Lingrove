/**
 * 翻译服务统一入口
 * 提供节点调度、故障转移和降级处理
 * @file translation-service.js
 */

/**
 * 翻译服务类
 * 单例模式，统一管理翻译请求
 */
class TranslationService {
  constructor() {
    // 失败节点临时标记（5分钟内不再尝试）
    this.failedNodes = new Map();
    this.failedNodeTimeout = 5 * 60 * 1000; // 5分钟

    // 速率限制追踪
    this.rateLimitTracker = new Map();
  }

  /**
   * 获取启用的节点列表
   * @returns {Promise<Array>} - 节点列表（按优先级排序）
   */
  async getEnabledNodes() {
    const nodes = await getTranslationNodes();
    return nodes.filter(node => node.enabled);
  }

  /**
   * 检查节点是否可用
   * @param {Object} node - 节点配置
   * @returns {boolean}
   */
  isNodeAvailable(node) {
    // 检查是否在失败列表中
    const failedTime = this.failedNodes.get(node.id);
    if (failedTime) {
      if (Date.now() - failedTime < this.failedNodeTimeout) {
        return false;
      }
      // 超时，移除失败标记
      this.failedNodes.delete(node.id);
    }

    // 检查速率限制
    if (node.rateLimit > 0) {
      const tracker = this.rateLimitTracker.get(node.id);
      if (tracker) {
        const now = Date.now();
        // 清理过期记录（1秒前的）
        while (tracker.length > 0 && now - tracker[0] > 1000) {
          tracker.shift();
        }
        if (tracker.length >= node.rateLimit) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 记录节点请求（用于速率限制）
   * @param {string} nodeId
   */
  recordRequest(nodeId) {
    if (!this.rateLimitTracker.has(nodeId)) {
      this.rateLimitTracker.set(nodeId, []);
    }
    this.rateLimitTracker.get(nodeId).push(Date.now());
  }

  /**
   * 标记节点失败
   * @param {string} nodeId
   */
  markNodeFailed(nodeId) {
    this.failedNodes.set(nodeId, Date.now());
    console.warn(`[TranslationService] Node ${nodeId} marked as failed`);
  }

  /**
   * 清除节点失败标记
   * @param {string} nodeId
   */
  clearNodeFailed(nodeId) {
    this.failedNodes.delete(nodeId);
  }

  /**
   * 统一翻译入口
   * @param {Object} request - 翻译请求
   * @returns {Promise<Object>} - 翻译结果
   */
  async translate(request) {
    const nodes = await this.getEnabledNodes();

    // 按优先级依次尝试可用节点
    for (const node of nodes) {
      if (!this.isNodeAvailable(node)) {
        console.log(`[TranslationService] Skipping unavailable node: ${node.name}`);
        continue;
      }

      try {
        // 记录请求
        this.recordRequest(node.id);

        // 创建适配器并翻译
        const adapter = createAdapter(node);
        const startTime = Date.now();
        const result = await adapter.translate(request);
        const latency = Date.now() - startTime;

        if (result.success) {
          console.log(`[TranslationService] ${node.name} succeeded in ${latency}ms`);
          // 成功后清除失败标记
          this.clearNodeFailed(node.id);
          return result;
        }

        // 翻译失败，记录并继续尝试下一个
        console.warn(`[TranslationService] ${node.name} failed:`, result.error);

        // 根据错误类型决定是否标记节点失败
        if (this.shouldMarkFailed(result.error?.code)) {
          this.markNodeFailed(node.id);
        }
      } catch (error) {
        console.error(`[TranslationService] ${node.name} error:`, error);
        this.markNodeFailed(node.id);
      }
    }

    // 所有节点失败，返回失败结果
    return createTranslationResult({
      success: false,
      provider: 'none',
      error: createTranslationError(
        TranslationErrorCode.ALL_FAILED,
        '所有翻译服务均不可用'
      )
    });
  }

  /**
   * 判断是否应该标记节点失败
   * @param {string} errorCode
   * @returns {boolean}
   */
  shouldMarkFailed(errorCode) {
    // 这些错误应该标记节点失败
    const failureCodes = [
      TranslationErrorCode.AUTH_FAILED,
      TranslationErrorCode.INVALID_API_KEY,
      TranslationErrorCode.QUOTA_EXCEEDED,
      TranslationErrorCode.SERVICE_UNAVAILABLE
    ];
    return failureCodes.includes(errorCode);
  }

  /**
   * 词典查询（优先使用支持词典的服务）
   * @param {string} word - 单词
   * @param {string} [from] - 源语言
   * @param {string} [to] - 目标语言
   * @returns {Promise<Object>} - 翻译结果（含词典信息）
   */
  async lookup(word, from = LanguageCode.AUTO, to = LanguageCode.ZH_CN) {
    const nodes = await this.getEnabledNodes();

    // 优先选择支持词典的节点
    const dictNodes = nodes.filter(node => {
      const capabilities = ProviderCapabilities[node.provider];
      return capabilities?.supportDict;
    });

    // 如果有支持词典的节点，优先使用
    if (dictNodes.length > 0) {
      // 临时调整节点顺序，词典节点优先
      const reorderedNodes = [...dictNodes, ...nodes.filter(n => !dictNodes.includes(n))];

      // 保存原始节点列表
      const originalGetEnabledNodes = this.getEnabledNodes.bind(this);
      this.getEnabledNodes = async () => reorderedNodes;

      try {
        return await this.translate({
          text: word,
          from,
          to,
          type: TranslationType.WORD,
          options: { needDict: true, needPhonetic: true }
        });
      } finally {
        // 恢复原始方法
        this.getEnabledNodes = originalGetEnabledNodes;
      }
    }

    // 没有词典节点，使用普通翻译
    return this.translate({
      text: word,
      from,
      to,
      type: TranslationType.WORD,
      options: { needDict: true, needPhonetic: true }
    });
  }

  /**
   * 测试节点连通性
   * @param {string} nodeId - 节点 ID
   * @returns {Promise<Object>} - 测试结果
   */
  async testConnection(nodeId) {
    const nodes = await getTranslationNodes();
    const node = nodes.find(n => n.id === nodeId);

    if (!node) {
      return {
        success: false,
        latency: 0,
        error: createTranslationError(
          TranslationErrorCode.INVALID_REQUEST,
          '节点不存在'
        )
      };
    }

    try {
      const adapter = createAdapter(node);
      const startTime = Date.now();
      const result = await adapter.testConnection();
      const latency = Date.now() - startTime;

      return {
        success: result.success,
        latency,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        latency: 0,
        error: createTranslationError(
          TranslationErrorCode.NETWORK_ERROR,
          error.message
        )
      };
    }
  }

  /**
   * 测试节点配置（不保存）
   * @param {Object} nodeConfig - 节点配置
   * @returns {Promise<Object>} - 测试结果
   */
  async testNodeConfig(nodeConfig) {
    try {
      const adapter = createAdapter(nodeConfig);
      const startTime = Date.now();
      const result = await adapter.testConnection();
      const latency = Date.now() - startTime;

      return {
        success: result.success,
        latency,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        latency: 0,
        error: createTranslationError(
          TranslationErrorCode.NETWORK_ERROR,
          error.message
        )
      };
    }
  }

  /**
   * 获取所有节点状态
   * @returns {Promise<Array>} - 节点状态列表
   */
  async getNodesStatus() {
    const nodes = await getTranslationNodes();
    return nodes.map(node => ({
      id: node.id,
      name: node.name,
      provider: node.provider,
      enabled: node.enabled,
      available: this.isNodeAvailable(node),
      lastTestResult: node.lastTestResult,
      lastTestTime: node.lastTestTime
    }));
  }

  /**
   * 重置所有失败标记
   */
  resetFailedNodes() {
    this.failedNodes.clear();
    console.log('[TranslationService] All failed node marks cleared');
  }
}

// 创建单例实例
const translationService = new TranslationService();

// ==================== 导出 ====================

// 如果在模块环境中
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TranslationService,
    translationService
  };
}
