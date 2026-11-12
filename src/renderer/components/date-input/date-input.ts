export interface DateInputOptions {
    /** Called with the new 'YYYY-MM-DD' value when the user picks or types a date (not on `value` assignment). */
    onChange?: (value: string) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' → 'DD-MM-YY'; '' when empty or malformed. */
export function formatDisplayDate(iso: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return match ? `${match[3]}-${match[2]}-${match[1].slice(-2)}` : '';
}

/**
 * 'DD-MM-YY' or 'DD-MM-YYYY' → 'YYYY-MM-DD', or null when it isn't a real date.
 * Also accepts '/', '.' or ' ' as separators and single-digit days/months.
 */
export function parseDisplayDate(text: string): string | null {
    const match = /^\s*(\d{1,2})[\/.\- ](\d{1,2})[\/.\- ](\d{2}|\d{4})\s*$/.exec(text);
    if (!match) return null;
    const [day, month] = [+match[1], +match[2]];
    const yearText = match[3];
    const year = yearText.length === 2 ? 2000 + +yearText : +yearText;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return `${year}-${pad(month)}-${pad(day)}`;
}

const CALENDAR_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;

/**
 * Date field that always displays DD-MM-YY, independent of the system locale
 * (a native <input type="date"> follows the OS locale, which Electron on Linux can't override).
 *
 * Takes over an existing <input type="date">: it is kept, hidden, to provide the native
 * calendar popup and min/max handling, and a text field showing DD-MM-YY takes its place.
 * `value`, `min` and `max` use the native 'YYYY-MM-DD' format.
 */
export class DateInput {
    readonly element: HTMLSpanElement;

    private readonly native: HTMLInputElement;
    private readonly text: HTMLInputElement;
    private readonly onChange?: (value: string) => void;

    constructor(input: HTMLInputElement, {onChange}: DateInputOptions = {}) {
        this.native = input;
        this.onChange = onChange;

        this.element = document.createElement('span');
        this.element.className = 'date-input';
        input.replaceWith(this.element);

        this.text = document.createElement('input');
        this.text.type = 'text';
        this.text.className = 'text-input date-input-text';
        this.text.placeholder = 'DD-MM-YY';
        this.text.inputMode = 'numeric';
        this.text.autocomplete = 'off';
        this.text.required = input.required;
        // Move the id so that <label for="..."> targets the visible field.
        if (input.id) {
            this.text.id = input.id;
            input.removeAttribute('id');
        }

        const pickerBtn = document.createElement('button');
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
            this.onChange?.(input.value);
        });
    }

    /** 'YYYY-MM-DD', or '' when empty. */
    get value(): string {
        return this.native.value;
    }

    /** Sets the date without firing `onChange`; malformed values clear the field. */
    set value(value: string) {
        this.native.value = value;
        this.text.value = formatDisplayDate(this.native.value);
    }

    get min(): string {
        return this.native.min;
    }

    set min(value: string) {
        this.native.min = value;
    }

    get max(): string {
        return this.native.max;
    }

    set max(value: string) {
        this.native.max = value;
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
        this.value = next;
        if (changed) this.onChange?.(next);
    }
}
