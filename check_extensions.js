const {DatabaseSync} = require('node:sqlite');
const path = require('path');
const os = require('os');
const dbPath = path.join(os.homedir(), '.config/posthuman/database.db');
const db = new DatabaseSync(dbPath);
const photos = db.prepare('SELECT PHOTO_ID, EXTENSION FROM PROGRESS_PHOTO').all();
console.log(JSON.stringify(photos, null, 2));
