/**
 * Lingrove 工具函数模块
 * 通用工具函数
 */

(function(L) {
  'use strict';

  /**
   * 判断词汇难度是否符合用户设置
   * @param {string} wordDifficulty - 词汇难度 (A1-C2)
   * @param {string} userDifficulty - 用户设置难度 (A1-C2)
   * @returns {boolean}
   */
  L.isDifficultyCompatible = function(wordDifficulty, userDifficulty) {
    const wordIdx = L.CEFR_LEVELS.indexOf(wordDifficulty);
    const userIdx = L.CEFR_LEVELS.indexOf(userDifficulty);
    return wordIdx >= userIdx;
  };

  /**
   * 生成文本指纹（用于去重）
   * @param {string} text - 文本内容
   * @param {string} path - 元素路径
   * @returns {string}
   */
  L.generateFingerprint = function(text, path = '') {
    const content = text.slice(0, 100).trim();
    let hash = 0;
    const str = content + path;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  };

  /**
   * 防抖函数
   * @param {Function} func - 要防抖的函数
   * @param {number} wait - 等待时间（毫秒）
   * @returns {Function}
   */
  L.debounce = function(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  /**
   * 检测文本语言
   * @param {string} text - 文本内容
   * @returns {string} 语言代码 (zh/ja/ko/en)
   */
  L.detectLanguage = function(text) {
    const chineseRegex = /[\u4e00-\u9fff]/g;
    const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/g;
    const koreanRegex = /[\uac00-\ud7af]/g;
    const latinRegex = /[a-zA-Z]/g;

    const chineseCount = (text.match(chineseRegex) || []).length;
    const japaneseCount = (text.match(japaneseRegex) || []).length;
    const koreanCount = (text.match(koreanRegex) || []).length;
    const latinCount = (text.match(latinRegex) || []).length;
    const total = chineseCount + japaneseCount + koreanCount + latinCount || 1;

    if (japaneseCount / total > 0.1) return 'ja';
    if (koreanCount / total > 0.1) return 'ko';
    if (chineseCount / total > 0.3) return 'zh';
    return 'en';
  };

  /**
   * 根据文本语言获取最小长度阈值
   * @param {string} text - 文本内容
   * @returns {number}
   */
  L.getMinTextLength = function(text) {
    const lang = L.detectLanguage(text);
    // 优先使用用户配置，否则使用默认值
    const config = L.config?.minLengthConfig || L.MIN_LENGTH_CONFIG;
    return config[lang] || 50;
  };

  /**
   * 判断检测到的语言是否与用户设置的母语匹配
   * @param {string} detectedLang - 检测到的语言
   * @param {string} nativeLang - 用户设置的母语
   * @returns {boolean}
   */
  L.isNativeLanguage = function(detectedLang, nativeLang) {
    // 中文简繁体视为同一语系
    if (detectedLang === 'zh' && (nativeLang === 'zh-CN' || nativeLang === 'zh-TW')) {
      return true;
    }
    return detectedLang === nativeLang;
  };

  /**
   * 判断是否为目标语言
   * @param {string} detectedLang - 检测到的语言
   * @param {string} targetLang - 目标语言
   * @returns {boolean}
   */
  L.isTargetLanguage = function(detectedLang, targetLang) {
    if (!detectedLang || !targetLang) return false;
    if (detectedLang === 'zh' && (targetLang === 'zh-CN' || targetLang === 'zh-TW')) {
      return true;
    }
    return detectedLang === targetLang;
  };

  /**
   * 获取 TTS 语言代码
   * @param {string} targetLang - 目标语言
   * @returns {string}
   */
  L.getTtsLang = function(targetLang) {
    return targetLang === 'en' ? 'en-US' :
           targetLang === 'zh-CN' ? 'zh-CN' :
           targetLang === 'zh-TW' ? 'zh-TW' :
           targetLang === 'ja' ? 'ja-JP' :
           targetLang === 'ko' ? 'ko-KR' : 'en-US';
  };

  /**
   * 检测文本是否为代码
   * @param {string} text - 文本内容
   * @returns {boolean}
   */
  L.isCodeText = function(text) {
    const codePatterns = [
      /^(const|let|var|function|class|import|export|return|if|else|for|while)\s/,
      /[{}();]\s*$/,
      /^\s*(\/\/|\/\*|\*|#)/,
      /\w+\.\w+\(/,
      /console\./,
      /https?:\/\//
    ];
    return codePatterns.some(pattern => pattern.test(text.trim()));
  };

  /**
   * 检测 hostname 是否为 IP 地址
   * @param {string} hostname - 主机名
   * @returns {boolean}
   */
  L.isIPAddress = function(hostname) {
    if (!hostname) return false;

    // localhost 特殊处理
    if (hostname === 'localhost' || hostname.startsWith('localhost:')) {
      return true;
    }

    // IPv4 正则（包括端口）
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;

    // IPv6 正则（简化版，包括 [::1] 格式）
    const ipv6Regex = /^\[?([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\]?(:\d+)?$/;

    return ipv4Regex.test(hostname) || ipv6Regex.test(hostname);
  };

  /**
   * 重建文本，只保留指定的词汇（用于发送给 AI）
   * @param {string} text - 原始文本
   * @param {string[]} targetWords - 目标词汇列表
   * @returns {string}
   */
  L.reconstructTextWithWords = function(text, targetWords) {
    const targetWordSet = new Set(targetWords.map(w => w.toLowerCase()));
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    const relevantSentences = sentences.filter(sentence => {
      const lowerSentence = sentence.toLowerCase();
      // 检查英文单词
      const words = sentence.match(/\b[a-zA-Z]{5,}\b/g) || [];
      const hasEnglishMatch = words.some(word => targetWordSet.has(word.toLowerCase()));

      // 检查中文短语（直接检查是否包含目标词汇）
      const hasChineseMatch = Array.from(targetWordSet).some(word => {
        // 只检查中文词汇
        if (/[\u4e00-\u9fff]/.test(word)) {
          return lowerSentence.includes(word);
        }
        return false;
      });

      return hasEnglishMatch || hasChineseMatch;
    });

    return relevantSentences.join('. ').trim() + (relevantSentences.length > 0 ? '.' : '');
  };

  /**
   * 获取元素的 DOM 路径
   * @param {Element} element - DOM 元素
   * @returns {string}
   */
  L.getElementPath = function(element) {
    const parts = [];
    let current = element;
    while (current && current !== document.body) {
      let selector = current.tagName?.toLowerCase() || '';
      if (current.id) selector += `#${current.id}`;
      parts.unshift(selector);
      current = current.parentElement;
    }
    return parts.join('>');
  };

  /**
   * 显示 Toast 提示
   * @param {string} message - 提示消息
   * @param {number} duration - 显示时长（毫秒）
   */
  L.showToast = function(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.className = 'lingrove-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10001;
      font-size: 14px;
      animation: lingrove-toast-in 0.3s ease;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'lingrove-toast-out 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  /**
   * 生成记忆按钮 SVG
   * @param {boolean} isActive - 是否激活
   * @param {number} size - 图标尺寸
   * @returns {string}
   */
  L.getMemorizeIconSvg = function(isActive, size = 16) {
    const path = isActive
      ? 'M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z'
      : 'M12.1,18.55L12,18.65L11.89,18.55C7.14,14.24 4,11.39 4,8.5C4,6.5 5.5,5 7.5,5C9.04,5 10.54,6 11.07,7.36H12.93C13.46,6 14.96,5 16.5,5C18.5,5 20,6.5 20,8.5C20,11.39 16.86,14.24 12.1,18.55M16.5,3C14.76,3 13.09,3.81 12,5.08C10.91,3.81 9.24,3 7.5,3C4.42,3 2,5.41 2,8.5C2,12.27 5.4,15.36 10.55,20.03L12,21.35L13.45,20.03C18.6,15.36 22,12.27 22,8.5C22,5.41 19.58,3 16.5,3Z';
    return `
      <svg viewBox="0 0 24 24" width="${size}" height="${size}">
        <path fill="currentColor" d="${path}"/>
      </svg>
    `;
  };

  /**
   * 生成记忆按钮内容
   * @param {boolean} isActive - 是否激活
   * @param {number} size - 图标尺寸
   * @param {string} activeText - 激活文案
   * @param {string} inactiveText - 未激活文案
   * @returns {string}
   */
  L.getMemorizeButtonHtml = function(isActive, size, activeText, inactiveText) {
    const text = isActive ? activeText : inactiveText;
    return `${L.getMemorizeIconSvg(isActive, size)}${text ? `\n  ${text}` : ''}`;
  };

  // 停用词列表
  L.STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their']);

  // UI 词汇可记忆过滤用停用词（保持与旧逻辑一致）
  L.MEMORIZABLE_STOP_WORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'and', 'but', 'or', 'nor', 'so', 'yet', 'i', 'me', 'my', 'we', 'our',
    'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they',
    'them', 'their', 'this', 'that', 'these', 'those', 'am', 'not', 'no'
  ]);

})(window.Lingrove);
