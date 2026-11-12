import { ipcMain } from 'electron';
import { db } from '../../db.js';
import type { BiometricEffort, BiometricWeight, EffortType, EffortUpdate } from '../../../shared/types/index.js';

// Weight in KG keyed by its measurement date (Unix timestamp in seconds).
const WEIGHT_TABLE_SQL = (name: string) => `CREATE TABLE IF NOT EXISTS ${name} (
    weight REAL NOT NULL,
    date   INTEGER PRIMARY KEY NOT NULL
)`;

// Older databases have biometric_weight without a key on date; rebuild it keeping the latest row per date
const weightColumns = db.prepare('PRAGMA table_info(biometric_weight)').all() as { name: string; pk: number }[];
if (weightColumns.length && !weightColumns.some(c => c.name === 'date' && c.pk)) {
    db.exec('BEGIN');
    try {
        db.exec(WEIGHT_TABLE_SQL('biometric_weight_new'));
        db.exec(`INSERT INTO biometric_weight_new (weight, date)
            SELECT weight, date FROM biometric_weight
            WHERE rowid IN (SELECT MAX(rowid) FROM biometric_weight GROUP BY date)`);
        db.exec('DROP TABLE biometric_weight');
        db.exec('ALTER TABLE biometric_weight_new RENAME TO biometric_weight');
        db.exec('COMMIT');
    } catch (e) {
        db.exec('ROLLBACK');
        throw e;
    }
}
db.exec(WEIGHT_TABLE_SQL('biometric_weight'));

/** Inserts weights, overwriting the weight of any row with the same date. Returns the number of rows written. */
export const upsertBiometricWeights = (weights: BiometricWeight[]): number => {
    const upsert = db.prepare(`INSERT INTO biometric_weight (weight, date) VALUES (?, ?)
        ON CONFLICT(date) DO UPDATE SET weight = excluded.weight`);
    db.exec('BEGIN');
    try {
        for (const { weight, date } of weights) upsert.run(weight, date);
        db.exec('COMMIT');
    } catch (e) {
        db.exec('ROLLBACK');
        throw e;
    }
    return weights.length;
};

db.exec(`CREATE TABLE IF NOT EXISTS EFFORT_TYPE (
    "KEY"  INTEGER PRIMARY KEY,
    "TEXT" TEXT NOT NULL
)`);
db.exec(`INSERT OR IGNORE INTO EFFORT_TYPE ("KEY", "TEXT") VALUES (1, 'Bulk'), (2, 'Cut'), (3, 'Maintain')`);

// Efforts (cut/bulk/maintain cycles). START_DATE is a Unix timestamp in seconds;
// an effort lasts until the next effort's START_DATE (or today when it is the latest).
db.exec(`CREATE TABLE IF NOT EXISTS CURRENT_EFFORT (
    EFFORT_ID   INTEGER PRIMARY KEY,
    START_DATE  INTEGER NOT NULL,
    TYPE        INTEGER NOT NULL REFERENCES EFFORT_TYPE ("KEY"),
    DESCRIPTION TEXT
)`);

const EFFORT_SELECT = 'SELECT EFFORT_ID, START_DATE, TYPE, DESCRIPTION FROM CURRENT_EFFORT';

const toEffort = (row: any): BiometricEffort => ({
    effortId: row.EFFORT_ID,
    startDate: row.START_DATE,
    typeKey: row.TYPE,
    description: row.DESCRIPTION ?? ''
});

export const registerBiometricsIpc = () => {
    ipcMain.handle('get-biometric-weight', async () => {
        try {
            const rows = db.prepare('SELECT weight, date FROM biometric_weight ORDER BY date ASC').all() as any[];
            return rows.map(row => ({ weight: row.weight, date: row.date }));
        } catch (e) {
            console.error('Error fetching biometric weight:', e);
            return [];
        }
    });

    ipcMain.handle('get-effort-types', async () => {
        try {
            const rows = db.prepare('SELECT "KEY", "TEXT" FROM EFFORT_TYPE ORDER BY "KEY"').all() as any[];
            return rows.map((row): EffortType => ({ key: row.KEY, text: row.TEXT }));
        } catch (e) {
            console.error('Error fetching effort types:', e);
            return [];
        }
    });

    ipcMain.handle('get-biometric-efforts', async () => {
        try {
            const rows = db.prepare(`${EFFORT_SELECT} ORDER BY START_DATE ASC, EFFORT_ID ASC`).all() as any[];
            return rows.map(toEffort);
        } catch (e) {
            console.error('Error fetching biometric efforts:', e);
            return [];
        }
    });

    ipcMain.handle('create-biometric-effort', async (_event, startDate: number, typeKey: number, description: string) => {
        try {
            const result = db.prepare('INSERT INTO CURRENT_EFFORT (START_DATE, TYPE, DESCRIPTION) VALUES (?, ?, ?)')
                .run(startDate, typeKey, description);
            return toEffort(db.prepare(`${EFFORT_SELECT} WHERE EFFORT_ID = ?`).get(result.lastInsertRowid));
        } catch (e) {
            console.error('Error creating biometric effort:', e);
            return null;
        }
    });

    ipcMain.handle('update-biometric-effort', async (_event, effortId: number, update: EffortUpdate) => {
        const columns: Record<keyof EffortUpdate, string> = { startDate: 'START_DATE', typeKey: 'TYPE', description: 'DESCRIPTION' };
        const entries = (Object.keys(columns) as (keyof EffortUpdate)[]).filter(k => update[k] !== undefined);
        if (!entries.length) return false;
        try {
            const sets = entries.map(k => `${columns[k]} = ?`).join(', ');
            const result = db.prepare(`UPDATE CURRENT_EFFORT SET ${sets} WHERE EFFORT_ID = ?`)
                .run(...entries.map(k => update[k] as number | string), effortId);
            return result.changes > 0;
        } catch (e) {
            console.error('Error updating biometric effort:', e);
            return false;
        }
    });
};
