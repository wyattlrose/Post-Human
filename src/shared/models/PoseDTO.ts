import { Pose, PoseAngle } from '../types/index.js';

export class PoseDTO implements Pose {
    poseId: number;
    poseName: string;
    croppingPercent: number;
    aspectRatio: number;
    verticalOffset: number;
    horizontalOffset: number;
    verticalSize: number;
    horizontalSize: number;
    yLandmark1Label: string;
    yLandmark2Label: string;
    xLandmarkLabel: string;
    angles: PoseAngle[];

    constructor({
                    pose_id,
                    pose_name,
                    cropping_percent,
                    aspect_ratio,
                    vertical_offset,
                    horizontal_offset,
                    vertical_size,
                    horizontal_size,
                    y_landmark_1,
                    y_landmark_2,
                    x_landmark,
                    angles
                }: any) {
        this.poseId = pose_id;
        this.poseName = pose_name;
        this.croppingPercent = cropping_percent;
        this.aspectRatio = aspect_ratio;
        this.verticalOffset = vertical_offset ?? 0;
        this.horizontalOffset = horizontal_offset ?? 0;
        this.verticalSize = vertical_size;
        this.horizontalSize = horizontal_size;
        this.yLandmark1Label = y_landmark_1 ?? '';
        this.yLandmark2Label = y_landmark_2 ?? '';
        this.xLandmarkLabel = x_landmark ?? '';
        this.angles = angles ?? [];
    }

    static fromDatabase(row: any): PoseDTO {
        return new PoseDTO(row);
    }

    toDatabase() {
        return {
            pose_id: this.poseId,
            pose_name: this.poseName,
            cropping_percent: this.croppingPercent,
            aspect_ratio: this.aspectRatio,
            vertical_offset: this.verticalOffset,
            horizontal_offset: this.horizontalOffset,
            vertical_size: this.verticalSize,
            horizontal_size: this.horizontalSize,
            y_landmark_1: this.yLandmark1Label,
            y_landmark_2: this.yLandmark2Label,
            x_landmark: this.xLandmarkLabel
        };
    }
}
