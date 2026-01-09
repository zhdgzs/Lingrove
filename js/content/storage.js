/**
 * Lingrove 存储操作模块
 * 管理配置加载、缓存读写、统计更新等
 */

(function(L) {
  'use strict';

  // 状态变量
  L.config = null;
  L.wordCache = new Map();

  /**
   * 加载配置
   * @returns {Promise<object>}
   */
  L.loadConfig = function() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (syncResult) => {
        // 从 local 获取词汇列表（避免 sync 的 8KB 限制）
        chrome.storage.local.get(['learnedWords', 'memorizeList'], (localResult) => {
          // 检查是否有可用的 API 节点
          const apiNodes = syncResult.apiNodes || [];
          const hasApiNodes = apiNodes.some(n => n.enabled);

          L.config = {
            // 使用新的多节点配置，保留旧字段用于向后兼容
            apiEndpoint: hasApiNodes ? 'multi-node' : (syncResult.apiEndpoint || ''),
            apiKey: syncResult.apiKey || '',
            modelName: syncResult.modelName || 'deepseek-chat',
            apiNodes: apiNodes,
            hasApiNodes: hasApiNodes,
            nativeLanguage: syncResult.nativeLanguage || 'zh-CN',
            targetLanguage: syncResult.targetLanguage || 'en',
            difficultyLevel: syncResult.difficultyLevel || 'B1',
            translationDensity: syncResult.translationDensity || 30,
            minLengthConfig: syncResult.minLengthConfig || { zh: 20, ja: 20, ko: 20, en: 50 },
            learnedWordDisplay: syncResult.learnedWordDisplay || 'hide',
            processMode: syncResult.processMode || 'both',
            autoProcess: syncResult.autoProcess ?? false,
            showPhonetic: syncResult.showPhonetic ?? true,
            dictionaryType: syncResult.dictionaryType || 'zh-en',
            showAddMemorize: syncResult.showAddMemorize ?? true,
            cacheMaxSize: syncResult.cacheMaxSize || L.DEFAULT_CACHE_MAX_SIZE,
            translationStyle: syncResult.translationStyle || 'translation-original',
            theme: syncResult.theme || 'dark',
            enabled: syncResult.enabled ?? true,
            siteMode: syncResult.siteMode || 'all',
            excludedSites: syncResult.excludedSites || syncResult.blacklist || [],
            allowedSites: syncResult.allowedSites || [],
            learnedWords: localResult.learnedWords || [],
            memorizeList: localResult.memorizeList || [],
            colorTheme: syncResult.colorTheme || 'default',
            customTheme: syncResult.customTheme || null,
            customizedThemes: syncResult.customizedThemes || null,
            customPromptRules: syncResult.customPromptRules || L.DEFAULT_CUSTOM_PROMPT,
            customSourceRules: syncResult.customSourceRules || {},
            customTargetRules: syncResult.customTargetRules || {}
          };

          // 加载保存的自定义主题配置
          if (L.config.customizedThemes) {
            ['ocean', 'forest', 'sunset'].forEach(themeId => {
              if (L.config.customizedThemes[themeId]) {
                L.BUILT_IN_THEMES[themeId] = L.config.customizedThemes[themeId];
              }
            });
          }

          // 应用主题
          L.applyColorTheme(L.config.colorTheme, L.config.customTheme);

          resolve(L.config);
        });
      });
    });
  };

  /**
   * 应用颜色主题
   * @param {string} themeId - 主题 ID
   * @param {object} customTheme - 自定义主题配置
   */
  L.applyColorTheme = function(themeId, customTheme) {
    const theme = themeId === 'custom' && customTheme ? customTheme : L.BUILT_IN_THEMES[themeId] || L.BUILT_IN_THEMES.default;

    // 创建或更新样式元素
    let styleEl = document.getElementById('lingrove-theme-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'lingrove-theme-style';
      document.head.appendChild(styleEl);
    }

    // 计算渐变的第二个颜色（稍微偏紫/深一点）
    const gradientEnd = theme.primary.replace('#', '');
    const r = Math.max(0, parseInt(gradientEnd.substr(0, 2), 16) - 20);
    const g = Math.max(0, parseInt(gradientEnd.substr(2, 2), 16) - 30);
    const b = Math.min(255, parseInt(gradientEnd.substr(4, 2), 16) + 20);
    const secondColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

    // 卡片背景色（自定义主题可以设置）
    const cardBgDark = theme.cardBg || '#1e293b';
    const cardBgLight = theme.cardBgLight || '#ffffff';
    const cardBorderDark = theme.cardBorder || '#334155';
    const cardBorderLight = theme.cardBorderLight || '#e2e8f0';

    // 下划线样式
    const underlineWidth = theme.underlineWidth || '2px';
    const underlineStyle = theme.underlineStyle || 'solid';

    // 文本颜色（空值表示保持原样式）
    const wordColorStyle = theme.wordColor ? `color: ${theme.wordColor} !important;` : '';
    const originalColorStyle = theme.originalColor ? `color: ${theme.originalColor} !important;` : '';

    styleEl.textContent = `
      .lingrove-translated {
        border-bottom: ${underlineWidth} ${underlineStyle} ${theme.underline} !important;
        text-decoration: none !important;
      }
      .lingrove-translated:hover {
        background: ${theme.hoverBg} !important;
      }
      ${wordColorStyle ? `.lingrove-translated .lingrove-word { ${wordColorStyle} }` : ''}
      ${originalColorStyle ? `.lingrove-translated .lingrove-original { ${originalColorStyle} }` : ''}
      .lingrove-tooltip .lingrove-tooltip-word {
        color: ${theme.tooltipWord} !important;
      }
      .lingrove-tooltip[data-theme="light"] .lingrove-tooltip-word {
        color: ${theme.primary} !important;
      }
      .lingrove-tooltip {
        background: ${cardBgDark} !important;
        border-color: ${cardBorderDark} !important;
      }
      .lingrove-tooltip[data-theme="light"] {
        background: ${cardBgLight} !important;
        border-color: ${cardBorderLight} !important;
      }
    `;
  };

  /**
   * 更新 UI 元素的主题
   */
  L.updateUITheme = function() {
    const theme = L.config?.theme || 'dark';
    if (L.tooltip) {
      L.tooltip.setAttribute('data-theme', theme);
    }
    if (L.selectionPopup) {
      L.selectionPopup.setAttribute('data-theme', theme);
    }
  };

  /**
   * 加载词汇缓存
   * @returns {Promise<Map>}
   */
  L.loadWordCache = function() {
    return new Promise((resolve) => {
      chrome.storage.local.get(L.WORD_CACHE_STORAGE_KEY, (result) => {
        const cached = result[L.WORD_CACHE_STORAGE_KEY];
        if (cached && Array.isArray(cached)) {
          cached.forEach(item => {
            L.wordCache.set(item.key, {
              translation: item.translation,
              phonetic: item.phonetic,
              difficulty: item.difficulty
            });
          });
        }
        resolve(L.wordCache);
      });
    });
  };

  /**
   * 保存词汇缓存
   * @returns {Promise}
   */
  L.saveWordCache = function() {
    // 使用 Map 确保 key 唯一
    const data = [];
    const seenKeys = new Set();
    for (const [key, value] of L.wordCache) {
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        data.push({ key, ...value });
      }
    }
    return new Promise((resolve, reject) => {
      const saveData = {};
      saveData[L.WORD_CACHE_STORAGE_KEY] = data;
      chrome.storage.local.set(saveData, () => {
        if (chrome.runtime.lastError) {
          console.error('[Lingrove] Failed to save cache:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  };

  /**
   * 更新统计数据
   * @param {object} stats - 统计数据
   * @returns {Promise<object>}
   */
  L.updateStats = function(stats) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['totalWords', 'todayWords', 'lastResetDate', 'cacheHits', 'cacheMisses'], (current) => {
        const today = new Date().toISOString().split('T')[0];
        if (current.lastResetDate !== today) {
          current.todayWords = 0;
          current.lastResetDate = today;
        }
        const updated = {
          totalWords: (current.totalWords || 0) + (stats.newWords || 0),
          todayWords: (current.todayWords || 0) + (stats.newWords || 0),
          lastResetDate: today,
          cacheHits: (current.cacheHits || 0) + (stats.cacheHits || 0),
          cacheMisses: (current.cacheMisses || 0) + (stats.cacheMisses || 0)
        };
        chrome.storage.sync.set(updated, () => resolve(updated));
      });
    });
  };

  /**
   * 添加到已学词汇列表
   * @param {string} original - 原词
   * @param {string} translation - 翻译
   * @param {string} difficulty - 难度
   * @returns {Promise}
   */
  L.addToWhitelist = async function(original, translation, difficulty) {
    const whitelist = L.config.learnedWords || [];
    const exists = whitelist.some(w => w.original === original || w.word === translation);
    if (!exists) {
      whitelist.push({
        original,
        word: translation,
        addedAt: Date.now(),
        difficulty: difficulty || 'B1'
      });
      L.config.learnedWords = whitelist;
      await new Promise(resolve => chrome.storage.local.set({ learnedWords: whitelist }, resolve));
    }
  };

  /**
   * 添加到记忆列表
   * @param {string} word - 词汇
   * @returns {Promise}
   */
  L.addToMemorizeList = async function(word) {
    if (!word || !word.trim()) {
      console.warn('[Lingrove] Invalid word for memorize list:', word);
      return;
    }

    const trimmedWord = word.trim();
    const list = L.config.memorizeList || [];
    const exists = list.some(w => w.word === trimmedWord);

    if (!exists) {
      list.push({ word: trimmedWord, addedAt: Date.now() });
      L.config.memorizeList = list;
      await new Promise(resolve => chrome.storage.local.set({ memorizeList: list }, resolve));

      // 确保配置已加载且扩展已启用
      if (!L.config) {
        await L.loadConfig();
      }

      // 确保扩展已启用
      if (!L.config.enabled) {
        L.showToast(`"${trimmedWord}" 已添加到记忆列表`);
        return;
      }

      // 立即触发翻译处理
      try {
        const count = await L.processSpecificWords([trimmedWord]);

        if (count > 0) {
          L.showToast(`"${trimmedWord}" 已添加到记忆列表并翻译`);
        } else {
          // 即使页面上没有找到，也要确保翻译结果被缓存
          try {
            await L.translateSpecificWords([trimmedWord]);
            L.showToast(`"${trimmedWord}" 已添加到记忆列表`);
          } catch (error) {
            console.error('[Lingrove] Error translating word:', trimmedWord, error);
            L.showToast(`"${trimmedWord}" 已添加到记忆列表`);
          }
        }
      } catch (error) {
        console.error('[Lingrove] Error processing word:', trimmedWord, error);
        L.showToast(`"${trimmedWord}" 已添加到记忆列表`);
      }
    } else {
      L.showToast(`"${trimmedWord}" 已在记忆列表中`);
    }
  };

  /**
   * 从记忆列表移除
   * @param {string} word - 词汇
   * @returns {Promise}
   */
  L.removeFromMemorizeList = async function(word) {
    if (!word || !word.trim()) return;

    const trimmedWord = word.trim();
    const list = L.config.memorizeList || [];
    const newList = list.filter(w => w.word !== trimmedWord);

    if (newList.length !== list.length) {
      L.config.memorizeList = newList;
      await new Promise(resolve => chrome.storage.local.set({ memorizeList: newList }, resolve));
      L.showToast(`"${trimmedWord}" 已从记忆列表移除`);
    }
  };

})(window.Lingrove);
