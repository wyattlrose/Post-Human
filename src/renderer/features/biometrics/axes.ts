/**
 * Axis rules for the weight chart (see AGENTS.md in this folder).
 * Times are Unix timestamps in seconds; weights are in kg.
 */

export {formatDate} from '../../utils/date.js';

export const DAY = 86400;
export const WEEK = 7 * DAY;

export const MIN_RANGE_DAYS = 7;
export const MAX_RANGE_DAYS = 29120;
const MAX_X_INTERVALS = 14;
const MAX_X_STEP_WEEKS = 52; // 364 days

const MIN_WEIGHT_TENTHS = 0;
const MAX_WEIGHT_TENTHS = 7000; // 700 kg
const MAX_Y_INTERVALS = 10;
const MAX_Y_STEP_TENTHS = 50; // 5 kg

/**
 * Clamps a time range to 7..29120 days.
 * `anchor` decides which end stays fixed when the range has to change.
 */
export function clampRange(start: number, end: number, anchor: 'start' | 'end' = 'end'): [number, number] {
    const span = Math.min(Math.max(end - start, MIN_RANGE_DAYS * DAY), MAX_RANGE_DAYS * DAY);
    return anchor === 'start' ? [start, start + span] : [end - span, end];
}

/** Smallest multiple of 7 days (7..364) that gives at most 14 intervals over the range. */
export function dateStep(min: number, max: number): number {
    const weeks = Math.ceil((max - min) / (MAX_X_INTERVALS * WEEK) - 1e-9);
    return Math.min(Math.max(weeks, 1), MAX_X_STEP_WEEKS) * WEEK;
}

/** Date ticks starting at the range start, every `dateStep` seconds. */
export function dateTicks(min: number, max: number): number[] {
    const step = dateStep(min, max);
    const ticks: number[] = [];
    for (let v = min; v <= max + 1e-6; v += step) ticks.push(v);
    return ticks;
}

/** Rounds kg to tenths, guarding against float noise (e.g. 79.4 * 10 = 794.0000000001). */
function toTenths(kg: number, round: (n: number) => number): number {
    return round(Math.round(kg * 10 * 1000) / 1000);
}

export interface WeightAxis {
    /** Step between ticks in kg (multiple of 0.1, at most 5). */
    step: number;
    /** Tick values in kg; first and last define the y domain. */
    ticks: number[];
}

/**
 * Smallest multiple of 0.1 kg (0.1..5) that covers [min, max] with at most 10 intervals,
 * ticks aligned to multiples of the step and clamped to 0..700 kg.
 */
export function weightAxis(min: number, max: number): WeightAxis {
    const lo = Math.max(MIN_WEIGHT_TENTHS, toTenths(Math.min(min, max), Math.floor));
    const hi = Math.min(MAX_WEIGHT_TENTHS, toTenths(Math.max(min, max), Math.ceil));

    const extent = (step: number): [number, number] => {
        const s = Math.floor(lo / step) * step;
        const e = Math.ceil(hi / step) * step;
        // A single value: give it one interval of room on each side.
        return s === e ? [s - step, e + step] : [s, e];
    };

    let step = 1;
    while (step < MAX_Y_STEP_TENTHS) {
        const [s, e] = extent(step);
        if ((e - s) / step <= MAX_Y_INTERVALS) break;
        step++;
    }
    let [start, end] = extent(step);

    if (start < MIN_WEIGHT_TENTHS) {
        end += MIN_WEIGHT_TENTHS - start;
        start = MIN_WEIGHT_TENTHS;
    }
    if (end > MAX_WEIGHT_TENTHS) {
        start = Math.max(MIN_WEIGHT_TENTHS, start - (end - MAX_WEIGHT_TENTHS));
        end = MAX_WEIGHT_TENTHS;
    }

    const ticks: number[] = [];
    for (let t = start; t <= end; t += step) ticks.push(t / 10);
    return {step: step / 10, ticks};
}

/** '00' when the step is a whole number of kg, '00.0' otherwise. */
export function formatWeight(value: number, step: number): string {
    return Number.isInteger(Math.round(step * 1000) / 1000) ? value.toFixed(0) : value.toFixed(1);
}

