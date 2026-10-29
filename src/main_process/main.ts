import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { registerPhotoProtocol, registerProgressPhotoIpc } from './features/progress-photos/progress-photos.ipc.js';
import { registerPoseIpc } from './features/poses/poses.ipc.js';
import { loadSettings, registerSettingsIpc, saveSettings, settings } from './features/settings/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

registerProgressPhotoIpc()
registerPoseIpc()
registerSettingsIpc()

app.whenReady().then(() => {
    loadSettings()
    registerPhotoProtocol()
    createWindow()
})

const createWindow = () => {
    const win = new BrowserWindow({
        width: settings.window?.width || 800,
        height: settings.window?.height || 600,
        x: settings.window?.x_pos,
        y: settings.window?.y_pos,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    })

    win.removeMenu()

    win.on('close', () => {
        saveSettings(win);
    });

    win.loadFile('src/renderer/index.html')
}
