import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import os from 'os';
import fs from 'fs';

// One-off migration: adds ANGLE_ID to PROGRESS_ANGLE, adds 135° angles, creates PROGRESS_POSE_ANGLE.
const dbPath = path.join(os.homedir(), '.config', 'health', 'database.db');
fs.copyFileSync(dbPath, `${dbPath}.bak-${Date.now()}`);

const db = new DatabaseSync(dbPath);
db.exec(`
BEGIN;
CREATE TABLE PROGRESS_ANGLE_NEW
(
    ANGLE_ID INTEGER primary key,
    ANGLE    TEXT not null unique
);
INSERT INTO PROGRESS_ANGLE_NEW (ANGLE_ID, ANGLE) VALUES
    (1, '135° Right'),
    (2, '90° Right'),
    (3, '45° Right'),
    (4, 'Front'),
    (5, '45° Left'),
    (6, '90° Left'),
    (7, '135° Left'),
    (8, 'Back');
INSERT INTO PROGRESS_ANGLE_NEW (ANGLE)
    SELECT ANGLE FROM PROGRESS_ANGLE WHERE ANGLE NOT IN (SELECT ANGLE FROM PROGRESS_ANGLE_NEW);
DROP TABLE PROGRESS_ANGLE;
ALTER TABLE PROGRESS_ANGLE_NEW RENAME TO PROGRESS_ANGLE;

CREATE TABLE PROGRESS_POSE_ANGLE
(
    POSE_ID  INTEGER not null references PROGRESS_POSE (pose_id) on delete cascade,
    ANGLE_ID INTEGER not null references PROGRESS_ANGLE (ANGLE_ID) on delete cascade,
    "ORDER"  INTEGER not null,
    primary key (POSE_ID, ANGLE_ID)
) WITHOUT ROWID;

-- Backfill with the angles that were previously visible (old ANGLE_ORDER minus hidden_angles)
INSERT INTO PROGRESS_POSE_ANGLE (POSE_ID, ANGLE_ID, "ORDER")
    SELECT p.pose_id, a.ANGLE_ID, a.ANGLE_ID
    FROM PROGRESS_POSE p CROSS JOIN PROGRESS_ANGLE a
    WHERE a.ANGLE IN ('90° Right', 'Front', '90° Left');
COMMIT;
`);
console.log(JSON.stringify(db.prepare('SELECT * FROM PROGRESS_ANGLE').all()));
console.log(JSON.stringify(db.prepare('SELECT * FROM PROGRESS_POSE_ANGLE').all()));
