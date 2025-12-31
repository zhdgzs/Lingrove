/**
 * Lingrove 文本替换器模块
 * 使用 Range API 精确替换文本节点
 */

import { storage } from '../core/storage.js';

/**
 * 文本替换器类
 */
class TextReplacer {
  constructor() {
    this.replacedElements = new WeakSet();
  }

  /**
   * 在元素中查找并替换词汇
   * @param {Element} element - DOM 元素
   * @param {Array} replacements - 替换项 [{ original, translation, phonetic, difficulty, position }]
   * @returns {number} - 替换数量
   */
  applyReplacements(element, replacements) {
    if (!element || !replacements || replacements.length === 0) {
      return 0;
    }

    let count = 0;
    const textNodes = this.getTextNodes(element);

    // 按位置排序替换项（从后往前替换，避免位置偏移）
    const sortedReplacements = [...replacements].sort((a, b) => (b.position || 0) - (a.position || 0));

    for (const replacement of sortedReplacements) {
      const { original, translation, phonetic, difficulty } = replacement;
      
      // 在文本节点中查找原词
      for (const textNode of textNodes) {
        if (this.replaceInTextNode(textNode, original, translation, phonetic, difficulty)) {
          count++;
          break; // 每个替换项只替换一次
        }
      }
    }

    // 标记元素已处理
    if (count > 0) {
      element.setAttribute('data-lingrove-processed', 'true');
    }

    return count;
  }

  /**
   * 获取元素内的所有文本节点
   * @param {Element} element - DOM 元素
   * @returns {Text[]}
   */
  getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim().length > 0) {
        textNodes.push(node);
      }
    }

    return textNodes;
  }

  /**
   * 在单个文本节点中替换词汇
   * @param {Text} textNode - 文本节点
   * @param {string} original - 原词
   * @param {string} translation - 翻译
   * @param {string} phonetic - 音标
   * @param {string} difficulty - 难度
   * @returns {boolean} - 是否成功替换
   */
  replaceInTextNode(textNode, original, translation, phonetic, difficulty) {
    const text = textNode.textContent;
    
    // 创建正则表达式匹配原词（支持词边界）
    const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[\\s，。、；：""''（）\\[\\]【】])${escapedOriginal}([\\s，。、；：""''（）\\[\\]【】]|$)`, 'i');
    
    const match = regex.exec(text);
    if (!match) {
      // 尝试不带边界的匹配（针对中文）
      const simpleIndex = text.indexOf(original);
      if (simpleIndex === -1) return false;
      
      return this.performReplacement(textNode, simpleIndex, original, translation, phonetic, difficulty);
    }

    const startIndex = match.index + match[1].length;
    return this.performReplacement(textNode, startIndex, original, translation, phonetic, difficulty);
  }

  /**
   * 执行实际的 DOM 替换
   * @param {Text} textNode - 文本节点
   * @param {number} startIndex - 起始位置
   * @param {string} original - 原词
   * @param {string} translation - 翻译
   * @param {string} phonetic - 音标
   * @param {string} difficulty - 难度
   * @returns {boolean}
   */
  performReplacement(textNode, startIndex, original, translation, phonetic, difficulty) {
    try {
      const range = document.createRange();
      range.setStart(textNode, startIndex);
      range.setEnd(textNode, startIndex + original.length);

      // 验证范围内容
      const rangeContent = range.toString();
      if (rangeContent.toLowerCase() !== original.toLowerCase()) {
        return false;
      }

      // 创建替换元素
      const wrapper = this.createReplacementElement(original, translation, phonetic, difficulty);

      // 执行替换
      range.deleteContents();
      range.insertNode(wrapper);

      return true;
    } catch (error) {
      console.error('[Lingrove] Replacement error:', error);
      return false;
    }
  }

  /**
   * 创建替换元素
   * @param {string} original - 原词
   * @param {string} translation - 翻译
   * @param {string} phonetic - 音标
   * @param {string} difficulty - 难度
   * @returns {HTMLElement}
   */
  createReplacementElement(original, translation, phonetic, difficulty) {
    const wrapper = document.createElement('span');
    wrapper.className = 'lingrove-translated';
    wrapper.setAttribute('data-original', original);
    wrapper.setAttribute('data-translation', translation);
    wrapper.setAttribute('data-phonetic', phonetic || '');
    wrapper.setAttribute('data-difficulty', difficulty || 'B1');
    
    // 显示格式: translated(original)
    wrapper.innerHTML = `<span class="lingrove-word">${translation}</span><span class="lingrove-original">(${original})</span>`;
    
    return wrapper;
  }

  /**
   * 恢复替换的词汇为原文
   * @param {Element} element - 替换元素
   */
  restoreOriginal(element) {
    if (!element.classList.contains('lingrove-translated')) {
      return;
    }

    const original = element.getAttribute('data-original');
    const textNode = document.createTextNode(original);
    element.parentNode.replaceChild(textNode, element);
  }

  /**
   * 恢复页面上所有替换的词汇
   * @param {Element} root - 根元素
   */
  restoreAll(root = document.body) {
    const elements = root.querySelectorAll('.lingrove-translated');
    elements.forEach(el => this.restoreOriginal(el));
    
    // 清除处理标记
    root.querySelectorAll('[data-lingrove-processed]').forEach(el => {
      el.removeAttribute('data-lingrove-processed');
    });
  }

  /**
   * 标记词汇为已学会（加入白名单并恢复原文）
   * @param {Element} element - 替换元素
   * @returns {Promise<void>}
   */
  async markAsLearned(element) {
    if (!element.classList.contains('lingrove-translated')) {
      return;
    }

    const original = element.getAttribute('data-original');
    const translation = element.getAttribute('data-translation');

    // 添加到白名单 - 标记原文（用户正在学习的单词）为已学会
    await storage.addToWhitelist({ original, word: original });

    // 恢复原文
    this.restoreOriginal(element);

    // 显示成功提示
    this.showToast(`"${original}" 已标记为已学会`);
  }

  /**
   * 显示提示消息
   * @param {string} message - 消息内容
   */
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'lingrove-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('lingrove-toast-show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('lingrove-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
}

// 导出单例
export const textReplacer = new TextReplacer();
export default textReplacer;

