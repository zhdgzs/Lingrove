/**
 * Lingrove 文本替换模块
 * 处理文本替换、恢复等操作
 */

(function(L) {
  'use strict';

  // 状态变量
  L.pendingContainers = new Set();

  /**
   * 创建替换元素
   * @param {string} original - 原词
   * @param {string} translation - 翻译
   * @param {string} phonetic - 音标
   * @param {string} difficulty - 难度
   * @param {boolean} isLearned - 是否已学会
   * @returns {Element}
   */
  L.createReplacementElement = function(original, translation, phonetic, difficulty, isLearned = false) {
    const wrapper = document.createElement('span');
    wrapper.className = 'lingrove-translated';
    if (isLearned) wrapper.classList.add('lingrove-learned');
    wrapper.setAttribute('data-original', original);
    wrapper.setAttribute('data-translation', translation);
    wrapper.setAttribute('data-phonetic', phonetic || '');
    wrapper.setAttribute('data-difficulty', difficulty || 'B1');
    if (isLearned) wrapper.setAttribute('data-learned', 'true');

    // 已学会词汇根据设置显示
    if (isLearned) {
      const learnedDisplay = L.config.learnedWordDisplay || 'hide';
      if (learnedDisplay === 'original') {
        // 显示原文（带标记样式）
        wrapper.innerHTML = `<span class="lingrove-word lingrove-learned-word">${original}</span>`;
      } else {
        // 显示译文
        wrapper.innerHTML = `<span class="lingrove-word lingrove-learned-word">${translation}</span>`;
      }
      return wrapper;
    }

    // 根据配置的样式生成不同的HTML
    const style = L.config.translationStyle || 'translation-original';
    let innerHTML = '';

    switch (style) {
      case 'translation-only':
        // 只显示译文
        innerHTML = `<span class="lingrove-word">${translation}</span>`;
        break;
      case 'original-translation':
        // 原文(译文)
        innerHTML = `<span class="lingrove-original">${original}</span><span class="lingrove-word">(${translation})</span>`;
        break;
      case 'translation-original':
      default:
        // 译文(原文) - 默认样式
        innerHTML = `<span class="lingrove-word">${translation}</span><span class="lingrove-original">(${original})</span>`;
        break;
    }

    wrapper.innerHTML = innerHTML;
    return wrapper;
  };

  /**
   * 应用替换
   * @param {Element} element - 目标元素
   * @param {object[]} replacements - 替换列表
   * @returns {number} 替换数量
   */
  L.applyReplacements = function(element, replacements) {
    if (!element || !replacements?.length) return 0;

    let count = 0;

    // 获取文本节点的辅助函数（每次调用都重新获取，确保节点引用有效）
    function getTextNodes() {
      const nodes = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          // 跳过已翻译的元素
          if (parent.classList?.contains('lingrove-translated')) {
            return NodeFilter.FILTER_REJECT;
          }

          // 跳过不应该处理的节点类型
          if (L.SKIP_TAGS.includes(parent.tagName)) return NodeFilter.FILTER_REJECT;

          // 跳过代码相关的类
          const classList = parent.className?.toString() || '';
          if (L.SKIP_CLASSES.some(cls => classList.includes(cls) && cls !== 'lingrove-translated')) {
            return NodeFilter.FILTER_REJECT;
          }

          // 跳过隐藏元素（使用 offsetParent 快速检测）
          if (parent.offsetParent === null && parent.tagName !== 'BODY' && parent.tagName !== 'HTML') {
            const position = parent.style.position;
            if (position !== 'fixed' && position !== 'sticky') {
              return NodeFilter.FILTER_REJECT;
            }
          }

          // 跳过可编辑元素
          if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;

          const text = node.textContent.trim();
          if (text.length === 0) return NodeFilter.FILTER_REJECT;

          return NodeFilter.FILTER_ACCEPT;
        }
      });

      let node;
      while (node = walker.nextNode()) {
        nodes.push(node);
      }
      return nodes;
    }

    // 按位置从后往前排序，避免位置偏移问题
    const sortedReplacements = [...replacements].sort((a, b) => (b.position || 0) - (a.position || 0));

    for (const replacement of sortedReplacements) {
      const { original, translation, phonetic, difficulty, isLearned } = replacement;
      const lowerOriginal = original.toLowerCase();

      // 每次替换后重新获取文本节点，因为DOM结构已改变
      const textNodes = getTextNodes();

      for (let i = 0; i < textNodes.length; i++) {
        const textNode = textNodes[i];

        // 检查节点是否仍然有效（DOM可能已改变）
        if (!textNode.parentElement || !element.contains(textNode)) {
          continue;
        }

        const text = textNode.textContent;
        const lowerText = text.toLowerCase();

        // 检查文本节点是否包含目标单词
        if (!lowerText.includes(lowerOriginal)) continue;

        // 使用单词边界匹配，确保匹配完整单词
        const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 匹配单词边界（包括中文标点）
        const regex = new RegExp(`(^|[^\\w\\u4e00-\\u9fff])${escapedOriginal}([^\\w\\u4e00-\\u9fff]|$)`, 'i');

        let match = regex.exec(text);
        let startIndex = match ? match.index + match[1].length : text.toLowerCase().indexOf(lowerOriginal);

        if (startIndex === -1) continue;

        try {
          const range = document.createRange();
          range.setStart(textNode, startIndex);
          range.setEnd(textNode, startIndex + original.length);

          const rangeContent = range.toString();
          if (rangeContent.toLowerCase() !== lowerOriginal) continue;

          // 检查是否已经被替换（检查父元素是否是已翻译的元素）
          let parent = textNode.parentElement;
          let isAlreadyReplaced = false;
          while (parent && parent !== element) {
            if (parent.classList?.contains('lingrove-translated')) {
              isAlreadyReplaced = true;
              break;
            }
            parent = parent.parentElement;
          }

          if (isAlreadyReplaced) continue;

          const wrapper = L.createReplacementElement(original, translation, phonetic, difficulty, isLearned);
          range.deleteContents();
          range.insertNode(wrapper);
          count++;

          // 找到匹配后立即跳出，因为DOM结构已改变，需要重新获取节点
          break;
        } catch (e) {
          console.error('[Lingrove] Replacement error:', e, original);
        }
      }
    }

    if (count > 0) element.setAttribute('data-lingrove-processed', 'true');
    return count;
  };

  /**
   * 恢复单个元素的原文
   * @param {Element} element - 已翻译的元素
   */
  L.restoreOriginal = function(element) {
    if (!element.classList?.contains('lingrove-translated')) return;
    const original = element.getAttribute('data-original');
    const textNode = document.createTextNode(original);
    element.parentNode.replaceChild(textNode, element);
  };

  /**
   * 恢复页面上所有相同单词的原文
   * @param {string} originalWord - 原词
   */
  L.restoreAllSameWord = function(originalWord) {
    document.querySelectorAll('.lingrove-translated').forEach(el => {
      if (el.getAttribute('data-original')?.toLowerCase() === originalWord.toLowerCase()) {
        L.restoreOriginal(el);
      }
    });
  };

  /**
   * 更新已学会词汇的显示
   * @param {string} original - 原词
   * @param {string} translation - 翻译
   * @param {string} difficulty - 难度
   */
  L.updateLearnedWordDisplay = function(original, translation, difficulty) {
    const learnedDisplay = L.config.learnedWordDisplay || 'hide';

    if (learnedDisplay === 'hide') {
      L.restoreAllSameWord(original);
      return;
    }

    document.querySelectorAll('.lingrove-translated').forEach(el => {
      if (el.getAttribute('data-original')?.toLowerCase() === original.toLowerCase()) {
        el.classList.add('lingrove-learned');
        el.setAttribute('data-learned', 'true');

        if (learnedDisplay === 'original') {
          el.innerHTML = `<span class="lingrove-word lingrove-learned-word">${original}</span>`;
        } else {
          el.innerHTML = `<span class="lingrove-word lingrove-learned-word">${translation}</span>`;
        }
      }
    });
  };

  /**
   * 恢复所有翻译
   */
  L.restoreAll = function() {
    // 设置手动还原标志，禁用自动处理
    L.isManuallyRestored = true;

    document.querySelectorAll('.lingrove-translated').forEach(L.restoreOriginal);
    document.querySelectorAll('[data-lingrove-processed]').forEach(el => el.removeAttribute('data-lingrove-processed'));
    document.querySelectorAll('[data-lingrove-observing]').forEach(el => el.removeAttribute('data-lingrove-observing'));
    L.processedFingerprints.clear();
    L.pendingContainers.clear();
  };

})(window.Lingrove);
