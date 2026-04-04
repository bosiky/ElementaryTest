// pages/bank.js - Question bank management page

import { Storage } from '../storage.js';
import { SUBJECTS, QUESTION_TYPES, DIFFICULTIES, QuestionBank } from '../questionBank.js';
import { showToast, showModal, closeModal, getSubjectOptions, getTypeOptions, getDifficultyOptions } from '../ui-helpers.js';

let currentImage = null;

export function renderBank(navigate) {
  const settings = Storage.getSettings();
  const questions = Storage.getFilteredQuestions({ year: settings.year, grade: settings.grade, semester: settings.semester });

  let listHtml = '';
  if (questions.length === 0) {
    listHtml = `<div class="empty-state"><div class="empty-state-icon">\u{1f4ed}</div><p class="empty-state-text">\u76ee\u524d\u6c92\u6709\u984c\u76ee</p><p class="empty-state-hint">\u9ede\u64ca\u4e0a\u65b9\u300c\u65b0\u589e\u984c\u76ee\u300d\u958b\u59cb\u5efa\u7acb\u984c\u5eab</p></div>`;
  } else {
    listHtml = `<div class="question-list">` + questions.map((q, i) => {
      const subj = SUBJECTS[q.subject] || { icon: '', name: q.subject };
      const diff = DIFFICULTIES[q.difficulty] || { name: q.difficulty, color: 'info' };
      const typeInfo = QUESTION_TYPES[q.type] || { name: q.type };
      return `<div class="question-item">
        <div class="question-number">${i + 1}</div>
        <div class="question-content">
          ${q.content?.image ? `<img src="${q.content.image}" class="question-image" alt="question image"/>` : ''}
          <div class="question-text">${escapeHtml(q.content?.text || '')}</div>
          <div class="question-meta">
            <span class="tag tag-primary">${subj.icon} ${subj.name}</span>
            <span class="tag tag-info">${typeInfo.name}</span>
            <span class="tag tag-${diff.color}">${diff.name}</span>
            <span class="tag tag-accent">\u7b54\u6848: ${escapeHtml(q.answer)}</span>
          </div>
        </div>
        <div class="question-actions">
          <button class="btn btn-ghost btn-icon edit-q-btn" data-id="${q.id}" title="\u7de8\u8f2f">\u270f\ufe0f</button>
          <button class="btn btn-ghost btn-icon delete-q-btn" data-id="${q.id}" title="\u522a\u9664">\u{1f5d1}\ufe0f</button>
        </div>
      </div>`;
    }).join('') + `</div>`;
  }

  return `<div class="page-enter">
    <div class="flex-between flex-wrap gap-md mb-lg">
      <div><h1 class="page-title">\u{1f4da} \u984c\u5eab\u7ba1\u7406</h1>
        <p class="page-subtitle" style="margin-bottom:0">${settings.year} \u5b78\u5e74\u5ea6 ${QuestionBank.formatGrade(settings.grade)} ${QuestionBank.formatSemester(settings.semester)} - \u5171 ${questions.length} \u984c</p>
      </div>
      <div class="flex-row gap-sm">
        <button class="btn btn-primary" id="add-question-btn">\u2795 \u65b0\u589e\u984c\u76ee</button>
        <button class="btn btn-outline" id="export-btn">\u{1f4e4} \u532f\u51fa</button>
        <button class="btn btn-outline" id="import-btn">\u{1f4e5} \u532f\u5165</button>
      </div>
    </div>
    ${listHtml}
  </div>`;
}

export function bindBank(navigate) {
  document.getElementById('add-question-btn')?.addEventListener('click', () => openQuestionModal(null, navigate));
  document.getElementById('export-btn')?.addEventListener('click', handleExport);
  document.getElementById('import-btn')?.addEventListener('click', handleImport.bind(null, navigate));

  document.querySelectorAll('.edit-q-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = Storage.getQuestions().find(x => x.id === btn.dataset.id);
      if (q) openQuestionModal(q, navigate);
    });
  });

  document.querySelectorAll('.delete-q-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('\u78ba\u5b9a\u8981\u522a\u9664\u9019\u984c\u55ce\uff1f')) {
        Storage.deleteQuestion(btn.dataset.id);
        showToast('\u984c\u76ee\u5df2\u522a\u9664', 'success');
        navigate('bank');
      }
    });
  });
}

function openQuestionModal(existingQ, navigate) {
  const settings = Storage.getSettings();
  const isEdit = !!existingQ;
  currentImage = existingQ?.content?.image || null;

  const body = `
    <div class="grid-2">
      <div class="form-group"><label class="form-label">\u79d1\u76ee</label>
        <select class="form-select" id="q-subject">${getSubjectOptions(existingQ?.subject || 'math')}</select></div>
      <div class="form-group"><label class="form-label">\u984c\u578b</label>
        <select class="form-select" id="q-type">${getTypeOptions(existingQ?.type || 'choice')}</select></div>
    </div>
    <div class="form-group"><label class="form-label">\u96e3\u5ea6</label>
      <select class="form-select" id="q-difficulty">${getDifficultyOptions(existingQ?.difficulty || 'medium')}</select></div>
    <div class="form-group"><label class="form-label">\u984c\u76ee\u5167\u5bb9 (\u6587\u5b57)</label>
      <textarea class="form-textarea" id="q-text" placeholder="\u8f38\u5165\u984c\u76ee\u6587\u5b57...">${existingQ?.content?.text || ''}</textarea></div>
    <div class="form-group"><label class="form-label">\u984c\u76ee\u5716\u7247 (\u9078\u586b)</label>
      <div id="q-image-area">
        ${currentImage ? `<div class="image-preview"><img src="${currentImage}" /><button class="image-preview-remove" id="remove-img-btn">\u00d7</button></div>` : `<div class="file-upload" id="upload-area"><div class="file-upload-icon">\u{1f4f7}</div><div class="file-upload-text">\u9ede\u64ca\u6216\u62d6\u66f3\u4e0a\u50b3\u5716\u7247</div></div>`}
      </div>
      <input type="file" id="q-image-input" accept="image/*" class="hidden" />
    </div>
    <div id="q-options-area"></div>
    <div class="form-group" id="q-answer-group"><label class="form-label">\u7b54\u6848</label>
      <input class="form-input" id="q-answer" value="${escapeHtml(existingQ?.answer || '')}" placeholder="\u8f38\u5165\u6b63\u78ba\u7b54\u6848" /></div>`;

  const footer = `<button class="btn btn-outline" id="modal-cancel-btn">\u53d6\u6d88</button>
    <button class="btn btn-primary" id="modal-save-btn">${isEdit ? '\u66f4\u65b0' : '\u65b0\u589e'}</button>`;

  const overlay = showModal(isEdit ? '\u7de8\u8f2f\u984c\u76ee' : '\u65b0\u589e\u984c\u76ee', body, footer);

  // Type change handler
  const typeSelect = document.getElementById('q-type');
  const updateOptionsArea = () => {
    const type = typeSelect.value;
    const optArea = document.getElementById('q-options-area');
    const ansGroup = document.getElementById('q-answer-group');
    if (type === 'choice') {
      const opts = existingQ?.options || ['', '', '', ''];
      optArea.innerHTML = `<div class="form-group"><label class="form-label">\u9078\u9805 (4\u500b)</label>
        ${opts.map((o, i) => `<input class="form-input mb-sm" id="q-opt-${i}" value="${escapeHtml(o)}" placeholder="\u9078\u9805 ${String.fromCharCode(65 + i)}" style="margin-bottom:8px;" />`).join('')}</div>`;
      ansGroup.querySelector('.form-label').textContent = '\u6b63\u78ba\u7b54\u6848 (\u8f38\u5165\u9078\u9805\u5167\u5bb9)';
    } else if (type === 'truefalse') {
      optArea.innerHTML = '';
      ansGroup.innerHTML = `<label class="form-label">\u7b54\u6848</label>
        <div class="tf-options"><div class="tf-option ${existingQ?.answer === 'O' ? 'selected' : ''}" data-val="O">O (\u5c0d)</div>
        <div class="tf-option ${existingQ?.answer === 'X' ? 'selected' : ''}" data-val="X">X (\u932f)</div></div>
        <input type="hidden" id="q-answer" value="${existingQ?.answer || ''}" />`;
      document.querySelectorAll('.tf-option').forEach(opt => {
        opt.addEventListener('click', () => {
          document.querySelectorAll('.tf-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          document.getElementById('q-answer').value = opt.dataset.val;
        });
      });
    } else {
      optArea.innerHTML = '';
      ansGroup.querySelector('.form-label').textContent = '\u6b63\u78ba\u7b54\u6848';
    }
  };
  typeSelect.addEventListener('change', updateOptionsArea);
  updateOptionsArea();

  // Image upload
  const setupImageHandlers = () => {
    document.getElementById('upload-area')?.addEventListener('click', () => document.getElementById('q-image-input').click());
    document.getElementById('remove-img-btn')?.addEventListener('click', () => {
      currentImage = null;
      document.getElementById('q-image-area').innerHTML = `<div class="file-upload" id="upload-area"><div class="file-upload-icon">\u{1f4f7}</div><div class="file-upload-text">\u9ede\u64ca\u6216\u62d6\u66f3\u4e0a\u50b3\u5716\u7247</div></div>`;
      setupImageHandlers();
    });
  };
  setupImageHandlers();

  document.getElementById('q-image-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      currentImage = ev.target.result;
      document.getElementById('q-image-area').innerHTML = `<div class="image-preview"><img src="${currentImage}" /><button class="image-preview-remove" id="remove-img-btn">\u00d7</button></div>`;
      setupImageHandlers();
    };
    reader.readAsDataURL(file);
  });

  // Save
  document.getElementById('modal-save-btn').addEventListener('click', () => {
    const type = typeSelect.value;
    const text = document.getElementById('q-text').value.trim();
    const answer = document.getElementById('q-answer').value.trim();

    if (!text && !currentImage) { showToast('\u8acb\u8f38\u5165\u984c\u76ee\u5167\u5bb9\u6216\u4e0a\u50b3\u5716\u7247', 'error'); return; }
    if (!answer) { showToast('\u8acb\u8f38\u5165\u7b54\u6848', 'error'); return; }

    const options = type === 'choice' ? [0,1,2,3].map(i => document.getElementById(`q-opt-${i}`)?.value?.trim() || '') : [];
    if (type === 'choice' && options.some(o => !o)) { showToast('\u8acb\u586b\u5beb\u6240\u6709\u9078\u9805', 'error'); return; }

    const data = {
      year: settings.year, grade: settings.grade, semester: settings.semester,
      subject: document.getElementById('q-subject').value,
      type, difficulty: document.getElementById('q-difficulty').value,
      text, image: currentImage, options, answer,
    };

    if (isEdit) {
      Storage.updateQuestion(existingQ.id, {
        subject: data.subject, type: data.type, difficulty: data.difficulty,
        content: { text: data.text, image: data.image },
        options: data.options, answer: data.answer,
      });
      showToast('\u984c\u76ee\u5df2\u66f4\u65b0', 'success');
    } else {
      QuestionBank.createQuestion(data);
      showToast('\u984c\u76ee\u5df2\u65b0\u589e', 'success');
    }
    closeModal();
    navigate('bank');
  });

  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
}

function handleExport() {
  const data = Storage.exportData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `quiz-bank-${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('\u984c\u5eab\u5df2\u532f\u51fa', 'success');
}

function handleImport(navigate) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = Storage.importData(e.target.result);
      if (result.success) {
        showToast(`\u6210\u529f\u532f\u5165 ${result.imported} \u984c (\u7e3d\u5171 ${result.total} \u984c)`, 'success');
        navigate('bank');
      } else {
        showToast(`\u532f\u5165\u5931\u6557: ${result.error}`, 'error');
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
