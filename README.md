# health

Electron desktop app for tracking progress photos.

## Requirements (Linux)

- Node.js (with npm) — a recent LTS release
- git

## Install

```bash
git clone <repo-url> post-human
cd post-human
npm install
```

## Build

Compiles TypeScript into `dist/`:

```bash
npm run build
```

## Run

Builds and then launches the app:

```bash
npm start
```

## Data location

- Database: `~/.config/health/database.db`
- Photos: `~/.config/health/progress_photos/`

The app does not create the database tables itself, so on a new machine copy an existing `~/.config/health/` folder over.

## Querying the database

```bash
npm run db -- "SELECT * FROM PROGRESS_POSE"
```

## Package for Ubuntu (.deb / AppImage)

```bash
npm run dist
```

Output goes to `release/`:

- Install the deb: `sudo apt install ./release/health_1.0.0_amd64.deb` (then launch "health" from the app menu, or run `health`)
- Or run the AppImage directly: `chmod +x release/health-1.0.0.AppImage && ./release/health-1.0.0.AppImage`

Uninstall the deb with `sudo apt remove health`. Your data in `~/.config/health/` is kept.
