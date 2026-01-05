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

  // 停用词列表
  L.STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their']);

})(window.Lingrove);
