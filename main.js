const {app, BrowserWindow, ipcMain, protocol, net} = require('electron')
const path = require("path");
const fs = require('fs')
const {DatabaseSync} = require('node:sqlite');

// File and directory paths
const userDataPath = app.getPath('userData')
const dbPath = path.join(userDataPath, 'database.db');
const settingsPath = path.join(userDataPath, 'settings.json');
const photosDir = path.join(userDataPath, 'progress_photos');

// Global settings object to ensure consistency
let settings = {};

// Ensure photos directory exists
if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
}

// json containing application-wide settings
const db = new DatabaseSync(dbPath);

app.whenReady().then(() => {
    settings = getSettings()
    getPhotoFiles()
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
            preload: path.join(__dirname, 'preload.js')
        }
    })

    win.on('close', () => {
        saveSettings(win);
    });

    win.loadFile('index.html').then(r => console.log("Loaded index.html"))
}

// ---------- File Management ----------

getPhotoFiles = () => {
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
        const photos = db.prepare(`
            SELECT PHOTO_ID, DATE, POSE_ID, ANGLE, EXTENSION, Y_LANDMARK_1, Y_LANDMARK_2, X_LANDMARK
            FROM PROGRESS_PHOTO 
            ORDER BY DATE ASC, POSE_ID ASC, ANGLE ASC
        `).all();
        return photos;
    } catch (e) {
        console.error('Error fetching progress photos:', e);
        return [];
    }
});

ipcMain.handle('get-progress-poses', async () => {
    try {
        const poses = db.prepare(`
            SELECT pose_id, pose_name, cropping_percent, aspect_ratio, collection_size, single_size
            FROM PROGRESS_POSE 
            ORDER BY pose_name ASC
        `).all();
        return poses;
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

const getSettings = () => {
    let settings = {}
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

const saveSettings = (win) => {
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