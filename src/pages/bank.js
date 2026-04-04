// pages/bank.js - Question bank management page

import { Storage } from '../storage.js';
import { SUBJECTS, QUESTION_TYPES, DIFFICULTIES, QuestionBank } from '../questionBank.js';
import { showToast, showModal, closeModal, getSubjectOptions, getTypeOptions } from '../ui-helpers.js';
import { cleanupBadQuestions } from '../gemini.js';

let currentImage = null;
let selectedIds = new Set();
let isSelectMode = false;
const PAGE_SIZE = 50;
let currentPage = 1;

export function renderBank(navigate) {
  // Auto-cleanup bad question patterns
  const removed = cleanupBadQuestions();
  if (removed > 0) {
    setTimeout(() => showToast(`\u5df2\u81ea\u52d5\u6e05\u9664 ${removed} \u984c\u4e0d\u9069\u5408\u7684\u984c\u578b`, 'success'), 100);
  }

  const settings = Storage.getSettings();
  const questions = Storage.getFilteredQuestions({ year: settings.year, grade: settings.grade, semester: settings.semester });

  // Collect scopes for filter
  const allScopes = [...new Set(questions.map(q => q.scope).filter(Boolean))];

  // Pagination
  const totalPages = Math.ceil(questions.length / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageQuestions = questions.slice(startIdx, startIdx + PAGE_SIZE);

  let listHtml = '';
  if (questions.length === 0) {
    listHtml = `<div class="empty-state"><div class="empty-state-icon">\u{1f4ed}</div><p class="empty-state-text">\u76ee\u524d\u6c92\u6709\u984c\u76ee</p><p class="empty-state-hint">\u9ede\u64ca\u4e0a\u65b9\u300c\u65b0\u589e\u984c\u76ee\u300d\u958b\u59cb\u5efa\u7acb\u984c\u5eab</p></div>`;
  } else {
    listHtml = `<div class="question-list" id="question-list">` + pageQuestions.map((q, i) => {
      const subj = SUBJECTS[q.subject] || { icon: '', name: q.subject };
      const typeInfo = QUESTION_TYPES[q.type] || { name: q.type };
      const globalIdx = startIdx + i;
      const checked = selectedIds.has(q.id) ? 'checked' : '';
      return `<div class="question-item ${selectedIds.has(q.id) ? 'selected-item' : ''}" data-id="${q.id}">
        ${isSelectMode ? `<label class="q-checkbox-label"><input type="checkbox" class="q-checkbox" data-id="${q.id}" ${checked} /></label>` : ''}
        <div class="question-number">${globalIdx + 1}</div>
        <div class="question-content">
          ${q.content?.image ? `<img src="${q.content.image}" class="question-image" alt="question image"/>` : ''}
          <div class="question-text">${escapeHtml(q.content?.text || '')}</div>
          <div class="question-meta">
            <span class="tag tag-primary">${subj.icon} ${subj.name}</span>
            <span class="tag tag-info">${typeInfo.name}</span>
            ${q.scope ? `<span class="tag tag-warning">${escapeHtml(q.scope)}</span>` : '<span class="tag tag-ghost">\u7121\u7bc4\u570d</span>'}
            <span class="tag tag-accent">\u7b54\u6848: ${escapeHtml(q.answer)}</span>
          </div>
        </div>
        <div class="question-actions">
          <button class="btn btn-ghost btn-icon edit-q-btn" data-id="${q.id}" title="\u7de8\u8f2f">\u270f\ufe0f</button>
          <button class="btn btn-ghost btn-icon delete-q-btn" data-id="${q.id}" title="\u522a\u9664">\u{1f5d1}\ufe0f</button>
        </div>
      </div>`;
    }).join('') + `</div>`;

    // Pagination controls
    if (totalPages > 1) {
      listHtml += `<div class="pagination" style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:var(--sp-lg);">
        <button class="btn btn-sm btn-outline" id="page-prev" ${currentPage <= 1 ? 'disabled' : ''}>\u2b05</button>
        <span class="text-secondary" style="font-size:0.9rem;">
          \u7b2c ${currentPage} / ${totalPages} \u9801 (\u5171 ${questions.length} \u984c)
        </span>
        <button class="btn btn-sm btn-outline" id="page-next" ${currentPage >= totalPages ? 'disabled' : ''}>\u27a1</button>
      </div>`;
    }
  }

  // Scope batch-assign section
  const noScopeCount = questions.filter(q => !q.scope).length;
  const batchScopeHtml = noScopeCount > 0 ? `
    <div class="card" style="margin-bottom:var(--sp-md);padding:var(--sp-md);border:1px solid var(--warning);background:var(--bg-elevated);">
      <div class="flex-between flex-wrap gap-sm">
        <div>
          <strong style="color:var(--warning);">\u26a0\ufe0f ${noScopeCount} \u984c\u5c1a\u672a\u8a2d\u5b9a\u7bc4\u570d</strong>
          <p style="font-size:0.85rem;color:var(--text-secondary);margin:4px 0 0;">\u8f38\u5165\u7bc4\u570d\u540d\u7a31\u5f8c\u6309\u300c\u5957\u7528\u300d\u53ef\u4e00\u6b21\u8a2d\u5b9a\u6240\u6709\u6c92\u6709\u7bc4\u570d\u7684\u984c\u76ee</p>
        </div>
        <div class="flex-row gap-sm" style="align-items:center;">
          <input class="form-input" id="batch-scope-input" placeholder="\u4f8b: Our World Book 2 Unit 7" style="min-width:220px;" />
          <button class="btn btn-sm btn-primary" id="batch-scope-btn">\u5957\u7528</button>
        </div>
      </div>
    </div>` : '';

  // Select mode toolbar
  const selectToolbar = `
    <div class="card" id="select-toolbar" style="display:${isSelectMode ? 'block' : 'none'};margin-bottom:var(--sp-md);padding:var(--sp-sm) var(--sp-md);background:var(--bg-elevated);border:1px solid var(--accent);">
      <div class="flex-between flex-wrap gap-sm" style="align-items:center;">
        <div class="flex-row gap-sm" style="align-items:center;">
          <label style="cursor:pointer;display:flex;align-items:center;gap:6px;">
            <input type="checkbox" id="select-all-cb" />
            <span style="font-size:0.9rem;">\u5168\u9078 (\u672c\u9801)</span>
          </label>
          <span id="selected-count" style="font-size:0.85rem;color:var(--text-secondary);">\u5df2\u9078 ${selectedIds.size} \u984c</span>
        </div>
        <div class="flex-row gap-sm">
          <button class="btn btn-sm btn-outline" id="batch-scope-selected-btn" ${selectedIds.size === 0 ? 'disabled' : ''}>\u{1f4dd} \u8a2d\u5b9a\u7bc4\u570d</button>
          <button class="btn btn-sm btn-danger" id="batch-delete-btn" ${selectedIds.size === 0 ? 'disabled' : ''}>\u{1f5d1}\ufe0f \u522a\u9664\u5df2\u9078 (${selectedIds.size})</button>
        </div>
      </div>
    </div>`;

  return `<div class="page-enter">
    <div class="flex-between flex-wrap gap-md mb-lg">
      <div><h1 class="page-title">\u{1f4da} \u984c\u5eab\u7ba1\u7406</h1>
        <p class="page-subtitle" style="margin-bottom:0">${settings.year} \u5b78\u5e74\u5ea6 ${QuestionBank.formatGrade(settings.grade)} ${QuestionBank.formatSemester(settings.semester)} - \u5171 ${questions.length} \u984c</p>
      </div>
      <div class="flex-row gap-sm flex-wrap">
        <button class="btn btn-primary" id="add-question-btn">\u2795 \u65b0\u589e\u984c\u76ee</button>
        <button class="btn ${isSelectMode ? 'btn-accent' : 'btn-outline'}" id="toggle-select-btn">\u2611\ufe0f ${isSelectMode ? '\u53d6\u6d88\u591a\u9078' : '\u591a\u9078\u6a21\u5f0f'}</button>
        ${questions.length > 0 ? `<button class="btn btn-outline btn-danger-text" id="delete-all-btn">\u{1f5d1}\ufe0f \u5168\u90e8\u522a\u9664</button>` : ''}
        <button class="btn btn-outline" id="export-btn">\u{1f4e4} \u532f\u51fa</button>
        <button class="btn btn-outline" id="import-btn">\u{1f4e5} \u532f\u5165</button>
      </div>
    </div>
    ${batchScopeHtml}
    ${selectToolbar}
    ${listHtml}
    ${questions.length > 5 ? `<div style="display:flex;justify-content:center;gap:8px;margin-top:var(--sp-lg);">
      <button class="btn btn-sm btn-ghost" id="scroll-top-btn">\u2b06 \u56de\u5230\u9802\u90e8</button>
      <button class="btn btn-sm btn-ghost" id="scroll-bottom-btn">\u2b07 \u6edd\u5230\u5e95\u90e8</button>
    </div>` : ''}
  </div>`;
}

export function bindBank(navigate) {
  document.getElementById('add-question-btn')?.addEventListener('click', () => openQuestionModal(null, navigate));
  document.getElementById('export-btn')?.addEventListener('click', handleExport);
  document.getElementById('import-btn')?.addEventListener('click', handleImport.bind(null, navigate));

  // Toggle select mode
  document.getElementById('toggle-select-btn')?.addEventListener('click', () => {
    isSelectMode = !isSelectMode;
    if (!isSelectMode) selectedIds.clear();
    navigate('bank');
  });

  // Scroll buttons
  document.getElementById('scroll-top-btn')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('scroll-bottom-btn')?.addEventListener('click', () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });

  // Pagination
  document.getElementById('page-prev')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; navigate('bank'); }
  });
  document.getElementById('page-next')?.addEventListener('click', () => {
    currentPage++; navigate('bank');
  });

  // Select mode checkboxes
  if (isSelectMode) {
    document.querySelectorAll('.q-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) selectedIds.add(cb.dataset.id);
        else selectedIds.delete(cb.dataset.id);
        updateSelectUI();
      });
    });

    document.getElementById('select-all-cb')?.addEventListener('change', (e) => {
      document.querySelectorAll('.q-checkbox').forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) selectedIds.add(cb.dataset.id);
        else selectedIds.delete(cb.dataset.id);
      });
      updateSelectUI();
    });
  }

  // Batch scope for selected
  document.getElementById('batch-scope-selected-btn')?.addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    const scope = prompt('\u8acb\u8f38\u5165\u7bc4\u570d\u540d\u7a31\uff08\u4f8b\u5982: Our World Book 2 Unit 7\uff09');
    if (scope === null) return;
    const questions = Storage.getQuestions();
    let updated = 0;
    for (const q of questions) {
      if (selectedIds.has(q.id)) { q.scope = scope; updated++; }
    }
    Storage.saveQuestions(questions);
    selectedIds.clear();
    showToast(`\u5df2\u66f4\u65b0 ${updated} \u984c\u7684\u7bc4\u570d\u70ba\u300c${scope}\u300d`, 'success');
    navigate('bank');
  });

  // Batch delete selected
  document.getElementById('batch-delete-btn')?.addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`\u78ba\u5b9a\u8981\u522a\u9664\u5df2\u9078\u7684 ${selectedIds.size} \u984c\u55ce\uff1f`)) return;
    let questions = Storage.getQuestions();
    questions = questions.filter(q => !selectedIds.has(q.id));
    Storage.saveQuestions(questions);
    showToast(`\u5df2\u522a\u9664 ${selectedIds.size} \u984c`, 'success');
    selectedIds.clear();
    navigate('bank');
  });

  // Delete all
  document.getElementById('delete-all-btn')?.addEventListener('click', () => {
    const settings = Storage.getSettings();
    const filtered = Storage.getFilteredQuestions({ year: settings.year, grade: settings.grade, semester: settings.semester });
    if (filtered.length === 0) return;
    if (!confirm(`\u78ba\u5b9a\u8981\u522a\u9664\u7576\u524d\u7be9\u9078\u7684\u5168\u90e8 ${filtered.length} \u984c\u55ce\uff1f\u6b64\u64cd\u4f5c\u7121\u6cd5\u5fa9\u539f\uff01`)) return;
    const filteredIds = new Set(filtered.map(q => q.id));
    const remaining = Storage.getQuestions().filter(q => !filteredIds.has(q.id));
    Storage.saveQuestions(remaining);
    showToast(`\u5df2\u522a\u9664 ${filtered.length} \u984c`, 'success');
    navigate('bank');
  });

  // Batch scope for no-scope questions
  document.getElementById('batch-scope-btn')?.addEventListener('click', () => {
    const scope = document.getElementById('batch-scope-input')?.value?.trim();
    if (!scope) { showToast('\u8acb\u8f38\u5165\u7bc4\u570d\u540d\u7a31', 'error'); return; }
    const questions = Storage.getQuestions();
    const settings = Storage.getSettings();
    let updated = 0;
    for (const q of questions) {
      if (q.year === settings.year && q.grade === settings.grade && q.semester === settings.semester && !q.scope) {
        q.scope = scope;
        updated++;
      }
    }
    if (updated === 0) { showToast('\u6c92\u6709\u9700\u8981\u66f4\u65b0\u7684\u984c\u76ee', 'info'); return; }
    Storage.saveQuestions(questions);
    showToast(`\u5df2\u5c07 ${updated} \u984c\u8a2d\u5b9a\u7bc4\u570d\u70ba\u300c${scope}\u300d`, 'success');
    navigate('bank');
  });

  // Per-question edit/delete
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

function updateSelectUI() {
  const countEl = document.getElementById('selected-count');
  if (countEl) countEl.textContent = `\u5df2\u9078 ${selectedIds.size} \u984c`;
  const delBtn = document.getElementById('batch-delete-btn');
  if (delBtn) {
    delBtn.disabled = selectedIds.size === 0;
    delBtn.textContent = `\u{1f5d1}\ufe0f \u522a\u9664\u5df2\u9078 (${selectedIds.size})`;
  }
  const scopeBtn = document.getElementById('batch-scope-selected-btn');
  if (scopeBtn) scopeBtn.disabled = selectedIds.size === 0;

  // Highlight selected items
  document.querySelectorAll('.question-item').forEach(item => {
    if (selectedIds.has(item.dataset.id)) item.classList.add('selected-item');
    else item.classList.remove('selected-item');
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
    <div class="form-group"><label class="form-label">\u7bc4\u570d</label>
      <input class="form-input" id="q-scope" value="${escapeHtml(existingQ?.scope || '')}" placeholder="\u4f8b\u5982: Our World Book 2 Unit 7" /></div>
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
      type, scope: document.getElementById('q-scope').value.trim(),
      text, image: currentImage, options, answer,
    };

    if (isEdit) {
      Storage.updateQuestion(existingQ.id, {
        subject: data.subject, type: data.type, scope: data.scope,
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
