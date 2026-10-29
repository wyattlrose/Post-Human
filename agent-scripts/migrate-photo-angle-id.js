import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import os from 'os';
import fs from 'fs';

// One-off migration: replaces PROGRESS_PHOTO.ANGLE (text) with ANGLE_ID (FK to PROGRESS_ANGLE).
const dbPath = path.join(os.homedir(), '.config', 'health', 'database.db');
fs.copyFileSync(dbPath, `${dbPath}.bak-${Date.now()}`);

const db = new DatabaseSync(dbPath);
const unmapped = db.prepare(`
    SELECT COUNT(*) AS c FROM PROGRESS_PHOTO
    WHERE ANGLE IS NOT NULL AND ANGLE NOT IN (SELECT ANGLE FROM PROGRESS_ANGLE)
`).get();
if (unmapped.c > 0) throw new Error(`${unmapped.c} photos have an angle not in PROGRESS_ANGLE`);

const before = db.prepare('SELECT COUNT(*) AS c FROM PROGRESS_PHOTO').get().c;

db.exec(`
BEGIN;
CREATE TABLE PROGRESS_PHOTO_NEW
(
    PHOTO_ID     INTEGER primary key,
    DATE         INTEGER,
    POSE_ID      INTEGER,
    ANGLE_ID     INTEGER references PROGRESS_ANGLE (ANGLE_ID),
    EXTENSION    TEXT,
    Y_LANDMARK_1 REAL,
    Y_LANDMARK_2 REAL,
    X_LANDMARK   REAL,
    unique (DATE, POSE_ID, ANGLE_ID)
);
INSERT INTO PROGRESS_PHOTO_NEW (PHOTO_ID, DATE, POSE_ID, ANGLE_ID, EXTENSION, Y_LANDMARK_1, Y_LANDMARK_2, X_LANDMARK)
    SELECT p.PHOTO_ID, p.DATE, p.POSE_ID, a.ANGLE_ID, p.EXTENSION, p.Y_LANDMARK_1, p.Y_LANDMARK_2, p.X_LANDMARK
    FROM PROGRESS_PHOTO p LEFT JOIN PROGRESS_ANGLE a ON a.ANGLE = p.ANGLE;
DROP TABLE PROGRESS_PHOTO;
ALTER TABLE PROGRESS_PHOTO_NEW RENAME TO PROGRESS_PHOTO;
COMMIT;
`);

const after = db.prepare('SELECT COUNT(*) AS c FROM PROGRESS_PHOTO').get().c;
console.log(JSON.stringify({ before, after }));
console.log(JSON.stringify(db.prepare('PRAGMA foreign_key_check(PROGRESS_PHOTO)').all()));
console.log(JSON.stringify(db.prepare('SELECT ANGLE_ID, COUNT(*) c FROM PROGRESS_PHOTO GROUP BY ANGLE_ID').all()));
