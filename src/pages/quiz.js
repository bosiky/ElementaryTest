// pages/quiz.js - Quiz setup and exam taking

import { Storage } from '../storage.js';
import { SUBJECTS, QuestionBank } from '../questionBank.js';
import { QuizEngine } from '../quizEngine.js';
import { showToast, getSubjectOptions, getDifficultyOptions } from '../ui-helpers.js';

let currentQuiz = null;
let currentIndex = 0;
let timerInterval = null;
let remainingTime = 0;

export function renderQuizSetup(navigate) {
  const settings = Storage.getSettings();
  const totalAvail = QuizEngine.getAvailableCount();

  return `<div class="page-enter">
    <h1 class="page-title">\u{1f3af} \u958b\u59cb\u6e2c\u9a57</h1>
    <p class="page-subtitle">\u8a2d\u5b9a\u51fa\u984c\u689d\u4ef6\u5f8c\u958b\u59cb\u4f5c\u7b54 (\u76ee\u524d\u984c\u5eab\u5171 ${totalAvail} \u984c)</p>
    ${totalAvail === 0 ? `<div class="card text-center" style="padding:var(--sp-3xl)"><div style="font-size:3rem;margin-bottom:var(--sp-md)">\u{1f4ed}</div><p>\u984c\u5eab\u4e2d\u6c92\u6709\u984c\u76ee\uff0c\u8acb\u5148\u5230\u300c\u984c\u5eab\u7ba1\u7406\u300d\u65b0\u589e\u984c\u76ee</p><button class="btn btn-primary mt-lg" id="go-bank-btn">\u524d\u5f80\u984c\u5eab\u7ba1\u7406</button></div>` : `
    <div class="card" style="max-width:600px;">
      <div class="form-group"><label class="form-label">\u79d1\u76ee\u7bc4\u570d</label>
        <select class="form-select" id="quiz-subject">${getSubjectOptions('', true)}</select></div>
      <div class="form-group"><label class="form-label">\u96e3\u5ea6\u7bc4\u570d</label>
        <select class="form-select" id="quiz-difficulty">${getDifficultyOptions('', true)}</select></div>
      <div class="form-group"><label class="form-label">\u984c\u6578</label>
        <div class="option-group" id="quiz-count-group">
          ${[5,10,15,20].map(n => `<button class="option-btn ${n===10?'selected':''}" data-val="${n}">${n} \u984c</button>`).join('')}
        </div>
        <div class="flex-row mt-md gap-sm"><input class="form-input" id="quiz-count-custom" type="number" min="1" max="100" placeholder="\u81ea\u8a02\u984c\u6578" style="max-width:150px;" /><span class="text-secondary" style="font-size:0.85rem">\u53ef\u7528: <span id="avail-count">${totalAvail}</span> \u984c</span></div>
      </div>
      <div class="form-group"><label class="form-label">\u6642\u9593\u9650\u5236 (\u5206\u9418\uff0c0=\u4e0d\u9650\u6642)</label>
        <input class="form-input" id="quiz-time" type="number" min="0" max="120" value="0" style="max-width:150px;" /></div>
      <button class="btn btn-accent btn-lg" id="start-quiz-btn" style="width:100%;margin-top:var(--sp-md)">\u{1f680} \u958b\u59cb\u6e2c\u9a57</button>
    </div>`}
  </div>`;
}

export function bindQuizSetup(navigate) {
  document.getElementById('go-bank-btn')?.addEventListener('click', () => navigate('bank'));

  // Count selection
  document.querySelectorAll('#quiz-count-group .option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#quiz-count-group .option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('quiz-count-custom').value = '';
    });
  });

  // Update available count when filters change
  const updateAvail = () => {
    const subj = document.getElementById('quiz-subject')?.value || '';
    const diff = document.getElementById('quiz-difficulty')?.value || '';
    const count = QuizEngine.getAvailableCount({ subject: subj || undefined, difficulty: diff || undefined });
    const el = document.getElementById('avail-count');
    if (el) el.textContent = count;
  };
  document.getElementById('quiz-subject')?.addEventListener('change', updateAvail);
  document.getElementById('quiz-difficulty')?.addEventListener('change', updateAvail);

  // Start
  document.getElementById('start-quiz-btn')?.addEventListener('click', () => {
    const subject = document.getElementById('quiz-subject').value || undefined;
    const difficulty = document.getElementById('quiz-difficulty').value || undefined;
    const customCount = parseInt(document.getElementById('quiz-count-custom').value);
    const selectedBtn = document.querySelector('#quiz-count-group .option-btn.selected');
    const count = customCount > 0 ? customCount : (selectedBtn ? parseInt(selectedBtn.dataset.val) : 10);
    const timeLimit = parseInt(document.getElementById('quiz-time').value) || 0;

    const quiz = QuizEngine.generateQuiz({ count, subject, difficulty, timeLimit });
    if (quiz.error === 'no_questions') {
      showToast('\u7b26\u5408\u689d\u4ef6\u7684\u984c\u76ee\u4e0d\u8db3', 'error');
      return;
    }

    currentQuiz = quiz;
    currentIndex = 0;
    navigate('exam');
  });
}

export function renderExam(navigate) {
  if (!currentQuiz) return renderQuizSetup(navigate);
  const q = currentQuiz.questions[currentIndex];
  if (!q) return renderQuizSetup(navigate);

  const timerHtml = currentQuiz.timeLimit > 0
    ? `<div class="exam-timer" id="exam-timer">${formatTimer(remainingTime || currentQuiz.timeLimit)}</div>` : '';

  const progressPct = ((currentIndex + 1) / currentQuiz.totalQuestions * 100).toFixed(0);

  let answerHtml = '';
  if (q.type === 'choice') {
    const opts = q.displayOptions || q.options || [];
    answerHtml = `<div class="answer-options">${opts.map((opt, i) => {
      const marker = String.fromCharCode(65 + i);
      const selected = q.userAnswer === opt ? 'selected' : '';
      return `<div class="answer-option ${selected}" data-answer="${escapeAttr(opt)}"><div class="option-marker">${marker}</div><div>${escapeHtml(opt)}</div></div>`;
    }).join('')}</div>`;
  } else if (q.type === 'truefalse') {
    answerHtml = `<div class="tf-options">
      <div class="tf-option ${q.userAnswer === 'O' ? 'selected' : ''}" data-answer="O">O (\u5c0d)</div>
      <div class="tf-option ${q.userAnswer === 'X' ? 'selected' : ''}" data-answer="X">X (\u932f)</div></div>`;
  } else {
    answerHtml = `<input class="fill-input" id="fill-answer" value="${escapeAttr(q.userAnswer || '')}" placeholder="\u8acb\u8f38\u5165\u7b54\u6848" />`;
  }

  const dots = currentQuiz.questions.map((qq, i) => {
    let cls = 'question-dot';
    if (i === currentIndex) cls += ' current';
    else if (qq.userAnswer) cls += ' answered';
    if (qq.flagged) cls += ' flagged';
    return `<div class="${cls}" data-idx="${i}">${i + 1}</div>`;
  }).join('');

  return `<div class="page-enter">
    <div class="exam-header">
      ${timerHtml}
      <div class="exam-progress">
        <div class="progress-bar"><div class="progress-fill" style="width:${progressPct}%"></div></div>
        <div class="progress-text">\u7b2c ${currentIndex + 1} \u984c / \u5171 ${currentQuiz.totalQuestions} \u984c</div>
      </div>
      <button class="btn btn-sm ${q.flagged ? 'btn-accent' : 'btn-outline'}" id="flag-btn">\u{1f6a9} ${q.flagged ? '\u5df2\u6a19\u8a18' : '\u6a19\u8a18'}</button>
    </div>
    <div class="exam-question">
      <div class="exam-question-number">\u7b2c ${currentIndex + 1} \u984c\u3000<span class="tag tag-info">${QuestionBank.formatQuestionType(q.type)}</span></div>
      ${q.content?.image ? `<img src="${q.content.image}" class="exam-question-image" alt="question"/>` : ''}
      <div class="exam-question-text">${escapeHtml(q.content?.text || '')}</div>
      ${answerHtml}
    </div>
    <div class="exam-nav">
      <button class="btn btn-outline" id="prev-btn" ${currentIndex === 0 ? 'disabled' : ''}>\u2b05 \u4e0a\u4e00\u984c</button>
      <div class="question-dots">${dots}</div>
      ${currentIndex === currentQuiz.totalQuestions - 1
        ? `<button class="btn btn-success" id="submit-btn">\u{1f4dd} \u4ea4\u5377</button>`
        : `<button class="btn btn-primary" id="next-btn">\u4e0b\u4e00\u984c \u27a1</button>`}
    </div>
  </div>`;
}

export function bindExam(navigate) {
  if (!currentQuiz) return;
  const q = currentQuiz.questions[currentIndex];

  // Timer
  if (currentQuiz.timeLimit > 0 && !timerInterval) {
    remainingTime = currentQuiz.timeLimit;
    timerInterval = setInterval(() => {
      remainingTime--;
      const el = document.getElementById('exam-timer');
      if (el) {
        el.textContent = formatTimer(remainingTime);
        if (remainingTime <= 60) el.className = 'exam-timer danger';
        else if (remainingTime <= 180) el.className = 'exam-timer warning';
      }
      if (remainingTime <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        showToast('\u6642\u9593\u5230\uff01\u81ea\u52d5\u4ea4\u5377', 'info');
        navigate('result');
      }
    }, 1000);
  }

  // Answer selection
  document.querySelectorAll('.answer-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.answer-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      q.userAnswer = opt.dataset.answer;
    });
  });

  document.querySelectorAll('.tf-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.tf-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      q.userAnswer = opt.dataset.answer;
    });
  });

  document.getElementById('fill-answer')?.addEventListener('input', (e) => {
    q.userAnswer = e.target.value;
  });

  // Flag
  document.getElementById('flag-btn')?.addEventListener('click', () => {
    q.flagged = !q.flagged;
    navigate('exam');
  });

  // Navigation
  document.getElementById('prev-btn')?.addEventListener('click', () => {
    if (currentIndex > 0) { currentIndex--; navigate('exam'); }
  });
  document.getElementById('next-btn')?.addEventListener('click', () => {
    if (currentIndex < currentQuiz.totalQuestions - 1) { currentIndex++; navigate('exam'); }
  });

  // Dots
  document.querySelectorAll('.question-dot').forEach(dot => {
    dot.addEventListener('click', () => { currentIndex = parseInt(dot.dataset.idx); navigate('exam'); });
  });

  // Submit
  document.getElementById('submit-btn')?.addEventListener('click', () => {
    const unanswered = currentQuiz.questions.filter(q => !q.userAnswer).length;
    if (unanswered > 0) {
      if (!confirm(`\u9084\u6709 ${unanswered} \u984c\u672a\u4f5c\u7b54\uff0c\u78ba\u5b9a\u8981\u4ea4\u5377\u55ce\uff1f`)) return;
    }
    clearInterval(timerInterval);
    timerInterval = null;
    navigate('result');
  });
}

export function getCurrentQuiz() { return currentQuiz; }
export function clearQuiz() { currentQuiz = null; currentIndex = 0; clearInterval(timerInterval); timerInterval = null; remainingTime = 0; }

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
