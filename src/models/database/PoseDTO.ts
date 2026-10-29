import { Pose } from '../../types/index.js';

export class PoseDTO implements Pose {
    poseId: number;
    poseName: string;
    croppingPercent: number;
    aspectRatio: number;
    collectionSize: number;
    singleSize: number;

    constructor({
                    pose_id,
                    pose_name,
                    cropping_percent,
                    aspect_ratio,
                    collection_size,
                    single_size
                }: any) {
        this.poseId = pose_id;
        this.poseName = pose_name;
        this.croppingPercent = cropping_percent;
        this.aspectRatio = aspect_ratio;
        this.collectionSize = collection_size;
        this.singleSize = single_size;
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
            collection_size: this.collectionSize,
            single_size: this.singleSize
        };
    }
}
