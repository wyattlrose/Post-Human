const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getProgressPhotos: () => ipcRenderer.invoke('get-progress-photos'),
    getProgressPoses: () => ipcRenderer.invoke('get-progress-poses'),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSetting: (key, value) => ipcRenderer.invoke('update-setting', key, value)
});
