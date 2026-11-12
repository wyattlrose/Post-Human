export interface DateInputOptions {
    /** Called with the new local-midnight Unix timestamp in seconds, or null when cleared. */
    onChange?: (value: number | null) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

function localDate(year: number, month: number, day: number): Date | null {
    if (!Number.isInteger(year) || year < 1 || year > 9999) return null;
    const date = new Date(0);
    date.setHours(0, 0, 0, 0);
    date.setFullYear(year, month, day);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
    return date;
}

function parseInputDate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match ? localDate(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function formatInputDate(date: Date): string {
    if (!Number.isFinite(date.getTime())) return '';
    const year = date.getFullYear();
    if (year < 1 || year > 9999) return '';
    return `${String(year).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timestampToInputDate(seconds: number | null | undefined): string {
    return typeof seconds === 'number' && Number.isFinite(seconds)
        ? formatInputDate(new Date(seconds * 1000))
        : '';
}

function inputDateToTimestamp(value: string): number | null {
    const date = parseInputDate(value);
    return date ? Math.floor(date.getTime() / 1000) : null;
}

/** 'YYYY-MM-DD' → 'DD-MM-YYYY'; '' when empty or malformed. */
export function formatDisplayDate(iso: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

/**
 * 'DD-MM-YYYY' → 'YYYY-MM-DD', or null when it isn't a real date.
 * Also accepts '/', '.' or ' ' as separators and single-digit days/months.
 */
export function parseDisplayDate(text: string): string | null {
    const match = /^\s*(\d{1,2})[\/.\- ](\d{1,2})[\/.\- ](\d{4})\s*$/.exec(text);
    if (!match) return null;
    const [day, month] = [+match[1], +match[2]];
    const year = +match[3];
    if (!localDate(year, month - 1, day)) return null;
    return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
}

const CALENDAR_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;

/**
 * Date field that displays DD-MM-YYYY, independent of the system locale
 * (a native <input type="date"> follows the OS locale, which Electron on Linux can't override).
 *
 * Takes over an existing <input type="date">: it is kept, hidden, to provide the native
 * calendar popup and min/max handling, and a formatted text field takes its place.
 * `value`, `min` and `max` use local-midnight Unix seconds.
 */
export class DateInput {
    readonly element: HTMLSpanElement;

    private readonly native: HTMLInputElement;
    private readonly text: HTMLInputElement;
    private readonly pickerBtn: HTMLButtonElement;
    private readonly onChange?: (value: number | null) => void;

    constructor(input: HTMLInputElement, {onChange}: DateInputOptions = {}) {
        this.native = input;
        this.onChange = onChange;
        if (!input.max) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            this.max = Math.floor(today.getTime() / 1000);
        }

        this.element = document.createElement('span');
        this.element.className = 'date-input';
        input.replaceWith(this.element);

        this.text = document.createElement('input');
        this.text.type = 'text';
        this.text.className = 'text-input date-input-text';
        this.text.placeholder = 'DD-MM-YYYY';
        this.text.inputMode = 'numeric';
        this.text.autocomplete = 'off';
        this.text.required = input.required;
        // Move the id so that <label for="..."> targets the visible field.
        if (input.id) {
            this.text.id = input.id;
            input.removeAttribute('id');
        }

        const pickerBtn = document.createElement('button');
        this.pickerBtn = pickerBtn;
        pickerBtn.type = 'button';
        pickerBtn.className = 'date-input-picker';
        pickerBtn.title = 'Choose date';
        pickerBtn.setAttribute('aria-label', 'Choose date');
        pickerBtn.innerHTML = CALENDAR_ICON;

        input.required = false;
        input.tabIndex = -1;
        input.setAttribute('aria-hidden', 'true');
        input.classList.add('date-input-native');

        this.element.append(this.text, pickerBtn, input);
        this.text.value = formatDisplayDate(input.value);
        this.disabled = input.disabled;

        pickerBtn.addEventListener('click', () => this.openPicker());
        this.text.addEventListener('keydown', e => {
            if (e.altKey && e.key === 'ArrowDown') {
                e.preventDefault();
                this.openPicker();
            }
        });
        this.text.addEventListener('change', () => this.commitText());
        input.addEventListener('change', () => {
            this.text.value = formatDisplayDate(input.value);
            this.onChange?.(inputDateToTimestamp(input.value));
        });
    }

    /** Selected local calendar date as Unix seconds at local midnight, or null when empty. */
    get value(): number | null {
        return inputDateToTimestamp(this.native.value);
    }

    /** Sets the selected local calendar date from Unix seconds without firing `onChange`. */
    set value(seconds: number | null | undefined) {
        this.native.value = timestampToInputDate(seconds);
        this.text.value = formatDisplayDate(this.native.value);
    }

    get disabled(): boolean {
        return this.native.disabled;
    }

    set disabled(value: boolean) {
        this.native.disabled = value;
        this.text.disabled = value;
        this.pickerBtn.disabled = value;
    }

    /** Minimum selectable local calendar date as Unix seconds at local midnight, or null when unset. */
    get min(): number | null {
        return inputDateToTimestamp(this.native.min);
    }

    /** Sets the minimum using Unix seconds; null or invalid values remove the minimum. */
    set min(seconds: number | null | undefined) {
        this.native.min = timestampToInputDate(seconds);
    }

    /** Maximum selectable local calendar date as Unix seconds at local midnight, or null when unset. */
    get max(): number | null {
        return inputDateToTimestamp(this.native.max);
    }

    /** Sets the maximum using Unix seconds; null or invalid values remove the maximum. */
    set max(seconds: number | null | undefined) {
        this.native.max = timestampToInputDate(seconds);
    }

    focus() {
        this.text.focus();
    }

    private openPicker() {
        try {
            this.native.showPicker();
        } catch {
            this.text.focus();
        }
    }

    /** Applies typed text: valid dates are clamped to min/max, anything else reverts. */
    private commitText() {
        const raw = this.text.value.trim();
        let next: string | null;
        if (raw === '') next = this.text.required ? null : '';
        else next = parseDisplayDate(raw);

        if (next === null) {
            this.text.value = formatDisplayDate(this.native.value);
            return;
        }
        if (next && this.native.min && next < this.native.min) next = this.native.min;
        if (next && this.native.max && next > this.native.max) next = this.native.max;
        const changed = next !== this.native.value;
        this.native.value = next;
        this.text.value = formatDisplayDate(next);
        if (changed) this.onChange?.(inputDateToTimestamp(next));
    }
}
