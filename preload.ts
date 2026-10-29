const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getProgressPhotos: () => ipcRenderer.invoke('get-progress-photos'),
    getProgressPoses: () => ipcRenderer.invoke('get-progress-poses'),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSetting: (key: string, value: any) => ipcRenderer.invoke('update-setting', key, value),
    updatePoseSettings: (poseId: number, settings: any) => ipcRenderer.invoke('update-pose-settings', poseId, settings)
});
