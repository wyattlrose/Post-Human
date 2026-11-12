import {ipcMain} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {settingsPath} from '../../db.js';
import {Settings, SettingsSection} from '../../../shared/types/index.js';

let settings: Settings | null = null;

export const getSettings = (): Settings => {
    if (settings === null) {
        settings = readSettingsFile();
    }
    return settings;
}

export const updateSetting = <S extends SettingsSection, K extends keyof NonNullable<Settings[S]>>(
    section: S,
    key: K,
    value: NonNullable<Settings[S]>[K]
): boolean => {
    try {
        const currentSettings = getSettings();
        const updatedSettings: Settings = {...currentSettings};
        const updatedSection = {...currentSettings[section], [key]: value};
        Object.assign(updatedSettings, {[section]: updatedSection});
        writeSettingsFile(updatedSettings);
        settings = updatedSettings;
        return true;
    } catch (e) {
        console.error(`Failed to update setting ${section}.${String(key)}:`, e);
        return false;
    }
}

export const registerSettingsIpc = () => {
    ipcMain.handle('get-settings', async () => {
        return getSettings();
    });

    ipcMain.handle('update-setting', async (_event, section: SettingsSection, key: string, value: unknown) => {
        return updateSetting(section, key as keyof NonNullable<Settings[typeof section]>, value as never);
    });
}

const writeSettingsFile = (data: Settings) => {
    const temporaryPath = `${settingsPath}.tmp`;
    let fileDescriptor: number | undefined;
    try {
        fileDescriptor = fs.openSync(temporaryPath, 'w', 0o600);
        fs.writeFileSync(fileDescriptor, JSON.stringify(data, null, 2), 'utf8');
        fs.fchmodSync(fileDescriptor, 0o600);
        fs.fsyncSync(fileDescriptor);
        fs.closeSync(fileDescriptor);
        fileDescriptor = undefined;
        fs.renameSync(temporaryPath, settingsPath);

        try {
            const directoryDescriptor = fs.openSync(path.dirname(settingsPath), 'r');
            try {
                fs.fsyncSync(directoryDescriptor);
            } finally {
                fs.closeSync(directoryDescriptor);
            }
        } catch {
            // Directory fsync is not supported on every platform/filesystem.
        }
    } catch (error) {
        if (fileDescriptor !== undefined) {
            try {
                fs.closeSync(fileDescriptor);
            } catch {
                // Preserve the original write error.
            }
        }
        try {
            fs.unlinkSync(temporaryPath);
        } catch {
            // The temporary file may not have been created or may already be renamed.
        }
        throw error;
    }
}

const readSettingsFile = (): Settings => {
    let settings: Settings = {}
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            settings = JSON.parse(data);
            console.log('Settings:' + settingsPath + ' \n', settings);
        } else {
            console.log('Settings file not found at:', settingsPath);
        }
    } catch (err) {
        console.error('Error reading settings file:', err);
    }
    return settings;
}