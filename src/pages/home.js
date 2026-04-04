// pages/home.js - Home page & Settings page with subject management

import { Storage } from '../storage.js';
import { SUBJECTS, DEFAULT_SUBJECTS, SUBJECT_ICONS, QuestionBank, getSubjects } from '../questionBank.js';
import { getYearOptions, getGradeOptions, getSemesterOptions, showToast } from '../ui-helpers.js';
import { isFirebaseEnabled } from '../firebase.js';

export function renderHome(navigate) {
  const settings = Storage.getSettings();
  const questionCount = Storage.getQuestions().filter(q =>
    q.year === settings.year && q.grade === settings.grade && q.semester === settings.semester
  ).length;
  const recordCount = Storage.getRecords().length;
  const fbBadge = isFirebaseEnabled()
    ? '<span class="tag tag-success">\u2601 \u96f2\u7aef\u540c\u6b65</span>'
    : '<span class="tag tag-warning">\u{1f4be} \u672c\u6a5f\u6a21\u5f0f</span>';

  return `<div class="page-enter">
    <h1 class="page-title">\u6b61\u8fce\u4f7f\u7528\u570b\u5c0f\u6e2c\u9a57\u5e73\u53f0</h1>
    <p class="page-subtitle">\u76ee\u524d\u8a2d\u5b9a\uff1a${settings.year} \u5b78\u5e74\u5ea6 ${QuestionBank.formatGrade(settings.grade)} ${QuestionBank.formatSemester(settings.semester)} \u2502 \u984c\u5eab ${questionCount} \u984c \u2502 \u8003\u8a66\u7d00\u9304 ${recordCount} \u6b21 \u2502 ${fbBadge}</p>
    <div class="menu-grid">
      <div class="menu-card" data-page="settings"><span class="menu-card-icon">\u2699\ufe0f</span><h3 class="menu-card-title">\u57fa\u672c\u8a2d\u5b9a</h3><p class="menu-card-desc">\u8a2d\u5b9a\u5b78\u5e74\u5ea6\u3001\u5e74\u7d1a\u8207\u5b78\u671f</p></div>
      <div class="menu-card" data-page="bank"><span class="menu-card-icon">\u{1f4da}</span><h3 class="menu-card-title">\u984c\u5eab\u7ba1\u7406</h3><p class="menu-card-desc">\u65b0\u589e\u3001\u7de8\u8f2f\u3001\u522a\u9664\u984c\u76ee</p></div>
      <div class="menu-card" data-page="scan"><span class="menu-card-icon">\u{1f4f7}</span><h3 class="menu-card-title">\u8003\u5377\u6383\u63cf</h3><p class="menu-card-desc">AI \u81ea\u52d5\u8fa8\u8b58\u8003\u5377\u5716\u7247</p></div>
      <div class="menu-card" data-page="quiz"><span class="menu-card-icon">\u{1f3af}</span><h3 class="menu-card-title">\u958b\u59cb\u6e2c\u9a57</h3><p class="menu-card-desc">\u96a8\u6a5f\u51fa\u984c\u3001\u7dda\u4e0a\u4f5c\u7b54</p></div>
      <div class="menu-card" data-page="history"><span class="menu-card-icon">\u{1f4ca}</span><h3 class="menu-card-title">\u6210\u7e3e\u7d00\u9304</h3><p class="menu-card-desc">\u6b77\u6b21\u8003\u8a66\u8207\u7d71\u8a08\u5206\u6790</p></div>
    </div>
  </div>`;
}

export function renderSettings(navigate) {
  const s = Storage.getSettings();
  const allSubjects = getSubjects();
  const customSubjects = Storage.getCustomSubjects();
  const currentApiKey = Storage.getApiKey();
  const apiKeyStatus = currentApiKey ? '\u2705 \u5df2\u8a2d\u5b9a (\u9ede\u6b64\u66f4\u63db)' : '\u8cbc\u4e0a\u60a8\u7684 Gemini API Key...';

  // Subject list HTML
  let subjectListHTML = '';
  for (const [key, val] of Object.entries(allSubjects)) {
    const isCustom = key in customSubjects;
    subjectListHTML += `<div class="subject-item flex-between" style="padding:var(--sp-sm) var(--sp-md);background:var(--bg-elevated);border-radius:var(--radius-sm);margin-bottom:var(--sp-xs);">
      <span>${val.icon} ${val.name}</span>
      ${isCustom ? `<button class="btn btn-ghost btn-sm delete-subject-btn" data-key="${key}">\u{1f5d1}\ufe0f</button>` : '<span class="tag tag-primary">\u9810\u8a2d</span>'}
    </div>`;
  }

  // Icon picker options
  const iconOptions = SUBJECT_ICONS.map(ic => `<option value="${ic}">${ic}</option>`).join('');

  return `<div class="page-enter">
    <h1 class="page-title">\u2699\ufe0f \u57fa\u672c\u8a2d\u5b9a</h1>
    <p class="page-subtitle">\u8a2d\u5b9a\u5b78\u5e74\u5ea6\u3001\u5e74\u7d1a\u3001\u5b78\u671f\uff0c\u4ee5\u53ca\u7ba1\u7406\u79d1\u76ee\u985e\u578b</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-xl);align-items:start;">
      <!-- Left: Basic Settings -->
      <div class="card">
        <h2 class="section-title">\u{1f4c5} \u5b78\u5e74\u5ea6\u8a2d\u5b9a</h2>
        <div class="form-group">
          <label class="form-label">\u5b78\u5e74\u5ea6</label>
          <select class="form-select" id="setting-year">${getYearOptions(s.year)}</select>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">\u5e74\u7d1a</label>
            <select class="form-select" id="setting-grade">${getGradeOptions(s.grade)}</select>
          </div>
          <div class="form-group">
            <label class="form-label">\u5b78\u671f</label>
            <select class="form-select" id="setting-semester">${getSemesterOptions(s.semester)}</select>
          </div>
        </div>
        <button class="btn btn-primary btn-lg" id="save-settings-btn" style="width:100%;margin-top:var(--sp-md);">\u{1f4be} \u5132\u5b58\u8a2d\u5b9a</button>
      </div>

      <!-- Right: Subject Management -->
      <div class="card">
        <h2 class="section-title">\u{1f4da} \u79d1\u76ee\u7ba1\u7406 <span class="tag tag-info" style="margin-left:var(--sp-sm);">${Object.keys(allSubjects).length} \u79d1</span></h2>
        <div id="subject-list" style="max-height:240px;overflow-y:auto;margin-bottom:var(--sp-md);">
          ${subjectListHTML}
        </div>
        <div style="border-top:1px solid var(--border);padding-top:var(--sp-md);">
          <h3 style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:var(--sp-sm);">\u2795 \u65b0\u589e\u81ea\u8a02\u79d1\u76ee</h3>
          <div class="flex-row gap-sm">
            <select class="form-select" id="new-subject-icon" style="width:60px;text-align:center;font-size:1.2rem;">${iconOptions}</select>
            <input class="form-input" id="new-subject-name" placeholder="\u79d1\u76ee\u540d\u7a31" style="flex:1;" />
            <button class="btn btn-success btn-sm" id="add-subject-btn">\u65b0\u589e</button>
          </div>
        </div>
      </div>
    </div>

    <!-- API Key Management -->
    <div class="card" style="margin-top:var(--sp-xl);">
      <h2 class="section-title">\u{1f511} Gemini API Key</h2>
      <p style="color:var(--text-secondary);margin-bottom:var(--sp-md);">\u8003\u5377\u6383\u63cf\u529f\u80fd\u9700\u8981 Google Gemini API Key\u3002<a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--accent);">\u524d\u5f80\u53d6\u5f97 (\u514d\u8cbb)</a></p>
      <div class="flex-row gap-sm">
        <input class="form-input" id="settings-api-key" type="password" placeholder="${apiKeyStatus}" value="${currentApiKey}" style="flex:1;" />
        <button class="btn btn-primary btn-sm" id="save-api-key-btn">\u5132\u5b58</button>
        ${currentApiKey ? '<button class="btn btn-outline btn-sm" id="toggle-api-key-btn">\u{1f441}\ufe0f</button><button class="btn btn-ghost btn-sm" id="delete-api-key-btn" style="color:var(--danger);">\u{1f5d1}\ufe0f</button>' : ''}
      </div>
    </div>

    <!-- Firebase Status -->
    <div class="card" style="margin-top:var(--sp-xl);">
      <h2 class="section-title">\u2601\ufe0f \u96f2\u7aef\u540c\u6b65\u72c0\u614b</h2>
      <p style="color:var(--text-secondary);">${isFirebaseEnabled()
        ? '\u2705 Firebase \u5df2\u9023\u7dda\uff0c\u8cc7\u6599\u6703\u81ea\u52d5\u540c\u6b65\u5230\u96f2\u7aef'
        : '\u{1f4be} \u76ee\u524d\u4f7f\u7528\u672c\u6a5f\u5132\u5b58 (LocalStorage)\u3002\u5982\u9700\u555f\u7528\u96f2\u7aef\u540c\u6b65\uff0c\u8acb\u5728 <code>src/firebase.js</code> \u586b\u5165 Firebase \u8a2d\u5b9a\u3002'
      }</p>
    </div>
  </div>`;
}

export function bindSettings(navigate) {
  // Save settings
  document.getElementById('save-settings-btn')?.addEventListener('click', () => {
    const settings = {
      year: parseInt(document.getElementById('setting-year').value),
      grade: parseInt(document.getElementById('setting-grade').value),
      semester: parseInt(document.getElementById('setting-semester').value),
    };
    Storage.saveSettings(settings);
    showToast('\u8a2d\u5b9a\u5df2\u5132\u5b58\uff01', 'success');
    navigate('home');
  });

  // Add custom subject
  document.getElementById('add-subject-btn')?.addEventListener('click', () => {
    const name = document.getElementById('new-subject-name').value.trim();
    const icon = document.getElementById('new-subject-icon').value;
    if (!name) {
      showToast('\u8acb\u8f38\u5165\u79d1\u76ee\u540d\u7a31', 'danger');
      return;
    }
    // Generate key from name
    const key = 'custom_' + Date.now().toString(36);
    Storage.addCustomSubject(key, name, icon);
    showToast(`\u5df2\u65b0\u589e\u79d1\u76ee\uff1a${icon} ${name}`, 'success');
    navigate('settings'); // Refresh
  });

  // Delete custom subject
  document.querySelectorAll('.delete-subject-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      Storage.removeCustomSubject(key);
      showToast('\u5df2\u522a\u9664\u79d1\u76ee', 'success');
      navigate('settings'); // Refresh
    });
  });

  // Save API Key
  document.getElementById('save-api-key-btn')?.addEventListener('click', () => {
    const key = document.getElementById('settings-api-key').value.trim();
    if (!key) {
      showToast('\u8acb\u8f38\u5165 API Key', 'error');
      return;
    }
    Storage.saveApiKey(key);
    showToast('API Key \u5df2\u5132\u5b58\uff01', 'success');
    navigate('settings');
  });

  // Toggle API Key visibility
  document.getElementById('toggle-api-key-btn')?.addEventListener('click', () => {
    const input = document.getElementById('settings-api-key');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Delete API Key
  document.getElementById('delete-api-key-btn')?.addEventListener('click', () => {
    if (confirm('\u78ba\u5b9a\u8981\u522a\u9664 API Key \u55ce\uff1f')) {
      Storage.saveApiKey('');
      showToast('API Key \u5df2\u522a\u9664', 'success');
      navigate('settings');
    }
  });
}
