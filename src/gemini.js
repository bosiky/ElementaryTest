// gemini.js - Google Gemini API integration for exam paper scanning

import { Storage } from './storage.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Analyze an exam paper image using Gemini AI
 * @param {string} base64Image - Base64-encoded image data (with data URI prefix)
 * @param {string} subject - Subject key (chinese, math, english, etc.)
 * @param {string} subjectName - Display name of the subject
 * @returns {Promise<{questions: Array, vocabulary: Array}>}
 */
export async function analyzeExamPaper(base64Image, subject, subjectName) {
  const apiKey = Storage.getApiKey();
  if (!apiKey) {
    throw new Error('\u8acb\u5148\u5728\u8a2d\u5b9a\u9801\u586b\u5165 Gemini API Key');
  }

  // Strip data URI prefix to get raw base64
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const mimeType = base64Image.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';

  const prompt = buildPrompt(subject, subjectName);

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Data,
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    }
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 400) throw new Error('API Key \u7121\u6548\u6216\u5716\u7247\u683c\u5f0f\u4e0d\u652f\u63f4');
    if (response.status === 429) throw new Error('API \u8acb\u6c42\u904e\u65bc\u983b\u7e41\uff0c\u8acb\u7a0d\u5f8c\u518d\u8a66');
    throw new Error(err.error?.message || `API \u932f\u8aa4 (${response.status})`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('\u7121\u6cd5\u89e3\u6790 AI \u56de\u61c9');
  }

  try {
    const result = JSON.parse(text);
    return {
      questions: Array.isArray(result.questions) ? result.questions : [],
      vocabulary: Array.isArray(result.vocabulary) ? result.vocabulary : [],
    };
  } catch (e) {
    throw new Error('\u7121\u6cd5\u89e3\u6790 AI \u56de\u61c9\u7684 JSON \u683c\u5f0f');
  }
}

function buildPrompt(subject, subjectName) {
  const isEnglish = subject === 'english';
  const isMath = subject === 'math';
  const isChinese = subject === 'chinese';

  let subjectSpecific = '';
  if (isEnglish) {
    subjectSpecific = `
- Pay special attention to English vocabulary words. Extract each word with its Chinese meaning.
- For vocabulary, create fill-in-the-blank questions (English to Chinese and Chinese to English).
- Identify sentence patterns and grammar points.`;
  } else if (isMath) {
    subjectSpecific = `
- For math problems, preserve the mathematical expressions clearly.
- Include calculation steps hints if visible in the image.
- Identify the math concept being tested (e.g., addition, multiplication, fractions).`;
  } else if (isChinese) {
    subjectSpecific = `
- Extract vocabulary words (生字/生詞) with their pronunciation (注音/拼音) if visible.
- Identify reading comprehension questions.
- For vocabulary, create fill-in-the-blank questions.`;
  }

  return `You are an expert at analyzing elementary school exam papers in Traditional Chinese (繁體中文).
Analyze this exam paper image for the subject: ${subjectName}

${subjectSpecific}

Extract ALL questions and vocabulary you can find. Return a JSON object with this EXACT structure:

{
  "questions": [
    {
      "type": "choice",
      "text": "題目內容 (in Traditional Chinese)",
      "options": ["選項A", "選項B", "選項C", "選項D"],
      "answer": "正確答案的選項內容",
      "difficulty": "easy|medium|hard"
    },
    {
      "type": "truefalse",
      "text": "是非題內容",
      "options": [],
      "answer": "O or X",
      "difficulty": "easy|medium|hard"
    },
    {
      "type": "fill",
      "text": "填充題內容，空格用 ____ 表示",
      "options": [],
      "answer": "正確答案",
      "difficulty": "easy|medium|hard"
    }
  ],
  "vocabulary": [
    {
      "word": "the word or character",
      "meaning": "meaning or pronunciation",
      "sentence": "example sentence if available"
    }
  ]
}

Rules:
1. ALL text must be in Traditional Chinese (繁體中文), except for English subject content.
2. "type" must be one of: "choice", "truefalse", "fill"
3. For "choice" type, "options" must have exactly 4 items. "answer" should be the exact text of the correct option.
4. For "truefalse", "answer" must be "O" (correct) or "X" (wrong).
5. Estimate difficulty based on grade level complexity.
6. Extract as many questions as possible from the image.
7. If you cannot identify a question clearly, skip it rather than guessing.
8. Return ONLY valid JSON, no markdown or explanations.`;
}

/**
 * Convert vocabulary items into fill-in-the-blank questions
 */
export function vocabularyToQuestions(vocabulary, subject) {
  const questions = [];
  for (const v of vocabulary) {
    if (subject === 'english') {
      // English → Chinese
      questions.push({
        type: 'fill',
        text: `\u8acb\u5beb\u51fa "${v.word}" \u7684\u4e2d\u6587\u610f\u601d`,
        options: [],
        answer: v.meaning,
        difficulty: 'easy',
        fromVocab: true,
      });
      // Chinese → English
      questions.push({
        type: 'fill',
        text: `"${v.meaning}" \u7684\u82f1\u6587\u662f\u4ec0\u9ebc\uff1f`,
        options: [],
        answer: v.word,
        difficulty: 'medium',
        fromVocab: true,
      });
    } else if (subject === 'chinese') {
      if (v.meaning) {
        questions.push({
          type: 'fill',
          text: `\u8acb\u5beb\u51fa "${v.word}" \u7684\u6ce8\u97f3\u6216\u89e3\u91cb`,
          options: [],
          answer: v.meaning,
          difficulty: 'easy',
          fromVocab: true,
        });
      }
      if (v.sentence) {
        questions.push({
          type: 'fill',
          text: v.sentence.replace(v.word, '____'),
          options: [],
          answer: v.word,
          difficulty: 'medium',
          fromVocab: true,
        });
      }
    }
  }
  return questions;
}

/**
 * Validate that an API key looks correct
 */
export function validateApiKey(key) {
  return key && key.trim().length >= 20;
}
