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
        const isOriginalTargetLang = L.isTargetLanguage(originalLang, L.config.targetLanguage);

        const word = isOriginalTargetLang ? original : translation;
        const lang = L.getTtsLang(L.config.targetLanguage);

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
          memorizeBtn.innerHTML = L.getMemorizeIconSvg(true, 16);
        } else {
          L.removeFromMemorizeList(original);
          memorizeBtn.classList.remove('active');
          memorizeBtn.title = '添加到记忆';
          memorizeBtn.innerHTML = L.getMemorizeIconSvg(false, 16);
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
        L.updateLearnedWordDisplay(original, translation, difficulty);
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
      // 点击弹窗内部不处理
      if (e.target.closest('.lingrove-selection-popup')) return;
      if (e.target.closest('.lingrove-word-action-popup')) return;

      // 隐藏词汇操作弹窗
      L.hideWordActionPopup();

      if (!L.config?.showAddMemorize) {
        if (L.selectionPopup) L.selectionPopup.style.display = 'none';
        return;
      }

      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        // 判断文本长度类型
        const len = text.length;
        let lengthType = null;

        if (len >= 1 && len <= 50) {
          lengthType = 'short';
        } else if (len > 50 && len <= 300) {
          lengthType = 'paragraph';
        }
        // >300 不响应

        // 检查选中的文本是否在弹窗内
        const isInPopup = selection.anchorNode && (
          selection.anchorNode.parentElement?.closest('.lingrove-selection-popup') ||
          selection.anchorNode.parentElement?.closest('.lingrove-tooltip') ||
          selection.anchorNode.parentElement?.closest('.lingrove-word-action-popup')
        );

        if (lengthType && !e.target.closest('.lingrove-translated') && !isInPopup) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          L.updateSelectionPopup(text, lengthType);
          L.selectionPopup.style.left = rect.left + window.scrollX + 'px';
          L.selectionPopup.style.top = rect.bottom + window.scrollY + 5 + 'px';
          L.selectionPopup.style.display = 'block';
        } else {
          if (L.selectionPopup) L.selectionPopup.style.display = 'none';
        }
      }, 10);
    });

    // 选择弹窗按钮点击事件
    document.addEventListener('click', (e) => {
      // 选择弹窗内的按钮
      const selBtn = e.target.closest('.lingrove-sel-btn');
      if (selBtn) {
        e.preventDefault();
        e.stopPropagation();
        const action = selBtn.getAttribute('data-action');

        if (action === 'translate') {
          // 翻译
          L.showSelectionLoading();
          L.translateSelection(L.selectionPopupText)
            .then(result => {
              L.showSelectionResult(result);
            })
            .catch(err => {
              console.error('[Lingrove] Translation error:', err);
              L.showSelectionError(err.message || '翻译失败');
            });
        } else if (action === 'memorize') {
          // 记忆
          const text = L.selectionPopupText;
          const isActive = selBtn.classList.contains('active');

          if (!isActive) {
            L.addToMemorizeList(text);
            selBtn.classList.add('active');
            selBtn.title = '已在记忆列表';
            L.showToast(`"${text}" 已添加到需记忆列表`);
          } else {
            L.removeFromMemorizeList(text);
            selBtn.classList.remove('active');
            selBtn.title = '添加到记忆';
          }
        } else if (action === 'copy') {
          // 复制
          navigator.clipboard.writeText(L.selectionPopupText).then(() => {
            L.showToast('已复制到剪贴板');
          }).catch(() => {
            L.showToast('复制失败');
          });
        }
        return;
      }

      // 翻译结果区域的发音按钮
      const selSpeak = e.target.closest('.lingrove-sel-speak');
      if (selSpeak) {
        e.preventDefault();
        e.stopPropagation();
        const text = selSpeak.getAttribute('data-text');
        if (text) {
          const lang = L.detectLanguage(text);
          const ttsLang = lang === 'zh' ? 'zh-CN' :
                          lang === 'ja' ? 'ja-JP' :
                          lang === 'ko' ? 'ko-KR' : 'en-US';
          chrome.runtime.sendMessage({ action: 'speak', text, lang: ttsLang });
        }
        return;
      }

      // 句子中可点击的词汇
      const clickableWord = e.target.closest('.lingrove-sel-clickable-word');
      if (clickableWord) {
        e.preventDefault();
        e.stopPropagation();
        const word = clickableWord.getAttribute('data-word');
        const rect = clickableWord.getBoundingClientRect();
        L.showWordActionPopup(word, rect.left + window.scrollX, rect.bottom + window.scrollY + 2);
        return;
      }

      // 词汇操作弹窗的按钮
      const wordActionBtn = e.target.closest('.lingrove-word-action-btn');
      if (wordActionBtn) {
        e.preventDefault();
        e.stopPropagation();
        const action = wordActionBtn.getAttribute('data-action');
        const word = L.wordActionPopup?.getAttribute('data-word');

        if (action === 'memorize' && word) {
          const isActive = wordActionBtn.classList.contains('active');

          if (!isActive) {
            L.addToMemorizeList(word);
            wordActionBtn.classList.add('active');
            wordActionBtn.innerHTML = L.getMemorizeButtonHtml(true, 14, '已在记忆列表', '添加到记忆');
            L.showToast(`"${word}" 已添加到需记忆列表`);
          } else {
            L.removeFromMemorizeList(word);
            wordActionBtn.classList.remove('active');
            wordActionBtn.innerHTML = L.getMemorizeButtonHtml(false, 14, '已在记忆列表', '添加到记忆');
            L.showToast(`"${word}" 已从记忆列表移除`);
          }
        }
        return;
      }

      // 点击其他地方隐藏词汇操作弹窗
      if (!e.target.closest('.lingrove-word-action-popup')) {
        L.hideWordActionPopup();
      }

      // 替换原文按钮
      const replaceBtn = e.target.closest('.lingrove-sel-replace-btn');
      if (replaceBtn) {
        e.preventDefault();
        e.stopPropagation();
        const original = replaceBtn.getAttribute('data-original');
        const translation = replaceBtn.getAttribute('data-translation');
        const phonetic = replaceBtn.getAttribute('data-phonetic');
        L.replaceSelectionWithTranslation(original, translation, phonetic);
        return;
      }
    });

    // 滚动处理
    const handleScroll = L.debounce(() => {
      // 如果用户手动还原了页面，不触发自动处理
      if (L.isManuallyRestored) {
        return;
      }
      if (L.config?.autoProcess && L.config?.enabled) {
        L.observeTextContainers();
      }
    }, 300);
    window.addEventListener('scroll', handleScroll, { passive: true });

    // 监听 DOM 变化
    const mutationObserver = new MutationObserver(L.debounce(() => {
      // 如果用户手动还原了页面，不触发自动处理
      if (L.isManuallyRestored) {
        return;
      }
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
