import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import { settingsPath } from '../../db.js';
import { Settings, SettingsSection } from '../../../shared/types/index.js';

// Global settings object to ensure consistency
export let settings: Settings = {};

export const loadSettings = () => {
    settings = getSettings();
    return settings;
}

export const registerSettingsIpc = () => {
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
}

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

export const saveSettings = (win: BrowserWindow) => {
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