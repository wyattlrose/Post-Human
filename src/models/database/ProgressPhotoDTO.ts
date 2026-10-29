import { ProgressPhoto } from '../../types/index.js';

export class ProgressPhotoDTO implements ProgressPhoto {
    photoId: number;
    date: number;
    poseId: number;
    angleId: number;
    angle: string;
    extension: string;
    yLandmark1: number;
    yLandmark2: number;
    xLandmark: number;

    constructor({
        PHOTO_ID,
        DATE,
        POSE_ID,
        ANGLE_ID,
        ANGLE,
        EXTENSION,
        Y_LANDMARK_1,
        Y_LANDMARK_2,
        X_LANDMARK
    }: any) {
        this.photoId = PHOTO_ID;
        this.date = DATE;
        this.poseId = POSE_ID;
        this.angleId = ANGLE_ID;
        this.angle = ANGLE;
        this.extension = EXTENSION;
        this.yLandmark1 = Y_LANDMARK_1;
        this.yLandmark2 = Y_LANDMARK_2;
        this.xLandmark = X_LANDMARK;
    }

    static fromDatabase(row: any): ProgressPhotoDTO {
        return new ProgressPhotoDTO(row);
    }

    toDatabase() {
        return {
            PHOTO_ID: this.photoId,
            DATE: this.date,
            POSE_ID: this.poseId,
            ANGLE_ID: this.angleId,
            EXTENSION: this.extension,
            Y_LANDMARK_1: this.yLandmark1,
            Y_LANDMARK_2: this.yLandmark2,
            X_LANDMARK: this.xLandmark
        };
    }
}
