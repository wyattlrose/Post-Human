import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { registerPhotoProtocol, registerProgressPhotoIpc } from './features/progress-photos/progress-photos.ipc.js';
import { registerPoseIpc } from './features/poses/poses.ipc.js';
import { registerBiometricsIpc } from './features/biometrics/biometrics.ipc.js';
import { getSettings, registerSettingsIpc, updateSetting } from './features/settings/settings.js';
import { closeWithingsCallbackServer, registerWithingsIpc, startWithingsCallbackServer, syncWithingsOnStartup } from './features/withings/withings.ipc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

registerProgressPhotoIpc()
registerPoseIpc()
registerBiometricsIpc()
registerSettingsIpc()
registerWithingsIpc()

app.whenReady().then(() => {
    startWithingsCallbackServer()
    void syncWithingsOnStartup()
    registerPhotoProtocol()
    createWindow()
})

app.on('will-quit', closeWithingsCallbackServer)

const createWindow = () => {
    const windowSettings = getSettings().window;
    const win = new BrowserWindow({
        width: windowSettings?.width || 800,
        height: windowSettings?.height || 600,
        x: windowSettings?.x_pos,
        y: windowSettings?.y_pos,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    })

    //win.removeMenu()

    win.on('close', () => {
        try {
            const bounds = win.getBounds();
            updateSetting('window', 'width', bounds.width);
            updateSetting('window', 'height', bounds.height);
            updateSetting('window', 'x_pos', bounds.x);
            updateSetting('window', 'y_pos', bounds.y);
        } catch (error) {
            console.error('Failed to save window settings:', error);
        }
    });

    win.loadFile('src/renderer/index.html')
}
