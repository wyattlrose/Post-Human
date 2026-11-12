const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getProgressPhotos: () => ipcRenderer.invoke('get-progress-photos'),
    getProgressPoses: () => ipcRenderer.invoke('get-progress-poses'),
    getProgressAngles: () => ipcRenderer.invoke('get-progress-angles'),
    setPoseAngleEnabled: (poseId: number, angleId: number, enabled: boolean) => ipcRenderer.invoke('set-pose-angle-enabled', poseId, angleId, enabled),
    updatePhotoLandmark: (photoId: number, landmark: string, value: number) => ipcRenderer.invoke('update-photo-landmark', photoId, landmark, value),
    updatePhotoAngle: (photoId: number, angleId: number) => ipcRenderer.invoke('update-photo-angle', photoId, angleId),
    deleteProgressPhoto: (photoId: number) => ipcRenderer.invoke('delete-progress-photo', photoId),
    saveProgressPhotos: (photos: any[]) => ipcRenderer.invoke('save-progress-photos', photos),
    getBiometricWeight: () => ipcRenderer.invoke('get-biometric-weight'),
    getBiometricEfforts: () => ipcRenderer.invoke('get-biometric-efforts'),
    getEffortTypes: () => ipcRenderer.invoke('get-effort-types'),
    createBiometricEffort: (startDate: number, typeKey: number, description: string) => ipcRenderer.invoke('create-biometric-effort', startDate, typeKey, description),
    updateBiometricEffort: (effortId: number, update: object) => ipcRenderer.invoke('update-biometric-effort', effortId, update),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSetting: (section: string, key: string, value: any) => ipcRenderer.invoke('update-setting', section, key, value),
    updatePoseSettings: (poseId: number, settings: any) => ipcRenderer.invoke('update-pose-settings', poseId, settings),
    withingsAuthorize: () => ipcRenderer.invoke('withings-authorize'),
    getWithingsStatus: () => ipcRenderer.invoke('withings-status'),
    fetchWithingsWeight: () => ipcRenderer.invoke('withings-fetch-weight')
});
