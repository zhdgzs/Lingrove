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
            minLengthConfig: syncResult.minLengthConfig || L.MIN_LENGTH_CONFIG,
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
            skipIPAddresses: syncResult.skipIPAddresses ?? false,
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
    const secondColor = L.getSecondaryColor(theme.primary);

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

// ==================== 翻译节点存储函数（全局） ====================

/**
 * 获取翻译节点列表
 * @returns {Promise<Array>} - 节点列表
 */
async function getTranslationNodes() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['translationNodes'], (result) => {
      const nodes = result.translationNodes || [];
      // 解码敏感字段
      resolve(nodes.map(node => ({
        ...node,
        secretKey: node.secretKey ? decodeBase64(node.secretKey) : '',
        apiKey: node.apiKey ? decodeBase64(node.apiKey) : ''
      })));
    });
  });
}

/**
 * 保存翻译节点列表
 * @param {Array} nodes - 节点列表
 * @returns {Promise}
 */
async function saveTranslationNodes(nodes) {
  return new Promise((resolve, reject) => {
    // 编码敏感字段
    const encodedNodes = nodes.map(node => ({
      ...node,
      secretKey: node.secretKey ? encodeBase64(node.secretKey) : '',
      apiKey: node.apiKey ? encodeBase64(node.apiKey) : ''
    }));

    chrome.storage.sync.set({ translationNodes: encodedNodes }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Storage] Failed to save translation nodes:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * 添加翻译节点
 * @param {Object} node - 节点配置
 * @returns {Promise<Object>} - 添加后的节点（含 ID）
 */
async function addTranslationNode(node) {
  const nodes = await getTranslationNodes();
  const newNode = createTranslationNode(node);
  nodes.push(newNode);
  await saveTranslationNodes(nodes);
  return newNode;
}

/**
 * 更新翻译节点
 * @param {string} nodeId - 节点 ID
 * @param {Object} updates - 更新内容
 * @returns {Promise<Object|null>} - 更新后的节点
 */
async function updateTranslationNode(nodeId, updates) {
  const nodes = await getTranslationNodes();
  const index = nodes.findIndex(n => n.id === nodeId);
  if (index === -1) return null;

  nodes[index] = { ...nodes[index], ...updates };
  await saveTranslationNodes(nodes);
  return nodes[index];
}

/**
 * 删除翻译节点
 * @param {string} nodeId - 节点 ID
 * @returns {Promise<boolean>} - 是否删除成功
 */
async function deleteTranslationNode(nodeId) {
  const nodes = await getTranslationNodes();
  const newNodes = nodes.filter(n => n.id !== nodeId);
  if (newNodes.length === nodes.length) return false;

  await saveTranslationNodes(newNodes);
  return true;
}

/**
 * 更新翻译节点顺序
 * @param {Array<string>} nodeIds - 节点 ID 列表（新顺序）
 * @returns {Promise}
 */
async function reorderTranslationNodes(nodeIds) {
  const nodes = await getTranslationNodes();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const reorderedNodes = nodeIds
    .map(id => nodeMap.get(id))
    .filter(Boolean);

  // 添加未在列表中的节点（保持原顺序）
  nodes.forEach(node => {
    if (!nodeIds.includes(node.id)) {
      reorderedNodes.push(node);
    }
  });

  await saveTranslationNodes(reorderedNodes);
}

/**
 * 更新节点测试结果
 * @param {string} nodeId - 节点 ID
 * @param {string} result - 测试结果 (success | failed)
 * @returns {Promise}
 */
async function updateNodeTestResult(nodeId, result) {
  return updateTranslationNode(nodeId, {
    lastTestTime: Date.now(),
    lastTestResult: result
  });
}

// ==================== Base64 编解码工具 ====================

/**
 * Base64 编码
 * @param {string} str
 * @returns {string}
 */
function encodeBase64(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    return str;
  }
}

/**
 * Base64 解码
 * @param {string} str
 * @returns {string}
 */
function decodeBase64(str) {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch (e) {
    return str;
  }
}
