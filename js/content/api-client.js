/**
 * Lingrove API 客户端模块
 * 处理翻译 API 调用、缓存管理等
 */

(function(L) {
  'use strict';

  /**
   * 按难度优先级选取词汇
   * 优先选择与用户设置相同难度的词汇，不够再逐级增加难度，同级超过则随机选取
   * @param {object[]} candidates - 候选词汇数组
   * @param {number} targetCount - 目标数量
   * @param {string} userLevel - 用户设置的难度等级
   * @returns {object[]} 选取的词汇数组
   */
  L.selectByDifficultyPriority = function(candidates, targetCount, userLevel) {
    if (targetCount <= 0 || candidates.length === 0) {
      return [];
    }

    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const userLevelIndex = levels.indexOf(userLevel || 'B1');

    // 从用户等级开始，向上逐级选取
    const priorityOrder = levels.slice(userLevelIndex >= 0 ? userLevelIndex : 2);

    const selected = [];
    const selectedSet = new Set();

    for (const level of priorityOrder) {
      if (selected.length >= targetCount) break;

      // 筛选当前难度等级的候选词汇
      const levelCandidates = candidates.filter(c =>
        (c.difficulty || 'B1') === level &&
        !selectedSet.has(c.original.toLowerCase())
      );

      const needed = targetCount - selected.length;

      if (levelCandidates.length <= needed) {
        // 全部选取
        for (const c of levelCandidates) {
          selected.push(c);
          selectedSet.add(c.original.toLowerCase());
        }
      } else {
        // 随机选取
        const shuffled = [...levelCandidates].sort(() => Math.random() - 0.5);
        for (let i = 0; i < needed; i++) {
          selected.push(shuffled[i]);
          selectedSet.add(shuffled[i].original.toLowerCase());
        }
      }
    }

    return selected;
  };

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

    // 计算目标翻译词汇数量（基于百分比）
    const translationDensity = L.config.translationDensity || 30;
    const targetCount = Math.ceil(allWords.length * (translationDensity / 100));

    // 过滤缓存结果（按难度等级和已学会状态过滤）
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

    // 按难度优先级选取缓存词汇（不超过目标数量）
    const selectedCached = L.selectByDifficultyPriority(
      filteredCached,
      targetCount,
      L.config.difficultyLevel
    );

    // 计算还需要从 API 获取的词汇数量
    const needFromApi = targetCount - selectedCached.length;

    // 返回选取的缓存结果作为即时结果
    const immediateResults = selectedCached;

    if (immediateResults.length > 0) {
      L.updateStats({ cacheHits: immediateResults.length, cacheMisses: 0 });
    }

    // 检查文本长度是否足够调用 API
    const textTooShort = text.trim().length < L.getMinTextLength(text);

    // 如果缓存已满足目标数量，或文本太短，或没有未缓存词汇，则不调用 API
    if (needFromApi <= 0 || textTooShort || uncached.length === 0) {
      return { immediate: immediateResults, async: null };
    }

    // 异步调用 API 补充词汇
    const asyncPromise = (async () => {
      try {
        const prompt = L.buildTranslationPrompt({
          sourceLang,
          targetLang,
          text: text,
          translationDensity: L.config.translationDensity || 30,
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

        // 过滤掉已学会和已在即时结果中的词汇
        const filteredCorrectedResults = correctedResults.filter(r =>
          !currentLearnedWords.has(r.original.toLowerCase()) &&
          !immediateWords.has(r.original.toLowerCase())
        );

        return filteredCorrectedResults;

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
   * 使用配置的翻译服务
   * @param {string} text - 待翻译文本
   * @param {string} from - 源语言
   * @param {string} to - 目标语言
   * @returns {Promise<Object>}
   */
  L.translateWithConfiguredService = async function(text, from, to) {
    // 检查是否有配置的翻译节点
    if (typeof translationService !== 'undefined') {
      const request = createTranslationRequest({
        text,
        from,
        to,
        type: text.split(/\s+/).length <= 3 ? TranslationType.WORD : TranslationType.SENTENCE,
        needDict: true,
        needPhonetic: true
      });

      const result = await translationService.translate(request);

      if (result.success) {
        return {
          translation: result.translation,
          phonetic: result.dictionary?.phonetic?.us || result.dictionary?.phonetic?.uk || '',
          dictionary: result.dictionary
        };
      }

      // 如果配置的服务失败，抛出错误让调用方处理
      if (result.error) {
        throw new Error(result.error.message);
      }
    }

    // 没有配置翻译服务，返回 null
    return null;
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

    const langNames = L.LANGUAGE_NAMES_ZH || {};
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

    // 1. 首先尝试使用配置的翻译服务
    try {
      const configuredResult = await L.translateWithConfiguredService(text, sourceLang, targetLang);
      if (configuredResult?.translation) {
        translation = configuredResult.translation;
        phonetic = configuredResult.phonetic || '';
      }
    } catch (e) {
      console.warn('[Lingrove] Configured translation service failed:', e.message);
    }

    // 2. 如果配置的服务失败或未配置，使用 AI 翻译
    if (!translation) {
      translation = await L.translateWithAI(text, targetLang);
    }

    if (!translation) {
      throw new Error('翻译失败');
    }

    // 如果是英文单词且没有音标，尝试获取音标
    if (isWord && sourceLang === 'en' && !phonetic) {
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
