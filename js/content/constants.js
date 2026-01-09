/**
 * Lingrove 配置常量模块
 * 定义全局命名空间和配置常量
 */

// 创建全局命名空间
window.Lingrove = window.Lingrove || {};

(function(L) {
  'use strict';

  // CEFR 难度等级
  L.CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  // 需要跳过的标签
  L.SKIP_TAGS = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'CODE', 'PRE', 'KBD', 'TEXTAREA', 'INPUT', 'SELECT', 'BUTTON'];

  // 需要跳过的类名
  L.SKIP_CLASSES = ['lingrove-translated', 'lingrove-tooltip', 'lingrove-selection-popup', 'lingrove-word-action-popup', 'lingrove-sel-original', 'lingrove-toast', 'hljs', 'code', 'syntax'];

  // 缓存配置
  L.DEFAULT_CACHE_MAX_SIZE = 2000;

  // 各语言最小文本长度阈值（字符数）
  L.MIN_LENGTH_CONFIG = {
    'zh': 20,  // 中文：20 字符
    'ja': 20,  // 日文：20 字符
    'ko': 20,  // 韩文：20 字符
    'en': 50   // 英文：50 字符
  };

  // 翻译密度预设档位
  L.DENSITY_PRESETS = [10, 30, 50, 70];

  // 文本分块配置
  L.TARGET_BATCH_SIZE = 1000;  // 目标批次大小（字符）
  L.MAX_BATCH_SIZE = 1200;     // 最大批次大小（字符）
  L.MIN_BATCH_SIZE = 100;      // 最小批次大小（字符）

  // 词典缓存配置
  L.DICT_CACHE_STORAGE_KEY = 'lingrove_dict_cache';
  L.DICT_CACHE_MAX_SIZE = 500;

  // 词汇缓存配置
  L.WORD_CACHE_STORAGE_KEY = 'lingrove_word_cache';

})(window.Lingrove);
