const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getProgressPhotos: () => ipcRenderer.invoke('get-progress-photos'),
    getProgressPoses: () => ipcRenderer.invoke('get-progress-poses'),
    getProgressAngles: () => ipcRenderer.invoke('get-progress-angles'),
    setPoseAngleEnabled: (poseId: number, angleId: number, enabled: boolean) => ipcRenderer.invoke('set-pose-angle-enabled', poseId, angleId, enabled),
    updatePhotoLandmark: (photoId: number, landmark: string, value: number) => ipcRenderer.invoke('update-photo-landmark', photoId, landmark, value),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSetting: (section: string, key: string, value: any) => ipcRenderer.invoke('update-setting', section, key, value),
    updatePoseSettings: (poseId: number, settings: any) => ipcRenderer.invoke('update-pose-settings', poseId, settings)
});
