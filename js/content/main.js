/**
 * Lingrove 主入口模块
 * 页面处理、初始化等核心逻辑
 */

(function(L) {
  'use strict';

  // 状态变量
  L.isProcessing = false;
  L.intersectionObserver = null;

  /**
   * 设置 IntersectionObserver
   */
  L.setupIntersectionObserver = function() {
    if (L.intersectionObserver) {
      L.intersectionObserver.disconnect();
    }

    L.intersectionObserver = new IntersectionObserver((entries) => {
      if (!L.config?.enabled || !L.shouldProcessSite()) return;

      let hasNewVisible = false;

      for (const entry of entries) {
        if (entry.isIntersecting) {
          const container = entry.target;
          if (container.hasAttribute('data-lingrove-processed')) continue;

          if (!L.pendingContainers.has(container)) {
            L.pendingContainers.add(container);
            container.setAttribute('data-lingrove-observing', 'true');
            hasNewVisible = true;
          }
        }
      }

      if (hasNewVisible && !L.isProcessing) {
        L.processPendingContainers();
      }
    }, {
      rootMargin: '500px 0px',
      threshold: 0
    });
  };

  /**
   * 处理待处理的可见容器
   */
  L.processPendingContainers = L.debounce(async function() {
    if (L.isProcessing || L.pendingContainers.size === 0) return;

    L.isProcessing = true;

    try {
      const containers = Array.from(L.pendingContainers).slice(0, L.MAX_SEGMENTS_PER_BATCH);
      for (const container of containers) {
        L.pendingContainers.delete(container);
      }

      const segments = [];
      const whitelistWords = new Set((L.config.learnedWords || []).map(w => w.original.toLowerCase()));

      for (const container of containers) {
        container.removeAttribute('data-lingrove-observing');

        if (container.hasAttribute('data-lingrove-processed')) continue;

        const text = L.getTextContent(container);
        if (!text || text.length < L.getMinTextLength(text)) continue;
        if (L.isCodeText(text)) continue;

        const path = L.getElementPath(container);
        const fingerprint = L.generateFingerprint(text, path);
        if (L.processedFingerprints.has(fingerprint)) continue;

        // 检查移除已学会词汇后文本是否足够长（用于判断是否值得处理）
        let filteredText = text;
        for (const word of whitelistWords) {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          filteredText = filteredText.replace(regex, '');
        }

        const minFilteredLength = L.getMinTextLength(filteredText);
        if (filteredText.trim().length >= minFilteredLength) {
          // 发送完整原文给 AI，保持语义完整
          segments.push({ element: container, text: text.slice(0, 2000), fingerprint, path });
        }
      }

      for (let i = 0; i < segments.length; i += L.MAX_SEGMENTS_PER_REQUEST) {
        const batch = segments.slice(i, i + L.MAX_SEGMENTS_PER_REQUEST);
        await L.processBatchSegments(batch, whitelistWords);

        if (i + L.MAX_SEGMENTS_PER_REQUEST < segments.length) {
          await new Promise(resolve => setTimeout(resolve, L.REQUEST_INTERVAL_MS));
        }
      }
    } finally {
      L.isProcessing = false;

      if (L.pendingContainers.size > 0) {
        L.processPendingContainers();
      }
    }
  }, 100);

  /**
   * 批量处理段落
   */
  L.processBatchSegments = async function(segments, whitelistWords) {
    if (segments.length === 0) return;

    // 发送完整原文给 AI，保持语义完整
    const combinedText = segments.map(s => s.text).join('\n\n---\n\n');

    try {
      const result = await L.translateText(combinedText);

      const allReplacements = [...(result.immediate || [])];
      const learnedWordDisplay = L.config.learnedWordDisplay || 'hide';

      for (const segment of segments) {
        const segmentText = segment.text.toLowerCase();

        // 分离已学会词汇和新词汇
        const matchingReplacements = allReplacements.filter(r =>
          segmentText.includes(r.original.toLowerCase()) &&
          !whitelistWords.has(r.original.toLowerCase())
        );

        // 根据设置处理已学会词汇
        let learnedReplacements = [];
        if (learnedWordDisplay !== 'hide') {
          const learnedWordsMap = new Map((L.config.learnedWords || []).map(w => [w.original.toLowerCase(), w]));
          // 直接从 learnedWords 中获取，而不是从 allReplacements 中过滤
          learnedReplacements = Array.from(learnedWordsMap.values())
            .filter(w => segmentText.includes(w.original.toLowerCase()))
            .map(w => ({
              original: w.original,
              translation: w.word,  // learnedWords 中翻译字段是 word
              phonetic: w.phonetic || '',
              difficulty: w.difficulty || 'B1',
              isLearned: true,
              position: segmentText.toLowerCase().indexOf(w.original.toLowerCase())
            }));
        }

        const allToApply = [...matchingReplacements, ...learnedReplacements];

        if (allToApply.length > 0) {
          L.applyReplacements(segment.element, allToApply);
          L.processedFingerprints.add(segment.fingerprint);
          const wordsToFetch = matchingReplacements.map(r => r.original).concat(matchingReplacements.map(r => r.translation));
          L.prefetchDictionaryData(wordsToFetch);
        }
      }

      if (result.async) {
        result.async.then(asyncReplacements => {
          if (asyncReplacements?.length) {
            const learnedWordDisplay = L.config.learnedWordDisplay || 'hide';

            for (const segment of segments) {
              const segmentText = segment.text.toLowerCase();
              const alreadyReplaced = new Set();
              segment.element.querySelectorAll('.lingrove-translated').forEach(el => {
                const original = el.getAttribute('data-original');
                if (original) alreadyReplaced.add(original.toLowerCase());
              });

              const matchingReplacements = asyncReplacements.filter(r =>
                segmentText.includes(r.original.toLowerCase()) &&
                !whitelistWords.has(r.original.toLowerCase()) &&
                !alreadyReplaced.has(r.original.toLowerCase())
              );

              // 根据设置处理已学会词汇
              let learnedReplacements = [];
              if (learnedWordDisplay !== 'hide') {
                const learnedWordsMap = new Map((L.config.learnedWords || []).map(w => [w.original.toLowerCase(), w]));
                // 直接从 learnedWords 中获取，而不是从 asyncReplacements 中过滤
                learnedReplacements = Array.from(learnedWordsMap.values())
                  .filter(w =>
                    segmentText.includes(w.original.toLowerCase()) &&
                    !alreadyReplaced.has(w.original.toLowerCase())
                  )
                  .map(w => ({
                    original: w.original,
                    translation: w.word,  // learnedWords 中翻译字段是 word
                    phonetic: w.phonetic || '',
                    difficulty: w.difficulty || 'B1',
                    isLearned: true,
                    position: segmentText.toLowerCase().indexOf(w.original.toLowerCase())
                  }));
              }

              const allToApply = [...matchingReplacements, ...learnedReplacements];

              if (allToApply.length > 0) {
                L.applyReplacements(segment.element, allToApply);
                const wordsToFetch = matchingReplacements.map(r => r.original).concat(matchingReplacements.map(r => r.translation));
                L.prefetchDictionaryData(wordsToFetch);
              }
            }
          }
        }).catch(error => {
          console.error('[Lingrove] Async translation error:', error);
        });
      }
    } catch (error) {
      console.error('[Lingrove] Batch processing error:', error);
    }
  };

  /**
   * 观察文本容器
   */
  L.observeTextContainers = function() {
    if (!L.intersectionObserver) return;
    if (!L.config?.enabled) return;
    if (!L.shouldProcessSite()) return;

    const containers = L.findTextContainers(document.body);
    let hasVisibleUnprocessed = false;

    for (const container of containers) {
      if (container.hasAttribute('data-lingrove-processed')) continue;

      if (L.isInViewport(container)) {
        if (!container.hasAttribute('data-lingrove-observing')) {
          L.pendingContainers.add(container);
          container.setAttribute('data-lingrove-observing', 'true');
          hasVisibleUnprocessed = true;
        }
      }

      L.intersectionObserver.observe(container);
    }

    if (hasVisibleUnprocessed && !L.isProcessing) {
      L.processPendingContainers();
    }
  };

  /**
   * 处理页面
   */
  L.processPage = async function(viewportOnly = true) {
    if (!L.config?.enabled) return { processed: 0, disabled: true };

    const hostname = window.location.hostname;
    if (L.config.siteMode === 'all') {
      if (L.config.excludedSites?.some(domain => hostname.includes(domain))) {
        return { processed: 0, excluded: true };
      }
    } else {
      if (!L.config.allowedSites?.some(domain => hostname.includes(domain))) {
        return { processed: 0, excluded: true };
      }
    }

    if (L.wordCache.size === 0) {
      await L.loadWordCache();
    }

    const memorizeWords = (L.config.memorizeList || []).map(w => w.word).filter(w => w && w.trim());
    if (memorizeWords.length > 0) {
      L.processSpecificWords(memorizeWords).catch(console.error);
    }

    L.observeTextContainers();

    return { processed: 0, lazy: true };
  };

  /**
   * 初始化
   */
  L.init = async function() {
    await L.loadConfig();
    await L.loadWordCache();

    L.createTooltip();
    L.createSelectionPopup();

    L.setupIntersectionObserver();
    L.setupEventListeners();

    if (L.config.autoProcess && L.config.enabled && (L.config.hasApiNodes || L.config.apiEndpoint)) {
      setTimeout(() => {
        const memorizeWords = (L.config.memorizeList || []).map(w => w.word).filter(w => w && w.trim());
        if (memorizeWords.length > 0) {
          L.processSpecificWords(memorizeWords).catch(console.error);
        }
        L.observeTextContainers();
      }, 500);
    }
  };

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', L.init);
  } else {
    L.init();
  }

})(window.Lingrove);
