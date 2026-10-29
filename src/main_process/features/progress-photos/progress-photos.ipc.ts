import { ipcMain, protocol, net } from 'electron';
import * as path from 'path';
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
}
