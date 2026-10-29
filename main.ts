import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { ProgressPhotoDTO } from './src/models/database/ProgressPhotoDTO.js';
import { PoseDTO } from './src/models/database/PoseDTO.js';
import { Settings } from './src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File and directory paths
const userDataPath = app.getPath('userData')
const dbPath = path.join(userDataPath, 'database.db');
const settingsPath = path.join(userDataPath, 'settings.json');
const photosDir = path.join(userDataPath, 'progress_photos');

// Global settings object to ensure consistency
let settings: Settings = {};

// Ensure photos directory exists
if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
}

// json containing application-wide settings
const db = new DatabaseSync(dbPath);

app.whenReady().then(() => {
    settings = getSettings()
    getPhotoFiles()
    
    // Debug: Log all poses
    try {
        const rows = db.prepare('SELECT * FROM PROGRESS_POSE').all();
        console.log('All Poses in DB:', JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error('Failed to log poses:', e);
    }

    createWindow()
})

const createWindow = () => {
    const win = new BrowserWindow({
        width: settings?.window_width || 800,
        height: settings?.window_height || 600,
        x: settings?.window_x_pos,
        y: settings?.window_y_pos,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    })

    win.on('close', () => {
        saveSettings(win);
    });

    win.loadFile('index.html').then(r => console.log("Loaded index.html"))
}

// ---------- File Management ----------

const getPhotoFiles = () => {
    protocol.handle('photo', (request) => {
        const url = new URL(request.url);
        let fileName = decodeURIComponent(url.hostname + url.pathname);
        if (fileName.endsWith('/')) {
            fileName = fileName.slice(0, -1);
        }
        const filePath = path.join(photosDir, fileName);
        return net.fetch('file://' + filePath);
    });
}

// ---------- Database Queries ----------

ipcMain.handle('get-progress-photos', async () => {
    try {
        const rows = db.prepare(`
            SELECT PHOTO_ID, DATE, POSE_ID, ANGLE, EXTENSION, Y_LANDMARK_1, Y_LANDMARK_2, X_LANDMARK
            FROM PROGRESS_PHOTO 
            ORDER BY DATE ASC, POSE_ID ASC, ANGLE ASC
        `).all();
        return rows.map(row => ProgressPhotoDTO.fromDatabase(row));
    } catch (e) {
        console.error('Error fetching progress photos:', e);
        return [];
    }
});

ipcMain.handle('get-progress-poses', async () => {
    try {
        const rows = db.prepare(`
            SELECT pose_id, pose_name, cropping_percent, aspect_ratio, collection_size, single_size
            FROM PROGRESS_POSE 
            ORDER BY pose_name ASC
        `).all();
        return rows.map(row => PoseDTO.fromDatabase(row));
    } catch (e) {
        console.error('Error fetching progress poses:', e);
        return [];
    }
});

// ---------- Setting management ----------

ipcMain.handle('get-settings', async () => {
    return getSettings();
});

ipcMain.handle('update-setting', async (event, key, value) => {
    try {
        settings[key] = value;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error(`Failed to update setting ${key}:`, e);
        return false;
    }
});

ipcMain.handle('update-pose-settings', async (event, poseId, poseSettings) => {
    try {
        console.log(`Updating pose settings for poseId: ${poseId}`, poseSettings);
        const fields = [];
        const values = [];
        
        if (poseSettings.croppingPercent !== undefined) {
            fields.push('cropping_percent = ?');
            values.push(poseSettings.croppingPercent);
        }
        if (poseSettings.aspectRatio !== undefined) {
            fields.push('aspect_ratio = ?');
            values.push(poseSettings.aspectRatio);
        }
        if (poseSettings.collectionSize !== undefined) {
            fields.push('collection_size = ?');
            values.push(poseSettings.collectionSize);
        }
        if (poseSettings.singleSize !== undefined) {
            fields.push('single_size = ?');
            values.push(poseSettings.singleSize);
        }

        if (fields.length === 0) return true;

        values.push(poseId);
        const query = `UPDATE PROGRESS_POSE SET ${fields.join(', ')} WHERE pose_id = ?`;
        console.log(`Executing query: ${query} with values:`, values);
        const result = db.prepare(query).run(...values);
        console.log('Update result:', result);
        return true;
    } catch (e) {
        console.error(`Failed to update pose settings for ${poseId}:`, e);
        return false;
    }
});

const getSettings = (): Settings => {
    let settings: Settings = {}
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            settings = JSON.parse(data);
            console.log('Settings: \n', settings);
        } else {
            console.log('Settings file not found at:', settingsPath);
        }
    } catch (err) {
        console.error('Error reading settings file:', err);
    }
    return settings;
}

const saveSettings = (win: BrowserWindow) => {
    try {
        const bounds = win.getBounds();
        settings.window_width = bounds.width;
        settings.window_height = bounds.height;
        settings.window_x_pos = bounds.x;
        settings.window_y_pos = bounds.y;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
}