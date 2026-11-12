import {linearScale, Scale} from './scale.js';
import {niceTicks, timeTicks} from './ticks.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
export const EFFORT_MARKER_HOVER_DISTANCE = 18;

export interface LineChartPoint {
    /** Unix epoch time in seconds. */
    x: number;
    y: number;
}

export interface LineChartSeries {
    id: string;
    label?: string;
    points: LineChartPoint[];
    /** Extra class for styling (colour comes from CSS: `--lc-series-color`). */
    className?: string;
}

export interface LineChartHover {
    series: LineChartSeries;
    point: LineChartPoint;
}

type Content = string | Node;

export interface LineChartOptions {
    /** Approximate number of generated x-axis time ticks. */
    xTicks?: number;
    /** Approximate number of generated y-axis ticks. */
    yTicks?: number;
    /** Adds one adjacent tick interval of empty space beyond each end of the y-axis range; defaults to false. */
    yAxisPadding?: boolean;
    /** Generates x-axis tick positions for a non-degenerate visible domain in epoch seconds; overrides `xTicks` generation. */
    xTickValues?: (min: number, max: number) => number[];
    /** Generates y-axis tick positions from the data range; returned ticks must cover [min, max] and define the y domain. */
    yTickValues?: (min: number, max: number) => number[];
    /** Formats epoch-second x values for axis labels and the default hover tooltip. */
    formatX?: (value: number) => string;
    /** Formats y values for axis labels and the default hover tooltip. */
    formatY?: (value: number) => string;
    /** Replaces the default hover tooltip with content rendered from the hovered points and chart. */
    renderTooltip?: (hovers: LineChartHover[], chart: LineChart) => Content;
    /** Whether to draw a circle at each data point; defaults to true. */
    showPoints?: boolean;
    /** Whether to show the legend for series that have labels; defaults to false. */
    showLegend?: boolean;
    /** Text displayed in the plot when there are no data points. */
    emptyText?: string;
    /** Called after each render, including empty or zero-size renders; use `plotLayer`/`overlay` and `scales` to draw annotations. */
    onRender?: (chart: LineChart) => void;
}

function createSvg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
    return node;
}

function createDiv(className: string, content?: Content): HTMLDivElement {
    const node = document.createElement('div');
    node.className = className;
    if (content !== undefined) node.append(content);
    return node;
}

/** Index of the point with x closest to `x` (points sorted by x). */
function nearestIndex(points: LineChartPoint[], x: number): number {
    let lo = 0, hi = points.length - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (points[mid].x < x) lo = mid + 1;
        else hi = mid;
    }
    if (lo > 0 && Math.abs(points[lo - 1].x - x) <= Math.abs(points[lo].x - x)) return lo - 1;
    return lo;
}

function getYTickValues(min: number, max: number, count: number, customValues?: (min: number, max: number) => number[], padding = false): number[] {
    const values = customValues ? customValues(min, max) : niceTicks(min, max, count);
    if (!padding) return values;

    const ticks = new Set(values).size < 2 ? niceTicks(min, max, count) : values;
    const first = ticks[0];
    const last = ticks[ticks.length - 1];
    const next = ticks.find(value => value !== first)!;
    const previous = [...ticks].reverse().find(value => value !== last)!;
    return [Number((first - (next - first)).toFixed(10)), ...ticks, Number((last + (last - previous)).toFixed(10))];
}

export class LineChart {
    readonly element: HTMLDivElement;
    /** HTML layer above the plot, sized to the plot area. */
    readonly overlay: HTMLDivElement;
    /** SVG group drawn above the lines, in plot pixel coordinates. */
    readonly plotLayer: SVGGElement;

    private readonly options: Required<Omit<LineChartOptions, 'renderTooltip' | 'onRender' | 'xTickValues' | 'yTickValues'>> & LineChartOptions;
    private readonly yAxis: HTMLDivElement;
    private readonly xAxis: HTMLDivElement;
    private readonly legend: HTMLDivElement;
    private readonly plot: HTMLDivElement;
    private readonly svgEl: SVGSVGElement;
    private readonly gridLayer: SVGGElement;
    private readonly seriesLayer: SVGGElement;
    private readonly hoverLayer: SVGGElement;
    private readonly tooltip: HTMLDivElement;
    private readonly empty: HTMLDivElement;
    private readonly observer: ResizeObserver;

    private series: LineChartSeries[] = [];
    private width = 0;
    private height = 0;
    private sx: Scale | null = null;
    private sy: Scale | null = null;
    private xDomain: [number, number] | null = null;

    constructor(container: HTMLElement, options: LineChartOptions = {}) {
        this.options = {
            xTicks: 6,
            yTicks: 5,
            yAxisPadding: false,
            formatX: v => String(v),
            formatY: v => String(v),
            showPoints: true,
            showLegend: false,
            emptyText: 'No data',
            ...options
        };

        this.element = createDiv('line-chart');
        this.yAxis = createDiv('lc-y-axis');
        this.plot = createDiv('lc-plot');
        this.xAxis = createDiv('lc-x-axis');
        this.legend = createDiv('lc-legend');

        this.svgEl = createSvg('svg', {class: 'lc-svg'});
        this.gridLayer = createSvg('g', {class: 'lc-grid'});
        this.seriesLayer = createSvg('g', {class: 'lc-series-layer'});
        this.plotLayer = createSvg('g', {class: 'lc-plot-layer'});
        this.hoverLayer = createSvg('g', {class: 'lc-hover'});
        this.svgEl.append(this.gridLayer, this.seriesLayer, this.plotLayer, this.hoverLayer);

        this.overlay = createDiv('lc-overlay');
        this.tooltip = createDiv('lc-tooltip');
        this.tooltip.hidden = true;
        this.empty = createDiv('lc-empty', this.options.emptyText);
        this.plot.append(this.svgEl, this.overlay, this.tooltip, this.empty);

        this.element.append(this.yAxis, this.plot, createDiv('lc-corner'), this.xAxis, this.legend);
        container.appendChild(this.element);

        this.plot.addEventListener('pointermove', this.onPointerMove);
        this.plot.addEventListener('pointerleave', this.hideHover);

        this.observer = new ResizeObserver(entries => {
            const {width, height} = entries[0].contentRect;
            if (width === this.width && height === this.height) return;
            this.width = width;
            this.height = height;
            this.render();
        });
        this.observer.observe(this.plot);
    }

    /** Accepts a single series of points or multiple series. */
    setData(data: LineChartPoint[] | LineChartSeries[]) {
        const list: LineChartSeries[] = data.length && 'points' in data[0]
            ? data as LineChartSeries[]
            : [{id: 'default', points: data as LineChartPoint[]}];
        this.series = list.map(s => ({...s, points: [...s.points].sort((a, b) => a.x - b.x)}));
        this.renderLegend();
        this.render();
    }

    /** Fixes the visible x range in epoch seconds (instead of the data extent); null restores the data extent. */
    setXDomain(domain: [number, number] | null) {
        this.xDomain = domain && domain[1] > domain[0] ? [domain[0], domain[1]] : null;
        this.render();
    }

    /** Current scales (data -> plot pixels); null before the first render with data. */
    get scales(): {x: Scale; y: Scale} | null {
        return this.sx && this.sy ? {x: this.sx, y: this.sy} : null;
    }

    destroy() {
        this.observer.disconnect();
        this.element.remove();
    }

    private xTickValues(min: number, max: number): number[] {
        const {xTicks, xTickValues} = this.options;
        if (xTickValues) return xTickValues(min, max);
        return timeTicks(min, max, xTicks);
    }

    private render() {
        const {yTicks, yTickValues, yAxisPadding, formatX, formatY, showPoints, onRender} = this.options;
        const points = this.series.flatMap(s => s.points);
        const w = this.width, h = this.height;

        this.gridLayer.replaceChildren();
        this.seriesLayer.replaceChildren();
        this.yAxis.replaceChildren();
        this.xAxis.replaceChildren();
        this.hideHover();

        const isEmpty = points.length === 0;
        this.empty.hidden = !isEmpty;
        this.element.classList.toggle('is-empty', isEmpty);
        if (isEmpty || w === 0 || h === 0) {
            this.sx = this.sy = null;
            if (isEmpty) this.plotLayer.replaceChildren();
            onRender?.(this);
            return;
        }

        this.svgEl.setAttribute('width', String(w));
        this.svgEl.setAttribute('height', String(h));

        const xs = points.map(p => p.x), ys = points.map(p => p.y);
        const [xMin, xMax] = this.xDomain ?? [Math.min(...xs), Math.max(...xs)];
        const yMin = Math.min(...ys), yMax = Math.max(...ys);
        const yValues = getYTickValues(yMin, yMax, yTicks, yTickValues, yAxisPadding);

        const sx = this.sx = linearScale([xMin, xMax], [0, w]);
        const sy = this.sy = linearScale([yValues[0], yValues[yValues.length - 1]], [h, 0]);

        const xValues = xMin === xMax ? [xMin] : this.xTickValues(xMin, xMax);

        this.renderAxisTicks(this.yAxis, yValues, sy, 'y', w, formatY);
        this.renderAxisTicks(this.xAxis, xValues, sx, 'x', h, formatX);

        this.series.forEach(s => {
            if (!s.points.length) return;
            const g = createSvg('g', {class: `lc-series ${s.className ?? ''}`.trim(), 'data-series': s.id});
            const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)},${sy(p.y)}`).join(' ');
            g.appendChild(createSvg('path', {d, class: 'lc-line'}));
            if (showPoints) {
                s.points.forEach(p => g.appendChild(createSvg('circle', {class: 'lc-point', cx: sx(p.x), cy: sy(p.y), r: 2.5})));
            }
            this.seriesLayer.appendChild(g);
        });

        onRender?.(this);
    }

    private renderAxisTicks(
        axis: HTMLDivElement,
        values: number[],
        scale: Scale,
        orientation: 'x' | 'y',
        extent: number,
        format: (value: number) => string
    ) {
        values.forEach(value => {
            const position = scale(value);
            const line = orientation === 'x'
                ? createSvg('line', {class: 'lc-grid-line', x1: position, x2: position, y1: 0, y2: extent})
                : createSvg('line', {class: 'lc-grid-line', x1: 0, x2: extent, y1: position, y2: position});
            this.gridLayer.appendChild(line);

            const label = createDiv('lc-tick', format(value));
            label.style.setProperty('--lc-pos', `${position}px`);
            axis.appendChild(label);
        });
    }

    private renderLegend() {
        this.legend.replaceChildren();
        const labelled = this.series.filter(s => s.label);
        this.legend.hidden = !this.options.showLegend || labelled.length === 0;
        labelled.forEach(s => {
            const item = createDiv(`lc-legend-item ${s.className ?? ''}`.trim());
            item.append(createDiv('lc-legend-swatch'), s.label!);
            this.legend.appendChild(item);
        });
    }

    private onPointerMove = (e: PointerEvent) => {
        const {sx, sy} = this;
        if (!sx || !sy) return;
        const rect = this.plot.getBoundingClientRect();
        const xValue = sx.invert(e.clientX - rect.left);

        let best: LineChartHover | null = null;
        for (const s of this.series) {
            if (!s.points.length) continue;
            const p = s.points[nearestIndex(s.points, xValue)];
            if (!best || Math.abs(p.x - xValue) < Math.abs(best.point.x - xValue)) best = {series: s, point: p};
        }
        if (!best) return;
        const targetX = best.point.x;
        const hovers: LineChartHover[] = this.series
            .filter(s => s.points.length)
            .map(s => ({series: s, point: s.points[nearestIndex(s.points, targetX)]}))
            .filter(hv => hv.point.x === targetX);

        const px = sx(targetX);
        const top = Math.min(...hovers.map(hv => sy(hv.point.y)));
        this.hoverLayer.replaceChildren(createSvg('line', {class: 'lc-crosshair', x1: px, x2: px, y1: top, y2: this.height}));
        hovers.forEach(hv => this.hoverLayer.appendChild(createSvg('circle', {
            class: `lc-hover-point ${hv.series.className ?? ''}`.trim(), cx: px, cy: sy(hv.point.y), r: 5
        })));

        const {formatX, formatY, renderTooltip} = this.options;
        if (renderTooltip) {
            this.tooltip.replaceChildren(renderTooltip(hovers, this));
        } else {
            const content = document.createDocumentFragment();
            content.appendChild(createDiv('lc-tooltip-x', formatX(targetX)));
            hovers.forEach(hv => content.appendChild(createDiv(
                'lc-tooltip-y',
                `${hv.series.label ? hv.series.label + ': ' : ''}${formatY(hv.point.y)}`
            )));
            this.tooltip.replaceChildren(content);
        }
        this.tooltip.hidden = false;
        this.tooltip.style.left = `${px}px`;
        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.setProperty('--lc-tooltip-point-y', `${top}px`);
    };

    /** Hides the point-hover crosshair and tooltip. */
    hideHover = () => {
        this.hoverLayer.replaceChildren();
        this.tooltip.hidden = true;
    };
}
