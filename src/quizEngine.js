// quizEngine.js - Quiz generation engine

import { Storage } from './storage.js';

export const QuizEngine = {
  /**
   * Generate a quiz from the question bank
   * @param {Object} options
   * @param {number} options.count - Number of questions
   * @param {string} options.subject - Subject filter (optional)
   * @param {string} options.difficulty - Difficulty filter (optional)
   * @param {number} options.timeLimit - Time limit in minutes (0 = no limit)
   * @returns {Object} Quiz object
   */
  generateQuiz(options = {}) {
    const settings = Storage.getSettings();
    const filters = {
      year: settings.year,
      grade: settings.grade,
      semester: settings.semester,
    };

    if (options.subject) filters.subject = options.subject;
    if (options.difficulty) filters.difficulty = options.difficulty;

    let pool = Storage.getFilteredQuestions(filters);

    if (pool.length === 0) {
      return { error: 'no_questions', questions: [] };
    }

    const count = Math.min(options.count || 10, pool.length);

    // Shuffle and pick
    const shuffled = this.shuffle([...pool]);
    const selected = shuffled.slice(0, count);

    // Randomize option order for choice questions
    const questions = selected.map(q => {
      const quizQuestion = { ...q, userAnswer: null, flagged: false };
      if (q.type === 'choice' && q.options?.length > 0) {
        // Create a mapping of shuffled options
        const optionPairs = q.options.map((opt, idx) => ({ opt, isAnswer: opt === q.answer }));
        const shuffledPairs = this.shuffle(optionPairs);
        quizQuestion.displayOptions = shuffledPairs.map(p => p.opt);
      }
      return quizQuestion;
    });

    return {
      id: Storage.generateId(),
      questions,
      totalQuestions: questions.length,
      timeLimit: (options.timeLimit || 0) * 60, // convert to seconds
      subject: options.subject || 'all',
      difficulty: options.difficulty || 'all',
      startedAt: new Date().toISOString(),
    };
  },

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },

  getAvailableCount(options = {}) {
    const settings = Storage.getSettings();
    const filters = {
      year: settings.year,
      grade: settings.grade,
      semester: settings.semester,
    };
    if (options.subject) filters.subject = options.subject;
    if (options.difficulty) filters.difficulty = options.difficulty;
    return Storage.getFilteredQuestions(filters).length;
  },
};
