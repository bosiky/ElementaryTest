// stats.js - Statistics and chart rendering

import { Storage } from './storage.js';
import { SUBJECTS } from './questionBank.js';

export const Stats = {
  getOverview() {
    const records = Storage.getRecords();
    if (records.length === 0) return null;

    const totalExams = records.length;
    const avgScore = Math.round(records.reduce((sum, r) => sum + r.score, 0) / totalExams);
    const bestScore = Math.max(...records.map(r => r.score));
    const totalQuestions = records.reduce((sum, r) => sum + r.totalQuestions, 0);
    const totalCorrect = records.reduce((sum, r) => sum + r.correctCount, 0);

    return { totalExams, avgScore, bestScore, totalQuestions, totalCorrect };
  },

  getSubjectStats() {
    const records = Storage.getRecords();
    const stats = {};

    for (const subject of Object.keys(SUBJECTS)) {
      const subjectRecords = records.filter(r => r.subject === subject);
      if (subjectRecords.length > 0) {
        stats[subject] = {
          count: subjectRecords.length,
          avgScore: Math.round(subjectRecords.reduce((s, r) => s + r.score, 0) / subjectRecords.length),
          bestScore: Math.max(...subjectRecords.map(r => r.score)),
        };
      }
    }

    return stats;
  },

  getRecentScores(limit = 10) {
    const records = Storage.getRecords();
    return records.slice(-limit).map(r => ({
      score: r.score,
      date: new Date(r.date).toLocaleDateString('zh-TW'),
      subject: r.subject,
    }));
  },

  renderBarChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container || data.length === 0) return;

    const maxVal = Math.max(...data.map(d => d.value), 1);
    const chartHeight = options.height || 200;

    let html = `<div class="stats-bar-chart" style="height: ${chartHeight}px;">`;
    data.forEach(d => {
      const height = (d.value / maxVal) * (chartHeight - 40);
      const color = d.color || 'var(--primary)';
      html += `
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
          <div class="stats-bar" style="height: ${height}px; background: linear-gradient(to top, ${color}, ${color}88);">
            <span class="stats-bar-value">${d.value}</span>
          </div>
        </div>`;
    });
    html += `</div>`;

    // Labels
    html += `<div style="display: flex; gap: var(--sp-sm); padding: var(--sp-sm) var(--sp-md);">`;
    data.forEach(d => {
      html += `<div class="stats-bar-label" style="flex: 1; text-align: center;">${d.label}</div>`;
    });
    html += `</div>`;

    container.innerHTML = html;
  },
};
