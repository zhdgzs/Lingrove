/**
 * Lingrove 事件处理模块
 * 处理用户交互、消息监听等
 */

(function(L) {
  'use strict';

  /**
   * 设置事件监听器
   */
  L.setupEventListeners = function() {
    // 悬停显示提示
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('.lingrove-translated');
      const tooltipTarget = e.target.closest('.lingrove-tooltip');

      if (target) {
        L.cancelHideTooltip();
        L.showTooltip(target, e.clientX, e.clientY);
      } else if (tooltipTarget) {
        L.cancelHideTooltip();
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('.lingrove-translated');
      const tooltipTarget = e.target.closest('.lingrove-tooltip');
      const relatedTarget = e.relatedTarget;

      if (target &&
          !relatedTarget?.closest('.lingrove-translated') &&
          !relatedTarget?.closest('.lingrove-tooltip')) {
        L.hideTooltip();
      }

      if (tooltipTarget &&
          !relatedTarget?.closest('.lingrove-tooltip') &&
          !relatedTarget?.closest('.lingrove-translated')) {
        L.hideTooltip();
      }
    });

    // tooltip 按钮点击事件
    document.addEventListener('click', (e) => {
      // 发音按钮
      const speakBtn = e.target.closest('.lingrove-btn-speak');
      if (speakBtn) {
        e.preventDefault();
        e.stopPropagation();
        const original = speakBtn.getAttribute('data-original');
        const translation = speakBtn.getAttribute('data-translation');

        const originalLang = L.detectLanguage(original);
        const isOriginalTargetLang = (originalLang === 'en' && L.config.targetLanguage === 'en') ||
                                     (originalLang === 'zh' && (L.config.targetLanguage === 'zh-CN' || L.config.targetLanguage === 'zh-TW')) ||
                                     (originalLang === 'ja' && L.config.targetLanguage === 'ja') ||
                                     (originalLang === 'ko' && L.config.targetLanguage === 'ko');

        const word = isOriginalTargetLang ? original : translation;
        const lang = L.config.targetLanguage === 'en' ? 'en-US' :
                     L.config.targetLanguage === 'zh-CN' ? 'zh-CN' :
                     L.config.targetLanguage === 'zh-TW' ? 'zh-TW' :
                     L.config.targetLanguage === 'ja' ? 'ja-JP' :
                     L.config.targetLanguage === 'ko' ? 'ko-KR' : 'en-US';

        chrome.runtime.sendMessage({ action: 'speak', text: word, lang });
        return;
      }

      // 收藏/记忆按钮
      const memorizeBtn = e.target.closest('.lingrove-btn-memorize');
      if (memorizeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const original = memorizeBtn.getAttribute('data-original');
        const isActive = memorizeBtn.classList.contains('active');

        if (!isActive) {
          L.addToMemorizeList(original);
          memorizeBtn.classList.add('active');
          memorizeBtn.title = '已在记忆列表';
          memorizeBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>
            </svg>
          `;
        } else {
          L.removeFromMemorizeList(original);
          memorizeBtn.classList.remove('active');
          memorizeBtn.title = '添加到记忆';
          memorizeBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12.1,18.55L12,18.65L11.89,18.55C7.14,14.24 4,11.39 4,8.5C4,6.5 5.5,5 7.5,5C9.04,5 10.54,6 11.07,7.36H12.93C13.46,6 14.96,5 16.5,5C18.5,5 20,6.5 20,8.5C20,11.39 16.86,14.24 12.1,18.55M16.5,3C14.76,3 13.09,3.81 12,5.08C10.91,3.81 9.24,3 7.5,3C4.42,3 2,5.41 2,8.5C2,12.27 5.4,15.36 10.55,20.03L12,21.35L13.45,20.03C18.6,15.36 22,12.27 22,8.5C22,5.41 19.58,3 16.5,3Z"/>
            </svg>
          `;
        }
        return;
      }

      // 已学会按钮
      const learnedBtn = e.target.closest('.lingrove-btn-learned');
      if (learnedBtn) {
        e.preventDefault();
        e.stopPropagation();
        const original = learnedBtn.getAttribute('data-original');
        const translation = learnedBtn.getAttribute('data-translation');
        const difficulty = learnedBtn.getAttribute('data-difficulty') || 'B1';

        L.addToWhitelist(original, translation, difficulty);
        L.restoreAllSameWord(original);
        L.hideTooltip();
        L.showToast(`"${original}" 已标记为已学会`);
        return;
      }

      // 重新翻译按钮
      const retranslateBtn = e.target.closest('.lingrove-btn-retranslate');
      if (retranslateBtn) {
        e.preventDefault();
        e.stopPropagation();
        const original = retranslateBtn.getAttribute('data-original');
        L.retranslateWithContext(original);
        return;
      }
    });

    // 选择文本显示添加按钮
    document.addEventListener('mouseup', (e) => {
      if (e.target.closest('.lingrove-selection-popup')) return;

      if (!L.config?.showAddMemorize) {
        if (L.selectionPopup) L.selectionPopup.style.display = 'none';
        return;
      }

      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text && text.length > 1 && text.length < 50 && !e.target.closest('.lingrove-translated')) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          L.selectionPopup.style.left = rect.left + window.scrollX + 'px';
          L.selectionPopup.style.top = rect.bottom + window.scrollY + 5 + 'px';
          L.selectionPopup.style.display = 'block';
        } else {
          L.selectionPopup.style.display = 'none';
        }
      }, 10);
    });

    // 滚动处理
    const handleScroll = L.debounce(() => {
      if (L.config?.autoProcess && L.config?.enabled) {
        L.observeTextContainers();
      }
    }, 300);
    window.addEventListener('scroll', handleScroll, { passive: true });

    // 监听 DOM 变化
    const mutationObserver = new MutationObserver(L.debounce(() => {
      if (L.config?.autoProcess && L.config?.enabled) {
        L.observeTextContainers();
      }
    }, 500));

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 监听配置变化
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        L.loadConfig().then(() => {
          if (changes.enabled?.newValue === false) {
            L.restoreAll();
          }
          if (changes.theme) {
            L.updateUITheme();
          }
          if (changes.difficultyLevel || changes.intensity || changes.translationStyle || changes.processMode) {
            L.restoreAll();
            if (L.config.enabled) {
              L.processPage();
            }
          }
          if (changes.memorizeList) {
            const oldList = changes.memorizeList.oldValue || [];
            const newList = changes.memorizeList.newValue || [];
            const oldWords = new Set(oldList.map(w => w.word.toLowerCase()));
            const newWords = newList
              .filter(w => !oldWords.has(w.word.toLowerCase()))
              .map(w => w.word);

            if (newWords.length > 0 && L.config.enabled) {
              setTimeout(() => {
                L.processSpecificWords(newWords);
              }, 200);
            }
          }
        });
      }
    });

    // 监听来自 popup 或 background 的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'processPage') {
        L.processPage().then(sendResponse);
        return true;
      }
      if (message.action === 'restorePage') {
        L.restoreAll();
        sendResponse({ success: true });
      }
      if (message.action === 'processSpecificWords') {
        const words = message.words || [];
        if (words.length > 0) {
          L.processSpecificWords(words).then(count => {
            sendResponse({ success: true, count });
          }).catch(error => {
            console.error('[Lingrove] Error processing specific words:', error);
            sendResponse({ success: false, error: error.message });
          });
          return true;
        } else {
          sendResponse({ success: false, error: 'No words provided' });
        }
      }
      if (message.action === 'getStatus') {
        sendResponse({
          processed: L.processedFingerprints.size,
          isProcessing: L.isProcessing,
          enabled: L.config?.enabled
        });
      }
    });
  };

})(window.Lingrove);
