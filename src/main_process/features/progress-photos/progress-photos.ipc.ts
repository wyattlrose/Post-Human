import { ipcMain, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { db, photosDir } from '../../db.js';
import { ProgressPhotoDTO } from '../../../shared/models/ProgressPhotoDTO.js';

const LANDMARK_COLUMNS: Record<string, string> = {
    yLandmark1: 'Y_LANDMARK_1',
    yLandmark2: 'Y_LANDMARK_2',
    xLandmark: 'X_LANDMARK'
};

// Serves files from the photos directory via photo://<file>
export const registerPhotoProtocol = () => {
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

export const registerProgressPhotoIpc = () => {
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

    // Inserts each photo and writes its file as <photoId>.<extension>; all or nothing
    ipcMain.handle('save-progress-photos', async (event, photos: {date: number, poseId: number, angleId: number, extension: string, yLandmark1: number, yLandmark2: number, xLandmark: number, data: Uint8Array}[]) => {
        const written: string[] = [];
        try {
            db.exec('BEGIN');
            const insert = db.prepare('INSERT INTO PROGRESS_PHOTO (DATE, POSE_ID, ANGLE_ID, EXTENSION, Y_LANDMARK_1, Y_LANDMARK_2, X_LANDMARK) VALUES (?, ?, ?, ?, ?, ?, ?)');
            for (const p of photos) {
                const result = insert.run(p.date, p.poseId, p.angleId, p.extension, p.yLandmark1, p.yLandmark2, p.xLandmark);
                const filePath = path.join(photosDir, `${result.lastInsertRowid}.${p.extension}`);
                fs.writeFileSync(filePath, Buffer.from(p.data), {flag: 'wx'});
                written.push(filePath);
            }
            db.exec('COMMIT');
            return {success: true};
        } catch (e) {
            try { db.exec('ROLLBACK'); } catch { /* not in a transaction */ }
            written.forEach(f => { try { fs.unlinkSync(f); } catch { /* ignore */ } });
            console.error('Failed to save progress photos:', e);
            return {success: false, error: String(e)};
        }
    });

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

    ipcMain.handle('update-photo-angle', async (event, photoId: number, angleId: number) => {
        try {
            db.prepare('UPDATE PROGRESS_PHOTO SET ANGLE_ID = ? WHERE PHOTO_ID = ?').run(angleId, photoId);
            return true;
        } catch (e) {
            console.error(`Failed to update angle for photo ${photoId}:`, e);
            return false;
        }
    });

    // Deletes the row and its file in photo storage
    ipcMain.handle('delete-progress-photo', async (event, photoId: number) => {
        try {
            const row = db.prepare('SELECT EXTENSION FROM PROGRESS_PHOTO WHERE PHOTO_ID = ?').get(photoId) as {EXTENSION: string} | undefined;
            if (!row) return false;
            db.prepare('DELETE FROM PROGRESS_PHOTO WHERE PHOTO_ID = ?').run(photoId);
            try { fs.unlinkSync(path.join(photosDir, `${photoId}.${row.EXTENSION}`)); } catch { /* file already missing */ }
            return true;
        } catch (e) {
            console.error(`Failed to delete photo ${photoId}:`, e);
            return false;
        }
    });
}
