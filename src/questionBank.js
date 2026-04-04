// questionBank.js - Question bank management with extensible subjects

import { Storage } from './storage.js';

// Default built-in subjects
export const DEFAULT_SUBJECTS = {
  chinese: { name: '\u570b\u8a9e', icon: '\u{1f4d6}' },
  math: { name: '\u6578\u5b78', icon: '\u{1f522}' },
  english: { name: '\u82f1\u8a9e', icon: '\u{1f1ec}\u{1f1e7}' },
  science: { name: '\u81ea\u7136', icon: '\u{1f52c}' },
  social: { name: '\u793e\u6703', icon: '\u{1f30d}' },
  life: { name: '\u751f\u6d3b', icon: '\u{1f3e0}' },
  health: { name: '\u5065\u5eb7', icon: '\u{1f3c3}' },
  art: { name: '\u7f8e\u8853', icon: '\u{1f3a8}' },
  music: { name: '\u97f3\u6a02', icon: '\u{1f3b5}' },
  pe: { name: '\u9ad4\u80b2', icon: '\u26bd' },
  native_lang: { name: '\u672c\u571f\u8a9e\u8a00', icon: '\u{1f5e3}\ufe0f' },
  info: { name: '\u8cc7\u8a0a', icon: '\u{1f4bb}' },
};

// Get all subjects (defaults + custom)
export function getSubjects() {
  const custom = Storage.getCustomSubjects();
  return { ...DEFAULT_SUBJECTS, ...custom };
}

// Use dynamic getter instead of static SUBJECTS
export const SUBJECTS = new Proxy({}, {
  get(target, prop) {
    const all = getSubjects();
    return all[prop];
  },
  ownKeys() {
    return Object.keys(getSubjects());
  },
  getOwnPropertyDescriptor(target, prop) {
    const all = getSubjects();
    if (prop in all) {
      return { configurable: true, enumerable: true, value: all[prop] };
    }
  },
  has(target, prop) {
    return prop in getSubjects();
  },
});

export const QUESTION_TYPES = {
  choice: { name: '\u9078\u64c7\u984c', icon: '\u2611\ufe0f' },
  truefalse: { name: '\u662f\u975e\u984c', icon: '\u2753' },
  fill: { name: '\u586b\u5145\u984c', icon: '\u270d\ufe0f' },
};

// Scope is now a free-text field extracted from exam paper titles
// e.g. "Our World Book 2 Unit 7", "南一版第三課"
export const DIFFICULTIES = {
  easy: { name: '\u7c21\u55ae', color: 'success' },
  medium: { name: '\u4e2d\u7b49', color: 'warning' },
  hard: { name: '\u56f0\u96e3', color: 'danger' },
};

export const GRADES = [
  { value: 1, name: '\u4e00\u5e74\u7d1a' },
  { value: 2, name: '\u4e8c\u5e74\u7d1a' },
  { value: 3, name: '\u4e09\u5e74\u7d1a' },
  { value: 4, name: '\u56db\u5e74\u7d1a' },
  { value: 5, name: '\u4e94\u5e74\u7d1a' },
  { value: 6, name: '\u516d\u5e74\u7d1a' },
];

export const SEMESTERS = [
  { value: 1, name: '\u4e0a\u5b78\u671f' },
  { value: 2, name: '\u4e0b\u5b78\u671f' },
];

export const SUBJECT_ICONS = [
  '\u{1f4d6}', '\u{1f522}', '\u{1f52c}', '\u{1f30d}', '\u{1f3e0}', '\u{1f3c3}',
  '\u{1f3a8}', '\u{1f3b5}', '\u26bd', '\u{1f5e3}\ufe0f', '\u{1f4bb}', '\u{1f4da}',
  '\u{1f4dd}', '\u{1f9ea}', '\u{1f9ee}', '\u{1f30e}', '\u{1f3ad}', '\u{1f3b9}',
  '\u2699\ufe0f', '\u{1f9d1}\u200d\u{1f3eb}', '\u{1f4d0}', '\u{1f4ca}',
];

export const QuestionBank = {
  createQuestion(data) {
    const question = {
      year: data.year,
      grade: data.grade,
      semester: data.semester,
      subject: data.subject,
      type: data.type,
      difficulty: data.difficulty || 'medium',
      scope: data.scope || '',
      content: {
        text: data.text || '',
        image: data.image || null,
      },
      options: data.options || [],
      answer: data.answer,
    };
    return Storage.addQuestion(question);
  },

  getQuestionsBySettings(settings) {
    return Storage.getFilteredQuestions({
      year: settings.year,
      grade: settings.grade,
      semester: settings.semester,
    });
  },

  getQuestionCount(filters) {
    return Storage.getFilteredQuestions(filters).length;
  },

  formatQuestionType(type) {
    return QUESTION_TYPES[type]?.name || type;
  },

  formatSubject(subject) {
    const all = getSubjects();
    return all[subject]?.name || subject;
  },

  formatDifficulty(difficulty) {
    return DIFFICULTIES[difficulty]?.name || difficulty;
  },

  formatGrade(grade) {
    return GRADES.find(g => g.value === grade)?.name || `${grade}\u5e74\u7d1a`;
  },

  formatSemester(semester) {
    return SEMESTERS.find(s => s.value === semester)?.name || `\u7b2c${semester}\u5b78\u671f`;
  },
};
