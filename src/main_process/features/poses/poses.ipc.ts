import { ipcMain } from 'electron';
import { db } from '../../db.js';
import { PoseDTO } from '../../../shared/models/PoseDTO.js';

export const registerPoseIpc = () => {
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
}
