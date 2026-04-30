/**
 * SecureNotes - Preload Script (Context Bridge)
 * PierceMyCode © 2026
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Persistencia de datos en sistema de archivos
    saveFile: (data) => ipcRenderer.invoke('save-file', data),
    loadFile: () => ipcRenderer.invoke('load-file'),
    saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
    loadSettings: () => ipcRenderer.invoke('load-settings'),

    // Diálogos de archivo
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    writeFileDialog: (filePath, data) => ipcRenderer.invoke('write-file-dialog', filePath, data),
    readFileDialog: (filePath) => ipcRenderer.invoke('read-file-dialog', filePath),

    // Eventos del menú
    onExport: (callback) => ipcRenderer.on('menu-export', callback),
    onImport: (callback) => ipcRenderer.on('menu-import', callback),
    onSaveBeforeQuit: (callback) => ipcRenderer.on('save-before-quit', callback),
    onRequestSave: (callback) => ipcRenderer.on('request-save', callback),
    onLocalData: (callback) => ipcRenderer.on('local-data', (event, data) => callback(data)),

    // Información del sistema
    platform: process.platform,
    arch: process.arch,
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron
    }
});