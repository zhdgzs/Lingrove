const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');

function loadScript(relativePath, lingrove, extraContext = {}) {
  const context = vm.createContext({
    console,
    Promise,
    Set,
    Map,
    window: { Lingrove: lingrove },
    ...extraContext
  });
  const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
  return context.window.Lingrove;
}

test('自动翻译目标使用向下取整，不超过配置密度', () => {
  const L = loadScript('js/content/api-client.js', {});

  assert.equal(L.calculateTranslationTarget(1, 30), 0);
  assert.equal(L.calculateTranslationTarget(10, 30), 3);
  assert.equal(L.calculateTranslationTarget(10, 150), 10);
});

test('缓存结果与 API 补充结果共享同一目标上限', async () => {
  let promptOptions;
  const wordCache = new Map([
    ['alpha:en:zh-CN', { translation: '阿尔法', difficulty: 'B1' }]
  ]);
  const L = loadScript('js/content/api-client.js', {
    config: {
      hasApiNodes: true,
      nativeLanguage: 'en',
      targetLanguage: 'zh-CN',
      processMode: 'both',
      translationDensity: 50,
      difficultyLevel: 'B1',
      learnedWords: [],
      memorizeList: [{ word: 'bravo' }],
      cacheMaxSize: 100
    },
    wordCache,
    STOP_WORDS: new Set(),
    DEFAULT_CACHE_MAX_SIZE: 100,
    detectLanguage: () => 'en',
    isNativeLanguage: () => true,
    loadWordCache: async () => wordCache,
    isDifficultyCompatible: () => true,
    getMinTextLength: () => 0,
    updateStats: () => Promise.resolve(),
    buildTranslationPrompt: options => {
      promptOptions = options;
      return 'prompt';
    },
    saveWordCache: async () => {}
  }, {
    chrome: {
      runtime: {
        sendMessage: () => {}
      }
    }
  });

  // api-client.js 会定义真实请求函数，加载后替换为确定性的测试桩
  L.sendApiRequest = async () => ({
    choices: [{
      message: {
        content: JSON.stringify([
          { original: 'bravo', translation: '布拉沃', difficulty: 'B1' },
          { original: 'charlie', translation: '查理', difficulty: 'B1' },
          { original: 'delta', translation: '德尔塔', difficulty: 'B1' }
        ])
      }
    }]
  });

  const result = await L.translateText('alpha bravo charlie delta');
  const asyncResults = await result.async;

  assert.equal(result.targetCount, 2);
  assert.equal(result.immediate.length, 1);
  assert.equal(promptOptions.targetCount, 1);
  assert.equal(asyncResults.length, 1);
  assert.notEqual(asyncResults[0].original, 'bravo');
  assert.equal(result.immediate.length + asyncResults.length, result.targetCount);
});

test('跨段落应用共享实际替换预算，已学会词汇不占用预算', async () => {
  const applied = [];
  const L = {
    config: {
      learnedWordDisplay: 'translation',
      learnedWords: [{ original: 'learned', word: '已学会', difficulty: 'B1' }]
    },
    processingGeneration: 0,
    processedFingerprints: new Set(),
    debounce: fn => fn,
    translateText: async () => ({
      immediate: [
        { original: 'alpha', translation: '阿尔法' },
        { original: 'bravo', translation: '布拉沃' }
      ],
      async: Promise.resolve([
        { original: 'charlie', translation: '查理' }
      ]),
      targetCount: 2
    }),
    applyReplacements: (element, replacements) => {
      applied.push(...replacements.map(replacement => ({
        element: element.id,
        original: replacement.original,
        isLearned: Boolean(replacement.isLearned)
      })));
      return replacements.length;
    },
    prefetchDictionaryData: () => {}
  };

  loadScript('js/content/main.js', L, {
    document: {
      readyState: 'loading',
      addEventListener: () => {}
    }
  });

  const createElement = id => ({
    id,
    querySelectorAll: () => []
  });
  const segments = [
    { element: createElement('first'), text: 'alpha bravo learned', fingerprint: 'first' },
    { element: createElement('second'), text: 'alpha bravo charlie learned', fingerprint: 'second' }
  ];

  await L.processBatchSegments(segments, new Set(['learned']));
  await new Promise(resolve => setImmediate(resolve));

  const automatic = applied.filter(item => !item.isLearned);
  const learned = applied.filter(item => item.isLearned);
  assert.equal(automatic.length, 2);
  assert.equal(learned.length, 2);
});

test('处理代次变化后忽略旧的异步翻译结果', async () => {
  let resolveAsyncResults;
  const asyncResults = new Promise(resolve => {
    resolveAsyncResults = resolve;
  });
  const applied = [];
  const L = {
    config: {
      learnedWordDisplay: 'hide',
      learnedWords: []
    },
    processingGeneration: 0,
    processedFingerprints: new Set(),
    debounce: fn => fn,
    translateText: async () => ({
      immediate: [],
      async: asyncResults,
      targetCount: 1
    }),
    applyReplacements: (_element, replacements) => {
      applied.push(...replacements);
      return replacements.length;
    },
    prefetchDictionaryData: () => {}
  };

  loadScript('js/content/main.js', L, {
    document: {
      readyState: 'loading',
      addEventListener: () => {}
    }
  });

  const segment = {
    element: {
      querySelectorAll: () => []
    },
    text: 'alpha',
    fingerprint: 'alpha'
  };

  await L.processBatchSegments([segment], new Set());
  L.processingGeneration += 1;
  resolveAsyncResults([{ original: 'alpha', translation: '阿尔法' }]);
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(applied.length, 0);
});
