import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the database
const dbPath = path.join(os.homedir(), '.config', 'health', 'database.db');

try {
    const db = new DatabaseSync(dbPath);
    const sql = process.argv[2];

    if (!sql) {
        console.error('Usage: ELECTRON_RUN_AS_NODE=1 electron db-shell.js "SELECT * FROM table"');
        process.exit(1);
    }

    if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const rows = db.prepare(sql).all();
        console.log(JSON.stringify(rows, null, 2));
    } else {
        const result = db.prepare(sql).run();
        console.log(JSON.stringify(result, null, 2));
    }
} catch (err) {
    console.error('Database Error:', err.message);
    process.exit(1);
}
