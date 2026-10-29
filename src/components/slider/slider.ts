/**
 * Keeps each slider's value bubble positioned above its thumb by setting
 * --range-progress (0..1) on the slider's wrapper.
 */
export function updateSliderPosition(slider: HTMLInputElement): void {
    const min = parseFloat(slider.min || '0');
    const max = parseFloat(slider.max || '100');
    const progress = max > min ? (parseFloat(slider.value) - min) / (max - min) : 0;
    slider.parentElement?.style.setProperty('--range-progress', progress.toString());
}

export function initSlider(slider: HTMLInputElement): void {
    slider.addEventListener('input', () => updateSliderPosition(slider));
    updateSliderPosition(slider);
}
