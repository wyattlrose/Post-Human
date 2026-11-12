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
    verticalSize: number;
    horizontalSize: number;
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

export interface WithingsOAuthSettings {
    client_id?: string;
    client_secret?: string;
    api_endpoint?: string;
}

export type WithingsOAuthSettingKey = keyof WithingsOAuthSettings;

export interface WithingsTokenSettings {
    user_id?: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
}

export interface WithingsSettings {
    oauth?: WithingsOAuthSettings;
    token?: WithingsTokenSettings;
    lastUpdate?: number;
}

export interface Settings {
    window?: WindowSettings;
    progress_photo?: ProgressPhotoSettings;
    withings?: WithingsSettings;
}

export type SettingsSection = keyof Settings;

export interface BiometricWeight {
    weight: number;
    date: number; // Unix timestamp (seconds)
}

export interface EffortType {
    key: number;
    text: string; // e.g. 'Bulk', 'Cut', 'Maintain'
}

export interface BiometricEffort {
    effortId: number;
    startDate: number; // Unix timestamp (seconds); the effort lasts until the next effort's start date
    typeKey: number; // EFFORT_TYPE key
    description: string;
}

export type EffortUpdate = Partial<Pick<BiometricEffort, 'startDate' | 'typeKey' | 'description'>>;

export type LandmarkKey = 'yLandmark1' | 'yLandmark2' | 'xLandmark';

export interface WithingsStatus {
    configured: boolean;
    listening: boolean;
    connected: boolean;
    userId?: string;
}

export interface WithingsFetchResult {
    success: boolean;
    response?: unknown; // aggregated Withings weight data
    saved?: number; // weight rows written to biometric_weight
    error?: string;
}

export interface IElectronAPI {
    getProgressPhotos: () => Promise<ProgressPhoto[]>;
    getProgressPoses: () => Promise<Pose[]>;
    getProgressAngles: () => Promise<Angle[]>;
    setPoseAngleEnabled: (poseId: number, angleId: number, enabled: boolean) => Promise<boolean>;
    updatePhotoLandmark: (photoId: number, landmark: LandmarkKey, value: number) => Promise<boolean>;
    updatePhotoAngle: (photoId: number, angleId: number) => Promise<boolean>;
    deleteProgressPhoto: (photoId: number) => Promise<boolean>;
    saveProgressPhotos: (photos: NewProgressPhoto[]) => Promise<{success: boolean, error?: string}>;
    getBiometricWeight: () => Promise<BiometricWeight[]>;
    getBiometricEfforts: () => Promise<BiometricEffort[]>;
    getEffortTypes: () => Promise<EffortType[]>;
    createBiometricEffort: (startDate: number, typeKey: number, description: string) => Promise<BiometricEffort | null>;
    updateBiometricEffort: (effortId: number, update: EffortUpdate) => Promise<boolean>;
    getSettings: () => Promise<Settings>;
    updateSetting: <S extends SettingsSection, K extends keyof NonNullable<Settings[S]>>(section: S, key: K, value: NonNullable<Settings[S]>[K]) => Promise<boolean>;
    updatePoseSettings: (poseId: number, settings: Partial<Pose>) => Promise<boolean>;
    withingsAuthorize: () => Promise<boolean>;
    getWithingsStatus: () => Promise<WithingsStatus>;
    fetchWithingsWeight: () => Promise<WithingsFetchResult>;
}

export interface NewProgressPhoto {
    date: number;
    poseId: number;
    angleId: number;
    extension: string;
    yLandmark1: number;
    yLandmark2: number;
    xLandmark: number;
    data: Uint8Array;
}

declare global {
    interface Window {
        api: IElectronAPI;
        applyDynamicCrop: (img: HTMLImageElement) => void;
    }
}
