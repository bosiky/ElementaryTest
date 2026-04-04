// pages/history.js - History & statistics page

import { Storage } from '../storage.js';
import { SUBJECTS, QuestionBank } from '../questionBank.js';
import { Stats } from '../stats.js';
import { showToast } from '../ui-helpers.js';

export function renderHistory(navigate) {
  const records = Storage.getRecords();
  const overview = Stats.getOverview();
  const recentScores = Stats.getRecentScores(10);

  let overviewHtml = '';
  if (overview) {
    overviewHtml = `<div class="grid-3 mb-lg">
      <div class="card text-center"><div class="result-stat-value" style="font-size:2rem;color:var(--primary-light)">${overview.totalExams}</div><div class="result-stat-label">\u7e3d\u8003\u8a66\u6b21\u6578</div></div>
      <div class="card text-center"><div class="result-stat-value" style="font-size:2rem;color:var(--accent-light)">${overview.avgScore}</div><div class="result-stat-label">\u5e73\u5747\u5206\u6578</div></div>
      <div class="card text-center"><div class="result-stat-value" style="font-size:2rem;color:var(--success)">${overview.bestScore}</div><div class="result-stat-label">\u6700\u9ad8\u5206\u6578</div></div>
    </div>`;
  }

  let chartHtml = '';
  if (recentScores.length > 0) {
    chartHtml = `<div class="stats-chart-container mb-lg">
      <h3 class="section-title">\u{1f4c8} \u6700\u8fd1\u6210\u7e3e\u8d8b\u52e2</h3>
      <div id="score-chart"></div>
    </div>`;
  }

  let tableHtml = '';
  if (records.length > 0) {
    const sorted = [...records].reverse();
    tableHtml = `<div class="card" style="overflow-x:auto;">
      <div class="flex-between mb-md">
        <h3 class="section-title" style="margin-bottom:0">\u{1f4cb} \u6b77\u6b21\u8a18\u9304</h3>
        <button class="btn btn-sm btn-danger" id="clear-records-btn">\u{1f5d1}\ufe0f \u6e05\u9664\u5168\u90e8</button>
      </div>
      <table class="history-table">
        <thead><tr><th>\u65e5\u671f</th><th>\u79d1\u76ee</th><th>\u984c\u6578</th><th>\u7b54\u5c0d</th><th>\u5206\u6578</th><th>\u6642\u9593</th><th>\u7b49\u7d1a</th></tr></thead>
        <tbody>${sorted.map(r => {
          const subj = SUBJECTS[r.subject];
          const gl = getGradeLevel(r.score);
          return `<tr>
            <td>${new Date(r.date).toLocaleDateString('zh-TW')}</td>
            <td>${subj ? `${subj.icon} ${subj.name}` : r.subject || '\u5168\u90e8'}</td>
            <td>${r.totalQuestions}</td>
            <td>${r.correctCount}</td>
            <td class="score-cell" style="color:${gl.color}">${r.score}</td>
            <td>${formatTime(r.timeSpent)}</td>
            <td><span class="tag tag-${gl.tag}">${gl.text}</span></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
  }

  return `<div class="page-enter">
    <h1 class="page-title">\u{1f4ca} \u6210\u7e3e\u7d00\u9304</h1>
    <p class="page-subtitle">\u67e5\u770b\u6b77\u6b21\u8003\u8a66\u7d50\u679c\u8207\u7d71\u8a08\u5206\u6790</p>
    ${!overview ? `<div class="empty-state"><div class="empty-state-icon">\u{1f4ca}</div><p class="empty-state-text">\u9084\u6c92\u6709\u8003\u8a66\u7d00\u9304</p><p class="empty-state-hint">\u5b8c\u6210\u6e2c\u9a57\u5f8c\u6210\u7e3e\u6703\u986f\u793a\u5728\u9019\u88e1</p></div>` : `${overviewHtml}${chartHtml}${tableHtml}`}
  </div>`;
}

export function bindHistory(navigate) {
  // Render chart
  const recentScores = Stats.getRecentScores(10);
  if (recentScores.length > 0) {
    const chartData = recentScores.map(s => ({
      value: s.score,
      label: s.date,
      color: s.score >= 90 ? 'var(--success)' : s.score >= 60 ? 'var(--primary)' : 'var(--danger)',
    }));
    Stats.renderBarChart('score-chart', chartData);
  }

  document.getElementById('clear-records-btn')?.addEventListener('click', () => {
    if (confirm('\u78ba\u5b9a\u8981\u6e05\u9664\u6240\u6709\u8003\u8a66\u7d00\u9304\u55ce\uff1f')) {
      Storage.clearRecords();
      showToast('\u7d00\u9304\u5df2\u6e05\u9664', 'success');
      navigate('history');
    }
  });
}

function getGradeLevel(score) {
  if (score >= 90) return { text: '\u512a\u79c0', tag: 'success', color: 'var(--success)' };
  if (score >= 75) return { text: '\u826f\u597d', tag: 'primary', color: 'var(--primary-light)' };
  if (score >= 60) return { text: '\u53ca\u683c', tag: 'warning', color: 'var(--warning)' };
  return { text: '\u52a0\u6cb9', tag: 'danger', color: 'var(--danger)' };
}

function formatTime(seconds) {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}\u5206${s.toString().padStart(2, '0')}\u79d2`;
}
