/**
 * SecureNotes - Electron Main Process
 * PierceMyCode © 2026
 */
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'SecureNotes',
        icon: path.join(__dirname, 'icons', 'icon.png'),
        backgroundColor: '#0d0d1a',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            sandbox: false
        }
    });

    // Cargar la app web
    mainWindow.loadFile(path.join(__dirname, '..', 'web', 'index.html'));

    // Mostrar cuando esté lista
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Enviar los datos locales desde el sistema de archivos
        sendLocalData();
    });

    // Abrir enlaces externos en el navegador
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:') || url.startsWith('http:')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    // Guardar datos periódicamente
    setInterval(saveLocalData, 30000);
}

// Enviar datos locales al renderer
function sendLocalData() {
    const dataPath = getDataPath();
    try {
        if (fs.existsSync(dataPath)) {
            const data = fs.readFileSync(dataPath, 'utf-8');
            mainWindow.webContents.send('local-data', data);
        }
    } catch (e) {
        console.warn('Error loading local data:', e.message);
    }
}

// Guardar datos locales
function saveLocalData() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('request-save');
}

// Ruta de datos persistente
function getDataPath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'securenotes-data.json');
}

function getSettingsPath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'securenotes-settings.json');
}

// IPC handlers
const { ipcMain } = require('electron');

ipcMain.handle('save-file', async (event, data) => {
    const dataPath = getDataPath();
    try {
        fs.writeFileSync(dataPath, data, 'utf-8');
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('load-file', async () => {
    const dataPath = getDataPath();
    try {
        if (fs.existsSync(dataPath)) {
            return fs.readFileSync(dataPath, 'utf-8');
        }
        return null;
    } catch (e) {
        return null;
    }
});

ipcMain.handle('save-settings', async (event, data) => {
    const settingsPath = getSettingsPath();
    try {
        fs.writeFileSync(settingsPath, data, 'utf-8');
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('load-settings', async () => {
    const settingsPath = getSettingsPath();
    try {
        if (fs.existsSync(settingsPath)) {
            return fs.readFileSync(settingsPath, 'utf-8');
        }
        return null;
    } catch (e) {
        return null;
    }
});

ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Exportar SecureNotes',
        defaultPath: `SecureNotes-backup-${new Date().toISOString().split('T')[0]}.json`,
        filters: [
            { name: 'JSON', extensions: ['json'] },
            { name: 'Todos los archivos', extensions: ['*'] }
        ],
        ...options
    });
    return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Importar SecureNotes',
        filters: [
            { name: 'JSON', extensions: ['json'] },
            { name: 'Todos los archivos', extensions: ['*'] }
        ],
        properties: ['openFile'],
        ...options
    });
    return result;
});

ipcMain.handle('write-file-dialog', async (event, filePath, data) => {
    try {
        fs.writeFileSync(filePath, data, 'utf-8');
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('read-file-dialog', async (event, filePath) => {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        return null;
    }
});

// Menú de aplicación
function createMenu() {
    const template = [
        {
            label: 'SecureNotes',
            submenu: [
                {
                    label: 'Acerca de SecureNotes',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Acerca de SecureNotes',
                            message: 'SecureNotes v2.0',
                            detail: 'Aplicación de notas seguras\nDesarrollado por PierceMyCode\n© 2026',
                            buttons: ['OK']
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Exportar datos...',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => mainWindow.webContents.send('menu-export')
                },
                {
                    label: 'Importar datos...',
                    accelerator: 'CmdOrCtrl+I',
                    click: () => mainWindow.webContents.send('menu-import')
                },
                { type: 'separator' },
                { role: 'quit', label: 'Salir' }
            ]
        },
        {
            label: 'Editar',
            submenu: [
                { role: 'undo', label: 'Deshacer' },
                { role: 'redo', label: 'Rehacer' },
                { type: 'separator' },
                { role: 'cut', label: 'Cortar' },
                { role: 'copy', label: 'Copiar' },
                { role: 'paste', label: 'Pegar' },
                { role: 'selectAll', label: 'Seleccionar todo' }
            ]
        },
        {
            label: 'Ver',
            submenu: [
                {
                    label: 'Recargar',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => mainWindow.reload()
                },
                { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
                { type: 'separator' },
                { role: 'zoomIn', label: 'Acercar' },
                { role: 'zoomOut', label: 'Alejar' },
                { role: 'resetZoom', label: 'Restablecer zoom' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Pantalla completa' }
            ]
        },
        {
            label: 'Ventana',
            submenu: [
                { role: 'minimize', label: 'Minimizar' },
                { role: 'zoom', label: 'Maximizar' },
                { role: 'close', label: 'Cerrar' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Eventos del ciclo de vida
app.whenReady().then(() => {
    createMenu();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async () => {
    // Forzar guardado antes de salir
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('save-before-quit');
        await new Promise(resolve => setTimeout(resolve, 500));
    }
});