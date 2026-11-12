const {app, BrowserWindow} = require('electron');
const path = require('node:path');

app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
    const win = new BrowserWindow({
        width: 900,
        height: 800,
        show: false,
        webPreferences: {contextIsolation: false, nodeIntegration: false, backgroundThrottling: false}
    });
    try {
        await win.loadFile(path.join(__dirname, '../src/renderer/index.html'));
        await win.webContents.executeJavaScript(`(async () => {
            const assert = (condition, message) => { if (!condition) throw new Error(message); };
            const waitFor = async (condition, message) => {
                for (let i = 0; i < 100; i++) {
                    if (condition()) return;
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                assert(false, message);
            };
            const localSeconds = date => Math.floor(date.getTime() / 1000);
            let createdEffort;
            let savedPhotos;
            window.api = {
                getBiometricWeight: async () => [],
                getBiometricEfforts: async () => [],
                getEffortTypes: async () => [{key: 1, text: 'Cut'}],
                createBiometricEffort: async (startDate, typeKey, description) => {
                    createdEffort = {startDate, typeKey, description};
                    return true;
                },
                getProgressPhotos: async () => [],
                getProgressPoses: async () => [{
                    poseId: 7,
                    poseName: 'Front',
                    angles: [{angleId: 11, angle: 'Front', order: 0}]
                }],
                saveProgressPhotos: async photos => {
                    savedPhotos = photos;
                    return {success: true};
                }
            };

            const biometrics = await import('../../dist/src/renderer/features/biometrics/biometrics.js');
            await biometrics.loadBiometrics();
            document.querySelector('.biometrics-new-effort-btn').click();
            const effortDate = document.querySelector('.biometrics-effort-start');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayInputDate = String(today.getFullYear()).padStart(4, '0') + '-' +
                String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            assert(effortDate.value === todayInputDate,
                'new biometrics effort did not receive today as a local-midnight timestamp');
            assert(effortDate.max === todayInputDate,
                'Biometrics date input did not inherit its default maximum of today');
            assert(effortDate.parentElement.querySelector('.date-input-text').value ===
                String(today.getDate()).padStart(2, '0') + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' +
                String(today.getFullYear()).padStart(4, '0'),
                'Biometrics date input did not display a four-digit year');
            effortDate.value = '2024-02-03';
            effortDate.dispatchEvent(new Event('change', {bubbles: true}));
            assert(effortDate.value === '2024-02-03' && effortDate.parentElement.querySelector('.date-input-text').value === '03-02-2024',
                'biometrics effort date did not retain and display the selected full-year date');
            document.querySelector('.biometrics-effort-create').click();
            await waitFor(() => createdEffort, 'new biometrics effort was not saved');
            assert(createdEffort.startDate === localSeconds(new Date(2024, 1, 3)),
                'biometrics did not persist the selected date as local-midnight Unix seconds');
            biometrics.cleanupBiometrics();

            const photoUpload = await import('../../dist/src/renderer/features/photo-upload/photo-upload.js');
            await photoUpload.loadPhotoUpload();
            const uploadDate = document.getElementById('upload-date');
            assert(document.querySelector('#photo-upload-dashboard .date-input-native').max === todayInputDate,
                'Photo Upload date input did not inherit its default maximum of today');
            assert(uploadDate.placeholder === 'DD-MM-YYYY', 'Photo Upload date input did not require a four-digit year');
            const photoNativeDate = document.querySelector('#photo-upload-dashboard .date-input-native');
            const photoDateBeforeShortYear = photoNativeDate.value;
            const photoTextBeforeShortYear = uploadDate.value;
            uploadDate.value = '04-02-24';
            uploadDate.dispatchEvent(new Event('change', {bubbles: true}));
            assert(photoNativeDate.value === photoDateBeforeShortYear && uploadDate.value === photoTextBeforeShortYear,
                'Photo Upload accepted a two-digit year or changed the existing date');
            uploadDate.value = '04-02-2024';
            uploadDate.dispatchEvent(new Event('change', {bubbles: true}));
            assert(document.querySelector('#photo-upload-dashboard .date-input-native').value === '2024-02-04' &&
                uploadDate.value === '04-02-2024', 'Photo Upload did not apply and display the typed full-year date');
            const transfer = new DataTransfer();
            transfer.items.add(new File([new Uint8Array([0])], 'test.png', {type: 'image/png'}));
            document.querySelector('#upload-drop-container .drop-zone').dispatchEvent(
                new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: transfer})
            );
            await waitFor(() => document.querySelector('.photo-strip-angle-select'), 'dropped photo was not added');
            const angleSelect = document.querySelector('.photo-strip-angle-select');
            angleSelect.value = '11';
            angleSelect.dispatchEvent(new Event('change', {bubbles: true}));
            document.getElementById('upload-save').click();
            await waitFor(() => savedPhotos?.length === 1, 'photo upload did not save the selected photo');
            const expectedUploadDate = localSeconds(new Date(2024, 1, 4));
            assert(savedPhotos[0].date === expectedUploadDate,
                'photo upload saved ' + savedPhotos[0].date + ' instead of local-midnight Unix seconds ' + expectedUploadDate);
        })()`).catch(error => { throw error; });
        console.log('Biometrics and Photo Upload date-input timestamp checks passed.');
    } catch (error) {
        console.error(error);
        app.exitCode = 1;
    } finally {
        if (!win.isDestroyed()) win.destroy();
        app.exit(app.exitCode ?? 0);
    }
});