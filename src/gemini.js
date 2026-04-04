// gemini.js - Google Gemini API integration for exam paper scanning
// With rate limiting, retry logic, and batch support

import { Storage } from './storage.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 5000; // 5 seconds base delay for retry

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Analyze an exam paper image using Gemini AI (with retry)
 * @param {string} base64Image - Base64-encoded image data (with data URI prefix)
 * @param {string} subject - Subject key
 * @param {string} subjectName - Display name of the subject
 * @returns {Promise<{questions: Array, vocabulary: Array}>}
 */
export async function analyzeExamPaper(base64Image, subject, subjectName) {
  const apiKey = Storage.getApiKey();
  if (!apiKey) {
    throw new Error('\u8acb\u5148\u5728\u8a2d\u5b9a\u9801\u586b\u5165 Gemini API Key');
  }

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

  // Retry with exponential backoff
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 429) {
        // Rate limited - wait and retry
        const waitTime = BASE_DELAY_MS * Math.pow(2, attempt); // 5s, 10s, 20s
        console.warn(`[Gemini] Rate limited. Retry ${attempt + 1}/${MAX_RETRIES} after ${waitTime / 1000}s...`);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 400) throw new Error('API Key \u7121\u6548\u6216\u5716\u7247\u683c\u5f0f\u4e0d\u652f\u63f4');
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
    } catch (error) {
      // If it's a non-retryable error, throw immediately
      if (!error.message?.includes('Rate') && attempt === 0) {
        throw error;
      }
      if (attempt === MAX_RETRIES - 1) {
        throw error;
      }
    }
  }

  throw new Error('\u91cd\u8a66\u591a\u6b21\u5f8c\u4ecd\u7136\u5931\u6557\uff0c\u8acb\u7a0d\u5f8c\u518d\u8a66');
}

/**
 * Analyze multiple exam images with automatic rate limiting
 * Processes one image at a time with delays between each
 * @param {Array<{data: string, name: string}>} images - Array of image objects
 * @param {string} subject - Subject key
 * @param {string} subjectName - Display name
 * @param {function} onProgress - Progress callback (index, total, status)
 * @returns {Promise<{questions: Array, vocabulary: Array, errors: Array}>}
 */
export async function analyzeMultipleImages(images, subject, subjectName, onProgress) {
  const allQuestions = [];
  const allVocabulary = [];
  const errors = [];
  const DELAY_BETWEEN_MS = 4000; // 4 seconds between requests

  for (let i = 0; i < images.length; i++) {
    onProgress?.(i, images.length, `\u6b63\u5728\u8fa8\u8b58\u7b2c ${i + 1}/${images.length} \u5f35\u5716\u7247...`);

    try {
      const result = await analyzeExamPaper(images[i].data, subject, subjectName);
      if (result.questions) allQuestions.push(...result.questions);
      if (result.vocabulary) allVocabulary.push(...result.vocabulary);
      onProgress?.(i, images.length, `\u7b2c ${i + 1} \u5f35\u5b8c\u6210\uff01\u627e\u5230 ${result.questions?.length || 0} \u984c`);
    } catch (err) {
      errors.push({ index: i, name: images[i].name, error: err.message });
      onProgress?.(i, images.length, `\u7b2c ${i + 1} \u5f35\u5931\u6557: ${err.message}`);
    }

    // Wait between requests (skip after last one)
    if (i < images.length - 1) {
      onProgress?.(i, images.length, `\u7b49\u5f85 ${DELAY_BETWEEN_MS / 1000} \u79d2\u907f\u514d\u983b\u7387\u9650\u5236...`);
      await sleep(DELAY_BETWEEN_MS);
    }
  }

  return { questions: allQuestions, vocabulary: allVocabulary, errors };
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
- Extract vocabulary words (\u751f\u5b57/\u751f\u8a5e) with their pronunciation (\u6ce8\u97f3/\u62fc\u97f3) if visible.
- Identify reading comprehension questions.
- For vocabulary, create fill-in-the-blank questions.`;
  }

  return `You are an expert at analyzing elementary school exam papers in Traditional Chinese (\u7e41\u9ad4\u4e2d\u6587).
Analyze this exam paper image for the subject: ${subjectName}

${subjectSpecific}

Extract ALL questions and vocabulary you can find. Return a JSON object with this EXACT structure:

{
  "questions": [
    {
      "type": "choice",
      "text": "\u984c\u76ee\u5167\u5bb9 (in Traditional Chinese)",
      "options": ["\u9078\u9805A", "\u9078\u9805B", "\u9078\u9805C", "\u9078\u9805D"],
      "answer": "\u6b63\u78ba\u7b54\u6848\u7684\u9078\u9805\u5167\u5bb9",
      "difficulty": "easy|medium|hard"
    },
    {
      "type": "truefalse",
      "text": "\u662f\u975e\u984c\u5167\u5bb9",
      "options": [],
      "answer": "O or X",
      "difficulty": "easy|medium|hard"
    },
    {
      "type": "fill",
      "text": "\u586b\u5145\u984c\u5167\u5bb9\uff0c\u7a7a\u683c\u7528 ____ \u8868\u793a",
      "options": [],
      "answer": "\u6b63\u78ba\u7b54\u6848",
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
1. ALL text must be in Traditional Chinese (\u7e41\u9ad4\u4e2d\u6587), except for English subject content.
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
      questions.push({
        type: 'fill',
        text: `\u8acb\u5beb\u51fa "${v.word}" \u7684\u4e2d\u6587\u610f\u601d`,
        options: [],
        answer: v.meaning,
        difficulty: 'easy',
        fromVocab: true,
      });
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
