/**
 * Lingrove DOM 处理模块
 * 处理 DOM 节点遍历、文本容器查找等
 */

(function(L) {
  'use strict';

  // 状态变量
  L.processedFingerprints = new Set();

  /**
   * 判断节点是否应该跳过
   * @param {Node} node - DOM 节点
   * @param {boolean} skipStyleCheck - 是否跳过样式检查
   * @returns {boolean}
   */
  L.shouldSkipNode = function(node, skipStyleCheck = false) {
    if (!node) return true;
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) return true;
    if (node.nodeType === Node.TEXT_NODE) return L.shouldSkipNode(node.parentElement, skipStyleCheck);

    const element = node;
    if (L.SKIP_TAGS.includes(element.tagName)) return true;
    const classList = element.className?.toString() || '';
    if (L.SKIP_CLASSES.some(cls => classList.includes(cls))) return true;

    // 使用更轻量的可见性检测，避免频繁触发 getComputedStyle
    if (!skipStyleCheck) {
      // 使用 offsetParent 快速检测是否隐藏（display: none 的元素 offsetParent 为 null）
      // 注意：position: fixed 元素的 offsetParent 也是 null，但这些通常不需要处理
      if (element.offsetParent === null && element.tagName !== 'BODY' && element.tagName !== 'HTML') {
        // 排除 position: fixed 的情况
        const position = element.style.position;
        if (position !== 'fixed' && position !== 'sticky') {
          return true;
        }
      }
    }

    if (element.isContentEditable) return true;
    if (element.hasAttribute('data-lingrove-processed')) return true;

    return false;
  };

  /**
   * 查找文本容器
   * @param {Element} root - 根元素
   * @returns {Element[]}
   */
  L.findTextContainers = function(root) {
    const containers = [];
    const blockTags = ['P', 'DIV', 'ARTICLE', 'SECTION', 'LI', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'BLOCKQUOTE'];

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        if (L.shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
        if (blockTags.includes(node.tagName)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      }
    });

    let node;
    while (node = walker.nextNode()) {
      const hasDirectText = Array.from(node.childNodes).some(
        child => child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 10
      );
      if (hasDirectText) containers.push(node);
    }
    return containers;
  };

  /**
   * 获取元素的文本内容
   * @param {Element} element - DOM 元素
   * @returns {string}
   */
  L.getTextContent = function(element) {
    const texts = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (L.shouldSkipNode(node.parentElement)) return NodeFilter.FILTER_REJECT;
        const text = node.textContent.trim();
        if (text.length > 0 && !L.isCodeText(text)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_REJECT;
      }
    });

    let node;
    while (node = walker.nextNode()) texts.push(node.textContent);
    return texts.join(' ').replace(/\s+/g, ' ').trim();
  };

  /**
   * 获取页面段落
   * @param {boolean} viewportOnly - 是否只获取视口内的段落
   * @param {number} margin - 视口边距
   * @returns {object[]}
   */
  L.getPageSegments = function(viewportOnly = false, margin = 500) {
    const segments = [];
    let viewportTop = 0, viewportBottom = Infinity;

    if (viewportOnly) {
      viewportTop = window.scrollY - margin;
      viewportBottom = window.scrollY + window.innerHeight + margin;
    }

    const containers = L.findTextContainers(document.body);

    for (const container of containers) {
      // 已达到批次上限，停止添加
      if (segments.length >= L.MAX_SEGMENTS_PER_BATCH) break;

      if (viewportOnly) {
        const rect = container.getBoundingClientRect();
        const elementTop = rect.top + window.scrollY;
        const elementBottom = rect.bottom + window.scrollY;
        if (elementBottom < viewportTop || elementTop > viewportBottom) continue;
      }

      const text = L.getTextContent(container);
      if (!text || text.length < L.getMinTextLength(text)) continue;
      if (L.isCodeText(text)) continue;

      const path = L.getElementPath(container);
      const fingerprint = L.generateFingerprint(text, path);
      if (L.processedFingerprints.has(fingerprint)) continue;

      segments.push({ element: container, text: text.slice(0, 2000), fingerprint, path });
    }

    return segments;
  };

  /**
   * 检查元素是否在视口内
   * @param {Element} element - DOM 元素
   * @param {number} margin - 边距
   * @returns {boolean}
   */
  L.isInViewport = function(element, margin = 500) {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    return rect.bottom >= -margin && rect.top <= viewportHeight + margin;
  };

  /**
   * 检查是否应该处理当前站点
   * @returns {boolean}
   */
  L.shouldProcessSite = function() {
    const hostname = window.location.hostname;
    if (L.config.siteMode === 'all') {
      // 所有网站模式：检查是否在排除列表中
      if (L.config.excludedSites?.some(domain => hostname.includes(domain))) {
        return false;
      }
    } else {
      // 仅指定网站模式：检查是否在允许列表中
      if (!L.config.allowedSites?.some(domain => hostname.includes(domain))) {
        return false;
      }
    }
    return true;
  };

})(window.Lingrove);
