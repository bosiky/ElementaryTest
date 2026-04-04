// pages/result.js - Grading result & review page

import { Grader } from '../grader.js';
import { QuestionBank } from '../questionBank.js';
import { getCurrentQuiz, clearQuiz } from './quiz.js';

export function renderResult(navigate) {
  const quiz = getCurrentQuiz();
  if (!quiz) return `<div class="page-enter text-center" style="padding:var(--sp-3xl)"><p>\u6c92\u6709\u53ef\u986f\u793a\u7684\u6e2c\u9a57\u7d50\u679c</p><button class="btn btn-primary mt-lg" id="go-home-result">\u8fd4\u56de\u9996\u9801</button></div>`;

  const result = Grader.grade(quiz);
  const gl = result.gradeLevel;

  const detailsHtml = result.details.map((d, i) => {
    const cls = d.isCorrect ? 'correct' : 'incorrect';
    return `<div class="review-item ${cls}">
      <div class="review-question-text"><strong>\u7b2c ${d.questionIndex} \u984c</strong>\u3000${escapeHtml(d.questionText)}
        ${d.questionImage ? `<br/><img src="${d.questionImage}" style="max-height:120px;border-radius:8px;margin-top:8px;" />` : ''}</div>
      <div class="review-answer">
        <div class="review-answer-item">\u4f60\u7684\u7b54\u6848: <span class="${d.isCorrect ? 'review-correct-mark' : 'review-incorrect-mark'}">${escapeHtml(d.userAnswer || '(\u672a\u4f5c\u7b54)')}</span></div>
        ${!d.isCorrect ? `<div class="review-answer-item">\u6b63\u78ba\u7b54\u6848: <span class="review-correct-mark">${escapeHtml(d.correctAnswer)}</span></div>` : ''}
        <div class="review-answer-item"><span class="tag tag-${d.isCorrect ? 'success' : 'danger'}">${d.isCorrect ? '\u2713 \u6b63\u78ba' : '\u2717 \u932f\u8aa4'}</span></div>
      </div>
    </div>`;
  }).join('');

  return `<div class="page-enter">
    <div class="result-hero ${gl.level}">
      <div style="font-size:3rem;margin-bottom:var(--sp-md)">${gl.emoji}</div>
      <div class="result-score ${gl.level}">${result.score}</div>
      <div class="result-grade">${gl.text}</div>
      <div class="result-summary">\u7b54\u5c0d ${result.correctCount} / ${result.totalQuestions} \u984c</div>
      <div class="result-stats">
        <div class="result-stat"><div class="result-stat-value">${result.totalQuestions}</div><div class="result-stat-label">\u7e3d\u984c\u6578</div></div>
        <div class="result-stat"><div class="result-stat-value">${result.correctCount}</div><div class="result-stat-label">\u7b54\u5c0d</div></div>
        <div class="result-stat"><div class="result-stat-value">${Grader.formatTime(result.timeSpent)}</div><div class="result-stat-label">\u82b1\u8cbb\u6642\u9593</div></div>
      </div>
    </div>

    <div class="flex-between mb-lg">
      <h2 class="section-title" style="margin-bottom:0">\u{1f4cb} \u7b54\u984c\u8a73\u60c5</h2>
      <div class="flex-row gap-sm">
        <button class="btn btn-primary" id="retry-btn">\u{1f504} \u518d\u6e2c\u4e00\u6b21</button>
        <button class="btn btn-outline" id="go-home-btn">\u{1f3e0} \u8fd4\u56de\u9996\u9801</button>
      </div>
    </div>
    <div class="review-list">${detailsHtml}</div>
  </div>`;
}

export function bindResult(navigate) {
  document.getElementById('go-home-result')?.addEventListener('click', () => navigate('home'));
  document.getElementById('retry-btn')?.addEventListener('click', () => { clearQuiz(); navigate('quiz'); });
  document.getElementById('go-home-btn')?.addEventListener('click', () => { clearQuiz(); navigate('home'); });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
