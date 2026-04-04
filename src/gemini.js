// gemini.js - Google Gemini API integration for exam paper scanning
// With model fallback chain, image compression, retry, and rate limiting

import { Storage } from './storage.js';

// Model fallback chain - try each in order if rate limited
const MODELS = [
  { id: 'gemini-2.5-flash-lite', name: '2.5 Flash Lite (15 RPM)', rpm: 15 },
  { id: 'gemini-3.1-flash-lite', name: '3.1 Flash Lite (11 RPM)', rpm: 11 },
  { id: 'gemini-3-flash', name: '3 Flash (5 RPM)', rpm: 5 },
  { id: 'gemini-2.5-flash', name: '2.5 Flash (5 RPM)', rpm: 5 },
];
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 10000;
const DELAY_BETWEEN_IMAGES = 6000;
const MAX_IMAGE_WIDTH = 1600;
const IMAGE_QUALITY = 0.85;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Compress image to reduce payload
 */
function compressImage(base64Image) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > MAX_IMAGE_WIDTH) {
        height = Math.round(height * (MAX_IMAGE_WIDTH / width));
        width = MAX_IMAGE_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
      const origKB = (base64Image.length * 0.75 / 1024).toFixed(0);
      const newKB = (compressed.length * 0.75 / 1024).toFixed(0);
      console.log(`[Gemini] Image: ${origKB}KB -> ${newKB}KB (${width}x${height})`);
      resolve(compressed);
    };
    img.onerror = () => resolve(base64Image);
    img.src = base64Image;
  });
}

/**
 * Parse AI response - handles multiple formats
 */
function parseResponse(text) {
  if (!text) return null;
  // Direct JSON
  try {
    const r = JSON.parse(text);
    if (r.questions || r.vocabulary) return r;
  } catch (e) { /* continue */ }
  // Markdown code block
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) { try { const r = JSON.parse(m[1].trim()); if (r.questions || r.vocabulary) return r; } catch (e) {} }
  // Find JSON object
  const b = text.match(/\{[\s\S]*\}/);
  if (b) { try { const r = JSON.parse(b[0]); if (r.questions || r.vocabulary) return r; } catch (e) {} }
  return null;
}

/**
 * Try sending to a specific model
 */
async function tryModel(modelId, requestBody, apiKey) {
  const url = `${API_BASE}/${modelId}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  return response;
}

/**
 * Send image to Gemini with model fallback chain
 */
async function analyzeOneImage(base64Image, subject, subjectName, onStatus) {
  const apiKey = Storage.getApiKey();
  if (!apiKey) throw new Error('\u8acb\u5148\u5728\u8a2d\u5b9a\u9801\u586b\u5165 Gemini API Key');

  const compressed = await compressImage(base64Image);
  const base64Data = compressed.replace(/^data:image\/\w+;base64,/, '');
  const prompt = buildPrompt(subject, subjectName);

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    }
  };

  // Try each model in the fallback chain
  for (let m = 0; m < MODELS.length; m++) {
    const model = MODELS[m];

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const statusMsg = `\u4f7f\u7528 ${model.name} (attempt ${attempt + 1})...`;
        console.log(`[Gemini] ${statusMsg}`);
        onStatus?.(statusMsg);

        const response = await tryModel(model.id, requestBody, apiKey);
        console.log(`[Gemini] ${model.id} -> ${response.status}`);

        if (response.status === 429) {
          if (attempt < MAX_RETRIES - 1) {
            const wait = BASE_DELAY_MS * Math.pow(2, attempt);
            console.warn(`[Gemini] ${model.id} rate limited. Waiting ${wait/1000}s...`);
            onStatus?.(`${model.name} \u983b\u7387\u9650\u5236\uff0c\u7b49\u5f85 ${wait/1000} \u79d2...`);
            await sleep(wait);
            continue;
          }
          // This model is exhausted, try next model
          console.warn(`[Gemini] ${model.id} exhausted. Trying next model...`);
          onStatus?.(`${model.name} \u984d\u5ea6\u8017\u76e1\uff0c\u5207\u63db\u4e0b\u4e00\u500b\u6a21\u578b...`);
          break;
        }

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[Gemini] Error:`, errText);
          if (response.status === 400) throw new Error('API Key \u7121\u6548\u6216\u5716\u7247\u683c\u5f0f\u932f\u8aa4');
          throw new Error(`API \u932f\u8aa4 (${response.status})`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(`[Gemini] Response from ${model.id}:`, text?.substring(0, 300));

        if (!text) {
          const reason = data.candidates?.[0]?.finishReason;
          if (reason === 'SAFETY') throw new Error('\u5716\u7247\u88ab\u5b89\u5168\u904e\u6ffe\u5668\u6514\u622a');
          throw new Error('\u7121\u6cd5\u53d6\u5f97 AI \u56de\u61c9');
        }

        const result = parseResponse(text);
        if (!result) {
          console.error(`[Gemini] Parse failed:`, text);
          throw new Error('\u7121\u6cd5\u89e3\u6790 JSON');
        }

        console.log(`[Gemini] Success via ${model.id}: ${result.questions?.length || 0}q, ${result.vocabulary?.length || 0}v`);
        return {
          questions: Array.isArray(result.questions) ? result.questions : [],
          vocabulary: Array.isArray(result.vocabulary) ? result.vocabulary : [],
          model: model.name,
          rawResponse: text.substring(0, 200),
        };

      } catch (error) {
        if (error.message?.includes('\u7121\u6548') || error.message?.includes('\u5b89\u5168')) throw error;
        if (attempt === MAX_RETRIES - 1 && m === MODELS.length - 1) throw error;
        if (attempt === MAX_RETRIES - 1) break; // try next model
        await sleep(BASE_DELAY_MS);
      }
    }
  }

  throw new Error('\u6240\u6709\u6a21\u578b\u7686\u5df2\u8017\u76e1\u914d\u984d\uff0c\u8acb\u7b49\u5f85\u5e7e\u5206\u9418\u5f8c\u518d\u8a66');
}

/**
 * Analyze multiple images one by one with delays and model fallback
 */
export async function analyzeMultipleImages(images, subject, subjectName, onProgress) {
  const allQuestions = [];
  const allVocabulary = [];
  const errors = [];
  const debugInfo = [];

  for (let i = 0; i < images.length; i++) {
    onProgress?.(i, images.length, `\u6b63\u5728\u8fa8\u8b58\u7b2c ${i + 1}/${images.length} \u5f35...`);

    try {
      const result = await analyzeOneImage(
        images[i].data, subject, subjectName,
        (status) => onProgress?.(i, images.length, `\u5716 ${i+1}: ${status}`)
      );
      if (result.questions?.length > 0) allQuestions.push(...result.questions);
      if (result.vocabulary?.length > 0) allVocabulary.push(...result.vocabulary);
      debugInfo.push({ name: images[i].name, questions: result.questions?.length || 0, model: result.model, raw: result.rawResponse });
      onProgress?.(i + 1, images.length,
        `\u7b2c ${i+1} \u5f35 (${result.model}): ${result.questions?.length || 0} \u984c`);
    } catch (err) {
      errors.push({ index: i, name: images[i].name, error: err.message });
      debugInfo.push({ name: images[i].name, error: err.message });
      onProgress?.(i + 1, images.length, `\u7b2c ${i+1} \u5f35\u5931\u6557: ${err.message}`);
    }

    if (i < images.length - 1) {
      onProgress?.(i + 1, images.length, `\u7b49\u5f85 ${DELAY_BETWEEN_IMAGES/1000} \u79d2...`);
      await sleep(DELAY_BETWEEN_IMAGES);
    }
  }

  console.log('[Gemini] === Summary ===');
  console.table(debugInfo);

  return { questions: allQuestions, vocabulary: allVocabulary, errors, debugInfo };
}

function buildPrompt(subject, subjectName) {
  const isEnglish = subject === 'english';
  const isMath = subject === 'math';
  const isChinese = subject === 'chinese';

  let extra = '';
  if (isEnglish) extra = `
- Extract English vocabulary with Chinese meanings into the vocabulary array.
- DO NOT create questions asking "What is the Chinese meaning of X" or "X 的中文意思" - we handle vocabulary separately.
- For fill-in-the-blank questions, ALWAYS provide a COMPLETE sentence with enough context. Example: "I like to ____ on the swings at the park." NOT just "Can a penguin ____?"
- Keep all questions in English for English subject.`;
  else if (isMath) extra = '\n- Preserve math expressions clearly.\n- Identify the math concept being tested.';
  else if (isChinese) extra = '\n- Extract vocabulary with pronunciation if visible.\n- Identify reading comprehension questions.';

  return `You are an expert at analyzing elementary school exam papers in Traditional Chinese.
Analyze this exam paper image for the subject: ${subjectName}
${extra}

IMPORTANT: You MUST extract questions from this image. Try your best even if image quality is not perfect.

Return a JSON object:

{
  "questions": [
    {
      "type": "choice",
      "text": "question text",
      "options": ["A", "B", "C", "D"],
      "answer": "correct option text",
      "difficulty": "easy"
    },
    {
      "type": "truefalse",
      "text": "complete statement to judge true or false",
      "options": [],
      "answer": "O",
      "difficulty": "easy"
    },
    {
      "type": "fill",
      "text": "A complete sentence with ____ for the blank",
      "options": [],
      "answer": "answer",
      "difficulty": "medium"
    }
  ],
  "vocabulary": [
    {"word": "word", "meaning": "meaning", "sentence": "a complete example sentence using this word"}
  ]
}

Rules:
1. Use Traditional Chinese for all text (except English content).
2. type: "choice", "truefalse", or "fill"
3. For choice: exactly 4 options.
4. For truefalse: answer "O" or "X".
5. For fill: the text MUST be a complete sentence with clear context. Never create isolated blanks without context.
6. NEVER ask for Chinese translations of English words in questions.
7. Extract as many questions as possible.
8. Return valid JSON only.`;
}

export function vocabularyToQuestions(vocabulary, subject) {
  const questions = [];

  for (let i = 0; i < vocabulary.length; i++) {
    const v = vocabulary[i];
    if (!v.word || !v.meaning) continue;

    if (subject === 'english') {
      // Fill-in with sentence context (use example sentence if available)
      if (v.sentence) {
        // Use the example sentence with blank
        const sentenceWithBlank = v.sentence.replace(new RegExp(v.word, 'gi'), '____');
        if (sentenceWithBlank !== v.sentence) {
          questions.push({
            type: 'fill',
            text: sentenceWithBlank,
            options: [], answer: v.word, difficulty: 'medium', fromVocab: true,
          });
        }
      }

      // Fill-in: "X的中文" 的英文是什麼？(Chinese to English only)
      // Strip parenthetical notes for cleaner display
      const cleanMeaning = v.meaning.replace(/\s*[（(].*?[）)]\s*/g, '').trim();

      questions.push({
        type: 'fill',
        text: `"${cleanMeaning}" \u7684\u82f1\u6587\u662f\u4ec0\u9ebc\uff1f`,
        options: [], answer: v.word, difficulty: 'medium', fromVocab: true,
      });

      // True/False correct: 「word」的意思是「meaning」
      questions.push({
        type: 'truefalse',
        text: `\u300c${v.word}\u300d\u7684\u610f\u601d\u662f\u300c${cleanMeaning}\u300d`,
        options: [], answer: 'O', difficulty: 'easy', fromVocab: true,
      });

      // True/False incorrect: pick a wrong meaning from same vocabulary list
      const others = vocabulary.filter((_, j) => j !== i && vocabulary[j].meaning);
      if (others.length > 0) {
        const wrong = others[Math.floor(Math.random() * others.length)];
        const wrongClean = wrong.meaning.replace(/\s*[（(].*?[）)]\s*/g, '').trim();
        questions.push({
          type: 'truefalse',
          text: `\u300c${v.word}\u300d\u7684\u610f\u601d\u662f\u300c${wrongClean}\u300d`,
          options: [], answer: 'X', difficulty: 'easy', fromVocab: true,
        });
      }

    } else if (subject === 'chinese') {
      questions.push({
        type: 'fill',
        text: `\u8acb\u5beb\u51fa "${v.word}" \u7684\u610f\u601d\u6216\u6ce8\u97f3`,
        options: [], answer: v.meaning, difficulty: 'easy', fromVocab: true,
      });
      questions.push({
        type: 'truefalse',
        text: `"${v.word}" \u7684\u610f\u601d\u662f "${v.meaning}"\u3002`,
        options: [], answer: 'O', difficulty: 'easy', fromVocab: true,
      });
      const others = vocabulary.filter((_, j) => j !== i && vocabulary[j].meaning);
      if (others.length > 0) {
        const wrong = others[Math.floor(Math.random() * others.length)];
        questions.push({
          type: 'truefalse',
          text: `"${v.word}" \u7684\u610f\u601d\u662f "${wrong.meaning}"\u3002`,
          options: [], answer: 'X', difficulty: 'easy', fromVocab: true,
        });
      }
    }
  }
  return questions;
}

/**
 * Clean up bad question patterns from stored questions
 * Removes: English-to-Chinese translation questions, context-less fill-in-blanks
 */
export function cleanupBadQuestions() {
  const raw = localStorage.getItem('quiz_questions');
  if (!raw) return 0;
  const questions = JSON.parse(raw);
  const badPatterns = [
    /What is the Chinese meaning/i,
    /\u8acb\u5beb\u51fa.*\u7684\u4e2d\u6587\u610f\u601d/,
    /Chinese meaning of/i,
    /Which word means/i,
    /^The word '.*' means '/i,
  ];
  const filtered = questions.filter(q => {
    const text = q.content?.text || '';
    return !badPatterns.some(p => p.test(text));
  });
  const removed = questions.length - filtered.length;
  if (removed > 0) {
    localStorage.setItem('quiz_questions', JSON.stringify(filtered));
  }
  return removed;
}

export function validateApiKey(key) {
  return key && key.trim().length >= 20;
}
