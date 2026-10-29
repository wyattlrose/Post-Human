# Project Guidelines for Database Interaction

This project uses a custom script to interact with its SQLite database, as standard `node:sqlite` is only available in the Electron environment and the `sqlite3` CLI might not be installed.

## Database Location
The database is located at: `~/.config/health/database.db`

## How to interact with the Database

### Recommended Method: NPM
You can run SQL queries directly using the `db` script in `package.json`:

```bash
npm run db -- "SELECT * FROM PROGRESS_POSE"
```

### Technical Note: Underlying Mechanism
The `db` script executes `agent-scripts/db-shell.js` using Electron in Node.js mode. 
If you ever need to run it manually without `npm`, you **must** set `ELECTRON_RUN_AS_NODE=1` to prevent Electron from opening a GUI window, which will hang in this environment:

```bash
ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron agent-scripts/db-shell.js "YOUR SQL QUERY"
```

## Important Notes
- The `db-shell.js` script outputs results in JSON format.
- For `SELECT` queries, it returns an array of objects.
- For other queries (INSERT, UPDATE, DELETE), it returns the result object from `node:sqlite`.
- Always use these methods instead of trying to find `sqlite3` on the system path.
