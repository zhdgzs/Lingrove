/**
 * Lingrove 提示词规则模块
 * 管理分层提示词架构：核心提示词 + 源语言规则 + 目标语言规则 + 用户自定义规则
 */

(function(L) {
  'use strict';

  // 默认自定义提示词
  L.DEFAULT_CUSTOM_PROMPT = `## 额外规则：
- 优先选择日常实用词汇
- 注意词汇的使用频率和实用性`;

  // 核心提示词（系统固定）
  L.CORE_PROMPT = `你是一个语言学习助手。请分析以下文本，选择适合学习的词汇进行翻译。

## 核心规则：
1. 优先选择：有学习价值的词汇、不同难度级别的词汇
2. 翻译倾向：结合上下文只翻译成最合适的词汇，而不是多个含义
3. 不要翻译专有名词、缩写、数字、代码等内容

## CEFR等级从简单到复杂依次为：A1-C2`;

  // 源语言规则（根据源语言动态注入）
  L.SOURCE_LANGUAGE_RULES = {
    'zh-CN': `
## 中文语义分词规则：
- 按语义边界识别词汇，过滤停用词（的、了、在、和、是、我、你、他、也等虚词），仅保留名词、动词、形容词、方式副词、成语等实义词。
- 注意区分同形异义词组，如「对方面无表情」应识别为「对方」「面无表情」而非「方面」
- 优先识别完整的成语、惯用语、固定搭配
- 避免将动宾结构拆分，如「吃饭」「睡觉」应作为整体
- 注意前后文语境，正确识别多音多义字的含义
- 对结果去重后形成有效词汇列表`,

    'zh-TW': `
## 繁體中文語義分詞規則：
- 按語義邊界識別詞彙，過濾停用詞（的、了、在、和、是、我、你、他、也等虛詞），僅保留名詞、動詞、形容詞、方式副詞、成語等實義詞。
- 注意區分同形異義詞組，如「對方面無表情」應識別為「對方」「面無表情」而非「方面」
- 優先識別完整的成語、慣用語、固定搭配
- 避免將動賓結構拆分，如「吃飯」「睡覺」應作為整體
- 注意前後文語境，正確識別多音多義字的含義
- 對結果去重後形成有效詞彙列表`,

    'en': `
## English Semantic Segmentation Rules:
- Filter stopwords (the, a, an, is, are, was, were, be, been, being, have, has, had, do, does, did, will, would, could, should, may, might, must, shall, can, to, of, in, for, on, with, at, by, from, as, it, this, that, these, those, I, you, he, she, we, they, etc.), keep only content words: nouns, verbs, adjectives, adverbs.
- Identify phrasal verbs as complete units (e.g., "give up", "look forward to", "put up with")
- Recognize idiomatic expressions and collocations as single units
- Keep compound nouns together (e.g., "ice cream", "high school")
- Consider context to distinguish homographs and polysemous words
- Deduplicate results to form an effective vocabulary list`,

    'ja': `
## 日本語の語義分割ルール：
- 助詞（は、が、を、に、で、と、も、の、へ、から、まで、より等）と助動詞（です、ます、た、ない、れる、られる等）を除外し、名詞、動詞、形容詞、副詞等の実義語のみを保持する。
- 複合語は意味のまとまりとして認識する
- 慣用句・熟語・四字熟語は分割しない
- 動詞の活用形を正しく認識し、原形で記録する
- 文脈に応じて同音異義語を区別する
- 結果を重複排除し、有効な語彙リストを形成する`,

    'ko': `
## 한국어 의미 분할 규칙:
- 조사(은/는, 이/가, 을/를, 에, 에서, 로/으로, 와/과, 도, 만, 부터, 까지 등)와 어미를 제외하고, 명사, 동사, 형용사, 부사 등 실질적 의미를 가진 단어만 유지한다.
- 복합어는 의미 단위로 인식
- 관용구와 숙어는 분리하지 않음
- 동사 활용형을 올바르게 인식하고 원형으로 기록
- 문맥에 따라 동음이의어 구별
- 결과를 중복 제거하여 유효한 어휘 목록 형성`,

    'fr': `
## Règles de segmentation sémantique française:
- Filtrer les mots vides (le, la, les, un, une, des, de, du, à, au, aux, en, et, ou, mais, donc, or, ni, car, que, qui, dont, où, ce, cette, ces, je, tu, il, elle, nous, vous, ils, elles, être, avoir, etc.), ne garder que les mots de contenu: noms, verbes, adjectifs, adverbes.
- Identifier les expressions idiomatiques comme unités complètes
- Reconnaître les verbes pronominaux et leurs particules
- Garder les locutions verbales ensemble
- Considérer le contexte pour les homonymes
- Dédupliquer les résultats pour former une liste de vocabulaire efficace`,

    'de': `
## Deutsche semantische Segmentierungsregeln:
- Stoppwörter filtern (der, die, das, ein, eine, und, oder, aber, denn, weil, dass, wenn, als, ob, zu, von, mit, bei, nach, für, über, unter, an, auf, in, aus, ich, du, er, sie, es, wir, ihr, sein, haben, werden, etc.), nur Inhaltswörter behalten: Substantive, Verben, Adjektive, Adverbien.
- Zusammengesetzte Wörter als Einheiten erkennen
- Trennbare Verben korrekt identifizieren (z.B. "aufstehen", "anfangen")
- Redewendungen und feste Wendungen nicht trennen
- Kontext für Homonyme berücksichtigen
- Ergebnisse deduplizieren, um eine effektive Vokabelliste zu bilden`,

    'es': `
## Reglas de segmentación semántica española:
- Filtrar palabras vacías (el, la, los, las, un, una, unos, unas, de, del, a, al, en, con, por, para, y, o, pero, que, quien, cual, este, esta, estos, estas, yo, tú, él, ella, nosotros, vosotros, ellos, ellas, ser, estar, haber, tener, etc.), mantener solo palabras de contenido: sustantivos, verbos, adjetivos, adverbios.
- Identificar expresiones idiomáticas como unidades completas
- Reconocer verbos pronominales y sus partículas
- Mantener las locuciones verbales juntas
- Considerar el contexto para homónimos
- Deduplicar resultados para formar una lista de vocabulario efectiva`
  };

  // 目标语言规则（根据目标语言动态注入）
  L.TARGET_LANGUAGE_RULES = {
    'zh-CN': `
## 中文输出规则：
- 使用简体中文
- 翻译应自然流畅，符合中文表达习惯
- 避免生硬的直译`,

    'zh-TW': `
## 繁體中文輸出規則：
- 使用繁體中文
- 翻譯應自然流暢，符合中文表達習慣
- 避免生硬的直譯`,

    'en': `
## English Output Rules:
- Use natural, fluent English
- Avoid overly literal translations
- Match the appropriate register and formality level`,

    'ja': `
## 日本語出力ルール：
- 自然で流暢な日本語を使用
- 直訳を避ける
- 適切な敬語レベルを維持`,

    'ko': `
## 한국어 출력 규칙:
- 자연스럽고 유창한 한국어 사용
- 직역 피하기
- 적절한 존댓말 수준 유지`,

    'fr': `
## Règles de sortie française:
- Utiliser un français naturel et fluide
- Éviter les traductions trop littérales
- Adapter le registre de langue`,

    'de': `
## Deutsche Ausgaberegeln:
- Natürliches, flüssiges Deutsch verwenden
- Zu wörtliche Übersetzungen vermeiden
- Angemessenes Sprachregister wählen`,

    'es': `
## Reglas de salida española:
- Usar español natural y fluido
- Evitar traducciones demasiado literales
- Adaptar el registro lingüístico`
  };

  /**
   * 构建完整的翻译提示词
   */
  L.buildTranslationPrompt = function(options) {
    const { sourceLang, targetLang, text, translationDensity, customPrompt, config } = options;

    // 获取源语言规则（优先使用自定义规则）
    const defaultSourceRule = L.SOURCE_LANGUAGE_RULES[sourceLang] ||
                              L.SOURCE_LANGUAGE_RULES[sourceLang.split('-')[0]] || '';
    const sourceRule = config?.customSourceRules?.[sourceLang] !== undefined
                       ? config.customSourceRules[sourceLang]
                       : defaultSourceRule;

    // 获取目标语言规则（优先使用自定义规则）
    const defaultTargetRule = L.TARGET_LANGUAGE_RULES[targetLang] ||
                              L.TARGET_LANGUAGE_RULES[targetLang.split('-')[0]] || '';
    const targetRule = config?.customTargetRules?.[targetLang] !== undefined
                       ? config.customTargetRules[targetLang]
                       : defaultTargetRule;

    // 用户自定义规则
    const userRule = customPrompt || '';

    return `${L.CORE_PROMPT}
${sourceRule}
${targetRule}
${userRule}

## 任务参数：
1. 请根据有效词汇列表选择约 ${translationDensity}% 的词汇进行翻译
2. 优先选择CEFR等级在${config?.difficultyLevel || 'B1'}及以上的词汇
3. 翻译方向：从 ${sourceLang} 翻译到 ${targetLang}
4. 不要重复翻译已经是${targetLang}的内容

## 输出格式：
返回 JSON 数组，每个元素包含：
- original: 原词
- translation: 翻译结果
- phonetic: 学习语言(${config?.targetLanguage || targetLang})的音标/发音
- difficulty: CEFR 难度等级 (A1/A2/B1/B2/C1/C2)，请谨慎评估

## 文本：
${text}

## 输出：
只返回 JSON 数组，不要其他内容。`;
  };

  /**
   * 构建特定词汇翻译的提示词
   */
  L.buildSpecificWordsPrompt = function(options) {
    const { sourceLang, targetLang, words, customPrompt, config } = options;
    const userRule = customPrompt || '';

    return `你是一个语言学习助手。请翻译以下特定词汇。

## 规则：
1. 必须翻译所有提供的词汇，不要跳过任何词
2. 如果单词是${sourceLang}，则翻译到${targetLang}，反之亦然
${userRule}

## CEFR等级从简单到复杂依次为：A1-C2

## 输出格式：
返回 JSON 数组，每个元素包含：
- original: 原词
- translation: 翻译结果
- phonetic: 学习语言(${config?.targetLanguage || targetLang})的音标/发音
- difficulty: CEFR 难度等级 (A1/A2/B1/B2/C1/C2)

## 要翻译的词汇：
${words.join(', ')}

## 输出：
只返回 JSON 数组，不要其他内容。`;
  };

  /**
   * 构建上下文重新翻译的提示词
   */
  L.buildRetranslatePrompt = function(options) {
    const { sourceLang, targetLang, word, context, customPrompt, config } = options;
    const userRule = customPrompt || '';

    return `你是一个语言学习助手。请根据上下文语境翻译单词。

## 上下文句子：
"${context}"

## 需要翻译的单词：
${word}

## 规则：
1. 根据上下文确定单词的正确含义和词性
2. 翻译方向：${sourceLang} → ${targetLang}
3. 翻译结果应符合上下文语境
${userRule}

## 输出格式：
返回单个 JSON 对象：
{
  "original": "原词",
  "translation": "根据上下文的正确翻译",
  "phonetic": "学习语言(${config?.targetLanguage || targetLang})的音标",
  "difficulty": "CEFR等级"
}

只返回 JSON，不要其他内容。`;
  };

})(window.Lingrove);
