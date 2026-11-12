import {EFFORT_MARKER_HOVER_DISTANCE, LineChart, LineChartPoint} from '../../components/line-chart/line-chart.js';
import {SegmentedControl} from '../../components/segmented-control/segmented-control.js';
import {Dropdown} from '../../components/dropdown/dropdown.js';
import {DateInput} from '../../components/date-input/date-input.js';
import type {BiometricEffort, EffortType} from '../../../shared/types/index.js';
import {clampRange, dateTicks, DAY, formatDate, formatWeight, weightAxis} from './axes.js';

type Period = 'L' | '12M' | '6M' | '3M';
type View = {kind: 'period'; period: Period} | {kind: 'effort'; effortId: number};
interface EffortDraft {
    startDate: number;
    typeKey: number;
    description: string;
}

const PERIOD_DAYS: Record<Exclude<Period, 'L'>, number> = {'12M': 364, '6M': 182, '3M': 91};
const EFFORT_LABEL_GAP = 8;
const EFFORT_LABEL_LEFT_INSET = 5;

const nowSeconds = () => Math.floor(Date.now() / 1000);
let activeCleanup: (() => void) | null = null;

/** 'YYYY-MM-DD' (local) for DateInput values. */
function toDateInput(seconds: number): string {
    const d = new Date(seconds * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of a 'YYYY-MM-DD' value, in seconds. */
function fromDateInput(value: string): number | null {
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    return Math.floor(new Date(y, m - 1, d).getTime() / 1000);
}

/** CSS class carrying the effort type's shade. */
const typeClass = (type: EffortType | undefined) => type ? `effort-type-${type.text.toLowerCase()}` : 'effort-type-unknown';

function swatch(type: EffortType | undefined): HTMLSpanElement {
    const node = document.createElement('span');
    node.className = `biometrics-effort-swatch ${typeClass(type)}`;
    return node;
}

export async function loadBiometrics() {
    activeCleanup?.();

    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const template = document.getElementById('tpl-biometrics-dashboard') as HTMLTemplateElement | null;
    const dashboard = template?.content.firstElementChild?.cloneNode(true);
    if (!(dashboard instanceof HTMLElement)) {
        console.error('Could not find the Biometrics page template.');
        return;
    }

    mainContent.appendChild(dashboard);

    const controller = new AbortController();
    const cleanupActions: Array<() => void> = [];
    let disposed = false;
    const cleanup = () => {
        if (disposed) return;
        disposed = true;
        controller.abort();
        cleanupActions.splice(0).reverse().forEach(dispose => dispose());
        dashboard.remove();
        if (activeCleanup === cleanup) activeCleanup = null;
    };
    activeCleanup = cleanup;

    const $ = <T extends HTMLElement>(selector: string) => dashboard.querySelector(selector) as T;
    const effortBtn = $<HTMLButtonElement>('.biometrics-effort-btn');
    const effortMenu = $<HTMLDivElement>('.biometrics-effort-menu');
    const editor = $<HTMLFormElement>('.biometrics-effort-editor');
    const typeBtn = $<HTMLButtonElement>('.biometrics-effort-type-btn');
    const typeMenu = $<HTMLDivElement>('.biometrics-effort-type-menu');
    const startInput = new DateInput($<HTMLInputElement>('.biometrics-effort-start'), {
        onChange: value => {
            const start = fromDateInput(value);
            if (start === null) return;
            void editEffort({startDate: Math.min(start, nowSeconds())});
        }
    });
    const descriptionInput = $<HTMLInputElement>('.biometrics-effort-description');
    const createBtn = $<HTMLButtonElement>('.biometrics-effort-create');
    const cancelBtn = $<HTMLButtonElement>('.biometrics-effort-cancel');

    const effortDropdown = new Dropdown(effortBtn, effortMenu);
    const typeDropdown = new Dropdown(typeBtn, typeMenu);
    cleanupActions.push(() => effortDropdown.dispose(), () => typeDropdown.dispose());

    let points: LineChartPoint[] = [];
    let efforts: BiometricEffort[] = []; // sorted by start date
    let effortTypes: EffortType[] = [];
    let view: View = {kind: 'period', period: 'L'};
    /** Non-null while the editor is creating a new effort. */
    let draft: EffortDraft | null = null;
    let yStep = 1;

    const typeOf = (key: number) => effortTypes.find(t => t.key === key);
    const selectedEffort = () => view.kind === 'effort' ? efforts.find(e => e.effortId === (view as {effortId: number}).effortId) ?? null : null;
    const effortLabel = (e: BiometricEffort) => [formatDate(e.startDate), typeOf(e.typeKey)?.text, e.description].filter(Boolean).join(' · ');

    const chart = new LineChart($('.biometrics-chart'), {
        xScale: 'time',
        timeUnit: 's',
        xTickValues: dateTicks,
        yTickValues: (min, max) => {
            const axis = weightAxis(min, max);
            yStep = axis.step;
            return axis.ticks;
        },
        formatX: formatDate,
        formatY: v => formatWeight(v, yStep),
        renderTooltip: hovers => {
            const {x, y} = hovers[0].point;
            const content = document.createDocumentFragment();
            const date = document.createElement('div');
            date.className = 'lc-tooltip-x';
            date.textContent = formatDate(x);
            const weight = document.createElement('div');
            weight.className = 'lc-tooltip-y';
            weight.textContent = `${y.toFixed(1)} kg`;
            content.append(date, weight);
            return content;
        },
        yAxisPadding: true,
        onRender: renderEffortMarkers,
        emptyText: 'No weight data in this range'
    });
    cleanupActions.push(() => chart.destroy());

    const effortLabels = document.createElement('div');
    effortLabels.className = 'biometrics-effort-labels';
    chart.element.appendChild(effortLabels);

    const periods = new SegmentedControl<Period>($('.biometrics-periods'), {
        label: 'Date range',
        value: 'L',
        options: [
            {value: 'L', label: 'L', title: 'Life Time'},
            {value: '12M', label: '12M', title: 'Past Year'},
            {value: '6M', label: '6M', title: 'Past 6 Months'},
            {value: '3M', label: '3M', title: 'Past 3 Months'}
        ],
        onChange: period => {
            view = {kind: 'period', period};
            render();
        }
    });

    /** Visible date range: a time range option, or an effort's start until the next effort's start (or today). */
    function range(): [number, number] {
        const now = nowSeconds();
        const effort = selectedEffort();
        if (effort) {
            const next = efforts[efforts.indexOf(effort) + 1];
            const end = next ? next.startDate : now;
            return clampRange(effort.startDate, Math.max(end, effort.startDate), 'start');
        }
        const period = view.kind === 'period' ? view.period : 'L';
        if (period === 'L') {
            const earliest = points.length ? points[0].x : now;
            return clampRange(Math.min(earliest, now), now);
        }
        return clampRange(now - PERIOD_DAYS[period] * DAY, now);
    }

    function selectEffort(effort: BiometricEffort) {
        effortDropdown.close();
        view = {kind: 'effort', effortId: effort.effortId};
        draft = null;
        render();
    }

    /** Vertical lines and descriptions at the start of each effort in range (time range views only). */
    function renderEffortMarkers(c: LineChart) {
        c.overlay.replaceChildren();
        effortLabels.replaceChildren();
        const scales = c.scales;
        if (!scales || view.kind !== 'period') {
            return;
        }
        const [start, end] = range();
        const width = c.overlay.getBoundingClientRect().width;
        const visibleEfforts = efforts
            .filter(e => e.startDate >= start && e.startDate <= end)
            .map(e => ({effort: e, x: Math.max(0, Math.min(width, scales.x(e.startDate)))}))
            .sort((a, b) => a.x - b.x || a.effort.startDate - b.effort.startDate || a.effort.effortId - b.effort.effortId);
        const labels = visibleEfforts.map(({effort: e, x}) => {
            const type = typeOf(e.typeKey);
            const marker = document.createElement('div');
            marker.className = `biometrics-effort-marker ${typeClass(type)}`;
            const label = document.createElement('div');
            label.className = `biometrics-effort-marker-label ${typeClass(type)}`;
            label.textContent = e.description || `${type?.text ?? 'Effort'} (${formatDate(e.startDate)})`;
            label.style.left = `${x}px`;
            const selectOnClick = (event: MouseEvent) => {
                if (event.button !== 0) return;
                selectEffort(e);
            };
            const setHovered = (hovered: boolean) => {
                marker.classList.toggle('is-hovered', hovered);
                label.classList.toggle('is-hovered', hovered);
                if (hovered) c.hideHover();
            };
            marker.addEventListener('click', selectOnClick);
            marker.addEventListener('pointermove', event => event.stopPropagation());
            marker.style.left = `${x}px`;
            marker.style.width = `${EFFORT_MARKER_HOVER_DISTANCE * 2}px`;
            label.addEventListener('click', selectOnClick);
            marker.addEventListener('mouseenter', () => setHovered(true));
            marker.addEventListener('mouseleave', () => setHovered(false));
            label.addEventListener('mouseenter', () => setHovered(true));
            label.addEventListener('mouseleave', () => setHovered(false));
            effortLabels.appendChild(label);
            c.overlay.appendChild(marker);
            const labelWidth = label.getBoundingClientRect().width;
            return {label, width: labelWidth, left: x - labelWidth / 2};
        });

        for (let index = labels.length - 1; index >= 0; index--) {
            const entry = labels[index];
            const right = index === labels.length - 1 ? width : labels[index + 1].left - EFFORT_LABEL_GAP;
            entry.left = Math.min(entry.left, right - entry.width);
        }

        labels.forEach((entry, index) => {
            const previous = labels[index - 1];
            entry.left = Math.max(entry.left, previous ? previous.left + previous.width + EFFORT_LABEL_GAP : EFFORT_LABEL_LEFT_INSET);
            entry.label.style.left = `${entry.left}px`;
        });
    }

    function renderEffortMenu() {
        const selected = selectedEffort();
        effortBtn.disabled = efforts.length === 0;
        effortBtn.title = efforts.length ? 'Show an effort' : 'No efforts yet — create one with "New Effort"';
        effortBtn.classList.toggle('is-selected', !!selected);
        effortBtn.textContent = selected ? effortLabel(selected) : 'Effort';
        effortMenu.replaceChildren(...[...efforts].reverse().map(e => {
            const item = document.createElement('div');
            item.className = 'interactable-dropdown-item';
            item.append(swatch(typeOf(e.typeKey)), effortLabel(e));
            item.addEventListener('click', () => selectEffort(e));
            return item;
        }));
    }

    function renderTypeMenu(selectedKey: number) {
        const selected = typeOf(selectedKey);
        typeBtn.replaceChildren(swatch(selected), selected?.text ?? 'Type');
        typeMenu.replaceChildren(...effortTypes.map(t => {
            const item = document.createElement('div');
            item.className = 'interactable-dropdown-item';
            item.append(swatch(t), t.text);
            item.addEventListener('click', () => {
                typeDropdown.close();
                void editEffort({typeKey: t.key});
            });
            return item;
        }));
    }

    /** The editor is shown while creating a new effort, or for the effort being viewed. */
    function renderEditor() {
        const effort = selectedEffort();
        const values: EffortDraft | null = draft ?? effort;
        editor.hidden = !values;
        if (!values) return;
        editor.classList.toggle('is-new', !!draft);
        createBtn.hidden = cancelBtn.hidden = !draft;
        startInput.max = toDateInput(nowSeconds());
        startInput.value = toDateInput(values.startDate);
        if (document.activeElement !== descriptionInput) descriptionInput.value = values.description;
        renderTypeMenu(values.typeKey);
    }

    function render() {
        if (disposed) return;
        if (view.kind === 'effort' && !selectedEffort()) view = {kind: 'period', period: 'L'};
        periods.setValue(view.kind === 'period' ? view.period : null);
        renderEffortMenu();
        renderEditor();
        const [start, end] = range();
        chart.setXDomain([start, end]);
        chart.setData(points.filter(p => p.x >= start && p.x <= end));
    }

    async function reloadEfforts() {
        const loadedEfforts = await window.api.getBiometricEfforts();
        if (disposed) return;
        efforts = loadedEfforts;
        render();
    }

    /** Applies a change to the draft, or saves it to the effort being viewed. */
    async function editEffort(update: Partial<EffortDraft>) {
        if (draft) {
            draft = {...draft, ...update};
            renderEditor();
            return;
        }
        const effort = selectedEffort();
        if (!effort) return;
        const updated = await window.api.updateBiometricEffort(effort.effortId, update);
        if (!disposed && updated) await reloadEfforts();
    }

    $('.biometrics-new-effort-btn').addEventListener('click', () => {
        draft = {startDate: fromDateInput(toDateInput(nowSeconds()))!, typeKey: effortTypes[0]?.key ?? 1, description: ''};
        descriptionInput.value = '';
        renderEditor();
        startInput.focus();
    }, {signal: controller.signal});

    const withingsBtn = $<HTMLButtonElement>('.biometrics-withings-btn');
    withingsBtn.addEventListener('click', async () => {
        withingsBtn.disabled = true;
        withingsBtn.textContent = 'Waiting for Withings…';
        try {
            const result = await window.api.fetchWithingsWeight();
            if (disposed) return;
            if (result.success) {
                console.log('All Withings weight data:', result.response);
                console.log(`Saved ${result.saved} Withings weight measurements.`);
                const rows = await window.api.getBiometricWeight();
                if (disposed) return;
                points = rows.map(r => ({x: r.date, y: r.weight})).sort((a, b) => a.x - b.x);
                render();
            } else console.error('Withings weight fetch failed:', result.error);
        } finally {
            if (!disposed) {
                withingsBtn.disabled = false;
                withingsBtn.textContent = 'Withings';
            }
        }
    }, {signal: controller.signal});

    descriptionInput.addEventListener('change', () => {
        void editEffort({description: descriptionInput.value.trim()});
    }, {signal: controller.signal});

    cancelBtn.addEventListener('click', () => {
        draft = null;
        renderEditor();
    }, {signal: controller.signal});

    editor.addEventListener('submit', async e => {
        e.preventDefault();
        if (!draft) return;
        const {startDate, typeKey, description} = {...draft, description: descriptionInput.value.trim()};
        if (!await window.api.createBiometricEffort(startDate, typeKey, description)) return;
        if (disposed) return;
        draft = null;
        await reloadEfforts();
    }, {signal: controller.signal});

    const [rows, effortRows, typeRows] = await Promise.all([
        window.api.getBiometricWeight(),
        window.api.getBiometricEfforts(),
        window.api.getEffortTypes()
    ]);
    if (disposed) return;
    points = rows.map(r => ({x: r.date, y: r.weight})).sort((a, b) => a.x - b.x);
    efforts = effortRows;
    effortTypes = typeRows;
    render();
}

export function cleanupBiometrics(): void {
    activeCleanup?.();
}
