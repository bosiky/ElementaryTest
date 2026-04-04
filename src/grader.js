// grader.js - Auto-grading logic

import { Storage } from './storage.js';

export const Grader = {
  /**
   * Grade a completed quiz
   * @param {Object} quiz - The quiz object with user answers
   * @returns {Object} Grading result
   */
  grade(quiz) {
    const details = quiz.questions.map((q, index) => {
      const userAnswer = (q.userAnswer || '').toString().trim();
      const correctAnswer = (q.answer || '').toString().trim();

      let isCorrect = false;
      if (q.type === 'fill') {
        // For fill-in questions, normalize and compare
        isCorrect = this.normalizeFillAnswer(userAnswer) === this.normalizeFillAnswer(correctAnswer);
      } else {
        isCorrect = userAnswer === correctAnswer;
      }

      return {
        questionId: q.id,
        questionIndex: index + 1,
        questionText: q.content?.text || '',
        questionImage: q.content?.image || null,
        questionType: q.type,
        options: q.options || [],
        userAnswer: userAnswer,
        correctAnswer: correctAnswer,
        isCorrect,
      };
    });

    const correctCount = details.filter(d => d.isCorrect).length;
    const totalQuestions = details.length;
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const endedAt = new Date().toISOString();
    const startedAt = quiz.startedAt;
    const timeSpent = startedAt ? Math.round((new Date(endedAt) - new Date(startedAt)) / 1000) : 0;

    const result = {
      quizId: quiz.id,
      year: Storage.getSettings().year,
      grade: Storage.getSettings().grade,
      semester: Storage.getSettings().semester,
      subject: quiz.subject,
      difficulty: quiz.difficulty,
      totalQuestions,
      correctCount,
      score,
      timeSpent,
      gradeLevel: this.getGradeLevel(score),
      details,
    };

    // Save to records
    Storage.saveRecord(result);

    return result;
  },

  normalizeFillAnswer(answer) {
    // Remove whitespace, convert to lowercase for comparison
    return answer.replace(/\s+/g, '').toLowerCase();
  },

  getGradeLevel(score) {
    if (score >= 90) return { level: 'excellent', text: '\u512a\u79c0 \u{1f31f}', emoji: '\u{1f3c6}' };
    if (score >= 75) return { level: 'good', text: '\u826f\u597d \u{1f44d}', emoji: '\u{1f389}' };
    if (score >= 60) return { level: 'pass', text: '\u53ca\u683c \u{1f4aa}', emoji: '\u2705' };
    return { level: 'fail', text: '\u52a0\u6cb9 \u{1f4a8}', emoji: '\u{1f4da}' };
  },

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}\u5206${s.toString().padStart(2, '0')}\u79d2`;
  },
};
