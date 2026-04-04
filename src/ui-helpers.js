// ui-helpers.js - Shared UI utilities

import { SUBJECTS, QUESTION_TYPES, DIFFICULTIES, GRADES, SEMESTERS, getSubjects } from './questionBank.js';

export function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '\u2705', error: '\u274c', info: '\u2139\ufe0f' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('toast-exit'); setTimeout(() => toast.remove(), 300); }, 3000);
}

export function showModal(title, bodyHtml, footerHtml = '') {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">
    <div class="modal-header"><h3 class="modal-title">${title}</h3><button class="modal-close" id="modal-close-btn">\u00d7</button></div>
    <div class="modal-body">${bodyHtml}</div>
    ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#modal-close-btn').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  return overlay;
}

export function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
}

export function renderSelectOptions(items, selectedVal) {
  return items.map(i => `<option value="${i.value}" ${i.value == selectedVal ? 'selected' : ''}>${i.name}</option>`).join('');
}

export function getYearOptions(selected) {
  const currentROC = new Date().getFullYear() - 1911;
  const years = [];
  for (let y = currentROC + 1; y >= currentROC - 5; y--) {
    years.push({ value: y, name: `${y} \u5b78\u5e74\u5ea6` });
  }
  return renderSelectOptions(years, selected);
}

export function getGradeOptions(selected) {
  return renderSelectOptions(GRADES, selected);
}

export function getSemesterOptions(selected) {
  return renderSelectOptions(SEMESTERS, selected);
}

export function getSubjectOptions(selected, includeAll = false) {
  const items = includeAll ? [{ value: '', name: '\u5168\u90e8\u79d1\u76ee' }] : [];
  const subjects = getSubjects();
  Object.entries(subjects).forEach(([k, v]) => items.push({ value: k, name: `${v.icon} ${v.name}` }));
  return renderSelectOptions(items, selected);
}

export function getTypeOptions(selected) {
  const items = [];
  Object.entries(QUESTION_TYPES).forEach(([k, v]) => items.push({ value: k, name: `${v.icon} ${v.name}` }));
  return renderSelectOptions(items, selected);
}

export function getDifficultyOptions(selected, includeAll = false) {
  const items = includeAll ? [{ value: '', name: '\u5168\u90e8\u96e3\u5ea6' }] : [];
  Object.entries(DIFFICULTIES).forEach(([k, v]) => items.push({ value: k, name: v.name }));
  return renderSelectOptions(items, selected);
}
