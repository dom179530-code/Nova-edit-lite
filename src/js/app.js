/* ============================================
   NOVA EDIT LITE — Main App Controller
   Navigation, Settings, Projects, Search
   ============================================ */

import { haptic } from './haptics.js';

class App {
  constructor() {
    this.currentScreen = 'home';
    this.settings = {
      theme: 'dark',
      accent: '#a78bfa',
      autoSave: true,
      hqExport: true,
      showGrid: false,
    };

    this.init();
  }

  async init() {
    // Load saved settings
    const saved = window.storage.loadSettings();
    if (saved.theme) this.settings.theme = saved.theme;
    if (saved.accent) this.settings.accent = saved.accent;
    if (saved.autoSave !== undefined) this.settings.autoSave = saved.autoSave;
    if (saved.hqExport !== undefined) this.settings.hqExport = saved.hqExport;
    if (saved.showGrid !== undefined) this.settings.showGrid = saved.showGrid;

    this.applyTheme(this.settings.theme);
    this.applyAccent(this.settings.accent);

    this.bindNavigation();
    this.bindSettings();
    this.bindSearch();
    this.bindGlobalKeys();

    await this.refreshProjects();
    this.updateStorageInfo();

    // Navigate to home
    this.navigate('home');
  }

  /* ============================================
     NAVIGATION
     ============================================ */
  navigate(screen) {
    const prev = document.getElementById(`screen-${this.currentScreen}`);
    const next = document.getElementById(`screen-${screen}`);
    if (!next) return;

    haptic('light');

    if (prev) prev.classList.remove('active');
    next.classList.add('active');

    this.currentScreen = screen;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.nav === screen);
    });

    // Update header title
    const titles = {
      home: 'Home', photo: 'Photo Editor',
      video: 'Video Editor', projects: 'Projects', settings: 'Settings',
    };
    const titleEl = document.getElementById('headerTitle');
    if (titleEl) titleEl.innerHTML = `<span>${titles[screen] || screen}</span>`;

    // Special: refresh when navigating to projects
    if (screen === 'projects') this.refreshProjects();
    if (screen === 'settings') this.updateStorageInfo();

    // Close search overlay if open
    this.closeSearch();
  }

  bindNavigation() {
    // Bottom nav items already use onclick in HTML
    // Header back - if needed later
  }

  /* ============================================
     SETTINGS
     ============================================ */
  bindSettings() {
    // Theme toggle
    document.querySelectorAll('.theme-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.applyTheme(btn.dataset.theme);
        this.settings.theme = btn.dataset.theme;
        this.saveSettings();
      });
    });

    // Accent color
    document.querySelectorAll('.accent-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.accent-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.applyAccent(btn.dataset.accent);
        this.settings.accent = btn.dataset.accent;
        this.saveSettings();
      });
    });

    // Header theme button
    document.getElementById('themeBtn')?.addEventListener('click', () => {
      const newTheme = this.settings.theme === 'dark' ? 'light' : 'dark';
      this.applyTheme(newTheme);
      this.settings.theme = newTheme;
      document.querySelectorAll('.theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === newTheme));
      this.saveSettings();
    });

    // Auto save toggle
    document.getElementById('autoSaveToggle')?.addEventListener('change', e => {
      this.settings.autoSave = e.target.checked;
      this.saveSettings();
    });

    // HQ export
    document.getElementById('hqExportToggle')?.addEventListener('change', e => {
      this.settings.hqExport = e.target.checked;
      this.saveSettings();
    });

    // Grid toggle
    document.getElementById('gridToggle')?.addEventListener('change', e => {
      this.settings.showGrid = e.target.checked;
      if (window.photoEditor) {
        window.photoEditor.showGrid = e.target.checked;
        window.photoEditor.applyAll();
      }
      this.saveSettings();
    });

    // Clear storage
    document.getElementById('clearStorageBtn')?.addEventListener('click', async () => {
      if (!confirm('Clear all saved projects? This cannot be undone.')) return;
      await window.storage.clearAll();
      await this.refreshProjects();
      this.updateStorageInfo();
      utils.showToast('All projects cleared', 'info');
    });
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.settings.theme = theme;
    // Update theme icon visibility
    document.getElementById('themeIconDark')?.classList.toggle('hidden', theme === 'light');
    document.getElementById('themeIconLight')?.classList.toggle('hidden', theme === 'dark');
    // Sync theme opts
    document.querySelectorAll('.theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  }

  applyAccent(color) {
    document.documentElement.style.setProperty('--accent', color);
    // Darken slightly for dark variant
    this.settings.accent = color;
    // Sync accent buttons
    document.querySelectorAll('.accent-btn').forEach(b => b.classList.toggle('active', b.dataset.accent === color));
  }

  saveSettings() {
    window.storage.saveSettings(this.settings);
  }

  /* ============================================
     PROJECTS
     ============================================ */
  async refreshProjects() {
    const projects = await window.storage.loadProjects();
    this.renderHomeRecent(projects.slice(0, 3));
    this.renderProjectsGrid(projects);
    const countEl = document.getElementById('projectCountDisplay');
    if (countEl) countEl.textContent = `${projects.length} project${projects.length !== 1 ? 's' : ''}`;
  }

  renderHomeRecent(projects) {
    const list = document.getElementById('homeRecentList');
    if (!list) return;

    if (projects.length === 0) {
      list.innerHTML = `
        <div class="empty-state glass">
          <div class="empty-icon">🎨</div>
          <p>No recent projects yet.<br/>Start editing to see them here!</p>
        </div>`;
      return;
    }

    list.innerHTML = `<div class="recent-projects-list">
      ${projects.map(p => `
        <div class="recent-item" data-id="${p.id}" data-type="${p.type}">
          <div class="recent-thumb">${p.thumb ? `<img src="${p.thumb}" style="width:100%;height:100%;object-fit:cover;border-radius:8px" />` : (p.type === 'video' ? '🎬' : '🖼️')}</div>
          <div class="recent-info">
            <div class="recent-name">${this.escapeHtml(p.name || 'Untitled')}</div>
            <div class="recent-meta">${utils.formatDate(p.updatedAt)}</div>
          </div>
          <span class="recent-type">${p.type === 'video' ? 'Video' : 'Photo'}</span>
        </div>
      `).join('')}
    </div>`;

    list.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => this.openProject(item.dataset.id, item.dataset.type));
    });
  }

  renderProjectsGrid(projects) {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    if (projects.length === 0) {
      grid.innerHTML = `
        <div class="empty-state glass" style="grid-column:1/-1">
          <div class="empty-icon">📁</div>
          <h3>No projects yet</h3>
          <p>Start editing to create your first project</p>
          <div class="hero-actions mt-12">
            <button class="btn btn-primary" onclick="app.navigate('photo')">Edit Photo</button>
            <button class="btn btn-secondary" onclick="app.navigate('video')">Edit Video</button>
          </div>
        </div>`;
      return;
    }

    grid.innerHTML = projects.map(p => `
      <div class="project-card" data-id="${p.id}" data-type="${p.type}">
        <div class="project-thumb">
          ${p.thumb ? `<img src="${p.thumb}" style="width:100%;height:100%;object-fit:cover" />` : (p.type === 'video' ? '🎬' : '🖼️')}
        </div>
        <div class="project-info">
          <div class="project-name">${this.escapeHtml(p.name || 'Untitled')}</div>
          <div class="project-meta">${utils.formatDate(p.updatedAt)}</div>
          <span class="project-type-badge">${p.type === 'video' ? '🎬 Video' : '🖼️ Photo'}</span>
        </div>
        <div class="project-actions">
          <button class="project-action-btn" data-open="${p.id}" data-type="${p.type}">Open</button>
          <button class="project-action-btn del" data-del="${p.id}">Delete</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-open]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.openProject(btn.dataset.open, btn.dataset.type); });
    });
    grid.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Delete this project?')) return;
        await window.storage.deleteProject(btn.dataset.del);
        await this.refreshProjects();
        utils.showToast('Project deleted', 'info');
      });
    });
    grid.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', () => this.openProject(card.dataset.id, card.dataset.type));
    });
  }

  async openProject(id, type) {
    const project = await window.storage.loadProject(id);
    if (!project) { utils.showToast('Project not found', 'error'); return; }

    if (type === 'photo' && project.dataURL) {
      this.navigate('photo');
      const img = new Image();
      img.onload = () => {
        if (window.photoEditor) {
          window.photoEditor.originalImage = img;
          window.photoEditor.projectId = project.id;
          window.photoEditor.projectName = project.name;
          window.photoEditor.adjustments = { ...project.adjustments };
          window.photoEditor.currentFilter = project.filter || 'none';
          window.photoEditor.rotation = project.rotation || 0;
          window.photoEditor.flipH = project.flipH || false;
          window.photoEditor.flipV = project.flipV || false;
          window.photoEditor.setupCanvas(img.naturalWidth, img.naturalHeight);
          window.photoEditor.applyAll();
          window.photoEditor.syncAdjustmentSliders();
          window.photoEditor.showEditorUI();
          window.photoEditor.pushHistory();
          utils.showToast(`Opened: ${project.name}`, 'success');
        }
      };
      img.src = project.dataURL;
    } else if (type === 'video') {
      this.navigate('video');
      utils.showToast(`Project "${project.name}" opened (re-import video to edit)`, 'info');
    }
  }

  /* ---- Project Search ---- */
  async searchProjects(query) {
    if (!query) return [];
    const projects = await window.storage.loadProjects();
    return projects.filter(p => (p.name || '').toLowerCase().includes(query.toLowerCase()));
  }

  /* ============================================
     SEARCH
     ============================================ */
  bindSearch() {
    document.getElementById('searchBtn')?.addEventListener('click', () => this.openSearch());
    document.getElementById('searchClose')?.addEventListener('click', () => this.closeSearch());
    document.getElementById('searchOverlay')?.addEventListener('click', e => {
      if (e.target === document.getElementById('searchOverlay')) this.closeSearch();
    });

    const input = document.getElementById('searchInput');
    if (input) {
      input.addEventListener('input', utils.debounce(e => this.doSearch(e.target.value), 250));
    }

    // Project search in projects screen
    const projSearch = document.getElementById('projectSearch');
    if (projSearch) {
      projSearch.addEventListener('input', utils.debounce(async e => {
        const q = e.target.value.trim();
        if (!q) { await this.refreshProjects(); return; }
        const results = await this.searchProjects(q);
        this.renderProjectsGrid(results);
      }, 250));
    }

    // View toggle
    document.getElementById('gridViewBtn')?.addEventListener('click', () => {
      const grid = document.getElementById('projectsGrid');
      grid?.classList.remove('list-view');
      document.getElementById('gridViewBtn')?.classList.add('active');
      document.getElementById('listViewBtn')?.classList.remove('active');
    });
    document.getElementById('listViewBtn')?.addEventListener('click', () => {
      const grid = document.getElementById('projectsGrid');
      grid?.classList.add('list-view');
      document.getElementById('listViewBtn')?.classList.add('active');
      document.getElementById('gridViewBtn')?.classList.remove('active');
    });
  }

  openSearch() {
    const overlay = document.getElementById('searchOverlay');
    overlay?.classList.remove('hidden');
    document.getElementById('searchInput')?.focus();
    this.renderSearchResults([]);
  }

  closeSearch() {
    document.getElementById('searchOverlay')?.classList.add('hidden');
  }

  async doSearch(query) {
    const results = document.getElementById('searchResults');
    if (!results) return;

    if (!query.trim()) { this.renderSearchResults([]); return; }

    // Feature search
    const features = [
      { label: 'Photo Editor', icon: '🖼️', action: () => this.navigate('photo') },
      { label: 'Video Editor', icon: '🎬', action: () => this.navigate('video') },
      { label: 'Import Photo', icon: '📂', action: () => { this.navigate('photo'); setTimeout(() => document.getElementById('photoImportBtn')?.click(), 300); } },
      { label: 'Import Video', icon: '📂', action: () => { this.navigate('video'); setTimeout(() => document.getElementById('videoImportBtn')?.click(), 300); } },
      { label: 'My Projects', icon: '📁', action: () => this.navigate('projects') },
      { label: 'Settings', icon: '⚙️', action: () => this.navigate('settings') },
      { label: 'Crop Tool', icon: '✂️', action: () => { this.navigate('photo'); setTimeout(() => window.photoEditor?.selectTool('crop'), 300); } },
      { label: 'Draw Tool', icon: '✏️', action: () => { this.navigate('photo'); setTimeout(() => window.photoEditor?.selectTool('draw'), 300); } },
      { label: 'Text Tool', icon: '🔤', action: () => { this.navigate('photo'); setTimeout(() => window.photoEditor?.selectTool('text'), 300); } },
      { label: 'Filters', icon: '🎨', action: () => { this.navigate('photo'); } },
      { label: 'Adjustments', icon: '🔧', action: () => { this.navigate('photo'); } },
      { label: 'Export / Download', icon: '⬇️', action: () => { if (this.currentScreen === 'video') window.videoEditor?.exportProject(); else window.photoEditor?.openDownloadModal(); } },
    ];

    const q = query.toLowerCase();
    const matchedFeatures = features.filter(f => f.label.toLowerCase().includes(q)).slice(0, 5);
    const matchedProjects = await this.searchProjects(query);

    this.renderSearchResults(matchedFeatures, matchedProjects.slice(0, 4));
  }

  renderSearchResults(features = [], projects = []) {
    const results = document.getElementById('searchResults');
    if (!results) return;

    if (features.length === 0 && projects.length === 0) {
      results.innerHTML = '';
      return;
    }

    let html = '';
    if (features.length > 0) {
      html += features.map(f => `
        <div class="search-result-item" data-feature="${f.label}">
          <span class="search-result-icon">${f.icon}</span>
          <span>${f.label}</span>
        </div>
      `).join('');
    }
    if (projects.length > 0) {
      html += `<div style="font-size:11px;color:var(--text-muted);padding:4px 14px;margin-top:4px">Projects</div>`;
      html += projects.map(p => `
        <div class="search-result-item" data-projid="${p.id}" data-projtype="${p.type}">
          <span class="search-result-icon">${p.type === 'video' ? '🎬' : '🖼️'}</span>
          <span>${this.escapeHtml(p.name || 'Untitled')}</span>
        </div>
      `).join('');
    }
    results.innerHTML = html;

    // Bind feature clicks using stored actions
    features.forEach(f => {
      results.querySelector(`[data-feature="${f.label}"]`)?.addEventListener('click', () => {
        this.closeSearch();
        f.action();
      });
    });
    results.querySelectorAll('[data-projid]').forEach(el => {
      el.addEventListener('click', () => {
        this.closeSearch();
        this.openProject(el.dataset.projid, el.dataset.projtype);
      });
    });
  }

  /* ============================================
     STORAGE INFO
     ============================================ */
  async updateStorageInfo() {
    const info = await window.storage.getStorageInfo();
    const el = document.getElementById('storageUsedDisplay');
    if (el) el.textContent = `${info.used} used${info.quota !== 'Unknown' ? ` / ${info.quota}` : ''}`;
    const projects = await window.storage.loadProjects();
    const countEl = document.getElementById('projectCountDisplay');
    if (countEl) countEl.textContent = `${projects.length} project${projects.length !== 1 ? 's' : ''}`;
  }

  /* ============================================
     GLOBAL KEYBOARD SHORTCUTS
     ============================================ */
  bindGlobalKeys() {
    document.addEventListener('keydown', e => {
      // Open search with "/"
      if (e.key === '/' && !['INPUT','TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        this.openSearch();
        return;
      }
      // Close search/modal with Escape
      if (e.key === 'Escape') {
        const searchOverlay = document.getElementById('searchOverlay');
        if (!searchOverlay?.classList.contains('hidden')) { this.closeSearch(); return; }
        const dlModal = document.getElementById('dlModal');
        if (!dlModal?.classList.contains('hidden')) { window.photoEditor?.closeDownloadModal(); return; }
        return;
      }
      // Navigation shortcuts (only when not in an input)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    });
  }

  /* ============================================
     HELPERS
     ============================================ */
  escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// Initialize app
window.app = new App();
