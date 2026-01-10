/**
 * 翻译功能类型定义和常量
 * @file translation-types.js
 */

// ==================== 语言编码常量 ====================

/**
 * 统一语言编码（ISO 639-1 为基础）
 */
const LanguageCode = {
  ZH_CN: 'zh-CN',   // 简体中文
  ZH_TW: 'zh-TW',   // 繁体中文
  EN: 'en',         // 英语
  JA: 'ja',         // 日语
  KO: 'ko',         // 韩语
  FR: 'fr',         // 法语
  DE: 'de',         // 德语
  ES: 'es',         // 西班牙语
  AUTO: 'auto'      // 自动检测
};

/**
 * 翻译服务提供商
 */
const TranslationProvider = {
  GOOGLE: 'google',
  BAIDU: 'baidu',
  TENCENT: 'tencent',
  YOUDAO: 'youdao',
  DEEPL: 'deepl'
};

/**
 * 翻译类型
 */
const TranslationType = {
  WORD: 'word',       // 单词翻译
  SENTENCE: 'sentence' // 句子翻译
};

/**
 * 节点测试状态
 */
const NodeTestStatus = {
  SUCCESS: 'success',
  FAILED: 'failed',
  UNTESTED: 'untested'
};

// ==================== 错误码常量 ====================

/**
 * 翻译错误码
 */
const TranslationErrorCode = {
  // 通用错误
  UNKNOWN: 'UNKNOWN',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMIT: 'RATE_LIMIT',
  ALL_FAILED: 'ALL_FAILED',

  // 认证错误
  AUTH_FAILED: 'AUTH_FAILED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // 请求错误
  INVALID_REQUEST: 'INVALID_REQUEST',
  TEXT_TOO_LONG: 'TEXT_TOO_LONG',
  UNSUPPORTED_LANGUAGE: 'UNSUPPORTED_LANGUAGE',

  // 服务错误
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  PROVIDER_ERROR: 'PROVIDER_ERROR'
};

/**
 * 错误码对应的用户友好消息
 */
const TranslationErrorMessages = {
  [TranslationErrorCode.UNKNOWN]: '未知错误',
  [TranslationErrorCode.NETWORK_ERROR]: '网络连接失败',
  [TranslationErrorCode.TIMEOUT]: '请求超时',
  [TranslationErrorCode.RATE_LIMIT]: '请求频率超限',
  [TranslationErrorCode.ALL_FAILED]: '所有翻译服务均不可用',
  [TranslationErrorCode.AUTH_FAILED]: '认证失败',
  [TranslationErrorCode.INVALID_API_KEY]: 'API 密钥无效',
  [TranslationErrorCode.QUOTA_EXCEEDED]: '配额已用尽',
  [TranslationErrorCode.INVALID_REQUEST]: '请求参数无效',
  [TranslationErrorCode.TEXT_TOO_LONG]: '文本过长',
  [TranslationErrorCode.UNSUPPORTED_LANGUAGE]: '不支持的语言',
  [TranslationErrorCode.SERVICE_UNAVAILABLE]: '服务暂时不可用',
  [TranslationErrorCode.PROVIDER_ERROR]: '翻译服务内部错误'
};

// ==================== 提供商配置 ====================

/**
 * 提供商能力声明
 */
const ProviderCapabilities = {
  [TranslationProvider.GOOGLE]: {
    name: '谷歌翻译',
    supportedLanguages: [LanguageCode.ZH_CN, LanguageCode.ZH_TW, LanguageCode.EN, LanguageCode.JA, LanguageCode.KO, LanguageCode.FR, LanguageCode.DE, LanguageCode.ES],
    supportDict: false,
    supportPhonetic: false,
    supportDetect: true,
    maxTextLength: 5000,
    defaultQps: 10,
    authFields: ['apiKey'],
    freeQuota: '50万字符/月',
    docUrl: 'https://cloud.google.com/translate/pricing?hl=zh-cn'
  },
  [TranslationProvider.BAIDU]: {
    name: '百度翻译',
    supportedLanguages: [LanguageCode.ZH_CN, LanguageCode.ZH_TW, LanguageCode.EN, LanguageCode.JA, LanguageCode.KO, LanguageCode.FR, LanguageCode.DE, LanguageCode.ES],
    supportDict: false,
    supportPhonetic: false,
    supportDetect: true,
    maxTextLength: 6000,
    defaultQps: 10,
    authFields: ['appId', 'secretKey'],
    freeQuota: '100万字符/月（个人认证）',
    docUrl: 'https://fanyi-api.baidu.com/product/112'
  },
  [TranslationProvider.TENCENT]: {
    name: '腾讯云翻译',
    supportedLanguages: [LanguageCode.ZH_CN, LanguageCode.ZH_TW, LanguageCode.EN, LanguageCode.JA, LanguageCode.KO, LanguageCode.FR, LanguageCode.DE, LanguageCode.ES],
    supportDict: false,
    supportPhonetic: false,
    supportDetect: true,
    maxTextLength: 2000,
    defaultQps: 5,
    authFields: ['secretId', 'secretKey'],
    freeQuota: '500万字符/月',
    docUrl: 'https://cloud.tencent.com/document/product/551/35017'
  },
  [TranslationProvider.YOUDAO]: {
    name: '有道智云',
    supportedLanguages: [LanguageCode.ZH_CN, LanguageCode.ZH_TW, LanguageCode.EN, LanguageCode.JA, LanguageCode.KO, LanguageCode.FR, LanguageCode.DE, LanguageCode.ES],
    supportDict: true,
    supportPhonetic: true,
    supportDetect: true,
    maxTextLength: 5000,
    defaultQps: 10,
    authFields: ['appId', 'secretKey'],
    freeQuota: '一次性50元额度',
    docUrl: 'https://ai.youdao.com/DOCSIRMA/html/trans/price/wbfy/index.html'
  },
  [TranslationProvider.DEEPL]: {
    name: 'DeepL',
    supportedLanguages: [LanguageCode.ZH_CN, LanguageCode.EN, LanguageCode.JA, LanguageCode.KO, LanguageCode.FR, LanguageCode.DE, LanguageCode.ES],
    supportDict: false,
    supportPhonetic: false,
    supportDetect: false,  // DeepL 不支持 auto
    maxTextLength: 5000,
    defaultQps: 5,
    authFields: ['apiKey']
  }
};

/**
 * 提供商认证字段标签
 */
const ProviderAuthLabels = {
  apiKey: 'API Key',
  appId: 'APP ID / App Key',
  secretId: 'Secret ID',
  secretKey: '密钥 / Secret Key'
};

// ==================== 数据结构工厂 ====================

/**
 * 创建翻译请求对象
 * @param {Object} options
 * @returns {Object} TranslationRequest
 */
function createTranslationRequest(options) {
  return {
    text: options.text || '',
    from: options.from || LanguageCode.AUTO,
    to: options.to || LanguageCode.ZH_CN,
    type: options.type || TranslationType.SENTENCE,
    options: {
      needPhonetic: options.needPhonetic || false,
      needDict: options.needDict || false,
      needExample: options.needExample || false
    }
  };
}

/**
 * 创建翻译结果对象
 * @param {Object} options
 * @returns {Object} TranslationResult
 */
function createTranslationResult(options) {
  return {
    success: options.success !== undefined ? options.success : false,
    provider: options.provider || '',
    translation: options.translation || '',
    detectedLang: options.detectedLang || null,
    dictionary: options.dictionary || null,
    error: options.error || null
  };
}

/**
 * 创建翻译错误对象
 * @param {string} code
 * @param {string} message
 * @returns {Object}
 */
function createTranslationError(code, message) {
  return {
    code: code || TranslationErrorCode.UNKNOWN,
    message: message || TranslationErrorMessages[code] || '未知错误'
  };
}

/**
 * 创建词典信息对象
 * @param {Object} options
 * @returns {Object} DictionaryInfo
 */
function createDictionaryInfo(options) {
  return {
    phonetic: options.phonetic || null,
    definitions: options.definitions || [],
    forms: options.forms || null
  };
}

/**
 * 创建翻译节点配置对象
 * @param {Object} options
 * @returns {Object} TranslationNode
 */
function createTranslationNode(options) {
  return {
    id: options.id || generateUUID(),
    name: options.name || '',
    provider: options.provider || '',
    // 认证字段
    appId: options.appId || '',
    secretId: options.secretId || '',
    secretKey: options.secretKey || '',
    apiKey: options.apiKey || '',
    // 配置
    rateLimit: options.rateLimit || 0,
    enabled: options.enabled !== undefined ? options.enabled : true,
    // 状态
    lastTestTime: options.lastTestTime || null,
    lastTestResult: options.lastTestResult || NodeTestStatus.UNTESTED
  };
}

/**
 * 生成 UUID
 * @returns {string}
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ==================== 导出 ====================

// 如果在模块环境中
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LanguageCode,
    TranslationProvider,
    TranslationType,
    NodeTestStatus,
    TranslationErrorCode,
    TranslationErrorMessages,
    ProviderCapabilities,
    ProviderAuthLabels,
    createTranslationRequest,
    createTranslationResult,
    createTranslationError,
    createDictionaryInfo,
    createTranslationNode,
    generateUUID
  };
}
