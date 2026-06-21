/* ============================================
   NOVA EDIT LITE — Storage Manager
   Handles LocalStorage + IndexedDB persistence
   ============================================ */

const STORAGE_KEY = 'nova_edit_projects';
const SETTINGS_KEY = 'nova_edit_settings';
const DB_NAME = 'NovaEditDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

class StorageManager {
  constructor() {
    this.db = null;
    this.initDB();
  }

  /* ---- IndexedDB Initialization ---- */
  async initDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async ensureDB() {
    if (!this.db) await this.initDB();
    return this.db;
  }

  /* ---- Project CRUD ---- */

  /** Save or update a project */
  async saveProject(project) {
    try {
      const db = await this.ensureDB();
      const now = new Date().toISOString();
      const data = {
        ...project,
        updatedAt: now,
        createdAt: project.createdAt || now,
      };
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(data);
        req.onsuccess = () => resolve(data);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      // Fallback to localStorage
      console.warn('IDB save failed, using localStorage:', err);
      return this._lsSaveProject(project);
    }
  }

  /** Load all projects, newest first */
  async loadProjects() {
    try {
      const db = await this.ensureDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const projects = req.result || [];
          projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          resolve(projects);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      return this._lsLoadProjects();
    }
  }

  /** Load a single project by id */
  async loadProject(id) {
    try {
      const db = await this.ensureDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      const projects = this._lsLoadProjects();
      return projects.find(p => p.id === id) || null;
    }
  }

  /** Delete a project by id */
  async deleteProject(id) {
    try {
      const db = await this.ensureDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      return this._lsDeleteProject(id);
    }
  }

  /** Clear all projects */
  async clearAll() {
    try {
      const db = await this.ensureDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    }
  }

  /** Get recent projects (last N) */
  async getRecentProjects(limit = 5) {
    const all = await this.loadProjects();
    return all.slice(0, limit);
  }

  /** Estimate storage used */
  async getStorageInfo() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const { usage, quota } = await navigator.storage.estimate();
        return {
          used: this._formatBytes(usage),
          quota: this._formatBytes(quota),
          percent: Math.round((usage / quota) * 100),
        };
      }
    } catch {}
    const lsData = localStorage.getItem(STORAGE_KEY) || '';
    return {
      used: this._formatBytes(new Blob([lsData]).size),
      quota: 'Unknown',
      percent: 0,
    };
  }

  _formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  /* ---- localStorage Fallbacks ---- */
  _lsSaveProject(project) {
    const projects = this._lsLoadProjects();
    const idx = projects.findIndex(p => p.id === project.id);
    const data = { ...project, updatedAt: new Date().toISOString(), createdAt: project.createdAt || new Date().toISOString() };
    if (idx >= 0) projects[idx] = data;
    else projects.unshift(data);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch {}
    return data;
  }

  _lsLoadProjects() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  _lsDeleteProject(id) {
    const projects = this._lsLoadProjects().filter(p => p.id !== id);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch {}
    return true;
  }

  /* ---- Settings ---- */
  saveSettings(settings) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  /** Generate a unique project ID */
  generateId() {
    return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

// Export global instance
window.storage = new StorageManager();
