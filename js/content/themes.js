/**
 * Lingrove 主题配置模块
 * 管理内置主题和自定义主题
 */

(function(L) {
  'use strict';

  // 内置主题配置（可被用户自定义覆盖）
  L.BUILT_IN_THEMES = {
    default: {
      name: '默认紫',
      primary: '#6366f1',
      underline: 'rgba(99,102,241,0.6)',
      hoverBg: 'rgba(99,102,241,0.15)',
      tooltipWord: '#818cf8',
      underlineWidth: '1.5px',
      underlineStyle: 'solid',
      wordColor: '',  // 保持原样式
      originalColor: ''
    },
    ocean: {
      name: '海洋蓝',
      primary: '#0ea5e9',
      underline: 'rgba(14,165,233,0.7)',
      hoverBg: 'rgba(14,165,233,0.12)',
      tooltipWord: '#38bdf8',
      underlineWidth: '2px',
      underlineStyle: 'dashed',
      wordColor: '#0ea5e9',
      originalColor: '#64748b'
    },
    forest: {
      name: '森林绿',
      primary: '#10b981',
      underline: 'rgba(16,185,129,0.6)',
      hoverBg: 'rgba(16,185,129,0.1)',
      tooltipWord: '#34d399',
      underlineWidth: '1.5px',
      underlineStyle: 'dotted',
      wordColor: '#059669',
      originalColor: '#6b7280'
    },
    sunset: {
      name: '日落橙',
      primary: '#f59e0b',
      underline: 'rgba(245,158,11,0.7)',
      hoverBg: 'rgba(245,158,11,0.12)',
      tooltipWord: '#fbbf24',
      underlineWidth: '2px',
      underlineStyle: 'wavy',
      wordColor: '#d97706',
      originalColor: '#78716c'
    }
  };

  /**
   * 获取主题配置
   * @param {string} themeName - 主题名称
   * @param {object} customThemes - 用户自定义主题
   * @returns {object} 主题配置
   */
  L.getTheme = function(themeName, customThemes) {
    // 优先使用自定义主题
    if (customThemes && customThemes[themeName]) {
      return customThemes[themeName];
    }
    // 使用内置主题
    return L.BUILT_IN_THEMES[themeName] || L.BUILT_IN_THEMES.default;
  };

  /**
   * 应用主题到 CSS 变量
   * @param {object} theme - 主题配置
   */
  L.applyTheme = function(theme) {
    const root = document.documentElement;
    if (theme.primary) root.style.setProperty('--lingrove-primary', theme.primary);
    if (theme.underline) root.style.setProperty('--lingrove-underline', theme.underline);
    if (theme.hoverBg) root.style.setProperty('--lingrove-hover-bg', theme.hoverBg);
    if (theme.tooltipWord) root.style.setProperty('--lingrove-tooltip-word', theme.tooltipWord);
    if (theme.underlineWidth) root.style.setProperty('--lingrove-underline-width', theme.underlineWidth);
    if (theme.underlineStyle) root.style.setProperty('--lingrove-underline-style', theme.underlineStyle);
    if (theme.wordColor) root.style.setProperty('--lingrove-word-color', theme.wordColor);
    if (theme.originalColor) root.style.setProperty('--lingrove-original-color', theme.originalColor);
  };

})(window.Lingrove);
