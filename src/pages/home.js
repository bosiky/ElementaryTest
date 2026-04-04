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
      <div class="menu-card" data-page="quiz"><span class="menu-card-icon">\u{1f3af}</span><h3 class="menu-card-title">\u958b\u59cb\u6e2c\u9a57</h3><p class="menu-card-desc">\u96a8\u6a5f\u51fa\u984c\u3001\u7dda\u4e0a\u4f5c\u7b54</p></div>
      <div class="menu-card" data-page="history"><span class="menu-card-icon">\u{1f4ca}</span><h3 class="menu-card-title">\u6210\u7e3e\u7d00\u9304</h3><p class="menu-card-desc">\u6b77\u6b21\u8003\u8a66\u8207\u7d71\u8a08\u5206\u6790</p></div>
    </div>
  </div>`;
}

export function renderSettings(navigate) {
  const s = Storage.getSettings();
  const allSubjects = getSubjects();
  const customSubjects = Storage.getCustomSubjects();

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
}
