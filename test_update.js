
import { DatabaseSync } from 'node:sqlite';
const dbPath = '/home/quiet/.config/health/database.db';
const db = new DatabaseSync(dbPath);
const poseId = 1;
const newCrop = 150;
console.log(`Updating pose ${poseId} crop to ${newCrop}`);
const result = db.prepare('UPDATE PROGRESS_POSE SET cropping_percent = ? WHERE pose_id = ?').run(newCrop, poseId);
console.log('Update result:', result);
const updated = db.prepare('SELECT * FROM PROGRESS_POSE WHERE pose_id = ?').all();
console.log('Updated pose:', JSON.stringify(updated, null, 2));
process.exit(0);
