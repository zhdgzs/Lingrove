/**
 * Lingrove API 客户端模块
 * 处理翻译 API 调用、缓存管理等
 */

(function(L) {
  'use strict';

  /**
   * 翻译文本
   * @param {string} text - 待翻译文本
   * @returns {Promise<{immediate: object[], async: Promise|null}>}
   */
  L.translateText = async function(text) {
    if (!L.config.hasApiNodes && !L.config.apiEndpoint) {
      throw new Error('API 未配置');
    }

    // 确保缓存已加载
    if (L.wordCache.size === 0) {
      await L.loadWordCache();
    }

    const detectedLang = L.detectLanguage(text);
    const isNative = L.isNativeLanguage(detectedLang, L.config.nativeLanguage);

    // 根据处理模式检查是否需要处理该文本
    if (L.config.processMode === 'native-only' && !isNative) {
      return { immediate: [], async: null };
    }
    if (L.config.processMode === 'target-only' && isNative) {
      return { immediate: [], async: null };
    }

    const sourceLang = isNative ? L.config.nativeLanguage : detectedLang;
    const targetLang = isNative ? L.config.targetLanguage : L.config.nativeLanguage;
    const maxReplacements = L.INTENSITY_CONFIG[L.config.intensity]?.maxPerParagraph || 8;

    // 检查缓存
    const words = (text.match(/\b[a-zA-Z]{5,}\b/g) || []).filter(w => !L.STOP_WORDS.has(w.toLowerCase()));

    // 提取中文短语
    const chinesePhrases = [];
    const chineseText = text.match(/[\u4e00-\u9fff]+/g) || [];
    for (const phrase of chineseText) {
      if (phrase.length >= 2) {
        for (let len = 2; len <= Math.min(4, phrase.length); len++) {
          for (let i = 0; i <= phrase.length - len; i++) {
            chinesePhrases.push(phrase.substring(i, i + len));
          }
        }
      }
    }

    const allWords = [...new Set([...words, ...chinesePhrases])];
    const cached = [];
    const uncached = [];
    const cachedWordsSet = new Set();

    for (const word of allWords) {
      const key = `${word.toLowerCase()}:${sourceLang}:${targetLang}`;
      if (L.wordCache.has(key)) {
        const lowerWord = word.toLowerCase();
        if (!cachedWordsSet.has(lowerWord)) {
          cached.push({ word, ...L.wordCache.get(key) });
          cachedWordsSet.add(lowerWord);
        }
      } else {
        uncached.push(word);
      }
    }

    // 额外检查缓存中的中文词汇
    const lowerText = text.toLowerCase();
    for (const [key, value] of L.wordCache) {
      const [cachedWord, cachedSourceLang, cachedTargetLang] = key.split(':');
      if (cachedSourceLang === sourceLang &&
          cachedTargetLang === targetLang &&
          /[\u4e00-\u9fff]/.test(cachedWord) &&
          cachedWord.length >= 2) {
        const lowerCachedWord = cachedWord.toLowerCase();
        if (!cachedWordsSet.has(lowerCachedWord) && lowerText.includes(lowerCachedWord)) {
          const idx = text.toLowerCase().indexOf(lowerCachedWord);
          if (idx >= 0) {
            cached.push({ word: text.substring(idx, idx + cachedWord.length), ...value });
            cachedWordsSet.add(lowerCachedWord);
          }
        }
      }
    }

    // 获取已学会单词列表
    const learnedWordsSet = new Set((L.config.learnedWords || []).map(w => w.original.toLowerCase()));

    // 过滤缓存结果
    const filteredCached = cached
      .filter(c =>
        L.isDifficultyCompatible(c.difficulty || 'B1', L.config.difficultyLevel) &&
        !learnedWordsSet.has(c.word.toLowerCase())
      )
      .map(c => {
        const idx = text.toLowerCase().indexOf(c.word.toLowerCase());
        return {
          original: c.word,
          translation: c.translation,
          phonetic: c.phonetic,
          difficulty: c.difficulty,
          position: idx >= 0 ? idx : 0,
          fromCache: true
        };
      });

    const immediateResults = filteredCached.slice(0, maxReplacements);

    if (immediateResults.length > 0) {
      L.updateStats({ cacheHits: immediateResults.length, cacheMisses: 0 });
    }

    if (uncached.length === 0) {
      return { immediate: immediateResults, async: null };
    }

    const filteredText = L.reconstructTextWithWords(text, uncached);
    const cacheSatisfied = immediateResults.length >= maxReplacements;
    const textTooShort = filteredText.trim().length < L.getMinTextLength(filteredText);

    if (textTooShort) {
      return { immediate: immediateResults, async: null };
    }

    const remainingSlots = maxReplacements - immediateResults.length;
    const maxAsyncReplacements = cacheSatisfied ? 1 : remainingSlots;

    if (maxAsyncReplacements <= 0) {
      return { immediate: immediateResults, async: null };
    }

    const aiTargetCount = cacheSatisfied ? 1 : Math.max(maxAsyncReplacements, Math.ceil(maxReplacements * 1.5));

    // 异步调用 API
    const asyncPromise = (async () => {
      try {
        const prompt = L.buildTranslationPrompt({
          sourceLang,
          targetLang,
          text: filteredText,
          targetCount: aiTargetCount,
          maxCount: maxReplacements * 2,
          customPrompt: L.config.customPromptRules,
          config: L.config
        });

        const apiResponse = await L.sendApiRequest({
          model: L.config.modelName,
          messages: [
            { role: 'system', content: '你是一个专业的语言学习助手。始终返回有效的 JSON 格式。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 2000
        });

        const content = apiResponse.choices?.[0]?.message?.content || '[]';
        let allResults = [];
        try {
          allResults = JSON.parse(content);
          if (!Array.isArray(allResults)) {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) allResults = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) allResults = JSON.parse(jsonMatch[0]);
        }

        // 缓存所有词汇
        for (const item of allResults) {
          const isChinese = /[\u4e00-\u9fff]/.test(item.original);
          if (isChinese && item.original.length < 2) continue;
          const isEnglish = /^[a-zA-Z]+$/.test(item.original);
          if (isEnglish && item.original.length < 5) continue;

          const key = `${item.original.toLowerCase()}:${sourceLang}:${targetLang}`;
          if (L.wordCache.has(key)) L.wordCache.delete(key);

          while (L.wordCache.size >= (L.config?.cacheMaxSize || L.DEFAULT_CACHE_MAX_SIZE)) {
            const firstKey = L.wordCache.keys().next().value;
            L.wordCache.delete(firstKey);
          }

          L.wordCache.set(key, {
            translation: item.translation,
            phonetic: item.phonetic || '',
            difficulty: item.difficulty || 'B1'
          });
        }
        await L.saveWordCache();

        // 过滤结果
        const filteredResults = allResults.filter(item => {
          if (!L.isDifficultyCompatible(item.difficulty || 'B1', L.config.difficultyLevel)) return false;
          const isEnglish = /^[a-zA-Z]+$/.test(item.original);
          if (isEnglish && item.original.length < 5) return false;
          return true;
        });

        L.updateStats({ newWords: filteredResults.length, cacheHits: cached.length, cacheMisses: 1 });

        const correctedResults = filteredResults.map(result => ({
          ...result,
          position: text.toLowerCase().indexOf(result.original.toLowerCase())
        }));

        const immediateWords = new Set(immediateResults.map(r => r.original.toLowerCase()));
        const currentLearnedWords = new Set((L.config.learnedWords || []).map(w => w.original.toLowerCase()));

        const cachedResults = cached
          .filter(c =>
            !immediateWords.has(c.word.toLowerCase()) &&
            !correctedResults.some(r => r.original.toLowerCase() === c.word.toLowerCase()) &&
            !currentLearnedWords.has(c.word.toLowerCase()) &&
            L.isDifficultyCompatible(c.difficulty || 'B1', L.config.difficultyLevel)
          )
          .map(c => ({
            original: c.word,
            translation: c.translation,
            phonetic: c.phonetic,
            difficulty: c.difficulty,
            position: text.toLowerCase().indexOf(c.word.toLowerCase()),
            fromCache: true
          }));

        const filteredCorrectedResults = correctedResults.filter(r => !currentLearnedWords.has(r.original.toLowerCase()));
        const mergedResults = [...cachedResults, ...filteredCorrectedResults];
        return mergedResults.slice(0, maxAsyncReplacements);

      } catch (error) {
        console.error('[Lingrove] Async API Error:', error);
        return [];
      }
    })();

    return { immediate: immediateResults, async: asyncPromise };
  };

  /**
   * 发送 API 请求
   * @param {object} body - 请求体
   * @returns {Promise<object>}
   */
  L.sendApiRequest = function(body) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'apiRequest',
        endpoint: L.config.apiEndpoint,
        apiKey: L.config.apiKey,
        body: body
      }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!response?.success) {
          reject(new Error(response?.error || 'API request failed'));
        } else {
          resolve(response.data);
        }
      });
    });
  };

  /**
   * 翻译特定词汇
   * @param {string[]} targetWords - 目标词汇列表
   * @returns {Promise<object[]>}
   */
  L.translateSpecificWords = async function(targetWords) {
    if ((!L.config.hasApiNodes && !L.config.apiEndpoint) || !targetWords?.length) {
      return [];
    }

    const detectedLang = L.detectLanguage(targetWords.join(' '));
    const isNative = L.isNativeLanguage(detectedLang, L.config.nativeLanguage);
    const sourceLang = isNative ? L.config.nativeLanguage : detectedLang;
    const targetLang = isNative ? L.config.targetLanguage : L.config.nativeLanguage;

    const uncached = [];
    const cached = [];

    for (const word of targetWords) {
      const key = `${word.toLowerCase()}:${sourceLang}:${targetLang}`;
      if (L.wordCache.has(key)) {
        const cachedItem = L.wordCache.get(key);
        L.wordCache.delete(key);
        L.wordCache.set(key, cachedItem);
        cached.push({ word, ...cachedItem });
      } else {
        uncached.push(word);
      }
    }

    let allResults = cached.map(c => ({
      original: c.word,
      translation: c.translation,
      phonetic: c.phonetic,
      difficulty: c.difficulty
    }));

    if (uncached.length > 0) {
      try {
        const prompt = L.buildSpecificWordsPrompt({
          sourceLang,
          targetLang,
          words: uncached,
          customPrompt: L.config.customPromptRules,
          config: L.config
        });

        const apiResponse = await L.sendApiRequest({
          model: L.config.modelName,
          messages: [
            { role: 'system', content: '你是一个专业的语言学习助手。始终返回有效的 JSON 格式。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1000
        });

        const content = apiResponse.choices?.[0]?.message?.content || '[]';
        let apiResults = [];
        try {
          apiResults = JSON.parse(content);
          if (!Array.isArray(apiResults)) {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) apiResults = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) apiResults = JSON.parse(jsonMatch[0]);
        }

        // 缓存结果
        for (const item of apiResults) {
          const isChinese = /[\u4e00-\u9fff]/.test(item.original);
          if (isChinese && item.original.length < 2) continue;
          const isEnglish = /^[a-zA-Z]+$/.test(item.original);
          if (isEnglish && item.original.length < 5) continue;

          const key = `${item.original.toLowerCase()}:${sourceLang}:${targetLang}`;
          if (L.wordCache.has(key)) L.wordCache.delete(key);

          while (L.wordCache.size >= (L.config?.cacheMaxSize || L.DEFAULT_CACHE_MAX_SIZE)) {
            const firstKey = L.wordCache.keys().next().value;
            L.wordCache.delete(firstKey);
          }

          L.wordCache.set(key, {
            translation: item.translation,
            phonetic: item.phonetic || '',
            difficulty: item.difficulty || 'B1'
          });
        }
        await L.saveWordCache();

        allResults = [...allResults, ...apiResults];
        L.updateStats({ newWords: apiResults.length, cacheHits: cached.length, cacheMisses: 1 });

      } catch (error) {
        console.error('[Lingrove] API Error for specific words:', error);
      }
    }

    return allResults.filter(item => targetWords.some(w => w.toLowerCase() === item.original.toLowerCase()));
  };

  /**
   * 根据上下文重新翻译单词
   * @param {string} originalWord - 原词
   */
  L.retranslateWithContext = async function(originalWord) {
    if (!L.config.hasApiNodes && !L.config.apiEndpoint) {
      L.showToast('请先配置 API');
      return;
    }

    const elements = document.querySelectorAll('.lingrove-translated');
    let contextSentence = '';

    for (const el of elements) {
      if (el.getAttribute('data-original')?.toLowerCase() === originalWord.toLowerCase()) {
        const parent = el.closest('p, div, li, td, span') || el.parentElement;
        if (parent) {
          contextSentence = parent.textContent.trim().slice(0, 300);
        }
        break;
      }
    }

    if (!contextSentence) {
      L.showToast('无法获取上下文');
      return;
    }

    L.showToast('正在重新翻译...');

    const detectedLang = L.detectLanguage(originalWord);
    const isNative = L.isNativeLanguage(detectedLang, L.config.nativeLanguage);
    const sourceLang = isNative ? L.config.nativeLanguage : detectedLang;
    const targetLang = isNative ? L.config.targetLanguage : L.config.nativeLanguage;

    try {
      const prompt = L.buildRetranslatePrompt({
        sourceLang,
        targetLang,
        word: originalWord,
        context: contextSentence,
        customPrompt: L.config.customPromptRules,
        config: L.config
      });

      const apiResponse = await L.sendApiRequest({
        model: L.config.modelName,
        messages: [
          { role: 'system', content: '你是一个专业的语言学习助手。始终返回有效的 JSON 格式。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      const content = apiResponse.choices?.[0]?.message?.content || '';
      let result = null;

      try {
        result = JSON.parse(content);
      } catch {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      }

      if (!result?.translation) {
        L.showToast('翻译失败');
        return;
      }

      // 更新缓存
      const key = `${originalWord.toLowerCase()}:${sourceLang}:${targetLang}`;
      if (L.wordCache.has(key)) L.wordCache.delete(key);
      L.wordCache.set(key, {
        translation: result.translation,
        phonetic: result.phonetic || '',
        difficulty: result.difficulty || 'B1'
      });
      await L.saveWordCache();

      // 清除词典缓存
      const dictionaryType = L.config.dictionaryType || 'zh-en';
      const dictCacheKey = `${originalWord.toLowerCase()}_${dictionaryType}`;
      L.dictCache.delete(dictCacheKey);
      if (L.persistentDictCache) {
        L.persistentDictCache.delete(dictCacheKey);
        L.scheduleDictCachePersist();
      }
      L.fetchDictionaryData(originalWord).catch(() => {});

      // 更新页面显示
      document.querySelectorAll('.lingrove-translated').forEach(el => {
        if (el.getAttribute('data-original')?.toLowerCase() === originalWord.toLowerCase()) {
          el.setAttribute('data-translation', result.translation);
          el.setAttribute('data-phonetic', result.phonetic || '');
          el.setAttribute('data-difficulty', result.difficulty || 'B1');

          const style = L.config.translationStyle || 'translation-original';
          let innerHTML = '';
          switch (style) {
            case 'translation-only':
              innerHTML = `<span class="lingrove-word">${result.translation}</span>`;
              break;
            case 'original-translation':
              innerHTML = `<span class="lingrove-original">${originalWord}</span><span class="lingrove-word">(${result.translation})</span>`;
              break;
            default:
              innerHTML = `<span class="lingrove-word">${result.translation}</span><span class="lingrove-original">(${originalWord})</span>`;
          }
          el.innerHTML = innerHTML;
        }
      });

      L.hideTooltip();
      L.showToast(`已更新翻译: ${result.translation}`);

    } catch (error) {
      console.error('[Lingrove] Retranslate error:', error);
      L.showToast('重新翻译失败');
    }
  };

  /**
   * 处理特定词汇
   * @param {string[]} targetWords - 目标词汇列表
   * @returns {Promise<number>}
   */
  L.processSpecificWords = async function(targetWords) {
    if (!L.config?.enabled || !targetWords?.length) {
      return 0;
    }

    const targetWordSet = new Set(targetWords.map(w => w.toLowerCase()));
    let processed = 0;

    // 检查已翻译的元素
    const alreadyTranslated = [];
    document.querySelectorAll('.lingrove-translated').forEach(el => {
      const original = el.getAttribute('data-original');
      if (original && targetWordSet.has(original.toLowerCase())) {
        alreadyTranslated.push(original.toLowerCase());
      }
    });

    // 查找包含目标单词的文本节点
    const textNodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (L.SKIP_TAGS.includes(parent.tagName)) return NodeFilter.FILTER_REJECT;

        const classList = parent.className?.toString() || '';
        if (L.SKIP_CLASSES.some(cls => classList.includes(cls) && cls !== 'lingrove-translated')) {
          return NodeFilter.FILTER_REJECT;
        }

        if (parent.offsetParent === null && parent.tagName !== 'BODY' && parent.tagName !== 'HTML') {
          const position = parent.style.position;
          if (position !== 'fixed' && position !== 'sticky') {
            return NodeFilter.FILTER_REJECT;
          }
        }

        if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;

        const text = node.textContent.trim();
        if (text.length === 0) return NodeFilter.FILTER_REJECT;
        if (L.isCodeText(text)) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent;
      const words = text.match(/\b[a-zA-Z]{5,}\b/g) || [];
      const chineseWords = text.match(/[\u4e00-\u9fff]{2,4}/g) || [];
      const allWords = [...words, ...chineseWords];

      const containsTarget = allWords.some(word => {
        const lowerWord = word.toLowerCase();
        return targetWordSet.has(lowerWord) && !alreadyTranslated.includes(lowerWord);
      });

      if (containsTarget) {
        textNodes.push(node);
      }
    }

    if (textNodes.length === 0) {
      return 0;
    }

    // 构造段落
    const segments = [];
    for (const textNode of textNodes) {
      const container = textNode.parentElement;
      if (!container) continue;

      const containerText = L.getTextContent(container);
      let contextText = containerText;
      if (contextText.length < 30) {
        const grandParent = container.parentElement;
        if (grandParent) {
          contextText = L.getTextContent(grandParent);
        }
      }

      if (contextText.length >= 10) {
        const path = L.getElementPath(container);
        const fingerprint = L.generateFingerprint(contextText, path);
        const isProcessed = container.hasAttribute('data-lingrove-processed') ||
                           container.closest('[data-lingrove-processed]');

        segments.push({
          element: container,
          text: contextText,
          fingerprint: fingerprint,
          isProcessed: !!isProcessed
        });
      }
    }

    // 去重
    const uniqueSegments = segments.filter((segment, index, self) =>
      index === self.findIndex(s => s.fingerprint === segment.fingerprint)
    );

    const translations = await L.translateSpecificWords(targetWords);

    if (translations.length === 0) {
      return 0;
    }

    // 应用替换
    for (const segment of uniqueSegments) {
      const replacements = translations.map(translation => {
        const position = segment.text.toLowerCase().indexOf(translation.original.toLowerCase());
        return {
          original: translation.original,
          translation: translation.translation,
          phonetic: translation.phonetic,
          difficulty: translation.difficulty,
          position: position >= 0 ? position : 0
        };
      }).filter(r => r.position >= 0 || segment.text.toLowerCase().includes(r.original.toLowerCase()));

      if (replacements.length === 0) continue;

      const count = L.applyReplacements(segment.element, replacements);
      processed += count;

      const wordsToFetch = replacements.map(r => r.original).concat(replacements.map(r => r.translation));
      L.prefetchDictionaryData(wordsToFetch);
    }

    return processed;
  };

})(window.Lingrove);

/**
 * Lingrove 选中翻译服务
 * 处理选中文本的翻译功能
 */
(function(L) {
  'use strict';

  // 翻译缓存
  L.selectionTranslateCache = new Map();

  /**
   * 使用有道翻译 API
   * @param {string} text - 待翻译文本
   * @returns {Promise<string|null>}
   */
  L.translateWithYoudao = async function(text) {
    try {
      const url = `https://fanyi.youdao.com/translate?&doctype=json&type=AUTO&i=${encodeURIComponent(text)}`;

      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'fetchProxy', url }, (res) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!res?.success) {
            reject(new Error(res?.error || 'Fetch failed'));
          } else {
            resolve(res.data);
          }
        });
      });

      const result = response.translateResult?.[0]?.[0]?.tgt;
      return result || null;
    } catch (e) {
      return null;
    }
  };

  /**
   * 使用 AI 翻译
   * @param {string} text - 待翻译文本
   * @param {string} targetLang - 目标语言
   * @returns {Promise<string|null>}
   */
  L.translateWithAI = async function(text, targetLang) {
    if (!L.config.hasApiNodes && !L.config.apiEndpoint) {
      throw new Error('API 未配置');
    }

    const langNames = {
      'zh-CN': '简体中文',
      'zh-TW': '繁体中文',
      'en': '英文',
      'ja': '日文',
      'ko': '韩文',
      'fr': '法文',
      'de': '德文',
      'es': '西班牙文'
    };

    const targetLangName = langNames[targetLang] || targetLang;

    const prompt = `请将以下文本翻译成${targetLangName}。要求：
1. 保持原文的语气和风格
2. 翻译要自然流畅
3. 只返回翻译结果，不要任何解释或额外内容

原文：${text}`;

    try {
      const apiResponse = await L.sendApiRequest({
        model: L.config.modelName,
        messages: [
          { role: 'system', content: '你是一个专业翻译助手。只返回翻译结果，不要任何解释。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = apiResponse.choices?.[0]?.message?.content?.trim();
      return content || null;
    } catch (e) {
      console.error('[Lingrove] AI translate error:', e);
      throw e;
    }
  };

  /**
   * 判断是否使用有道翻译
   * @param {string} text - 文本
   * @param {string} sourceLang - 源语言
   * @param {string} targetLang - 目标语言
   * @returns {boolean}
   */
  L.shouldUseYoudao = function(text, sourceLang, targetLang) {
    // 计算词数
    const wordCount = sourceLang === 'zh' || sourceLang === 'ja'
      ? text.length
      : text.split(/\s+/).filter(w => w.length > 0).length;

    // 短文本（≤10词）
    if (wordCount > 10) return false;

    // 中英互译
    const isChinese = sourceLang === 'zh';
    const isEnglish = sourceLang === 'en';
    const targetIsChinese = targetLang.startsWith('zh');
    const targetIsEnglish = targetLang === 'en';

    return (isChinese && targetIsEnglish) || (isEnglish && targetIsChinese);
  };

  /**
   * 混合翻译策略
   * @param {string} text - 待翻译文本
   * @returns {Promise<{translation: string, original: string, phonetic: string, isWord: boolean}>}
   */
  L.translateSelection = async function(text) {
    // 检查缓存
    const cacheKey = text.toLowerCase();
    if (L.selectionTranslateCache.has(cacheKey)) {
      return L.selectionTranslateCache.get(cacheKey);
    }

    const sourceLang = L.detectLanguage(text);
    const isNative = L.isNativeLanguage(sourceLang, L.config.nativeLanguage);
    const targetLang = isNative ? L.config.targetLanguage : L.config.nativeLanguage;

    // 判断是否为单词
    const wordCount = sourceLang === 'zh' || sourceLang === 'ja'
      ? text.length
      : text.split(/\s+/).filter(w => w.length > 0).length;
    const isWord = wordCount <= 3;

    let translation = null;
    let phonetic = '';

    // 尝试有道翻译
    if (L.shouldUseYoudao(text, sourceLang, targetLang)) {
      translation = await L.translateWithYoudao(text);
    }

    // 有道失败或不适用，使用 AI
    if (!translation) {
      translation = await L.translateWithAI(text, targetLang);
    }

    if (!translation) {
      throw new Error('翻译失败');
    }

    // 如果是英文单词，尝试获取音标
    if (isWord && sourceLang === 'en') {
      const dictData = await L.fetchDictionaryData(text);
      if (dictData?.phonetic) {
        phonetic = dictData.phonetic;
      }
    }

    const result = {
      translation,
      original: text,
      phonetic,
      isWord
    };

    // 缓存结果
    L.selectionTranslateCache.set(cacheKey, result);

    return result;
  };

})(window.Lingrove);
