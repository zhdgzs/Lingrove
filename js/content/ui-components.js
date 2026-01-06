/**
 * Lingrove UI 组件模块
 * 管理 Tooltip、词典、弹窗等 UI 组件
 */

(function(L) {
  'use strict';

  // UI 状态变量
  L.tooltip = null;
  L.selectionPopup = null;
  L.tooltipHideTimeout = null;
  L.currentTooltipElement = null;

  // 词典缓存
  L.dictCache = new Map();
  L.persistentDictCache = null;
  L.dictCacheInitPromise = null;
  L.dictPersistTimer = null;

  /**
   * 创建 Tooltip
   */
  L.createTooltip = function() {
    if (L.tooltip) return;

    L.tooltip = document.createElement('div');
    L.tooltip.className = 'lingrove-tooltip';
    L.tooltip.setAttribute('data-theme', L.config?.theme || 'dark');
    L.tooltip.style.display = 'none';
    document.body.appendChild(L.tooltip);
  };

  /**
   * 初始化持久化词典缓存
   */
  L.ensureDictCacheLoaded = async function() {
    if (L.persistentDictCache) return;
    if (L.dictCacheInitPromise) return L.dictCacheInitPromise;

    L.dictCacheInitPromise = new Promise((resolve) => {
      chrome.storage.local.get(L.DICT_CACHE_STORAGE_KEY, (result) => {
        const raw = result?.[L.DICT_CACHE_STORAGE_KEY];
        L.persistentDictCache = new Map();

        if (Array.isArray(raw)) {
          for (const item of raw) {
            if (item?.key) {
              L.persistentDictCache.set(item.key, item.value ?? null);
            }
          }
        }

        while (L.persistentDictCache.size > L.DICT_CACHE_MAX_SIZE) {
          const firstKey = L.persistentDictCache.keys().next().value;
          L.persistentDictCache.delete(firstKey);
        }

        resolve();
      });
    });

    return L.dictCacheInitPromise;
  };

  /**
   * 延迟保存持久化缓存
   */
  L.scheduleDictCachePersist = function() {
    if (L.dictPersistTimer) clearTimeout(L.dictPersistTimer);
    L.dictPersistTimer = setTimeout(() => {
      L.dictPersistTimer = null;
      if (!L.persistentDictCache) return;

      const data = [];
      for (const [key, value] of L.persistentDictCache) {
        data.push({ key, value });
      }
      const saveData = {};
      saveData[L.DICT_CACHE_STORAGE_KEY] = data;
      chrome.storage.local.set(saveData);
    }, 500);
  };

  /**
   * 获取持久化缓存
   */
  L.getDictCacheValue = async function(cacheKey) {
    await L.ensureDictCacheLoaded();
    if (!L.persistentDictCache?.has(cacheKey)) return undefined;

    const value = L.persistentDictCache.get(cacheKey);
    L.persistentDictCache.delete(cacheKey);
    L.persistentDictCache.set(cacheKey, value);
    return value;
  };

  /**
   * 设置持久化缓存
   */
  L.setDictCacheValue = async function(cacheKey, value) {
    await L.ensureDictCacheLoaded();
    if (!L.persistentDictCache) L.persistentDictCache = new Map();

    if (L.persistentDictCache.has(cacheKey)) L.persistentDictCache.delete(cacheKey);
    while (L.persistentDictCache.size >= L.DICT_CACHE_MAX_SIZE) {
      const firstKey = L.persistentDictCache.keys().next().value;
      L.persistentDictCache.delete(firstKey);
    }
    L.persistentDictCache.set(cacheKey, value ?? null);
    L.scheduleDictCachePersist();
  };

  /**
   * 从有道词典获取中英释义
   */
  L.fetchYoudaoData = async function(word) {
    try {
      const url = `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word)}&doctype=json`;

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

      const ecData = response.ec?.word?.[0];
      if (!ecData) return null;

      const phonetic = ecData.usphone ? `/${ecData.usphone}/` : (ecData.ukphone ? `/${ecData.ukphone}/` : '');
      const meanings = [];
      const trs = ecData.trs || [];

      for (const tr of trs.slice(0, 4)) {
        const defText = tr.tr?.[0]?.l?.i?.[0] || '';
        if (defText) {
          const match = defText.match(/^([a-z]+\.)\s*(.+)$/i);
          if (match) {
            const pos = match[1];
            const def = match[2];
            const existing = meanings.find(m => m.partOfSpeech === pos);
            if (existing) {
              if (existing.definitions.length < 4) existing.definitions.push(def);
            } else {
              meanings.push({ partOfSpeech: pos, definitions: [def] });
            }
          } else {
            meanings.push({ partOfSpeech: '', definitions: [defText] });
          }
        }
      }

      if (meanings.length === 0) return null;
      return { word, phonetic, meanings };
    } catch (e) {
      console.error('[Lingrove] Youdao fetch error:', e);
      return null;
    }
  };

  /**
   * 从 Wiktionary 获取英英释义
   */
  L.fetchWiktionaryData = async function(word) {
    try {
      const url = `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&format=json&prop=text&origin=*`;

      const data = await new Promise((resolve, reject) => {
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

      if (data.error || !data.parse?.text?.['*']) return null;

      const htmlString = data.parse.text['*'];
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      const contentRoot = doc.querySelector('.mw-parser-output') || doc.body;

      const allH2 = contentRoot.querySelectorAll('h2');
      let englishStart = null;
      let englishEnd = null;

      for (let i = 0; i < allH2.length; i++) {
        const h2 = allH2[i];
        if (h2.id === 'English' || h2.textContent.includes('English')) {
          englishStart = h2.parentNode?.classList?.contains('mw-heading') ? h2.parentNode : h2;
          if (i + 1 < allH2.length) {
            const nextH2 = allH2[i + 1];
            englishEnd = nextH2.parentNode?.classList?.contains('mw-heading') ? nextH2.parentNode : nextH2;
          }
          break;
        }
      }

      if (!englishStart) return null;

      const phoneticEl = contentRoot.querySelector('.IPA');
      const phonetic = phoneticEl?.textContent?.trim() || '';

      const validPOS = ['Noun', 'Verb', 'Adjective', 'Adverb', 'Interjection', 'Pronoun', 'Preposition', 'Conjunction'];
      const meaningsMap = new Map();
      const headers = contentRoot.querySelectorAll('h3, h4');

      for (const header of headers) {
        const headerNode = header.parentNode?.classList?.contains('mw-heading') ? header.parentNode : header;

        if (englishStart.compareDocumentPosition(headerNode) & Node.DOCUMENT_POSITION_PRECEDING) continue;
        if (englishEnd && (englishEnd.compareDocumentPosition(headerNode) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;

        const headerText = header.textContent.replace(/\[.*?\]/g, '').trim();
        const matchedPOS = validPOS.find(pos => headerText.includes(pos));
        if (!matchedPOS) continue;

        let currentNode = header.parentNode?.classList?.contains('mw-heading') ? header.parentNode : header;
        let definitionList = null;

        while (currentNode?.nextElementSibling) {
          currentNode = currentNode.nextElementSibling;
          if (currentNode.tagName === 'OL') {
            definitionList = currentNode;
            break;
          }
          if (['H2', 'H3', 'H4'].includes(currentNode.tagName)) break;
        }

        if (definitionList) {
          const listItems = definitionList.querySelectorAll(':scope > li');
          for (const li of Array.from(listItems).slice(0, 3)) {
            const cloneLi = li.cloneNode(true);
            cloneLi.querySelectorAll('.h-usage-example, .e-example, ul, dl, .reference, .citation').forEach(el => el.remove());
            const defText = cloneLi.textContent.replace(/<[^>]*>/g, '').trim().slice(0, 200);
            if (defText) {
              if (!meaningsMap.has(matchedPOS)) meaningsMap.set(matchedPOS, []);
              const defs = meaningsMap.get(matchedPOS);
              if (defs.length < 4) defs.push(defText);
            }
          }
        }
      }

      const meanings = [];
      for (const [pos, defs] of meaningsMap) {
        if (meanings.length >= 4) break;
        if (defs.length > 0) meanings.push({ partOfSpeech: pos, definitions: defs });
      }

      if (meanings.length === 0) return null;
      return { word, phonetic, meanings };
    } catch (e) {
      console.error('[Lingrove] Wiktionary fetch error:', e);
      return null;
    }
  };

  /**
   * 获取词典数据
   */
  L.fetchDictionaryData = async function(word, lang = null) {
    const dictionaryType = L.config.dictionaryType || 'en-en';
    const cacheKey = `${word.toLowerCase()}_${dictionaryType}`;

    if (L.dictCache.has(cacheKey)) {
      return L.dictCache.get(cacheKey);
    }

    const persistedValue = await L.getDictCacheValue(cacheKey);
    if (persistedValue !== undefined) {
      L.dictCache.set(cacheKey, persistedValue);
      return persistedValue;
    }

    try {
      let result = null;

      if (dictionaryType === 'zh-en') {
        result = await L.fetchYoudaoData(word);
      } else {
        result = await L.fetchWiktionaryData(word);
      }

      L.dictCache.set(cacheKey, result);
      await L.setDictCacheValue(cacheKey, result);
      return result;
    } catch (e) {
      console.error('[Lingrove] Dictionary fetch error:', e);
      L.dictCache.set(cacheKey, null);
      L.setDictCacheValue(cacheKey, null);
      return null;
    }
  };

  /**
   * 预加载词典数据
   */
  L.prefetchDictionaryData = function(words) {
    const dictionaryType = L.config.dictionaryType || 'en-en';

    for (const word of words) {
      const wordLang = L.detectLanguage(word);
      if (wordLang !== 'en') continue;

      const cacheKey = `${word.toLowerCase()}_${dictionaryType}`;
      if (L.dictCache.has(cacheKey)) continue;

      L.fetchDictionaryData(word).catch(() => {});
    }
  };

  /**
   * 更新 Tooltip 的词典内容
   */
  L.updateTooltipDictionary = function(dictData) {
    if (!L.tooltip || !dictData) return;

    const dictContainer = L.tooltip.querySelector('.lingrove-tooltip-dict');
    if (!dictContainer) return;

    let html = '';
    for (const meaning of dictData.meanings) {
      html += `<div class="lingrove-dict-entry">`;
      if (meaning.partOfSpeech) {
        html += `<span class="lingrove-dict-pos">${meaning.partOfSpeech}</span>`;
      }
      html += `<ul class="lingrove-dict-defs">`;
      for (const def of meaning.definitions) {
        html += `<li>${def}</li>`;
      }
      html += `</ul></div>`;
    }

    dictContainer.innerHTML = html || '<div class="lingrove-dict-empty">暂无词典数据</div>';
  };

  /**
   * 显示 Tooltip
   */
  L.showTooltip = function(element, mouseX, mouseY) {
    if (!L.tooltip || !element.classList?.contains('lingrove-translated')) return;

    if (L.currentTooltipElement === element && L.tooltip.style.display === 'block') {
      return;
    }
    L.currentTooltipElement = element;

    const original = element.getAttribute('data-original');
    const translation = element.getAttribute('data-translation');
    const phonetic = element.getAttribute('data-phonetic');
    const difficulty = element.getAttribute('data-difficulty');

    const isInMemorizeList = (L.config.memorizeList || []).some(w =>
      w.word.toLowerCase() === original.toLowerCase()
    );

    const targetLang = L.config.targetLanguage || 'en';
    const originalLang = L.detectLanguage(original);
    const translationLang = L.detectLanguage(translation);

    const isOriginalTargetLang = (originalLang === 'en' && targetLang === 'en') ||
                                  (originalLang === 'zh' && (targetLang === 'zh-CN' || targetLang === 'zh-TW'));
    const isTranslationTargetLang = (translationLang === 'en' && targetLang === 'en') ||
                                     (translationLang === 'zh' && (targetLang === 'zh-CN' || targetLang === 'zh-TW'));

    const dictWord = isOriginalTargetLang ? original : (isTranslationTargetLang ? translation : null);

    L.tooltip.innerHTML = `
      <div class="lingrove-tooltip-header">
        <span class="lingrove-tooltip-word">${translation}</span>
        <span class="lingrove-tooltip-badge" data-difficulty="${difficulty}">${difficulty}</span>
        <button class="lingrove-tooltip-btn lingrove-btn-memorize ${isInMemorizeList ? 'active' : ''}" data-original="${original}" title="${isInMemorizeList ? '已在记忆列表' : '添加到记忆列表'}">
          <svg viewBox="0 0 24 24" width="16" height="16">
            ${isInMemorizeList
              ? '<path fill="currentColor" d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>'
              : '<path fill="currentColor" d="M12.1,18.55L12,18.65L11.89,18.55C7.14,14.24 4,11.39 4,8.5C4,6.5 5.5,5 7.5,5C9.04,5 10.54,6 11.07,7.36H12.93C13.46,6 14.96,5 16.5,5C18.5,5 20,6.5 20,8.5C20,11.39 16.86,14.24 12.1,18.55M16.5,3C14.76,3 13.09,3.81 12,5.08C10.91,3.81 9.24,3 7.5,3C4.42,3 2,5.41 2,8.5C2,12.27 5.4,15.36 10.55,20.03L12,21.35L13.45,20.03C18.6,15.36 22,12.27 22,8.5C22,5.41 19.58,3 16.5,3Z"/>'
            }
          </svg>
        </button>
      </div>
      ${phonetic && L.config.showPhonetic ? `
      <div class="lingrove-tooltip-phonetic lingrove-btn-speak" data-original="${original}" data-translation="${translation}" title="点击发音">
        <svg viewBox="0 0 24 24" width="12" height="12">
          <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
        </svg>
        <span>${phonetic}</span>
      </div>
      ` : ''}
      <div class="lingrove-tooltip-original">原文: ${original}</div>
      <div class="lingrove-tooltip-dict"></div>
      <div class="lingrove-tooltip-actions">
        <button class="lingrove-tooltip-btn lingrove-btn-learned" data-original="${original}" data-translation="${translation}" data-difficulty="${difficulty}" title="标记已学会">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
          </svg>
        </button>
        <button class="lingrove-tooltip-btn lingrove-btn-retranslate" data-original="${original}" title="根据上下文重新翻译">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
          </svg>
        </button>
      </div>
    `;

    // 计算位置
    let posLeft, posTop;
    const caretRange = document.caretRangeFromPoint(mouseX, mouseY);
    if (caretRange && element.contains(caretRange.startContainer)) {
      const tempRange = document.createRange();
      tempRange.setStart(caretRange.startContainer, caretRange.startOffset);
      tempRange.setEnd(caretRange.startContainer, caretRange.startOffset);
      const caretRect = tempRange.getBoundingClientRect();
      posLeft = caretRect.left;
      posTop = caretRect.bottom;
    } else {
      const rect = element.getBoundingClientRect();
      posLeft = rect.left;
      posTop = mouseY + 16;
    }

    L.tooltip.style.left = posLeft + window.scrollX + 'px';
    L.tooltip.style.top = posTop + window.scrollY + 2 + 'px';
    L.tooltip.style.display = 'block';

    // 加载词典数据
    const dictionaryType = L.config.dictionaryType || 'en-en';
    const dictContainer = L.tooltip.querySelector('.lingrove-tooltip-dict');
    if (dictContainer && dictWord) {
      const cacheKey = `${dictWord.toLowerCase()}_${dictionaryType}`;
      const cachedData = L.dictCache.get(cacheKey);
      if (cachedData) {
        L.updateTooltipDictionary(cachedData);
      } else {
        dictContainer.innerHTML = '<div class="lingrove-dict-loading">加载词典...</div>';
        L.fetchDictionaryData(dictWord).then(dictData => {
          if (L.tooltip.style.display !== 'none') {
            if (dictData) {
              L.updateTooltipDictionary(dictData);
            } else {
              dictContainer.innerHTML = '<div class="lingrove-dict-empty">暂无词典数据</div>';
            }
          }
        });
      }
    } else if (dictContainer) {
      dictContainer.innerHTML = '<div class="lingrove-dict-empty">暂无词典数据</div>';
    }
  };

  /**
   * 隐藏 Tooltip
   */
  L.hideTooltip = function(immediate = false) {
    if (immediate) {
      clearTimeout(L.tooltipHideTimeout);
      if (L.tooltip) L.tooltip.style.display = 'none';
      L.currentTooltipElement = null;
    } else {
      L.tooltipHideTimeout = setTimeout(() => {
        if (L.tooltip) L.tooltip.style.display = 'none';
        L.currentTooltipElement = null;
      }, 200);
    }
  };

  /**
   * 取消隐藏 Tooltip
   */
  L.cancelHideTooltip = function() {
    clearTimeout(L.tooltipHideTimeout);
  };

  // 选择弹窗状态
  L.selectionPopupState = 'idle'; // idle, loading, result, error
  L.selectionPopupText = '';
  L.selectionPopupResult = null;
  L.wordActionPopup = null;

  // 英文虚词列表
  const STOP_WORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'and', 'but', 'or', 'nor', 'so', 'yet', 'i', 'me', 'my', 'we', 'our',
    'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they',
    'them', 'their', 'this', 'that', 'these', 'those', 'am', 'not', 'no'
  ]);

  /**
   * 判断词汇是否值得添加到记忆
   */
  L.isMemorizableWord = function(word) {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    return clean.length >= 2 && !STOP_WORDS.has(clean);
  };

  /**
   * 分词处理
   */
  L.tokenizeText = function(text, lang) {
    if (lang === 'zh' || lang === 'ja') {
      return text.split('');
    }
    return text.match(/[\w'-]+|[^\w\s]/g) || [];
  };

  /**
   * 创建选择弹窗
   */
  L.createSelectionPopup = function() {
    if (L.selectionPopup) return;

    L.selectionPopup = document.createElement('div');
    L.selectionPopup.className = 'lingrove-selection-popup';
    L.selectionPopup.setAttribute('data-theme', L.config?.theme || 'dark');
    L.selectionPopup.setAttribute('data-state', 'idle');
    L.selectionPopup.setAttribute('data-length', 'short');
    L.selectionPopup.style.display = 'none';
    document.body.appendChild(L.selectionPopup);

    // 创建词汇操作弹窗
    L.wordActionPopup = document.createElement('div');
    L.wordActionPopup.className = 'lingrove-word-action-popup';
    L.wordActionPopup.setAttribute('data-theme', L.config?.theme || 'dark');
    L.wordActionPopup.style.display = 'none';
    L.wordActionPopup.innerHTML = `
      <button class="lingrove-word-action-btn" data-action="memorize">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M12.1,18.55L12,18.65L11.89,18.55C7.14,14.24 4,11.39 4,8.5C4,6.5 5.5,5 7.5,5C9.04,5 10.54,6 11.07,7.36H12.93C13.46,6 14.96,5 16.5,5C18.5,5 20,6.5 20,8.5C20,11.39 16.86,14.24 12.1,18.55M16.5,3C14.76,3 13.09,3.81 12,5.08C10.91,3.81 9.24,3 7.5,3C4.42,3 2,5.41 2,8.5C2,12.27 5.4,15.36 10.55,20.03L12,21.35L13.45,20.03C18.6,15.36 22,12.27 22,8.5C22,5.41 19.58,3 16.5,3Z"/>
        </svg>
        添加到记忆
      </button>
    `;
    document.body.appendChild(L.wordActionPopup);
  };

  /**
   * 更新选择弹窗内容
   */
  L.updateSelectionPopup = function(text, lengthType) {
    if (!L.selectionPopup) return;

    L.selectionPopupText = text;
    L.selectionPopupState = 'idle';
    L.selectionPopupResult = null;
    L.selectionPopup.setAttribute('data-state', 'idle');
    L.selectionPopup.setAttribute('data-length', lengthType);

    const isInMemorizeList = (L.config.memorizeList || []).some(w =>
      w.word.toLowerCase() === text.toLowerCase()
    );

    // 工具栏按钮
    let toolbarHtml = `
      <div class="lingrove-selection-toolbar">
        <button class="lingrove-sel-btn" data-action="translate" title="翻译">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M12.87,15.07L10.33,12.56L10.36,12.53C12.1,10.59 13.34,8.36 14.07,6H17V4H10V2H8V4H1V6H12.17C11.5,7.92 10.44,9.75 9,11.35C8.07,10.32 7.3,9.19 6.69,8H4.69C5.42,9.63 6.42,11.17 7.67,12.56L2.58,17.58L4,19L9,14L12.11,17.11L12.87,15.07M18.5,10H16.5L12,22H14L15.12,19H19.87L21,22H23L18.5,10M15.88,17L17.5,12.67L19.12,17H15.88Z"/>
          </svg>
          翻译
        </button>`;

    // 短文本才显示记忆按钮
    if (lengthType === 'short') {
      toolbarHtml += `
        <button class="lingrove-sel-btn ${isInMemorizeList ? 'active' : ''}" data-action="memorize" title="${isInMemorizeList ? '已在记忆列表' : '添加到记忆'}">
          <svg viewBox="0 0 24 24" width="16" height="16">
            ${isInMemorizeList
              ? '<path fill="currentColor" d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>'
              : '<path fill="currentColor" d="M12.1,18.55L12,18.65L11.89,18.55C7.14,14.24 4,11.39 4,8.5C4,6.5 5.5,5 7.5,5C9.04,5 10.54,6 11.07,7.36H12.93C13.46,6 14.96,5 16.5,5C18.5,5 20,6.5 20,8.5C20,11.39 16.86,14.24 12.1,18.55M16.5,3C14.76,3 13.09,3.81 12,5.08C10.91,3.81 9.24,3 7.5,3C4.42,3 2,5.41 2,8.5C2,12.27 5.4,15.36 10.55,20.03L12,21.35L13.45,20.03C18.6,15.36 22,12.27 22,8.5C22,5.41 19.58,3 16.5,3Z"/>'
            }
          </svg>
          记忆
        </button>`;
    }

    toolbarHtml += `
        <button class="lingrove-sel-btn" data-action="copy" title="复制">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/>
          </svg>
          复制
        </button>
      </div>
      <div class="lingrove-selection-result"></div>
    `;

    L.selectionPopup.innerHTML = toolbarHtml;
  };

  /**
   * 显示翻译加载状态
   */
  L.showSelectionLoading = function() {
    L.selectionPopupState = 'loading';
    L.selectionPopup.setAttribute('data-state', 'loading');
    const resultDiv = L.selectionPopup.querySelector('.lingrove-selection-result');
    if (resultDiv) {
      resultDiv.innerHTML = '<div class="lingrove-sel-loading">翻译中...</div>';
    }
  };

  /**
   * 显示翻译结果
   */
  L.showSelectionResult = function(result) {
    L.selectionPopupState = 'result';
    L.selectionPopupResult = result;
    L.selectionPopup.setAttribute('data-state', 'result');

    const resultDiv = L.selectionPopup.querySelector('.lingrove-selection-result');
    if (!resultDiv) return;

    const { translation, original, phonetic, isWord, dictData } = result;
    const sourceLang = L.detectLanguage(original);

    let html = '';

    if (isWord) {
      // 单词结果
      html = `
        <div class="lingrove-sel-header">
          <span class="lingrove-sel-word">${translation}</span>
        </div>
        ${phonetic ? `
        <div class="lingrove-sel-phonetic lingrove-sel-speak" data-text="${original}" title="朗读原文">
          <svg viewBox="0 0 24 24" width="12" height="12">
            <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
          </svg>
          <span>${phonetic}</span>
        </div>
        ` : ''}
        <div class="lingrove-sel-speak-group">
          <div class="lingrove-sel-speak-btn lingrove-sel-speak" data-text="${original}" title="朗读原文">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
            </svg>
            原文
          </div>
          <div class="lingrove-sel-speak-btn lingrove-sel-speak" data-text="${translation}" title="朗读译文">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
            </svg>
            译文
          </div>
        </div>
        <div class="lingrove-sel-original">原文: ${original}</div>
        <div class="lingrove-sel-dict"></div>
      `;
    } else {
      // 句子结果 - 原文词汇可点击
      const tokens = L.tokenizeText(original, sourceLang);
      const clickableHtml = tokens.map(token => {
        if (L.isMemorizableWord(token)) {
          return `<span class="lingrove-sel-clickable-word" data-word="${token}">${token}</span>`;
        }
        return `<span>${token}</span>`;
      }).join(sourceLang === 'en' ? ' ' : '');

      const translationLang = L.detectLanguage(translation);

      html = `
        <div class="lingrove-sel-translation">${translation}</div>
        <div class="lingrove-sel-speak-group">
          <div class="lingrove-sel-speak-btn lingrove-sel-speak" data-text="${original}" title="朗读原文">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
            </svg>
            原文
          </div>
          <div class="lingrove-sel-speak-btn lingrove-sel-speak" data-text="${translation}" title="朗读译文">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
            </svg>
            译文
          </div>
        </div>
        <div class="lingrove-sel-original-sentence">原文: ${clickableHtml}</div>
      `;
    }

    resultDiv.innerHTML = html;

    // 加载词典数据（仅单词）
    if (isWord && sourceLang === 'en') {
      L.fetchDictionaryData(original).then(dictData => {
        if (dictData && L.selectionPopupState === 'result') {
          const dictContainer = resultDiv.querySelector('.lingrove-sel-dict');
          if (dictContainer) {
            let dictHtml = '';
            for (const meaning of dictData.meanings) {
              dictHtml += `<div class="lingrove-dict-entry">`;
              if (meaning.partOfSpeech) {
                dictHtml += `<span class="lingrove-dict-pos">${meaning.partOfSpeech}</span>`;
              }
              dictHtml += `<ul class="lingrove-dict-defs">`;
              for (const def of meaning.definitions) {
                dictHtml += `<li>${def}</li>`;
              }
              dictHtml += `</ul></div>`;
            }
            dictContainer.innerHTML = dictHtml;
          }
        }
      });
    }
  };

  /**
   * 显示翻译错误
   */
  L.showSelectionError = function(message) {
    L.selectionPopupState = 'error';
    L.selectionPopup.setAttribute('data-state', 'error');
    const resultDiv = L.selectionPopup.querySelector('.lingrove-selection-result');
    if (resultDiv) {
      resultDiv.innerHTML = `<div class="lingrove-sel-error">${message}</div>`;
    }
  };

  /**
   * 隐藏词汇操作弹窗
   */
  L.hideWordActionPopup = function() {
    if (L.wordActionPopup) {
      L.wordActionPopup.style.display = 'none';
    }
  };

  /**
   * 显示词汇操作弹窗
   */
  L.showWordActionPopup = function(word, x, y) {
    if (!L.wordActionPopup) return;

    const isInMemorizeList = (L.config.memorizeList || []).some(w =>
      w.word.toLowerCase() === word.toLowerCase()
    );

    const btn = L.wordActionPopup.querySelector('.lingrove-word-action-btn');
    if (btn) {
      if (isInMemorizeList) {
        btn.classList.add('active');
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>
          </svg>
          已在记忆列表
        `;
      } else {
        btn.classList.remove('active');
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M12.1,18.55L12,18.65L11.89,18.55C7.14,14.24 4,11.39 4,8.5C4,6.5 5.5,5 7.5,5C9.04,5 10.54,6 11.07,7.36H12.93C13.46,6 14.96,5 16.5,5C18.5,5 20,6.5 20,8.5C20,11.39 16.86,14.24 12.1,18.55M16.5,3C14.76,3 13.09,3.81 12,5.08C10.91,3.81 9.24,3 7.5,3C4.42,3 2,5.41 2,8.5C2,12.27 5.4,15.36 10.55,20.03L12,21.35L13.45,20.03C18.6,15.36 22,12.27 22,8.5C22,5.41 19.58,3 16.5,3Z"/>
          </svg>
          添加到记忆
        `;
      }
    }

    L.wordActionPopup.setAttribute('data-word', word);
    L.wordActionPopup.style.left = x + 'px';
    L.wordActionPopup.style.top = y + 'px';
    L.wordActionPopup.style.display = 'block';
  };

})(window.Lingrove);
