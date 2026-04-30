/**
 * SecureNotes v2.0 - PierceMyCode
 * Aplicación de notas seguras con cifrado local
 * Layout Standard Notes: Nav | Items | Editor
 */

// ===================== CONFIGURACIÓN FIREBASE =====================
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TU_MSG_SENDER_ID",
    appId: "TU_APP_ID"
};

let db = null;
let user = null;
let notesRef = null;
let unsubscribe = null;
let useFirebase = false;

// ===================== ESTADO GLOBAL =====================
const state = {
    notes: [],
    currentNoteId: null,
    currentView: 'notes',
    sortBy: 'recent',
    searchQuery: '',
    theme: localStorage.getItem('sn-theme') || 'dark',
    customTheme: null,
    isDirty: false,
    saveTimeout: null,
    generatedPasswords: JSON.parse(localStorage.getItem('sn-passwords') || '[]')
};

// ===================== INICIALIZACIÓN =====================
function init() {
    loadNotes();
    applyTheme(state.theme);
    renderNotes();
    renderPasswords();
    updateCounts();
    bindEvents();
    tryFirebase();
    
    // Autoguardado periódico
    setInterval(() => {
        if (state.isDirty && state.currentNoteId) {
            saveCurrentNote();
        }
    }, 3000);
}

// ===================== FIREBASE =====================
function tryFirebase() {
    const status = document.getElementById('connectionStatus');
    try {
        if (typeof firebase !== 'undefined') {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            const auth = firebase.auth();
            
            auth.signInAnonymously().then(cred => {
                user = cred.user;
                useFirebase = true;
                status.textContent = '☁️ Sincronizado';
                status.style.color = 'var(--sn-stylekit-success-color)';
                
                notesRef = db.collection('users').doc(user.uid).collection('notes');
                
                unsubscribe = notesRef.onSnapshot(snapshot => {
                    if (snapshot) {
                        snapshot.docChanges().forEach(change => {
                            if (change.type === 'modified') {
                                const fbNote = { id: change.doc.id, ...change.doc.data() };
                                const localIdx = state.notes.findIndex(n => n.id === fbNote.id);
                                if (localIdx !== -1) {
                                    // Solo actualizar si Firebase es más reciente
                                    if (!state.notes[localIdx].updatedAt || fbNote.updatedAt > state.notes[localIdx].updatedAt) {
                                        state.notes[localIdx] = { ...state.notes[localIdx], ...fbNote };
                                    }
                                }
                            }
                        });
                        renderNotes();
                        updateCounts();
                    }
                });
            }).catch(err => {
                console.warn('Firebase auth failed:', err.message);
                status.textContent = '💾 Local';
                status.style.color = 'var(--sn-stylekit-passive-color-1)';
            });
        } else {
            status.textContent = '💾 Local';
            status.style.color = 'var(--sn-stylekit-passive-color-1)';
        }
    } catch (e) {
        console.warn('Firebase not available:', e.message);
        status.textContent = '💾 Local';
        status.style.color = 'var(--sn-stylekit-passive-color-1)';
    }
}

// ===================== ALMACENAMIENTO LOCAL =====================
function loadNotes() {
    try {
        const stored = localStorage.getItem('sn-notes');
        state.notes = stored ? JSON.parse(stored) : [];
    } catch (e) {
        state.notes = [];
    }
}

function saveNotes() {
    localStorage.setItem('sn-notes', JSON.stringify(state.notes));
    updateCounts();
}

function generateId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    const array = new Uint8Array(20);
    crypto.getRandomValues(array);
    for (let i = 0; i < 20; i++) {
        id += chars[array[i] % chars.length];
    }
    return id;
}

function getCurrentDateISO() {
    return new Date().toISOString();
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    
    if (diff < 60000) return 'Ahora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getWordCount(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).length;
}

function getCharCount(text) {
    return text ? text.length : 0;
}

// ===================== CRUD DE NOTAS =====================
function createNote() {
    const now = getCurrentDateISO();
    const note = {
        id: generateId(),
        title: '',
        body: '',
        createdAt: now,
        updatedAt: now,
        status: 'active', // 'active' | 'archived' | 'trashed'
        archivedAt: null,
        trashedAt: null
    };
    
    state.notes.unshift(note);
    saveNotes();
    renderNotes();
    updateCounts();
    selectNote(note.id);
    
    if (useFirebase && notesRef) {
        notesRef.doc(note.id).set(note).catch(console.warn);
    }
    
    showToast('Nota creada');
    return note;
}

function selectNote(id) {
    state.currentNoteId = id;
    const note = state.notes.find(n => n.id === id);
    
    // Actualizar UI
    document.querySelectorAll('.note-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.id === id);
    });
    
    if (note) {
        document.getElementById('editorContent').classList.remove('hidden');
        document.getElementById('editorEmpty').classList.add('hidden');
        
        const titleInput = document.getElementById('noteTitle');
        const bodyInput = document.getElementById('noteBody');
        
        titleInput.value = note.title || '';
        bodyInput.value = note.body || '';
        
        document.getElementById('noteDate').textContent = formatDate(note.updatedAt);
        
        const wc = getWordCount(note.body);
        document.getElementById('noteWordCount').textContent = `${wc} palabras · ${getCharCount(note.body)} caracteres`;
        
        // Botones según estado
        const isTrashed = note.status === 'trashed';
        const isArchived = note.status === 'archived';
        
        document.getElementById('archiveBtn').style.display = isTrashed ? 'none' : (isArchived ? 'none' : 'inline-flex');
        document.getElementById('trashBtn').style.display = isTrashed ? 'none' : 'inline-flex';
        document.getElementById('deleteBtn').classList.toggle('hidden', !isTrashed && !isArchived);
        
        state.isDirty = false;
    }
}

function saveCurrentNote() {
    if (!state.currentNoteId) return;
    
    const title = document.getElementById('noteTitle').value;
    const body = document.getElementById('noteBody').value;
    const note = state.notes.find(n => n.id === state.currentNoteId);
    
    if (!note) return;
    
    note.title = title;
    note.body = body;
    note.updatedAt = getCurrentDateISO();
    
    saveNotes();
    renderNotes();
    updateCounts();
    
    if (useFirebase && notesRef) {
        notesRef.doc(note.id).update({
            title: title,
            body: body,
            updatedAt: note.updatedAt
        }).catch(console.warn);
    }
    
    document.getElementById('noteDate').textContent = formatDate(note.updatedAt);
    const wc = getWordCount(body);
    document.getElementById('noteWordCount').textContent = `${wc} palabras · ${getCharCount(body)} caracteres`;
    
    state.isDirty = false;
}

function archiveNote() {
    if (!state.currentNoteId) return;
    const note = state.notes.find(n => n.id === state.currentNoteId);
    if (!note) return;
    
    note.status = 'archived';
    note.archivedAt = getCurrentDateISO();
    note.updatedAt = getCurrentDateISO();
    saveNotes();
    
    if (useFirebase && notesRef) {
        notesRef.doc(note.id).update({ status: 'archived', archivedAt: note.archivedAt, updatedAt: note.updatedAt }).catch(console.warn);
    }
    
    state.currentNoteId = null;
    document.getElementById('editorContent').classList.add('hidden');
    document.getElementById('editorEmpty').classList.remove('hidden');
    renderNotes();
    updateCounts();
    showToast('Nota archivada');
}

function trashNote() {
    if (!state.currentNoteId) return;
    const note = state.notes.find(n => n.id === state.currentNoteId);
    if (!note) return;
    
    note.status = 'trashed';
    note.trashedAt = getCurrentDateISO();
    note.updatedAt = getCurrentDateISO();
    saveNotes();
    
    if (useFirebase && notesRef) {
        notesRef.doc(note.id).update({ status: 'trashed', trashedAt: note.trashedAt, updatedAt: note.updatedAt }).catch(console.warn);
    }
    
    state.currentNoteId = null;
    document.getElementById('editorContent').classList.add('hidden');
    document.getElementById('editorEmpty').classList.remove('hidden');
    renderNotes();
    updateCounts();
    showToast('Nota movida a la papelera');
}

function restoreNote(id) {
    const note = state.notes.find(n => n.id === id);
    if (!note) return;
    
    note.status = 'active';
    note.updatedAt = getCurrentDateISO();
    saveNotes();
    
    if (useFirebase && notesRef) {
        notesRef.doc(note.id).update({ status: 'active', updatedAt: note.updatedAt }).catch(console.warn);
    }
    
    renderNotes();
    updateCounts();
    switchView('archived');
    showToast('Nota restaurada');
}

function permanentlyDeleteNote(id) {
    if (!confirm('¿Eliminar esta nota permanentemente? Esta acción no se puede deshacer.')) return;
    
    const idx = state.notes.findIndex(n => n.id === id);
    if (idx === -1) return;
    
    state.notes.splice(idx, 1);
    saveNotes();
    
    if (useFirebase && notesRef) {
        notesRef.doc(id).delete().catch(console.warn);
    }
    
    if (state.currentNoteId === id) {
        state.currentNoteId = null;
        document.getElementById('editorContent').classList.add('hidden');
        document.getElementById('editorEmpty').classList.remove('hidden');
    }
    
    renderNotes();
    updateCounts();
    showToast('Nota eliminada permanentemente');
}

function emptyTrash() {
    if (!confirm('¿Vaciar la papelera? Todos los elementos se eliminarán permanentemente.')) return;
    
    const trashed = state.notes.filter(n => n.status === 'trashed');
    trashed.forEach(n => {
        if (useFirebase && notesRef) notesRef.doc(n.id).delete().catch(console.warn);
    });
    
    state.notes = state.notes.filter(n => n.status !== 'trashed');
    saveNotes();
    
    if (state.currentNoteId && !state.notes.find(n => n.id === state.currentNoteId)) {
        state.currentNoteId = null;
        document.getElementById('editorContent').classList.add('hidden');
        document.getElementById('editorEmpty').classList.remove('hidden');
    }
    
    renderNotes();
    updateCounts();
    showToast('Papelera vaciada');
}

// ===================== RENDER =====================
function getFilteredNotes() {
    let notes = [...state.notes];
    
    // Filtrar por vista
    switch (state.currentView) {
        case 'notes':
            notes = notes.filter(n => n.status === 'active');
            break;
        case 'archived':
            notes = notes.filter(n => n.status === 'archived');
            break;
        case 'trash':
            notes = notes.filter(n => n.status === 'trashed');
            break;
        case 'passwords':
            return [];
    }
    
    // Buscar
    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        notes = notes.filter(n => 
            (n.title || '').toLowerCase().includes(q) || 
            (n.body || '').toLowerCase().includes(q)
        );
    }
    
    // Ordenar
    switch (state.sortBy) {
        case 'recent':
            notes.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
            break;
        case 'oldest':
            notes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            break;
        case 'alpha':
            notes.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            break;
    }
    
    return notes;
}

function renderNotes() {
    const list = document.getElementById('notesList');
    const empty = document.getElementById('emptyState');
    const notes = getFilteredNotes();
    
    if (notes.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'flex';
        return;
    }
    
    empty.style.display = 'none';
    
    list.innerHTML = notes.map(n => {
        const isSelected = n.id === state.currentNoteId;
        const preview = (n.body || '').substring(0, 120).replace(/\n/g, ' ');
        const title = n.title || 'Sin título';
        const date = formatDate(n.updatedAt || n.createdAt);
        
        let statusBadge = '';
        if (n.status === 'archived') statusBadge = '<span class="note-item-status">📦 Archivada</span>';
        if (n.status === 'trashed') statusBadge = '<span class="note-item-status">🗑️ Papelera</span>';
        
        return `
            <div class="note-item ${isSelected ? 'selected' : ''}" data-id="${n.id}" onclick="selectNote('${n.id}')">
                <div class="note-item-title">${escapeHtml(title)}</div>
                <div class="note-item-preview">${escapeHtml(preview)}</div>
                <div class="note-item-date">
                    ${date}
                    ${statusBadge}
                </div>
            </div>
        `;
    }).join('');
}

function updateCounts() {
    const active = state.notes.filter(n => n.status === 'active').length;
    const archived = state.notes.filter(n => n.status === 'archived').length;
    const trashed = state.notes.filter(n => n.status === 'trashed').length;
    
    document.getElementById('notesCount').textContent = active;
    document.getElementById('archivedCount').textContent = archived;
    document.getElementById('trashCount').textContent = trashed;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// ===================== VISTAS (continuación) =====================
function switchView(view) {
    state.currentView = view;
    document.querySelectorAll('.nav-item[data-view]').forEach(el => {
        el.classList.toggle('active', el.dataset.view === view);
    });
    
    // Mostrar/ocultar columnas según vista
    const itemsColumn = document.getElementById('itemsColumn');
    const editorColumn = document.getElementById('editorColumn');
    
    if (view === 'passwords') {
        itemsColumn.style.display = 'none';
        document.getElementById('passwordPanel').classList.remove('hidden');
        document.getElementById('editorEmpty').classList.add('hidden');
        document.getElementById('editorContent').classList.add('hidden');
    } else {
        itemsColumn.style.display = 'block';
        document.getElementById('passwordPanel').classList.add('hidden');
        
        // Empty state y botón de vaciar papelera
        const emptyState = document.getElementById('emptyState');
        if (view === 'trash') {
            const trashed = state.notes.filter(n => n.status === 'trashed');
            emptyState.innerHTML = trashed.length > 0 ? `
                <div class="empty-icon">🗑️</div>
                <h3>Papelera</h3>
                <p>${trashed.length} nota(s) en la papelera</p>
                <button onclick="emptyTrash()" class="btn-small btn-danger" style="margin-top:12px;width:auto;padding:8px 24px;">
                    Vaciar papelera
                </button>
            ` : `
                <div class="empty-icon">🗑️</div>
                <h3>Papelera vacía</h3>
                <p>Las notas eliminadas aparecerán aquí</p>
            `;
        } else if (view === 'archived') {
            emptyState.innerHTML = `
                <div class="empty-icon">📦</div>
                <h3>Sin notas archivadas</h3>
                <p>Archiva notas para mantenerlas guardadas sin distracciones</p>
            `;
        } else {
            emptyState.innerHTML = `
                <div class="empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </div>
                <h3>No hay notas</h3>
                <p>Crea tu primera nota para empezar</p>
                <button id="emptyNewNote" class="btn-primary" style="width:auto;padding:8px 24px;">Crear nota</button>
            `;
        }
    }
    
    renderNotes();
}

// ===================== GENERADOR DE CONTRASEÑAS =====================
function generatePassword() {
    const length = parseInt(document.getElementById('pwLength').value) || 20;
    const useUpper = document.getElementById('pwUpper').checked;
    const useLower = document.getElementById('pwLower').checked;
    const useDigits = document.getElementById('pwDigits').checked;
    const useSymbols = document.getElementById('pwSymbols').checked;
    
    let chars = '';
    if (useUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (useLower) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (useDigits) chars += '0123456789';
    if (useSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?/~';
    
    if (!chars) {
        showToast('Selecciona al menos un tipo de caracter');
        return;
    }
    
    let password = '';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
        password += chars[array[i] % chars.length];
    }
    
    document.getElementById('pwOutput').value = password;
    updateStrength(password);
}

function updateStrength(password) {
    const segments = document.querySelectorAll('.pw-strength-segment');
    let score = 0;
    let label = 'Débil';
    let cssClass = 'weak';
    
    // Criterios de fortaleza
    if (password.length >= 8) score++;
    if (password.length >= 14) score++;
    if (password.length >= 20) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (password.length >= 32) score++;
    
    // Normalizar a 5 segmentos
    const normalizedScore = Math.min(5, Math.ceil(score * 5 / 7));
    
    if (normalizedScore <= 2) { label = 'Débil'; cssClass = 'weak'; }
    else if (normalizedScore <= 3) { label = 'Media'; cssClass = 'medium'; }
    else { label = 'Fuerte'; cssClass = 'strong'; }
    
    segments.forEach((seg, i) => {
        seg.className = 'pw-strength-segment' + (i < normalizedScore ? ' active ' + cssClass : '');
    });
    
    document.getElementById('pwStrengthLabel').textContent = label;
}

function copyPassword() {
    const pw = document.getElementById('pwOutput').value;
    if (!pw) return;
    
    navigator.clipboard.writeText(pw).then(() => {
        showToast('Contraseña copiada al portapapeles');
        
        // Guardar en historial
        if (!state.generatedPasswords.includes(pw)) {
            state.generatedPasswords.unshift(pw);
            if (state.generatedPasswords.length > 20) state.generatedPasswords.pop();
            localStorage.setItem('sn-passwords', JSON.stringify(state.generatedPasswords));
            renderPasswords();
        }
    }).catch(() => {
        // Fallback para iOS/Safari
        const textarea = document.getElementById('pwOutput');
        textarea.select();
        document.execCommand('copy');
        showToast('Contraseña copiada');
    });
}

function renderPasswords() {
    const list = document.getElementById('savedPasswordsList');
    if (!list) return;
    
    if (state.generatedPasswords.length === 0) {
        list.innerHTML = '<p style="font-size:13px;opacity:0.5;">Aún no has generado contraseñas</p>';
        document.getElementById('passwordsCount').textContent = '0';
        return;
    }
    
    list.innerHTML = state.generatedPasswords.map(pw => `
        <div class="pw-saved-item">
            <code>${escapeHtml(pw)}</code>
            <button class="btn-icon-small" onclick="copySavedPassword('${escapeHtml(pw)}')" title="Copiar">📋</button>
        </div>
    `).join('');
    
    document.getElementById('passwordsCount').textContent = state.generatedPasswords.length;
}

function copySavedPassword(pw) {
    navigator.clipboard.writeText(pw).then(() => {
        showToast('Contraseña copiada');
    });
}

// ===================== SISTEMA DE TEMAS =====================
function applyTheme(theme) {
    state.theme = theme;
    localStorage.setItem('sn-theme', theme);
    
    // Limpiar tema personalizado si usamos uno predefinido
    if (theme !== 'custom') {
        localStorage.removeItem('sn-custom-theme');
        state.customTheme = null;
    }
    
    // Aplicar a HTML
    document.documentElement.setAttribute('data-theme', theme === 'custom' ? 'dark' : theme);
    document.documentElement.className = theme === 'custom' ? '' : 'theme-' + theme;
    
    // Si es tema personalizado, aplicar variables
    if (theme === 'custom') {
        applyCustomTheme();
    }
    
    // Actualizar UI del selector
    document.querySelectorAll('.theme-item').forEach(el => {
        el.classList.toggle('active', el.dataset.theme === theme);
    });
    
    // Botón toggle
    const toggle = document.getElementById('themeToggle');
    if (theme === 'dark' || theme === 'midnight' || theme === 'solarized' || theme === 'gruvbox' || theme === 'custom') {
        toggle.textContent = '☀️';
    } else {
        toggle.textContent = '🌙';
    }
    
    // Actualizar meta theme-color
    const bgColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--sn-stylekit-contrast-background-color').trim() || '#0d0d1a';
    document.querySelector('meta[name="theme-color"]').content = bgColor;
}

function applyCustomTheme() {
    try {
        const custom = JSON.parse(localStorage.getItem('sn-custom-theme'));
        if (!custom) return;
        
        const root = document.documentElement;
        root.style.setProperty('--sn-stylekit-background-color', custom.bgPrimary);
        root.style.setProperty('--sn-stylekit-contrast-background-color', custom.bgSecondary);
        root.style.setProperty('--sn-stylekit-foreground-color', custom.textPrimary);
        root.style.setProperty('--sn-stylekit-info-color', custom.accent);
        root.style.setProperty('--sn-stylekit-paragraph-text-color', custom.textSecondary);
        root.style.setProperty('--sn-stylekit-border-color', custom.border);
        root.style.setProperty('--selected-item-bg', custom.selected);
        root.style.setProperty('--sn-stylekit-editor-background-color', custom.editorBg);
        
        state.customTheme = custom;
    } catch (e) {
        console.warn('Failed to apply custom theme:', e);
    }
}

function openThemeModal() {
    const modal = document.getElementById('themeModal');
    modal.classList.remove('hidden');
    
    // Cargar valores actuales o defaults
    const custom = state.customTheme || {};
    
    document.getElementById('cBgPrimary').value = custom.bgPrimary || '#0d0d1a';
    document.getElementById('cBgPrimaryHex').value = custom.bgPrimary || '#0d0d1a';
    document.getElementById('cBgSecondary').value = custom.bgSecondary || '#16162a';
    document.getElementById('cBgSecondaryHex').value = custom.bgSecondary || '#16162a';
    document.getElementById('cTextPrimary').value = custom.textPrimary || '#e8e8f0';
    document.getElementById('cTextPrimaryHex').value = custom.textPrimary || '#e8e8f0';
    document.getElementById('cAccent').value = custom.accent || '#7c3aed';
    document.getElementById('cAccentHex').value = custom.accent || '#7c3aed';
    document.getElementById('cTextSecondary').value = custom.textSecondary || '#9898b8';
    document.getElementById('cTextSecondaryHex').value = custom.textSecondary || '#9898b8';
    document.getElementById('cBorder').value = custom.border || '#2a2a4a';
    document.getElementById('cBorderHex').value = custom.border || '#2a2a4a';
    document.getElementById('cSelected').value = custom.selected || '#1e1e3a';
    document.getElementById('cSelectedHex').value = custom.selected || '#1e1e3a';
    document.getElementById('cEditorBg').value = custom.editorBg || '#0d0d1a';
    document.getElementById('cEditorBgHex').value = custom.editorBg || '#0d0d1a';
}

function closeThemeModal() {
    document.getElementById('themeModal').classList.add('hidden');
}

function saveCustomTheme() {
    const custom = {
        bgPrimary: document.getElementById('cBgPrimaryHex').value,
        bgSecondary: document.getElementById('cBgSecondaryHex').value,
        textPrimary: document.getElementById('cTextPrimaryHex').value,
        accent: document.getElementById('cAccentHex').value,
        textSecondary: document.getElementById('cTextSecondaryHex').value,
        border: document.getElementById('cBorderHex').value,
        selected: document.getElementById('cSelectedHex').value,
        editorBg: document.getElementById('cEditorBgHex').value
    };
    
    localStorage.setItem('sn-custom-theme', JSON.stringify(custom));
    state.customTheme = custom;
    applyTheme('custom');
    closeThemeModal();
    showToast('Tema personalizado aplicado');
}

function resetCustomTheme() {
    localStorage.removeItem('sn-custom-theme');
    state.customTheme = null;
    applyTheme('dark');
    closeThemeModal();
    showToast('Tema restablecido a Dark');
}

function toggleTheme() {
    const themes = ['dark', 'light', 'midnight', 'sepia', 'solarized', 'gruvbox'];
    const currentIdx = themes.indexOf(state.theme);
    const nextTheme = themes[(currentIdx + 1) % themes.length];
    applyTheme(nextTheme);
}

// ===================== EXPORTAR DATOS =====================
function exportData() {
    const data = {
        exportedAt: new Date().toISOString(),
        app: 'SecureNotes by PierceMyCode',
        version: '2.0',
        notesCount: state.notes.length,
        notes: state.notes,
        generatedPasswords: state.generatedPasswords
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SecureNotes-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Datos exportados');
}

// ===================== EVENTOS =====================
function bindEvents() {
    // Sidebar toggle (mobile)
    document.getElementById('sidebarToggle').addEventListener('click', () => {
        document.getElementById('navigationColumn').classList.toggle('open');
    });
    
    document.getElementById('menuClose').addEventListener('click', () => {
        document.getElementById('navigationColumn').classList.remove('open');
    });
    
    // Nueva nota
    document.getElementById('newNoteBtn').addEventListener('click', createNote);
    
    // Navegación de vistas
    document.querySelectorAll('.nav-item[data-view]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(el.dataset.view);
            // Cerrar sidebar en mobile
            document.getElementById('navigationColumn').classList.remove('open');
        });
    });
    
    // Temas
    document.querySelectorAll('.theme-item').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            applyTheme(el.dataset.theme);
        });
    });
    
    document.getElementById('customThemeBtn').addEventListener('click', (e) => {
        e.preventDefault();
        openThemeModal();
    });
    
    document.getElementById('closeThemeModal').addEventListener('click', closeThemeModal);
    document.querySelector('.modal-backdrop').addEventListener('click', closeThemeModal);
    document.getElementById('applyThemeBtn').addEventListener('click', saveCustomTheme);
    document.getElementById('resetThemeBtn').addEventListener('click', resetCustomTheme);
    
    // Color picker sync
    document.querySelectorAll('.customizer-row input[type="color"]').forEach(input => {
        input.addEventListener('input', () => {
            const hexInput = input.parentElement.querySelector('input[type="text"]');
            if (hexInput) hexInput.value = input.value;
        });
    });
    document.querySelectorAll('.customizer-row input[type="text"]').forEach(input => {
        input.addEventListener('input', () => {
            const colorInput = input.parentElement.querySelector('input[type="color"]');
            if (colorInput && /^#[0-9a-fA-F]{6}$/.test(input.value)) {
                colorInput.value = input.value;
            }
        });
    });
    
    // Editor - autoguardado
    document.getElementById('noteTitle').addEventListener('input', () => {
        state.isDirty = true;
        if (state.saveTimeout) clearTimeout(state.saveTimeout);
        state.saveTimeout = setTimeout(saveCurrentNote, 800);
    });
    
    document.getElementById('noteBody').addEventListener('input', () => {
        state.isDirty = true;
        if (state.saveTimeout) clearTimeout(state.saveTimeout);
        state.saveTimeout = setTimeout(saveCurrentNote, 800);
    });
    
    // Atajos de teclado (Ctrl+S)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveCurrentNote();
            showToast('Nota guardada');
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            createNote();
        }
    });
    
    // Botones de acción
    document.getElementById('archiveBtn').addEventListener('click', archiveNote);
    document.getElementById('trashBtn').addEventListener('click', trashNote);
    document.getElementById('deleteBtn').addEventListener('click', () => {
        if (state.currentNoteId) permanentlyDeleteNote(state.currentNoteId);
    });
    
    // Búsqueda con debounce
    document.getElementById('searchInput').addEventListener('input', () => {
        if (state.searchTimeout) clearTimeout(state.searchTimeout);
        state.searchTimeout = setTimeout(() => {
            state.searchQuery = document.getElementById('searchInput').value;
            renderNotes();
        }, 250);
    });
    
    // Ordenar
    document.getElementById('sortBtn').addEventListener('click', () => {
        const orders = ['recent', 'oldest', 'alpha'];
        const labels = ['📅 Recientes', '📅 Más antiguas', '🔤 Alfabético'];
        const currentIdx = orders.indexOf(state.sortBy);
        const nextIdx = (currentIdx + 1) % orders.length;
        state.sortBy = orders[nextIdx];
        document.getElementById('sortBtn').textContent = labels[nextIdx];
        renderNotes();
    });
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // Export
    document.getElementById('exportBtn').addEventListener('click', exportData);
    
    // Password generator
    const pwLength = document.getElementById('pwLength');
    if (pwLength) {
        pwLength.addEventListener('input', generatePassword);
        document.querySelectorAll('#passwordPanel input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', generatePassword);
        });
        document.getElementById('generatePwBtn')?.addEventListener('click', generatePassword);
        document.getElementById('copyPwBtn')?.addEventListener('click', copyPassword);
    }
}

// ===================== TOAST =====================
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    
    if (toast._timeout) clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 2500);
}

// ===================== INICIAR =====================
document.addEventListener('DOMContentLoaded', init);