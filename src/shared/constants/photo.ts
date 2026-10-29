export interface SliderConfig {
    min: number;
    max: number;
    step: number;
}

export const PHOTO_SLIDERS = {
    size: {min: 100, max: 500, step: 20},
    croppingPercent: {min: 10, max: 500, step: 5},
    aspectRatio: {min: 0.1, max: 2, step: 0.05},
    verticalOffset: {min: -100, max: 100, step: 2},
    horizontalOffset: {min: -100, max: 100, step: 2}
} as const satisfies Record<string, SliderConfig>;

export type PhotoSliderSetting = keyof typeof PHOTO_SLIDERS;

/** Rounds a value to the setting's step and clamps it to its min/max. */
export function snapToSlider(setting: PhotoSliderSetting, value: number): number {
    const {min, max, step} = PHOTO_SLIDERS[setting];
    const decimals = (step.toString().split('.')[1] || '').length;
    const snapped = Number((Math.round(value / step) * step).toFixed(decimals));
    return Math.min(max, Math.max(min, snapped));
}

/** Applies a setting's min/max/step to a range input. */
export function applySliderConfig(slider: HTMLInputElement | null, setting: PhotoSliderSetting): void {
    if (!slider) return;
    const {min, max, step} = PHOTO_SLIDERS[setting];
    slider.min = min.toString();
    slider.max = max.toString();
    slider.step = step.toString();
}
