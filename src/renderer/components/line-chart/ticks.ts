export function niceStep(span: number, count: number): number {
    const rawStep = span / Math.max(count, 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const residual = rawStep / magnitude;
    return (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;
}

/** Ticks that extend to cover [min, max] (useful for the y domain). */
export function niceTicks(min: number, max: number, count: number): number[] {
    if (min === max) {
        min -= 1;
        max += 1;
    }
    const step = niceStep(max - min, count);
    const start = Math.floor(min / step) * step;
    const end = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
    return ticks;
}

/** Nice ticks strictly within [min, max] (useful for a fixed x domain). */
export function innerTicks(min: number, max: number, count: number): number[] {
    if (min === max) return [min];
    const step = niceStep(max - min, count);
    const ticks: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
    return ticks;
}

const DAY = 86_400_000;

/** Calendar-aligned ticks for millisecond timestamps within [min, max]. */
export function timeTicks(min: number, max: number, count: number): number[] {
    if (min === max) return [min];
    const target = (max - min) / Math.max(count, 1);
    const ticks: number[] = [];

    if (target < DAY) return innerTicks(min, max, count);

    if (target < 28 * DAY) {
        const days = [1, 2, 7, 14].find(d => d * DAY >= target) ?? 14;
        const d = new Date(min);
        d.setHours(0, 0, 0, 0);
        if (days === 7 || days === 14) d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // align to Monday
        while (d.getTime() < min) d.setDate(d.getDate() + days);
        while (d.getTime() <= max) {
            ticks.push(d.getTime());
            d.setDate(d.getDate() + days);
        }
        return ticks;
    }

    const monthsTarget = target / (30 * DAY);
    const months = [1, 2, 3, 6, 12].find(m => m >= monthsTarget) ?? Math.ceil(monthsTarget / 12) * 12;
    const d = new Date(min);
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
    d.setMonth(Math.floor(d.getMonth() / Math.min(months, 12)) * Math.min(months, 12));
    while (d.getTime() < min) d.setMonth(d.getMonth() + months);
    while (d.getTime() <= max) {
        ticks.push(d.getTime());
        d.setMonth(d.getMonth() + months);
    }
    return ticks;
}
