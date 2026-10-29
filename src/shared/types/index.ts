export interface ProgressPhoto {
    photoId: number;
    date: number; // Unix timestamp
    poseId: number;
    angleId: number;
    angle: string; // resolved from PROGRESS_ANGLE via ANGLE_ID
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
    verticalOffset: number; // percent of the Y-landmark gap; positive moves the crop down
    horizontalOffset: number; // percent of the Y-landmark gap; positive moves the crop right
    collectionSize: number;
    singleSize: number;
    yLandmark1Label: string;
    yLandmark2Label: string;
    xLandmarkLabel: string;
    angles: PoseAngle[]; // enabled angles, sorted by order
}

export interface Angle {
    angleId: number;
    angle: string;
}

export interface PoseAngle extends Angle {
    order: number;
}

export interface WindowSettings {
    width?: number;
    height?: number;
    x_pos?: number;
    y_pos?: number;
}

export interface ProgressPhotoSettings {
    size?: number;
    crop?: number;
    aspect?: number;
    default_pose?: string | number;
    view_mode?: 'date-rows' | 'angle-rows';
}

export interface Settings {
    window?: WindowSettings;
    progress_photo?: ProgressPhotoSettings;
}

export type SettingsSection = keyof Settings;

export type LandmarkKey = 'yLandmark1' | 'yLandmark2' | 'xLandmark';

export interface IElectronAPI {
    getProgressPhotos: () => Promise<ProgressPhoto[]>;
    getProgressPoses: () => Promise<Pose[]>;
    getProgressAngles: () => Promise<Angle[]>;
    setPoseAngleEnabled: (poseId: number, angleId: number, enabled: boolean) => Promise<boolean>;
    updatePhotoLandmark: (photoId: number, landmark: LandmarkKey, value: number) => Promise<boolean>;
    getSettings: () => Promise<Settings>;
    updateSetting: <S extends SettingsSection>(section: S, key: keyof NonNullable<Settings[S]>, value: any) => Promise<boolean>;
    updatePoseSettings: (poseId: number, settings: Partial<Pose>) => Promise<boolean>;
}

declare global {
    interface Window {
        api: IElectronAPI;
        applyDynamicCrop: (img: HTMLImageElement) => void;
    }
}
