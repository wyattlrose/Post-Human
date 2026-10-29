import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseSync } from 'node:sqlite';

// File and directory paths
export const userDataPath = app.getPath('userData')
export const dbPath = path.join(userDataPath, 'database.db');
export const settingsPath = path.join(userDataPath, 'settings.json');
export const photosDir = path.join(userDataPath, 'progress_photos');

// Ensure photos directory exists
if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');
