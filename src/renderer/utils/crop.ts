export interface CropLandmarks {
    yLandmark1: number;
    yLandmark2: number;
    xLandmark: number;
}

export interface CropSettings {
    croppingPercent?: number;
    aspectRatio?: number;
    verticalOffset?: number;
    horizontalOffset?: number;
}

export interface CropRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

// Final crop area in original image pixel coordinates.
// The gap between the two Y landmarks is the per-photo scale: crop size and both offsets are relative to it,
// so framing stays consistent regardless of camera distance, zoom or resolution.
export function computeCropRect(landmarks: CropLandmarks, settings: CropSettings): CropRect {
    const cropPercent = settings.croppingPercent || 50;
    const aspectRatio = settings.aspectRatio || 1.0;
    const verticalOffset = settings.verticalOffset ?? 0;
    const horizontalOffset = settings.horizontalOffset ?? 0;

    const {yLandmark1: y1, yLandmark2: y2, xLandmark: x} = landmarks;
    const gap = Math.abs(y2 - y1);

    const height = gap + 2 * gap * (cropPercent / 100);
    const width = height * aspectRatio;

    const centerY = (y1 + y2) / 2 + (verticalOffset / 100) * gap;
    const centerX = x + (horizontalOffset / 100) * gap;

    return {left: centerX - width / 2, top: centerY - height / 2, width, height};
}
