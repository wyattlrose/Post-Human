const {app, BrowserWindow, ipcMain} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
    const win = new BrowserWindow({
        width: 900,
        height: 800,
        show: false,
        webPreferences: {contextIsolation: false, nodeIntegration: false, backgroundThrottling: false}
    });
    let tempDir;
    let realWindow;
    let database;
    let exitCode = 0;
    try {
        await win.loadFile(path.join(__dirname, '../src/renderer/index.html'));
        await win.webContents.executeJavaScript(`(async () => {
            const assert = (condition, message) => { if (!condition) throw new Error(message); };
            const clone = value => JSON.parse(JSON.stringify(value));
            const waitFor = async (condition, message) => {
                for (let i = 0; i < 100; i++) {
                    if (condition()) return;
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                assert(false, typeof message === 'function' ? message() : message);
            };
            const localSeconds = date => Math.floor(date.getTime() / 1000);
            const persisted = {
                biometrics: {
                    idealBmiUpperBound: 27,
                    idealBmiLowerBound: 24,
                    height: 180,
                    dateOfBirth: localSeconds(new Date(1992, 4, 6)),
                    sex: 'F'
                }
            };
            let getSettings = async () => clone(persisted);
            let updateCalls = 0;
            let failNextUpdate = false;
            let delayNextUpdate = false;
            let resolveUpdate;
            const api = {
                getSettings: () => getSettings(),
                updateSetting: async (section, key, value) => {
                    updateCalls++;
                    if (delayNextUpdate) {
                        delayNextUpdate = false;
                        await new Promise(resolve => { resolveUpdate = resolve; });
                    }
                    if (failNextUpdate) {
                        failNextUpdate = false;
                        return false;
                    }
                    persisted[section] ??= {};
                    if (value === undefined) delete persisted[section][key];
                    else persisted[section][key] = value;
                    return true;
                },
                getProgressPhotos: async () => [],
                getProgressPoses: async () => [],
                getProgressAngles: async () => []
            };
            window.api = api;

            await waitFor(() => document.getElementById('dash-settings') && document.getElementById('dash-integrations'),
                'settings navigation icons were not created');
            const settingsIcon = document.getElementById('dash-settings');
            const integrationsIcon = document.getElementById('dash-integrations');
            await waitFor(() => document.getElementById('dash-photos')?.classList.contains('active'),
                'initial sidebar navigation did not complete');
            const settingsRect = settingsIcon.getBoundingClientRect();
            const integrationsRect = integrationsIcon.getBoundingClientRect();
            assert(settingsRect.top < integrationsRect.top,
                'Settings is not visually above Integrations in the bottom sidebar group');

            let resolveInitialLoad;
            getSettings = () => new Promise(resolve => { resolveInitialLoad = () => resolve(clone(persisted)); });
            settingsIcon.click();
            await waitFor(() => document.querySelector('.settings-dashboard'), 'Settings page did not open');
            const fields = [...document.querySelectorAll('.settings-dashboard [data-setting]')];
            assert(fields.length === 5 && fields.every(input => input.disabled),
                'biometrics fields should be present and disabled while settings load');
            assert(document.querySelector('.settings-dashboard .date-input-text')?.disabled &&
                document.querySelector('.settings-dashboard .date-input-picker')?.disabled,
                'date input text and picker were not disabled while settings load');
            resolveInitialLoad();
            getSettings = async () => clone(persisted);
            await waitFor(() => fields.every(input => !input.disabled), 'biometrics fields did not enable after loading');
            const field = key => document.querySelector('[data-setting="' + key + '"]');
            const status = () => document.querySelector('.settings-status');
            const dateText = () => document.querySelector('.settings-dashboard .date-input-text');
            const datePicker = () => document.querySelector('.settings-dashboard .date-input-picker');
            const {DateInput, formatDisplayDate, parseDisplayDate} = await import('../../dist/src/renderer/components/date-input/date-input.js');
            assert(formatDisplayDate('1992-05-06') === '06-05-1992' &&
                formatDisplayDate('0042-01-02') === '02-01-0042' &&
                parseDisplayDate('06-05-1992') === '1992-05-06' &&
                parseDisplayDate('06-05-92') === null && parseDisplayDate('31-02-1992') === null,
                'shared date input did not consistently format and validate four-digit years');
            const localDate = (year, month, day) => {
                const date = new Date(0);
                date.setHours(0, 0, 0, 0);
                date.setFullYear(year, month, day);
                return date;
            };
            const timestampNative = document.createElement('input');
            timestampNative.type = 'date';
            timestampNative.min = '0099-12-31';
            timestampNative.max = '0100-01-02';
            timestampNative.value = '0099-12-31';
            document.body.appendChild(timestampNative);
            let selectedValue;
            const timestampDate = new DateInput(timestampNative, {onChange: value => { selectedValue = value; }});
            const earlyText = timestampDate.element.querySelector('.date-input-text');
            assert(earlyText.placeholder === 'DD-MM-YYYY' && earlyText.value === '31-12-0099',
                'date input did not initially render the full year');
            assert(timestampDate.min === localSeconds(localDate(99, 11, 31)) &&
                timestampDate.max === localSeconds(localDate(100, 0, 2)),
                'date input did not read preconfigured native bounds as Unix seconds');
            timestampDate.min = null;
            timestampDate.max = null;
            const earlyDate = localDate(42, 0, 2);
            timestampDate.value = localSeconds(earlyDate);
            assert(timestampDate.value === localSeconds(earlyDate) && timestampNative.value === '0042-01-02' &&
                earlyText.value === '02-01-0042' && selectedValue === undefined,
                'numeric value assignment did not round-trip and render an early local-calendar date silently');
            earlyText.value = '03-01-0042';
            earlyText.dispatchEvent(new Event('change', {bubbles: true}));
            assert(timestampDate.value === localSeconds(localDate(42, 0, 3)) &&
                selectedValue === localSeconds(localDate(42, 0, 3)),
                'date input did not emit a numeric timestamp for a typed four-digit year below 0100');
            const changedValue = selectedValue;
            earlyText.value = '03-01-42';
            earlyText.dispatchEvent(new Event('change', {bubbles: true}));
            assert(timestampDate.value === changedValue && selectedValue === changedValue && earlyText.value === '03-01-0042',
                'date input accepted a short year or emitted a change for it');
            earlyText.value = '31-02-0042';
            earlyText.dispatchEvent(new Event('change', {bubbles: true}));
            assert(timestampDate.value === changedValue && selectedValue === changedValue && earlyText.value === '03-01-0042',
                'invalid typed date was not rejected without changing the selection');
            const earlyMin = localDate(42, 0, 1);
            const earlyMax = localDate(99, 11, 31);
            const earlyMinNoon = new Date(earlyMin);
            earlyMinNoon.setHours(12);
            const earlyMaxNoon = new Date(earlyMax);
            earlyMaxNoon.setHours(12);
            timestampDate.min = localSeconds(earlyMinNoon);
            timestampDate.max = localSeconds(earlyMaxNoon);
            assert(timestampNative.min === '0042-01-01' && timestampNative.max === '0099-12-31' &&
                timestampDate.min === localSeconds(earlyMin) && timestampDate.max === localSeconds(earlyMax),
                'date input did not normalize numeric bounds to local-midnight Unix seconds');
            earlyText.value = '31-12-0041';
            earlyText.dispatchEvent(new Event('change', {bubbles: true}));
            assert(timestampDate.value === localSeconds(earlyMin), 'typed date was not clamped to the numeric minimum');
            earlyText.value = '01-01-0100';
            earlyText.dispatchEvent(new Event('change', {bubbles: true}));
            assert(timestampDate.value === localSeconds(earlyMax), 'typed date was not clamped to the numeric maximum');
            timestampDate.min = null;
            timestampDate.max = null;
            assert(timestampNative.min === '' && timestampNative.max === '' &&
                timestampDate.min === null && timestampDate.max === null,
                'clearing numeric bounds did not remove native minimum and maximum');
            timestampDate.min = Number.NaN;
            timestampDate.max = Number.POSITIVE_INFINITY;
            assert(timestampNative.min === '' && timestampNative.max === '' &&
                timestampDate.min === null && timestampDate.max === null,
                'invalid numeric bounds were not cleared');
            timestampDate.value = Number.NaN;
            assert(timestampDate.value === null && timestampNative.value === '',
                'invalid timestamp did not clear the selected date');
            timestampDate.value = localSeconds(new Date(1970, 0, 1));
            assert(timestampDate.value === localSeconds(new Date(1970, 0, 1)) &&
                timestampNative.value === '1970-01-01', 'date input did not handle the Unix epoch date');
            timestampDate.value = null;
            assert(timestampDate.value === null && timestampNative.value === '',
                'null timestamp did not clear the selected date');
            timestampDate.value = '2024-01-01';
            assert(timestampDate.value === null && timestampNative.value === '',
                'date input still accepted a string as its selected value');
            timestampNative.value = '0042-01-04';
            timestampNative.dispatchEvent(new Event('change', {bubbles: true}));
            assert(timestampDate.value === localSeconds(localDate(42, 0, 4)) &&
                selectedValue === localSeconds(localDate(42, 0, 4)) && earlyText.value === '04-01-0042',
                'native picker change did not render a four-digit year or emit a numeric timestamp');
            timestampDate.element.remove();
            const defaultNative = document.createElement('input');
            defaultNative.type = 'date';
            defaultNative.value = '2024-01-02';
            document.body.appendChild(defaultNative);
            let defaultChanged;
            const defaultDate = new DateInput(defaultNative, {onChange: value => { defaultChanged = value; }});
            const defaultText = defaultDate.element.querySelector('.date-input-text');
            assert(defaultText.placeholder === 'DD-MM-YYYY' && defaultText.value === '02-01-2024' &&
                defaultDate.value === localSeconds(localDate(2024, 0, 2)),
                'date input did not display a four-digit year or report timestamps');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todaySeconds = localSeconds(today);
            const todayInputDate = String(today.getFullYear()).padStart(4, '0') + '-' +
                String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            assert(defaultDate.max === todaySeconds && defaultNative.max === todayInputDate,
                'date input did not default its maximum to today at local midnight');
            defaultText.value = '03-02-2025';
            defaultText.dispatchEvent(new Event('change', {bubbles: true}));
            assert(defaultDate.value === localSeconds(localDate(2025, 1, 3)) &&
                defaultChanged === localSeconds(localDate(2025, 1, 3)),
                'date input did not accept a four-digit year and emit timestamps');
            const selectedBeforeShortYear = defaultDate.value;
            const callbackBeforeShortYear = defaultChanged;
            defaultText.value = '03-02-25';
            defaultText.dispatchEvent(new Event('change', {bubbles: true}));
            assert(defaultDate.value === selectedBeforeShortYear && defaultChanged === callbackBeforeShortYear &&
                defaultText.value === '03-02-2025',
                'date input accepted a two-digit year or emitted a change for it');
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            defaultText.value = String(tomorrow.getDate()).padStart(2, '0') + '-' +
                String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getFullYear()).padStart(4, '0');
            defaultText.dispatchEvent(new Event('change', {bubbles: true}));
            assert(defaultDate.value === todaySeconds && defaultChanged === todaySeconds,
                'default date input did not clamp a future typed date to today');
            defaultDate.element.remove();
            assert(document.querySelector('.settings-card h2').textContent === 'Biometrics',
                'Settings page is missing its Biometrics section');
            assert(field('idealBmiUpperBound').value === '27' && field('idealBmiLowerBound').value === '24' &&
                field('height').value === '180' && field('dateOfBirth').value === '1992-05-06' &&
                dateText().value === '06-05-1992' && !dateText().disabled && !datePicker().disabled && field('sex').value === 'F',
                'loaded biometrics settings were not displayed');
            assert(field('dateOfBirth').max === todayInputDate,
                'Settings date input did not inherit its default maximum of today');

            const changeAndWait = async (key, value) => {
                const input = key === 'dateOfBirth' ? dateText() : field(key);
                input.value = value;
                input.dispatchEvent(new Event('change', {bubbles: true}));
                await waitFor(() => status().textContent === 'Saved.', key + ' did not save');
            };
            await changeAndWait('idealBmiUpperBound', '28.5');
            await changeAndWait('idealBmiLowerBound', '23.8');
            await changeAndWait('height', '172.5');
            const callsBeforeShortYear = updateCalls;
            dateText().value = '03-11-95';
            dateText().dispatchEvent(new Event('change', {bubbles: true}));
            assert(dateText().value === '06-05-1992' && updateCalls === callsBeforeShortYear,
                'birth date accepted an ambiguous two-digit year');
            delayNextUpdate = true;
            field('dateOfBirth').value = '1994-02-01';
            field('dateOfBirth').dispatchEvent(new Event('change', {bubbles: true}));
            assert(fields.every(input => input.disabled) && dateText().disabled && datePicker().disabled,
                'settings remained interactive during a save');
            resolveUpdate();
            await waitFor(() => status().textContent === 'Saved.' && !dateText().disabled,
                'date picker selection did not finish saving');
            assert(dateText().value === '01-02-1994', 'date picker selection did not update the shared text field');
            await changeAndWait('dateOfBirth', '03-11-1995');
            await changeAndWait('sex', 'm');
            assert(persisted.biometrics.idealBmiUpperBound === 28.5 && persisted.biometrics.idealBmiLowerBound === 23.8 &&
                persisted.biometrics.height === 172.5 && persisted.biometrics.sex === 'M',
                'numeric and sex values were not stored as the expected types');
            const dateSeconds = persisted.biometrics.dateOfBirth;
            const storedDate = new Date(dateSeconds * 1000);
            assert(dateSeconds === localSeconds(new Date(1995, 10, 3)) && storedDate.getHours() === 0 &&
                storedDate.getMinutes() === 0 && storedDate.getSeconds() === 0,
                'date of birth was not persisted as local-midnight Unix seconds');
            assert(new Date(1995, 10, 3).getTimezoneOffset() !== 0,
                'timezone regression must run outside UTC');

            const callsBeforeInvalid = updateCalls;
            field('height').value = '0';
            field('height').dispatchEvent(new Event('change', {bubbles: true}));
            assert(status().classList.contains('is-error') && updateCalls === callsBeforeInvalid,
                'invalid numeric value was saved instead of reported');
            field('height').value = 'not-a-number';
            field('height').dispatchEvent(new Event('change', {bubbles: true}));
            assert(status().classList.contains('is-error') && updateCalls === callsBeforeInvalid &&
                persisted.biometrics.height === 172.5, 'malformed numeric text cleared or changed a saved value');
            field('sex').value = 'X';
            field('sex').dispatchEvent(new Event('change', {bubbles: true}));
            assert(status().classList.contains('is-error') && updateCalls === callsBeforeInvalid,
                'invalid sex value was saved instead of reported');

            failNextUpdate = true;
            dateText().value = '04-11-1995';
            dateText().dispatchEvent(new Event('change', {bubbles: true}));
            await waitFor(() => status().classList.contains('is-error') && !dateText().disabled,
                'failed birth date save was not shown');
            assert(dateText().value === '04-11-1995' && !document.querySelector('.settings-retry').hidden,
                'failed birth date was not retained for retry');
            document.querySelector('.settings-retry').click();
            await waitFor(() => status().textContent === 'Saved.', 'failed birth date could not be retried');
            assert(persisted.biometrics.dateOfBirth === localSeconds(new Date(1995, 10, 4)),
                'retry did not persist the birth date');

            await changeAndWait('dateOfBirth', '');
            assert(!Object.hasOwn(persisted.biometrics, 'dateOfBirth'), 'clearing date of birth did not remove the optional setting');

            failNextUpdate = true;
            field('height').value = '173';
            field('height').dispatchEvent(new Event('change', {bubbles: true}));
            await waitFor(() => status().classList.contains('is-error') && !field('height').disabled,
                'failed save was not displayed or retryable');
            await changeAndWait('height', '173');
            assert(persisted.biometrics.height === 173, 'retry after a failed save did not persist the value');

            integrationsIcon.click();
            await waitFor(() => document.querySelector('.integrations-dashboard'), 'Integrations page did not open');
            settingsIcon.click();
            await waitFor(() => document.querySelector('.settings-dashboard'), 'Settings page did not reopen from Integrations');
            await waitFor(() => document.querySelector('.settings-dashboard [data-setting="height"]')?.value === '173',
                () => 'saved biometrics settings were not restored after re-entry: stored=' + persisted.biometrics.height +
                    ', input=' + document.querySelector('.settings-dashboard [data-setting="height"]')?.value +
                    ', status=' + status()?.textContent);
            assert(field('dateOfBirth').value === '', 'cleared date of birth reappeared after re-entry');

            integrationsIcon.click();
            await waitFor(() => document.querySelector('.integrations-dashboard'), 'Integrations page did not reopen');
            getSettings = async () => { throw new Error('test load error'); };
            settingsIcon.click();
            await waitFor(() => status()?.textContent === 'Could not load biometrics settings.',
                'settings load error was not shown');
            assert([...document.querySelectorAll('.settings-dashboard [data-setting]')].every(input => !input.disabled),
                'fields were not re-enabled after a load error');
            assert(!dateText().disabled && !datePicker().disabled, 'date input was not re-enabled after a load error');

            integrationsIcon.click();
            await waitFor(() => document.querySelector('.integrations-dashboard'), 'Integrations page did not reopen after load error');
            getSettings = async () => ({});
            settingsIcon.click();
            await waitFor(() => document.querySelector('.settings-dashboard [data-setting="height"]') &&
                !document.querySelector('.settings-dashboard [data-setting="height"]').disabled,
                'empty biometrics settings did not load');
            assert([...document.querySelectorAll('.settings-dashboard [data-setting]')].every(input => input.value === ''),
                'missing biometrics settings were populated with defaults');

            let resolveLateLoad;
            getSettings = () => new Promise(resolve => { resolveLateLoad = () => resolve(clone(persisted)); });
            settingsIcon.click();
            await waitFor(() => resolveLateLoad, 'late settings load did not start');
            getSettings = async () => clone(persisted);
            integrationsIcon.click();
            await waitFor(() => document.querySelector('.integrations-dashboard'), 'navigation away during load failed');
            resolveLateLoad();
            await new Promise(resolve => setTimeout(resolve, 20));
            assert(!document.querySelector('.settings-dashboard'),
                'a late settings load restored the page after navigating away');
        })()`).catch(error => { throw error; });
        win.destroy();
        tempDir = fs.mkdtempSync(path.join(__dirname, '.biometrics-settings-check-'));
        app.setPath('userData', tempDir);
        const settingsPath = path.join(tempDir, 'settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify({
            withings: {oauth: {client_id: 'preserve-me'}},
            biometrics: {height: 180, sex: 'F'}
        }));
        database = (await import(pathToFileURL(path.join(__dirname, '../dist/src/main_process/db.js')).href)).db;
        const {registerSettingsIpc} = await import(pathToFileURL(path.join(__dirname, '../dist/src/main_process/features/settings/settings.js')).href);
        registerSettingsIpc();
        for (const channel of ['get-progress-photos', 'get-progress-poses', 'get-progress-angles']) {
            ipcMain.handle(channel, async () => []);
        }
        realWindow = new BrowserWindow({
            width: 900,
            height: 800,
            show: false,
            webPreferences: {
                preload: path.join(__dirname, '../dist/src/main_process/preload.cjs'),
                contextIsolation: true,
                nodeIntegration: false,
                backgroundThrottling: false
            }
        });
        await realWindow.loadFile(path.join(__dirname, '../src/renderer/index.html'));
        await realWindow.webContents.executeJavaScript(`(async () => {
            const assert = (condition, message) => { if (!condition) throw new Error(message); };
            const waitFor = async (condition, message) => {
                for (let i = 0; i < 100; i++) {
                    if (condition()) return;
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                assert(false, message);
            };
            const field = key => document.querySelector('.settings-dashboard [data-setting="' + key + '"]');
            const dateText = () => document.querySelector('.settings-dashboard .date-input-text');
            const status = () => document.querySelector('.settings-status');
            await waitFor(() => document.getElementById('dash-photos')?.classList.contains('active'), 'initial navigation did not complete');
            document.getElementById('dash-settings').click();
            await waitFor(() => field('height') && !field('height').disabled, 'real settings IPC did not load');
            assert(field('height').value === '180' && field('sex').value === 'F', 'real settings were not loaded');
            const change = async (key, value) => {
                const input = key === 'dateOfBirth' ? dateText() : field(key);
                input.value = value;
                input.dispatchEvent(new Event('change', {bubbles: true}));
                await waitFor(() => status().textContent === 'Saved.', key + ' was not saved through IPC');
            };
            await change('idealBmiUpperBound', '27.5');
            await change('idealBmiLowerBound', '23.5');
            await change('height', '181.2');
            await change('sex', 'm');
            await change('dateOfBirth', '06-05-1990');
            await change('height', '');
            document.getElementById('dash-integrations').click();
            await waitFor(() => document.querySelector('.integrations-dashboard'), 'real Integrations navigation failed');
            document.getElementById('dash-settings').click();
            await waitFor(() => field('sex')?.value === 'M', 'real settings did not persist across re-entry');
            assert(field('height').value === '' && dateText().value === '06-05-1990',
                'cleared height or birth date was not restored through IPC');
        })()`);
        const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (saved.withings?.oauth?.client_id !== 'preserve-me' || saved.biometrics?.idealBmiUpperBound !== 27.5 ||
            saved.biometrics?.idealBmiLowerBound !== 23.5 || saved.biometrics?.sex !== 'M' ||
            saved.biometrics?.dateOfBirth !== Math.floor(new Date(1990, 4, 6).getTime() / 1000) ||
            Object.hasOwn(saved.biometrics, 'height')) {
            throw new Error('Real settings IPC did not persist biometrics values or preserve unrelated settings.');
        }
        console.log('Biometrics settings page, date input, and real IPC persistence checks passed.');
    } catch (error) {
        console.error(error);
        exitCode = 1;
    } finally {
        if (!win.isDestroyed()) win.destroy();
        if (realWindow && !realWindow.isDestroyed()) realWindow.destroy();
        if (database) database.close();
        if (tempDir) fs.rmSync(tempDir, {recursive: true, force: true});
        app.exit(exitCode);
    }
});