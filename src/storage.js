// storage.js - LocalStorage + Firebase Firestore sync layer

import { isFirebaseEnabled, getDb } from './firebase.js';

const STORAGE_KEYS = {
  SETTINGS: 'quiz_settings',
  QUESTIONS: 'quiz_questions',
  RECORDS: 'quiz_records',
  CUSTOM_SUBJECTS: 'quiz_custom_subjects',
  API_KEY: 'quiz_api_key',
  SCAN_SETTINGS: 'quiz_scan_settings',
};

// Firestore helpers (lazy import to avoid bundling when unused)
let firestoreMethods = null;
async function getFirestoreMethods() {
  if (!firestoreMethods) {
    const mod = await import('firebase/firestore');
    firestoreMethods = mod;
  }
  return firestoreMethods;
}

export const Storage = {
  // ===== Settings =====
  getSettings() {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : {
      year: new Date().getFullYear() - 1911,  // ROC year
      grade: 1,
      semester: 1,
      subject: 'math',
    };
  },

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    this._syncToFirestore('settings', 'user_settings', settings);
  },

  // ===== Custom Subjects =====
  getCustomSubjects() {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_SUBJECTS);
    return data ? JSON.parse(data) : {};
  },

  saveCustomSubjects(subjects) {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_SUBJECTS, JSON.stringify(subjects));
    this._syncToFirestore('custom_subjects', 'all', subjects);
  },

  addCustomSubject(key, name, icon) {
    const subjects = this.getCustomSubjects();
    subjects[key] = { name, icon };
    this.saveCustomSubjects(subjects);
    return subjects;
  },

  removeCustomSubject(key) {
    const subjects = this.getCustomSubjects();
    delete subjects[key];
    this.saveCustomSubjects(subjects);
    return subjects;
  },

  // ===== API Key =====
  getApiKey() {
    return localStorage.getItem(STORAGE_KEYS.API_KEY) || '';
  },

  saveApiKey(key) {
    localStorage.setItem(STORAGE_KEYS.API_KEY, key);
  },

  // ===== Scan Settings =====
  getScanSettings() {
    const data = localStorage.getItem(STORAGE_KEYS.SCAN_SETTINGS);
    return data ? JSON.parse(data) : null;
  },

  saveScanSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SCAN_SETTINGS, JSON.stringify(settings));
  },

  // ===== Questions =====
  getQuestions() {
    const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    return data ? JSON.parse(data) : [];
  },

  saveQuestions(questions) {
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
  },

  addQuestion(question) {
    const questions = this.getQuestions();
    question.id = this.generateId();
    question.createdAt = new Date().toISOString();
    questions.push(question);
    this.saveQuestions(questions);
    this._syncToFirestore('questions', question.id, question);
    return question;
  },

  updateQuestion(id, updates) {
    const questions = this.getQuestions();
    const idx = questions.findIndex(q => q.id === id);
    if (idx !== -1) {
      questions[idx] = { ...questions[idx], ...updates };
      this.saveQuestions(questions);
      this._syncToFirestore('questions', id, questions[idx]);
      return questions[idx];
    }
    return null;
  },

  deleteQuestion(id) {
    const questions = this.getQuestions().filter(q => q.id !== id);
    this.saveQuestions(questions);
    this._deleteFromFirestore('questions', id);
  },

  getFilteredQuestions(filters = {}) {
    let questions = this.getQuestions();
    if (filters.year) questions = questions.filter(q => q.year === filters.year);
    if (filters.grade) questions = questions.filter(q => q.grade === filters.grade);
    if (filters.semester) questions = questions.filter(q => q.semester === filters.semester);
    if (filters.subject) questions = questions.filter(q => q.subject === filters.subject);
    if (filters.type) questions = questions.filter(q => q.type === filters.type);
    if (filters.difficulty) questions = questions.filter(q => q.difficulty === filters.difficulty);
    if (filters.scope) questions = questions.filter(q => q.scope === filters.scope);
    return questions;
  },

  // ===== Records =====
  getRecords() {
    const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
    return data ? JSON.parse(data) : [];
  },

  saveRecord(record) {
    const records = this.getRecords();
    record.id = this.generateId();
    record.date = new Date().toISOString();
    records.push(record);
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
    this._syncToFirestore('records', record.id, record);
    return record;
  },

  clearRecords() {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify([]));
  },

  // ===== Export / Import =====
  exportData() {
    return JSON.stringify({
      settings: this.getSettings(),
      questions: this.getQuestions(),
      records: this.getRecords(),
      customSubjects: this.getCustomSubjects(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  },

  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.questions && Array.isArray(data.questions)) {
        const existing = this.getQuestions();
        const existingIds = new Set(existing.map(q => q.id));
        const newQuestions = data.questions.filter(q => !existingIds.has(q.id));
        this.saveQuestions([...existing, ...newQuestions]);

        // Import custom subjects if present
        if (data.customSubjects && typeof data.customSubjects === 'object') {
          const currentCustom = this.getCustomSubjects();
          this.saveCustomSubjects({ ...currentCustom, ...data.customSubjects });
        }

        return { success: true, imported: newQuestions.length, total: data.questions.length };
      }
      return { success: false, error: 'Invalid data format' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // ===== Firebase Sync (fire-and-forget) =====
  async _syncToFirestore(collection, docId, data) {
    if (!isFirebaseEnabled()) return;
    try {
      const { doc, setDoc } = await getFirestoreMethods();
      const db = getDb();
      await setDoc(doc(db, collection, docId), {
        ...data,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[Firebase] Sync failed:', e.message);
    }
  },

  async _deleteFromFirestore(collection, docId) {
    if (!isFirebaseEnabled()) return;
    try {
      const { doc, deleteDoc } = await getFirestoreMethods();
      const db = getDb();
      await deleteDoc(doc(db, collection, docId));
    } catch (e) {
      console.warn('[Firebase] Delete failed:', e.message);
    }
  },

  async syncFromFirestore() {
    if (!isFirebaseEnabled()) return;
    try {
      const { collection, getDocs } = await getFirestoreMethods();
      const db = getDb();

      // Sync questions
      const snapshot = await getDocs(collection(db, 'questions'));
      if (!snapshot.empty) {
        const cloudQuestions = [];
        snapshot.forEach(doc => cloudQuestions.push(doc.data()));
        const local = this.getQuestions();
        const localIds = new Set(local.map(q => q.id));
        const newFromCloud = cloudQuestions.filter(q => !localIds.has(q.id));
        if (newFromCloud.length > 0) {
          this.saveQuestions([...local, ...newFromCloud]);
          console.log(`[Firebase] Synced ${newFromCloud.length} questions from cloud.`);
        }
      }
    } catch (e) {
      console.warn('[Firebase] Cloud sync failed:', e.message);
    }
  },

  // ===== Utility =====
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  },

  getStorageSize() {
    let total = 0;
    for (const key in STORAGE_KEYS) {
      const val = localStorage.getItem(STORAGE_KEYS[key]);
      if (val) total += val.length * 2;
    }
    return total;
  },
};
