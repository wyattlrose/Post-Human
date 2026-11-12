export interface Scale {
    (value: number): number;
    domain: [number, number];
    range: [number, number];
    invert(px: number): number;
}

export function linearScale(domain: [number, number], range: [number, number]): Scale {
    let [d0, d1] = domain;
    if (d0 === d1) {
        d0 -= 1;
        d1 += 1;
    }
    const [r0, r1] = range;
    const scale = ((v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)) as Scale;
    scale.domain = [d0, d1];
    scale.range = [r0, r1];
    scale.invert = (px: number) => d0 + ((px - r0) / (r1 - r0)) * (d1 - d0);
    return scale;
}
