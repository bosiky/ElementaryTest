// app.js - Main application router

import './style.css';
import { Storage } from './storage.js';
import { QuestionBank } from './questionBank.js';
import { initFirebase } from './firebase.js';
import { renderHome, renderSettings, bindSettings } from './pages/home.js';
import { renderBank, bindBank } from './pages/bank.js';
import { renderQuizSetup, bindQuizSetup, renderExam, bindExam } from './pages/quiz.js';
import { renderResult, bindResult } from './pages/result.js';
import { renderHistory, bindHistory } from './pages/history.js';

let currentPage = 'home';

const PAGES = {
  home: { render: renderHome, bind: null, nav: true, label: '\u{1f3e0} \u9996\u9801' },
  settings: { render: renderSettings, bind: bindSettings, nav: true, label: '\u2699\ufe0f \u8a2d\u5b9a' },
  bank: { render: renderBank, bind: bindBank, nav: true, label: '\u{1f4da} \u984c\u5eab' },
  quiz: { render: renderQuizSetup, bind: bindQuizSetup, nav: true, label: '\u{1f3af} \u6e2c\u9a57' },
  exam: { render: renderExam, bind: bindExam, nav: false },
  result: { render: renderResult, bind: bindResult, nav: false },
  history: { render: renderHistory, bind: bindHistory, nav: true, label: '\u{1f4ca} \u7d00\u9304' },
};

function navigate(page) {
  if (!PAGES[page]) page = 'home';
  currentPage = page;
  renderPage();
}

function renderPage() {
  const container = document.getElementById('page-container');
  const pageConfig = PAGES[currentPage];

  // Render navigation
  renderNav();

  // Render page content
  container.innerHTML = pageConfig.render(navigate);

  // Bind events
  if (pageConfig.bind) pageConfig.bind(navigate);

  // Bind menu card clicks (home page)
  document.querySelectorAll('.menu-card[data-page]').forEach(card => {
    card.addEventListener('click', () => navigate(card.dataset.page));
  });

  // Update settings badge
  renderSettingsBadge();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderNav() {
  const navLinks = document.getElementById('nav-links');
  navLinks.innerHTML = Object.entries(PAGES)
    .filter(([, cfg]) => cfg.nav)
    .map(([key, cfg]) => `<button class="nav-link ${currentPage === key ? 'active' : ''}" data-nav="${key}">${cfg.label}</button>`)
    .join('');

  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => navigate(link.dataset.nav));
  });
}

function renderSettingsBadge() {
  const badge = document.getElementById('nav-settings-badge');
  const s = Storage.getSettings();
  badge.innerHTML = `${s.year} ${QuestionBank.formatGrade(s.grade)} ${QuestionBank.formatSemester(s.semester)}`;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Try to init Firebase (optional, will fall back to LocalStorage)
  initFirebase();

  // Sync from cloud if Firebase enabled
  Storage.syncFromFirestore();

  navigate('home');
});

