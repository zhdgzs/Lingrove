/**
 * 翻译服务适配器
 * 包含基类和各提供商的具体实现
 * @file translation-adapters.js
 */

// ==================== 代理请求函数 ====================

/**
 * 通过 background.js 代理发送请求（避免 CORS）
 * @param {Object} options - 请求选项
 * @param {string} options.url - 请求 URL
 * @param {string} [options.method='GET'] - 请求方法
 * @param {Object} [options.headers] - 请求头
 * @param {string|Object} [options.body] - 请求体
 * @returns {Promise<Object>} - 响应数据
 */
async function proxyFetch(options) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'translationApiProxy',
      url: options.url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body
    }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!response?.success) {
        const error = new Error(response?.error || 'Request failed');
        error.status = response?.status;
        reject(error);
      } else {
        resolve(response.data);
      }
    });
  });
}

// ==================== 适配器基类 ====================

/**
 * 翻译适配器基类
 * 所有提供商适配器都需要继承此类
 */
class BaseAdapter {
  /**
   * @param {Object} config - 节点配置
   */
  constructor(config) {
    this.config = config;
    this.name = 'base';
  }

  /**
   * 语言代码映射表（子类必须覆盖）
   */
  get languageMap() {
    return {};
  }

  /**
   * 映射语言代码到提供商格式
   * @param {string} code - 统一语言代码
   * @returns {string} - 提供商语言代码
   */
  mapLanguageCode(code) {
    return this.languageMap[code] || code;
  }

  /**
   * 执行翻译请求（子类必须实现）
   * @param {string} text - 待翻译文本
   * @param {string} from - 源语言（已映射）
   * @param {string} to - 目标语言（已映射）
   * @returns {Promise<Object>} - 原始响应
   */
  async doTranslate(text, from, to) {
    throw new Error('doTranslate must be implemented by subclass');
  }

  /**
   * 从响应中提取翻译结果（子类必须实现）
   * @param {Object} response - 原始响应
   * @returns {string} - 翻译结果
   */
  extractTranslation(response) {
    throw new Error('extractTranslation must be implemented by subclass');
  }

  /**
   * 解析词典信息（子类可选实现）
   * @param {Object} response - 原始响应
   * @returns {Object|null} - 词典信息
   */
  parseDict(response) {
    return null;
  }

  /**
   * 获取提供商能力声明
   * @returns {Object} - 能力声明
   */
  getCapabilities() {
    return ProviderCapabilities[this.name] || {};
  }

  /**
   * 统一翻译入口
   * @param {Object} request - 翻译请求
   * @returns {Promise<Object>} - 翻译结果
   */
  async translate(request) {
    try {
      const from = this.mapLanguageCode(request.from);
      const to = this.mapLanguageCode(request.to);

      const rawResponse = await this.doTranslate(request.text, from, to);

      const result = createTranslationResult({
        success: true,
        provider: this.name,
        translation: this.extractTranslation(rawResponse),
        detectedLang: rawResponse.detectedLang || null
      });

      // 如果需要词典信息
      if (request.options?.needDict) {
        result.dictionary = this.parseDict(rawResponse);
      }

      return result;
    } catch (error) {
      console.error(`[${this.name}] Translation error:`, error);
      return createTranslationResult({
        success: false,
        provider: this.name,
        error: createTranslationError(
          error.code || TranslationErrorCode.UNKNOWN,
          error.message || '翻译失败'
        )
      });
    }
  }

  /**
   * 测试连接
   * @returns {Promise<Object>} - 测试结果
   */
  async testConnection() {
    try {
      const result = await this.translate({
        text: 'hello',
        from: LanguageCode.EN,
        to: LanguageCode.ZH_CN,
        type: TranslationType.WORD
      });

      return {
        success: result.success,
        latency: 0, // 可以在调用时计算
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
}

// ==================== 谷歌翻译适配器 ====================

/**
 * 谷歌翻译适配器
 * 使用 Google Cloud Translation API
 */
class GoogleAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = TranslationProvider.GOOGLE;
    this.baseUrl = 'https://translation.googleapis.com/language/translate/v2';
  }

  get languageMap() {
    return {
      [LanguageCode.ZH_CN]: 'zh-CN',
      [LanguageCode.ZH_TW]: 'zh-TW',
      [LanguageCode.EN]: 'en',
      [LanguageCode.JA]: 'ja',
      [LanguageCode.KO]: 'ko',
      [LanguageCode.FR]: 'fr',
      [LanguageCode.DE]: 'de',
      [LanguageCode.ES]: 'es',
      [LanguageCode.AUTO]: ''  // 谷歌自动检测不需要指定
    };
  }

  async doTranslate(text, from, to) {
    const { apiKey } = this.config;

    const params = new URLSearchParams({
      key: apiKey,
      q: text,
      target: to,
      format: 'text'
    });

    // 如果指定了源语言
    if (from && from !== '') {
      params.append('source', from);
    }

    const data = await proxyFetch({
      url: `${this.baseUrl}?${params}`,
      method: 'POST'
    });

    if (data.error) {
      const error = new Error(data.error.message);
      error.code = this.mapErrorCode(data.error.code);
      throw error;
    }

    return data;
  }

  extractTranslation(response) {
    return response.data?.translations?.[0]?.translatedText || '';
  }

  mapErrorCode(code) {
    const errorMap = {
      400: TranslationErrorCode.INVALID_REQUEST,
      401: TranslationErrorCode.AUTH_FAILED,
      403: TranslationErrorCode.QUOTA_EXCEEDED,
      429: TranslationErrorCode.RATE_LIMIT,
      500: TranslationErrorCode.SERVICE_UNAVAILABLE
    };
    return errorMap[code] || TranslationErrorCode.PROVIDER_ERROR;
  }
}

// ==================== 百度翻译适配器 ====================

/**
 * 百度翻译适配器
 * 使用百度翻译开放平台 API
 */
class BaiduAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = TranslationProvider.BAIDU;
    this.baseUrl = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
  }

  get languageMap() {
    return {
      [LanguageCode.ZH_CN]: 'zh',
      [LanguageCode.ZH_TW]: 'cht',
      [LanguageCode.EN]: 'en',
      [LanguageCode.JA]: 'jp',
      [LanguageCode.KO]: 'kor',
      [LanguageCode.FR]: 'fra',
      [LanguageCode.DE]: 'de',
      [LanguageCode.ES]: 'spa',
      [LanguageCode.AUTO]: 'auto'
    };
  }

  async doTranslate(text, from, to) {
    const { appId, secretKey } = this.config;

    // 生成签名
    const signParams = baiduSign({
      appId,
      secretKey,
      query: text
    });

    const params = new URLSearchParams({
      q: text,
      from: from,
      to: to,
      ...signParams
    });

    const data = await proxyFetch({
      url: `${this.baseUrl}?${params}`
    });

    if (data.error_code) {
      const error = new Error(data.error_msg || '百度翻译错误');
      error.code = this.mapErrorCode(data.error_code);
      throw error;
    }

    return data;
  }

  extractTranslation(response) {
    return response.trans_result?.[0]?.dst || '';
  }

  mapErrorCode(code) {
    const errorMap = {
      '52001': TranslationErrorCode.TIMEOUT,
      '52002': TranslationErrorCode.SERVICE_UNAVAILABLE,
      '52003': TranslationErrorCode.AUTH_FAILED,
      '54000': TranslationErrorCode.INVALID_REQUEST,
      '54001': TranslationErrorCode.INVALID_API_KEY,
      '54003': TranslationErrorCode.RATE_LIMIT,
      '54004': TranslationErrorCode.QUOTA_EXCEEDED,
      '54005': TranslationErrorCode.RATE_LIMIT,
      '58000': TranslationErrorCode.AUTH_FAILED,
      '58001': TranslationErrorCode.UNSUPPORTED_LANGUAGE,
      '58002': TranslationErrorCode.SERVICE_UNAVAILABLE
    };
    return errorMap[code] || TranslationErrorCode.PROVIDER_ERROR;
  }
}

// ==================== 腾讯云翻译适配器 ====================

/**
 * 腾讯云翻译适配器
 * 使用腾讯云机器翻译 API
 */
class TencentAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = TranslationProvider.TENCENT;
    this.host = 'tmt.tencentcloudapi.com';
    this.service = 'tmt';
    this.version = '2018-03-21';
    this.region = 'ap-guangzhou';
  }

  get languageMap() {
    return {
      [LanguageCode.ZH_CN]: 'zh',
      [LanguageCode.ZH_TW]: 'zh-TW',
      [LanguageCode.EN]: 'en',
      [LanguageCode.JA]: 'ja',
      [LanguageCode.KO]: 'ko',
      [LanguageCode.FR]: 'fr',
      [LanguageCode.DE]: 'de',
      [LanguageCode.ES]: 'es',
      [LanguageCode.AUTO]: 'auto'
    };
  }

  async doTranslate(text, from, to) {
    const { secretId, secretKey } = this.config;

    const payload = {
      SourceText: text,
      Source: from,
      Target: to,
      ProjectId: 0
    };

    // 生成 TC3 签名
    const signResult = await tencentCloudSign({
      secretId,
      secretKey,
      service: this.service,
      host: this.host,
      action: 'TextTranslate',
      version: this.version,
      region: this.region,
      payload
    });

    const data = await proxyFetch({
      url: `https://${this.host}`,
      method: 'POST',
      headers: signResult.headers,
      body: signResult.body
    });

    if (data.Response?.Error) {
      const error = new Error(data.Response.Error.Message);
      error.code = this.mapErrorCode(data.Response.Error.Code);
      throw error;
    }

    return data.Response;
  }

  extractTranslation(response) {
    return response.TargetText || '';
  }

  mapErrorCode(code) {
    const errorMap = {
      'AuthFailure': TranslationErrorCode.AUTH_FAILED,
      'AuthFailure.SecretIdNotFound': TranslationErrorCode.INVALID_API_KEY,
      'AuthFailure.SignatureFailure': TranslationErrorCode.AUTH_FAILED,
      'LimitExceeded': TranslationErrorCode.RATE_LIMIT,
      'RequestLimitExceeded': TranslationErrorCode.RATE_LIMIT,
      'ResourceInsufficient': TranslationErrorCode.QUOTA_EXCEEDED,
      'UnsupportedOperation': TranslationErrorCode.UNSUPPORTED_LANGUAGE,
      'InvalidParameter': TranslationErrorCode.INVALID_REQUEST,
      'InternalError': TranslationErrorCode.SERVICE_UNAVAILABLE
    };
    return errorMap[code] || TranslationErrorCode.PROVIDER_ERROR;
  }
}

// ==================== 有道智云适配器 ====================

/**
 * 有道智云适配器
 * 支持翻译和词典功能
 */
class YoudaoAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = TranslationProvider.YOUDAO;
    this.baseUrl = 'https://openapi.youdao.com/api';
  }

  get languageMap() {
    return {
      [LanguageCode.ZH_CN]: 'zh-CHS',
      [LanguageCode.ZH_TW]: 'zh-CHT',
      [LanguageCode.EN]: 'en',
      [LanguageCode.JA]: 'ja',
      [LanguageCode.KO]: 'ko',
      [LanguageCode.FR]: 'fr',
      [LanguageCode.DE]: 'de',
      [LanguageCode.ES]: 'es',
      [LanguageCode.AUTO]: 'auto'
    };
  }

  async doTranslate(text, from, to) {
    const { appId, secretKey } = this.config;

    // 生成签名
    const signParams = await youdaoSign({
      appKey: appId,
      appSecret: secretKey,
      query: text
    });

    const params = new URLSearchParams({
      q: text,
      from: from,
      to: to,
      ...signParams
    });

    const data = await proxyFetch({
      url: this.baseUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (data.errorCode !== '0') {
      const error = new Error(this.getErrorMessage(data.errorCode));
      error.code = this.mapErrorCode(data.errorCode);
      throw error;
    }

    return data;
  }

  extractTranslation(response) {
    return response.translation?.[0] || '';
  }

  /**
   * 解析词典信息（有道特有）
   */
  parseDict(response) {
    if (!response.basic) return null;

    const basic = response.basic;
    return createDictionaryInfo({
      phonetic: {
        us: basic['us-phonetic'],
        uk: basic['uk-phonetic']
      },
      definitions: this.parseExplains(basic.explains),
      forms: this.parseForms(basic.wfs)
    });
  }

  /**
   * 解析释义
   */
  parseExplains(explains) {
    if (!explains) return [];
    return explains.map(exp => {
      // 尝试匹配词性和释义，如 "n. 单词"
      const match = exp.match(/^([a-z]+\.)\s*(.+)$/i);
      if (match) {
        return { pos: match[1], meanings: [match[2]] };
      }
      return { pos: '', meanings: [exp] };
    });
  }

  /**
   * 解析词形变化
   */
  parseForms(wfs) {
    if (!wfs) return null;
    const forms = {};
    wfs.forEach(wf => {
      if (wf.wf) {
        const name = wf.wf.name;
        const value = wf.wf.value;
        if (name === '复数') forms.plural = value;
        else if (name === '过去式') forms.past = value;
        else if (name === '过去分词') forms.pastParticiple = value;
        else if (name === '现在分词') forms.presentParticiple = value;
      }
    });
    return Object.keys(forms).length > 0 ? forms : null;
  }

  getErrorMessage(code) {
    const messages = {
      '101': '缺少必填参数',
      '102': '不支持的语言类型',
      '103': '翻译文本过长',
      '104': '不支持的API类型',
      '105': '不支持的签名类型',
      '106': '不支持的响应类型',
      '107': '不支持的传输加密类型',
      '108': 'appKey无效',
      '109': 'batchLog格式不正确',
      '110': '无相关服务的有效实例',
      '111': '开发者账号无效',
      '112': '请求服务无效',
      '113': 'q不能为空',
      '114': '不支持的图片传输方式',
      '201': '解密失败',
      '202': '签名检验失败',
      '203': '访问IP地址不在可访问IP列表',
      '205': '请求的接口与应用的平台类型不一致',
      '206': '因为时间戳无效导致签名校验失败',
      '207': '重放请求',
      '301': '辞典查询失败',
      '302': '翻译查询失败',
      '303': '服务端的其它异常',
      '304': '会话闲置太久超时',
      '401': '账户已经欠费',
      '402': 'offlinesdk不可用',
      '411': '访问频率受限',
      '412': '长请求过于频繁'
    };
    return messages[code] || `有道翻译错误 (${code})`;
  }

  mapErrorCode(code) {
    const errorMap = {
      '101': TranslationErrorCode.INVALID_REQUEST,
      '102': TranslationErrorCode.UNSUPPORTED_LANGUAGE,
      '103': TranslationErrorCode.TEXT_TOO_LONG,
      '108': TranslationErrorCode.INVALID_API_KEY,
      '111': TranslationErrorCode.AUTH_FAILED,
      '202': TranslationErrorCode.AUTH_FAILED,
      '401': TranslationErrorCode.QUOTA_EXCEEDED,
      '411': TranslationErrorCode.RATE_LIMIT,
      '412': TranslationErrorCode.RATE_LIMIT
    };
    return errorMap[code] || TranslationErrorCode.PROVIDER_ERROR;
  }
}

// ==================== DeepL 适配器 ====================

/**
 * DeepL 翻译适配器
 */
class DeepLAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = TranslationProvider.DEEPL;
    // 根据 API Key 判断是 Free 还是 Pro
    this.baseUrl = this.getBaseUrl(config.apiKey);
  }

  getBaseUrl(apiKey) {
    // DeepL Free API Key 以 ':fx' 结尾
    if (apiKey && apiKey.endsWith(':fx')) {
      return 'https://api-free.deepl.com/v2/translate';
    }
    return 'https://api.deepl.com/v2/translate';
  }

  get languageMap() {
    return {
      [LanguageCode.ZH_CN]: 'ZH',
      [LanguageCode.ZH_TW]: 'ZH',  // DeepL 不区分简繁
      [LanguageCode.EN]: 'EN',
      [LanguageCode.JA]: 'JA',
      [LanguageCode.KO]: 'KO',
      [LanguageCode.FR]: 'FR',
      [LanguageCode.DE]: 'DE',
      [LanguageCode.ES]: 'ES',
      [LanguageCode.AUTO]: ''  // DeepL 不支持 auto，留空让其自动检测
    };
  }

  async doTranslate(text, from, to) {
    const { apiKey } = this.config;

    const params = new URLSearchParams({
      text: text,
      target_lang: to
    });

    // DeepL 源语言可选
    if (from && from !== '') {
      params.append('source_lang', from);
    }

    try {
      const data = await proxyFetch({
        url: this.baseUrl,
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      return data;
    } catch (e) {
      const error = new Error(`DeepL API error: ${e.status || e.message}`);
      error.code = this.mapErrorCode(e.status);
      throw error;
    }
  }

  extractTranslation(response) {
    return response.translations?.[0]?.text || '';
  }

  mapErrorCode(status) {
    const errorMap = {
      400: TranslationErrorCode.INVALID_REQUEST,
      401: TranslationErrorCode.AUTH_FAILED,
      403: TranslationErrorCode.AUTH_FAILED,
      404: TranslationErrorCode.INVALID_REQUEST,
      413: TranslationErrorCode.TEXT_TOO_LONG,
      429: TranslationErrorCode.RATE_LIMIT,
      456: TranslationErrorCode.QUOTA_EXCEEDED,
      500: TranslationErrorCode.SERVICE_UNAVAILABLE,
      503: TranslationErrorCode.SERVICE_UNAVAILABLE
    };
    return errorMap[status] || TranslationErrorCode.PROVIDER_ERROR;
  }
}

// ==================== 适配器工厂 ====================

/**
 * 适配器类映射
 */
const AdapterClasses = {
  [TranslationProvider.GOOGLE]: GoogleAdapter,
  [TranslationProvider.BAIDU]: BaiduAdapter,
  [TranslationProvider.TENCENT]: TencentAdapter,
  [TranslationProvider.YOUDAO]: YoudaoAdapter,
  [TranslationProvider.DEEPL]: DeepLAdapter
};

/**
 * 创建适配器实例
 * @param {Object} node - 节点配置
 * @returns {BaseAdapter} - 适配器实例
 */
function createAdapter(node) {
  const AdapterClass = AdapterClasses[node.provider];
  if (!AdapterClass) {
    throw new Error(`Unknown provider: ${node.provider}`);
  }
  return new AdapterClass(node);
}

// ==================== 导出 ====================

// 如果在模块环境中
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BaseAdapter,
    GoogleAdapter,
    BaiduAdapter,
    TencentAdapter,
    YoudaoAdapter,
    DeepLAdapter,
    AdapterClasses,
    createAdapter
  };
}
