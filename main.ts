import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { ProgressPhotoDTO } from './src/models/database/ProgressPhotoDTO.js';
import { PoseDTO } from './src/models/database/PoseDTO.js';
import { Settings, SettingsSection } from './src/types/index.js';

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
db.exec('PRAGMA foreign_keys = ON');

app.whenReady().then(() => {
    settings = getSettings()
    getPhotoFiles()
    
    // Debug: Log all poses
    try {
        const rows = db.prepare('SELECT * FROM PROGRESS_POSE').all();
    } catch (e) {
        console.error('Failed to log poses:', e);
    }

    createWindow()
})

const createWindow = () => {
    const win = new BrowserWindow({
        width: settings.window?.width || 800,
        height: settings.window?.height || 600,
        x: settings.window?.x_pos,
        y: settings.window?.y_pos,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    })

    win.on('close', () => {
        saveSettings(win);
    });

    win.loadFile('index.html')
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
            SELECT p.PHOTO_ID, p.DATE, p.POSE_ID, p.ANGLE_ID, a.ANGLE, p.EXTENSION, p.Y_LANDMARK_1, p.Y_LANDMARK_2, p.X_LANDMARK
            FROM PROGRESS_PHOTO p
            LEFT JOIN PROGRESS_ANGLE a ON a.ANGLE_ID = p.ANGLE_ID
            ORDER BY p.DATE ASC, p.POSE_ID ASC, p.ANGLE_ID ASC
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
            SELECT pose_id, pose_name, cropping_percent, aspect_ratio, vertical_offset, horizontal_offset, collection_size, single_size, y_landmark_1, y_landmark_2, x_landmark
            FROM PROGRESS_POSE 
            ORDER BY pose_name ASC
        `).all();
        const angleRows = db.prepare(`
            SELECT pa.POSE_ID, a.ANGLE_ID, a.ANGLE, pa."ORDER"
            FROM PROGRESS_POSE_ANGLE pa
            JOIN PROGRESS_ANGLE a ON a.ANGLE_ID = pa.ANGLE_ID
            ORDER BY pa.POSE_ID ASC, pa."ORDER" ASC
        `).all() as any[];
        return rows.map((row: any) => PoseDTO.fromDatabase({
            ...row,
            angles: angleRows
                .filter(a => a.POSE_ID === row.pose_id)
                .map(a => ({ angleId: a.ANGLE_ID, angle: a.ANGLE, order: a.ORDER }))
        }));
    } catch (e) {
        console.error('Error fetching progress poses:', e);
        return [];
    }
});

ipcMain.handle('get-progress-angles', async () => {
    try {
        const rows = db.prepare('SELECT ANGLE_ID, ANGLE FROM PROGRESS_ANGLE ORDER BY ANGLE_ID ASC').all() as any[];
        return rows.map(row => ({ angleId: row.ANGLE_ID, angle: row.ANGLE }));
    } catch (e) {
        console.error('Error fetching progress angles:', e);
        return [];
    }
});

ipcMain.handle('set-pose-angle-enabled', async (event, poseId: number, angleId: number, enabled: boolean) => {
    try {
        if (enabled) {
            // Newly enabled angles are appended to the end of the pose's order
            db.prepare(`
                INSERT OR IGNORE INTO PROGRESS_POSE_ANGLE (POSE_ID, ANGLE_ID, "ORDER")
                SELECT ?, ?, COALESCE(MAX("ORDER"), 0) + 1 FROM PROGRESS_POSE_ANGLE WHERE POSE_ID = ?
            `).run(poseId, angleId, poseId);
        } else {
            db.prepare('DELETE FROM PROGRESS_POSE_ANGLE WHERE POSE_ID = ? AND ANGLE_ID = ?').run(poseId, angleId);
        }
        return true;
    } catch (e) {
        console.error(`Failed to set angle ${angleId} for pose ${poseId}:`, e);
        return false;
    }
});

const LANDMARK_COLUMNS: Record<string, string> = {
    yLandmark1: 'Y_LANDMARK_1',
    yLandmark2: 'Y_LANDMARK_2',
    xLandmark: 'X_LANDMARK'
};

ipcMain.handle('update-photo-landmark', async (event, photoId: number, landmark: string, value: number) => {
    try {
        const column = LANDMARK_COLUMNS[landmark];
        if (!column) throw new Error(`Unknown landmark ${landmark}`);
        db.prepare(`UPDATE PROGRESS_PHOTO SET ${column} = ? WHERE PHOTO_ID = ?`).run(value, photoId);
        return true;
    } catch (e) {
        console.error(`Failed to update ${landmark} for photo ${photoId}:`, e);
        return false;
    }
});

// ---------- Setting management ----------

ipcMain.handle('get-settings', async () => {
    return getSettings();
});

ipcMain.handle('update-setting', async (event, section: SettingsSection, key: string, value: any) => {
    try {
        const sectionSettings: Record<string, any> = settings[section] ?? {};
        sectionSettings[key] = value;
        (settings as Record<string, any>)[section] = sectionSettings;
        writeSettings();
        return true;
    } catch (e) {
        console.error(`Failed to update setting ${section}.${key}:`, e);
        return false;
    }
});

ipcMain.handle('update-pose-settings', async (event, poseId, poseSettings) => {
    try {
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
        if (poseSettings.verticalOffset !== undefined) {
            fields.push('vertical_offset = ?');
            values.push(poseSettings.verticalOffset);
        }
        if (poseSettings.horizontalOffset !== undefined) {
            fields.push('horizontal_offset = ?');
            values.push(poseSettings.horizontalOffset);
        }
        if (poseSettings.collectionSize !== undefined) {
            fields.push('collection_size = ?');
            values.push(poseSettings.collectionSize);
        }
        if (poseSettings.singleSize !== undefined) {
            fields.push('single_size = ?');
            values.push(poseSettings.singleSize);
        }

        if (poseSettings.yLandmark1Label !== undefined) {
            fields.push('y_landmark_1 = ?');
            values.push(poseSettings.yLandmark1Label);
        }
        if (poseSettings.yLandmark2Label !== undefined) {
            fields.push('y_landmark_2 = ?');
            values.push(poseSettings.yLandmark2Label);
        }
        if (poseSettings.xLandmarkLabel !== undefined) {
            fields.push('x_landmark = ?');
            values.push(poseSettings.xLandmarkLabel);
        }

        if (fields.length === 0) return true;

        values.push(poseId);
        const query = `UPDATE PROGRESS_POSE SET ${fields.join(', ')} WHERE pose_id = ?`;
        const result = db.prepare(query).run(...values);
        return true;
    } catch (e) {
        console.error(`Failed to update pose settings for ${poseId}:`, e);
        return false;
    }
});

const writeSettings = () => {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
}

// Moves legacy flat keys (e.g. "window_width", "progress_photo_size") into their nested sections
const migrateSettings = (raw: Record<string, any>): { migrated: Settings, changed: boolean } => {
    const migrated: Record<string, any> = { ...raw };
    let changed = false;
    const prefixes: Record<string, SettingsSection> = { window_: 'window', progress_photo_: 'progress_photo' };

    for (const key of Object.keys(raw)) {
        const prefix = Object.keys(prefixes).find(p => key.startsWith(p));
        if (!prefix) continue;
        const section = prefixes[prefix];
        migrated[section] = { ...(migrated[section] ?? {}) };
        const subKey = key.slice(prefix.length);
        if (migrated[section][subKey] === undefined) {
            migrated[section][subKey] = raw[key];
        }
        delete migrated[key];
        changed = true;
    }
    return { migrated, changed };
}

const getSettings = (): Settings => {
    let settings: Settings = {}
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            const { migrated, changed } = migrateSettings(JSON.parse(data));
            settings = migrated;
            if (changed) {
                fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
            }
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
        settings.window = {
            ...settings.window,
            width: bounds.width,
            height: bounds.height,
            x_pos: bounds.x,
            y_pos: bounds.y
        };
        writeSettings();
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
}