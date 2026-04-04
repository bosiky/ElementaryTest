// pages/scan.js - AI Exam Paper Scanner page

import { Storage } from '../storage.js';
import { QuestionBank, getSubjects } from '../questionBank.js';
import { showToast, showModal, closeModal, getSubjectOptions, getGradeOptions, getSemesterOptions, getYearOptions } from '../ui-helpers.js';
import { analyzeMultipleImages, vocabularyToQuestions, validateApiKey, cleanupBadQuestions } from '../gemini.js';

let uploadedImages = [];
let recognizedQuestions = [];
let recognizedVocab = [];
let isProcessing = false;

export function renderScan(navigate) {
  const settings = Storage.getSettings();
  const scanSettings = Storage.getScanSettings() || {};
  const apiKey = Storage.getApiKey();
  const hasKey = apiKey && validateApiKey(apiKey);
  // Use saved scan settings, fallback to global settings
  const curSubject = scanSettings.subject || settings.subject || 'chinese';
  const curGrade = scanSettings.grade || settings.grade;
  const curSemester = scanSettings.semester || settings.semester;

  return `<div class="page-enter">
    <h1 class="page-title">\u{1f4f7} \u8003\u5377\u6383\u63cf</h1>
    <p class="page-subtitle">\u4e0a\u50b3\u8003\u5377\u5716\u7247\uff0cAI \u81ea\u52d5\u8fa8\u8b58\u984c\u76ee\u8207\u55ae\u5b57\uff0c\u4e00\u9375\u532f\u5165\u984c\u5eab</p>

    ${!hasKey ? `
    <div class="card" style="border-left:4px solid var(--warning);margin-bottom:var(--sp-xl);">
      <h3 style="color:var(--warning);margin-bottom:var(--sp-sm);">\u26a0\ufe0f \u8acb\u5148\u8a2d\u5b9a API Key</h3>
      <p style="color:var(--text-secondary);margin-bottom:var(--sp-md);">\u6b64\u529f\u80fd\u9700\u8981 Google Gemini API Key\u3002\u8acb\u524d\u5f80 <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--accent);">Google AI Studio</a> \u514d\u8cbb\u53d6\u5f97\u3002</p>
      <div class="flex-row gap-sm">
        <input class="form-input" id="scan-api-key" type="password" placeholder="\u8cbc\u4e0a\u60a8\u7684 Gemini API Key..." style="flex:1;" />
        <button class="btn btn-primary" id="save-api-key-btn">\u5132\u5b58</button>
      </div>
    </div>` : ''}

    <!-- Step 1: Settings -->
    <div class="card mb-lg">
      <h2 class="section-title">\u{1f4cb} \u6b65\u9a5f 1\uff1a\u9078\u64c7\u8a2d\u5b9a</h2>
      <div class="grid-3">
        <div class="form-group">
          <label class="form-label">\u79d1\u76ee</label>
          <select class="form-select" id="scan-subject">${getSubjectOptions(curSubject)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">\u5e74\u7d1a</label>
          <select class="form-select" id="scan-grade">${getGradeOptions(curGrade)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">\u5b78\u671f</label>
          <select class="form-select" id="scan-semester">${getSemesterOptions(curSemester)}</select>
        </div>
      </div>
    </div>

    <!-- Step 2: Upload -->
    <div class="card mb-lg">
      <h2 class="section-title">\u{1f4f7} \u6b65\u9a5f 2\uff1a\u4e0a\u50b3\u8003\u5377\u5716\u7247</h2>
      <div class="scan-upload-zone" id="scan-upload-zone">
        <div class="scan-upload-icon">\u{1f4c4}</div>
        <div class="scan-upload-text">\u9ede\u64ca\u6216\u62d6\u66f3\u4e0a\u50b3\u8003\u5377\u5716\u7247</div>
        <div class="scan-upload-hint">\u652f\u63f4 JPG\u3001PNG\u3001WEBP\uff0c\u53ef\u4e0a\u50b3\u591a\u5f35</div>
      </div>
      <input type="file" id="scan-file-input" accept="image/*" multiple class="hidden" />
      <div id="scan-preview-area" class="scan-preview-grid"></div>
    </div>

    <!-- Step 3: Recognize -->
    <div class="card mb-lg" id="scan-action-card" style="display:none;">
      <div class="flex-between">
        <h2 class="section-title">\u{1f9e0} \u6b65\u9a5f 3\uff1aAI \u8fa8\u8b58</h2>
        <button class="btn btn-primary btn-lg" id="scan-recognize-btn" ${!hasKey ? 'disabled' : ''}>
          \u{1f680} \u958b\u59cb\u8fa8\u8b58
        </button>
      </div>
      <div id="scan-progress" style="display:none;">
        <div class="scan-progress-bar">
          <div class="scan-progress-fill" id="scan-progress-fill"></div>
        </div>
        <p class="scan-progress-text" id="scan-progress-text">\u6b63\u5728\u8fa8\u8b58\u4e2d...</p>
      </div>
    </div>

    <!-- Step 4: Results -->
    <div id="scan-results" style="display:none;">
      <div class="card mb-lg">
        <div class="flex-between mb-md">
          <h2 class="section-title">\u{1f4dd} \u8fa8\u8b58\u7d50\u679c</h2>
          <div class="flex-row gap-sm">
            <span class="tag tag-success" id="result-q-count"></span>
            <span class="tag tag-info" id="result-v-count"></span>
          </div>
        </div>
        <div id="scan-question-list"></div>
      </div>
      <div class="flex-row gap-sm" style="justify-content:center;">
        <button class="btn btn-primary btn-lg" id="scan-import-all-btn">\u2705 \u5168\u90e8\u52a0\u5165\u984c\u5eab</button>
        <button class="btn btn-outline btn-lg" id="scan-clear-btn">\u{1f5d1}\ufe0f \u6e05\u9664\u7d50\u679c</button>
      </div>
    </div>
  </div>`;
}

export function bindScan(navigate) {
  const uploadZone = document.getElementById('scan-upload-zone');
  const fileInput = document.getElementById('scan-file-input');

  // API Key save
  document.getElementById('save-api-key-btn')?.addEventListener('click', () => {
    const key = document.getElementById('scan-api-key').value.trim();
    if (!validateApiKey(key)) {
      showToast('API Key \u683c\u5f0f\u4e0d\u6b63\u78ba', 'error');
      return;
    }
    Storage.saveApiKey(key);
    showToast('API Key \u5df2\u5132\u5b58\uff01', 'success');
    navigate('scan');
  });

  // Upload zone click
  uploadZone?.addEventListener('click', () => fileInput.click());

  // Drag & drop
  uploadZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone?.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });
  uploadZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files));
  });

  // File input change
  fileInput?.addEventListener('change', (e) => {
    handleFiles(Array.from(e.target.files));
  });

  // Recognize button
  document.getElementById('scan-recognize-btn')?.addEventListener('click', () => startRecognition());

  // Import all
  document.getElementById('scan-import-all-btn')?.addEventListener('click', () => importAll(navigate));

  // Clear results
  document.getElementById('scan-clear-btn')?.addEventListener('click', () => {
    recognizedQuestions = [];
    recognizedVocab = [];
    document.getElementById('scan-results').style.display = 'none';
    showToast('\u7d50\u679c\u5df2\u6e05\u9664', 'success');
  });
}

function handleFiles(files) {
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  if (imageFiles.length === 0) {
    showToast('\u8acb\u4e0a\u50b3\u5716\u7247\u6a94\u6848', 'error');
    return;
  }

  imageFiles.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImages.push({
        name: file.name,
        data: e.target.result,
        size: file.size,
      });
      renderPreviews();
    };
    reader.readAsDataURL(file);
  });
}

function renderPreviews() {
  const area = document.getElementById('scan-preview-area');
  const actionCard = document.getElementById('scan-action-card');

  if (uploadedImages.length === 0) {
    area.innerHTML = '';
    actionCard.style.display = 'none';
    return;
  }

  actionCard.style.display = 'block';
  area.innerHTML = uploadedImages.map((img, i) => `
    <div class="scan-preview-item">
      <img src="${img.data}" alt="${img.name}" />
      <div class="scan-preview-overlay">
        <span class="scan-preview-name">${img.name}</span>
        <button class="btn btn-ghost btn-sm scan-remove-img" data-idx="${i}">\u00d7</button>
      </div>
    </div>
  `).join('');

  // Remove buttons
  area.querySelectorAll('.scan-remove-img').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      uploadedImages.splice(parseInt(btn.dataset.idx), 1);
      renderPreviews();
    });
  });
}

async function startRecognition() {
  if (isProcessing) return;
  if (uploadedImages.length === 0) {
    showToast('\u8acb\u5148\u4e0a\u50b3\u5716\u7247', 'error');
    return;
  }

  const subject = document.getElementById('scan-subject').value;
  const grade = parseInt(document.getElementById('scan-grade').value);
  const semester = parseInt(document.getElementById('scan-semester').value);
  const subjects = getSubjects();
  const subjectName = subjects[subject]?.name || subject;

  // Save scan settings for next time
  Storage.saveScanSettings({ subject, grade, semester });

  isProcessing = true;
  recognizedQuestions = [];
  recognizedVocab = [];

  const btn = document.getElementById('scan-recognize-btn');
  const progress = document.getElementById('scan-progress');
  const progressFill = document.getElementById('scan-progress-fill');
  const progressText = document.getElementById('scan-progress-text');

  btn.disabled = true;
  btn.textContent = '\u8fa8\u8b58\u4e2d...';
  progress.style.display = 'block';

  // Use rate-limited processing (5s delay between images + auto retry on 429)
  const result = await analyzeMultipleImages(
    uploadedImages,
    subject,
    subjectName,
    (index, total, status) => {
      const pct = ((index) / total * 100).toFixed(0);
      progressFill.style.width = `${pct}%`;
      progressText.textContent = status;
    }
  );

  recognizedQuestions = result.questions || [];
  recognizedVocab = result.vocabulary || [];

  // Show errors if any
  if (result.errors?.length > 0) {
    for (const e of result.errors) {
      showToast(`\u5716\u7247 ${e.index + 1} (${e.name}) \u5931\u6557: ${e.error}`, 'error');
    }
  }

  // Convert vocabulary to questions
  if (recognizedVocab.length > 0) {
    const vocabQuestions = vocabularyToQuestions(recognizedVocab, subject);
    recognizedQuestions.push(...vocabQuestions);
  }

  progressFill.style.width = '100%';

  if (recognizedQuestions.length === 0) {
    // Show debug info to help diagnose
    let debugHtml = '<div style="margin-top:var(--sp-md);padding:var(--sp-md);background:var(--bg-elevated);border-radius:var(--radius-md);border:1px solid var(--warning);">';
    debugHtml += '<h4 style="color:var(--warning);margin-bottom:var(--sp-sm);">\u{1f50d} \u8a3a\u65b7\u8cc7\u8a0a</h4>';
    if (result.errors?.length > 0) {
      debugHtml += `<p style="color:var(--danger);">\u932f\u8aa4: ${result.errors.map(e => e.error).join(', ')}</p>`;
    }
    if (result.debugInfo) {
      for (const d of result.debugInfo) {
        debugHtml += `<p style="font-size:0.85rem;color:var(--text-secondary);margin-top:var(--sp-xs);">`;
        debugHtml += `<strong>${d.name}:</strong> `;
        if (d.error) {
          debugHtml += `<span style="color:var(--danger);">${d.error}</span>`;
        } else {
          debugHtml += `${d.questions} \u984c\u627e\u5230`;
          if (d.raw) debugHtml += ` | AI\u56de\u61c9: ${escapeHtml(d.raw.substring(0, 100))}...`;
        }
        debugHtml += '</p>';
      }
    }
    debugHtml += '<p style="font-size:0.8rem;color:var(--text-secondary);margin-top:var(--sp-sm);">\u{1f4a1} \u5efa\u8b70: \u8acb\u78ba\u8a8d\u5716\u7247\u6e05\u6670\u53ef\u8b80\uff0c\u7136\u5f8c\u6309 F12 \u958b\u555f\u4e3b\u63a7\u53f0\u67e5\u770b\u8a73\u7d30\u65e5\u8a8c</p>';
    debugHtml += '</div>';
    progressText.innerHTML = `\u8fa8\u8b58\u5b8c\u6210\u4f46\u672a\u627e\u5230\u984c\u76ee ${debugHtml}`;
  } else {
    progressText.textContent = `\u8fa8\u8b58\u5b8c\u6210\uff01\u5171\u627e\u5230 ${recognizedQuestions.length} \u984c`;
  }

  isProcessing = false;
  btn.disabled = false;
  btn.textContent = '\u{1f680} \u91cd\u65b0\u8fa8\u8b58';

  renderResults();
}

function renderResults() {
  const resultsDiv = document.getElementById('scan-results');
  const listDiv = document.getElementById('scan-question-list');
  const qCountTag = document.getElementById('result-q-count');
  const vCountTag = document.getElementById('result-v-count');

  if (recognizedQuestions.length === 0) {
    resultsDiv.style.display = 'none';
    showToast('\u672a\u627e\u5230\u53ef\u8fa8\u8b58\u7684\u984c\u76ee', 'error');
    return;
  }

  resultsDiv.style.display = 'block';
  const examQ = recognizedQuestions.filter(q => !q.fromVocab);
  const vocabQ = recognizedQuestions.filter(q => q.fromVocab);
  qCountTag.textContent = `\u{1f4dd} \u8003\u984c ${examQ.length} \u984c`;
  vCountTag.textContent = `\u{1f4d6} \u55ae\u5b57 ${vocabQ.length} \u984c`;

  listDiv.innerHTML = recognizedQuestions.map((q, i) => {
    const typeLabels = { choice: '\u9078\u64c7\u984c', truefalse: '\u662f\u975e\u984c', fill: '\u586b\u5145\u984c' };
    const diffLabels = { easy: '\u7c21\u55ae', medium: '\u4e2d\u7b49', hard: '\u56f0\u96e3' };
    const diffColors = { easy: 'success', medium: 'warning', hard: 'danger' };

    return `<div class="scan-result-item" id="scan-q-${i}">
      <div class="flex-between mb-sm">
        <div class="flex-row gap-sm">
          <span class="scan-result-num">${i + 1}</span>
          <span class="tag tag-info">${typeLabels[q.type] || q.type}</span>
          <span class="tag tag-${diffColors[q.difficulty] || 'info'}">${diffLabels[q.difficulty] || q.difficulty}</span>
          ${q.fromVocab ? '<span class="tag tag-accent">\u55ae\u5b57\u984c</span>' : ''}
        </div>
        <div class="flex-row gap-xs">
          <button class="btn btn-ghost btn-sm scan-edit-q" data-idx="${i}">\u270f\ufe0f</button>
          <button class="btn btn-ghost btn-sm scan-delete-q" data-idx="${i}">\u{1f5d1}\ufe0f</button>
        </div>
      </div>
      <div class="scan-result-text">${escapeHtml(q.text)}</div>
      ${q.type === 'choice' && q.options ? `<div class="scan-result-options">${q.options.map((o, j) => `<span class="scan-option ${o === q.answer ? 'correct' : ''}">${String.fromCharCode(65 + j)}. ${escapeHtml(o)}</span>`).join('')}</div>` : ''}
      <div class="scan-result-answer">\u7b54\u6848\uff1a<strong>${escapeHtml(q.answer)}</strong></div>
    </div>`;
  }).join('');

  // Bind edit/delete
  listDiv.querySelectorAll('.scan-delete-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      recognizedQuestions.splice(idx, 1);
      renderResults();
      showToast('\u5df2\u79fb\u9664', 'success');
    });
  });

  listDiv.querySelectorAll('.scan-edit-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      openEditModal(idx);
    });
  });
}

function openEditModal(idx) {
  const q = recognizedQuestions[idx];
  if (!q) return;

  const body = `
    <div class="form-group">
      <label class="form-label">\u984c\u76ee\u5167\u5bb9</label>
      <textarea class="form-textarea" id="edit-q-text" rows="3">${escapeHtml(q.text)}</textarea>
    </div>
    ${q.type === 'choice' ? `
    <div class="form-group">
      <label class="form-label">\u9078\u9805</label>
      ${(q.options || []).map((o, i) => `<input class="form-input mb-sm" id="edit-q-opt-${i}" value="${escapeHtml(o)}" style="margin-bottom:8px;" />`).join('')}
    </div>` : ''}
    <div class="form-group">
      <label class="form-label">\u7b54\u6848</label>
      <input class="form-input" id="edit-q-answer" value="${escapeHtml(q.answer)}" />
    </div>`;

  const footer = `<button class="btn btn-outline" id="edit-cancel-btn">\u53d6\u6d88</button>
    <button class="btn btn-primary" id="edit-save-btn">\u5132\u5b58</button>`;

  showModal(`\u7de8\u8f2f\u7b2c ${idx + 1} \u984c`, body, footer);

  document.getElementById('edit-save-btn').addEventListener('click', () => {
    q.text = document.getElementById('edit-q-text').value.trim();
    q.answer = document.getElementById('edit-q-answer').value.trim();
    if (q.type === 'choice') {
      q.options = [0, 1, 2, 3].map(i => document.getElementById(`edit-q-opt-${i}`)?.value?.trim() || '');
    }
    closeModal();
    renderResults();
    showToast('\u5df2\u66f4\u65b0', 'success');
  });

  document.getElementById('edit-cancel-btn').addEventListener('click', closeModal);
}

function importAll(navigate) {
  if (recognizedQuestions.length === 0) {
    showToast('\u6c92\u6709\u53ef\u532f\u5165\u7684\u984c\u76ee', 'error');
    return;
  }

  const settings = Storage.getSettings();
  const subject = document.getElementById('scan-subject').value;
  const grade = parseInt(document.getElementById('scan-grade').value);
  const semester = parseInt(document.getElementById('scan-semester').value);

  // Sync global settings so bank page shows the same filter
  settings.grade = grade;
  settings.semester = semester;
  settings.subject = subject;
  Storage.saveSettings(settings);

  let imported = 0;
  for (const q of recognizedQuestions) {
    try {
      QuestionBank.createQuestion({
        year: settings.year,
        grade,
        semester,
        subject,
        type: q.type,
        difficulty: q.difficulty || 'medium',
        text: q.text,
        image: null,
        options: q.options || [],
        answer: q.answer,
      });
      imported++;
    } catch (e) {
      console.warn('Import failed for question:', q, e);
    }
  }

  console.log(`[Scan] Imported ${imported} questions. year=${settings.year}, grade=${grade}, semester=${semester}, subject=${subject}`);
  console.log(`[Scan] Total questions in storage: ${Storage.getQuestions().length}`);

  showToast(`\u6210\u529f\u532f\u5165 ${imported} \u984c\u5230\u984c\u5eab\uff01`, 'success');
  recognizedQuestions = [];
  recognizedVocab = [];
  uploadedImages = [];
  navigate('bank');
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
