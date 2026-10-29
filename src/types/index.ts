export interface ProgressPhoto {
    photoId: number;
    date: number; // Unix timestamp
    poseId: number;
    angle: string;
    extension: string;
    yLandmark1: number;
    yLandmark2: number;
    xLandmark: number;
}

export interface Pose {
    poseId: number;
    poseName: string;
    croppingPercent: number;
    aspectRatio: number;
    collectionSize: number;
    singleSize: number;
}

export interface Settings {
    window_width?: number;
    window_height?: number;
    window_x_pos?: number;
    window_y_pos?: number;
    progress_photo_size?: number;
    progress_photo_crop?: number;
    progress_photo_aspect?: number;
    progress_photo_default_pose?: string | number;
    progress_photo_view_mode?: 'date-rows' | 'angle-rows';
    progress_photo_hidden_angles?: string[];
    [key: string]: any;
}

export interface IElectronAPI {
    getProgressPhotos: () => Promise<ProgressPhoto[]>;
    getProgressPoses: () => Promise<Pose[]>;
    getSettings: () => Promise<Settings>;
    updateSetting: (key: string, value: any) => Promise<boolean>;
    updatePoseSettings: (poseId: number, settings: Partial<Pose>) => Promise<boolean>;
}

declare global {
    interface Window {
        api: IElectronAPI;
        applyDynamicCrop: (img: HTMLImageElement) => void;
    }
}
