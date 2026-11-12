export interface SegmentedControlOption<T extends string> {
    value: T;
    label: string;
    /** Tooltip / accessible name when the label is abbreviated. */
    title?: string;
}

export interface SegmentedControlOptions<T extends string> {
    options: SegmentedControlOption<T>[];
    /** Initially selected value; null leaves no segment selected. */
    value?: T | null;
    /** Accessible name of the group. */
    label?: string;
    /** Called when the user selects a segment (not on `setValue`). */
    onChange?: (value: T) => void;
}

/**
 * A row of mutually exclusive buttons (radio group).
 * The selection can be cleared with `setValue(null)` so that an external
 * control can take over without a segment appearing active.
 */
export class SegmentedControl<T extends string> {
    readonly element: HTMLDivElement;

    private readonly buttons = new Map<T, HTMLButtonElement>();
    private readonly onChange?: (value: T) => void;
    private current: T | null = null;

    constructor(container: HTMLElement, {options, value = null, label, onChange}: SegmentedControlOptions<T>) {
        this.onChange = onChange;
        this.element = document.createElement('div');
        this.element.className = 'segmented-control';
        this.element.setAttribute('role', 'radiogroup');
        if (label) this.element.setAttribute('aria-label', label);

        options.forEach(option => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'segmented-control-option';
            button.textContent = option.label;
            button.dataset.value = option.value;
            button.setAttribute('role', 'radio');
            if (option.title) {
                button.title = option.title;
                button.setAttribute('aria-label', option.title);
            }
            button.addEventListener('click', () => this.select(option.value));
            this.buttons.set(option.value, button);
            this.element.appendChild(button);
        });

        this.element.addEventListener('keydown', this.onKeyDown);
        this.setValue(value);
        container.appendChild(this.element);
    }

    get value(): T | null {
        return this.current;
    }

    /** Updates the selection without firing `onChange`. */
    setValue(value: T | null) {
        this.current = value !== null && this.buttons.has(value) ? value : null;
        const values = [...this.buttons.keys()];
        const focusable = this.current ?? values[0];
        this.buttons.forEach((button, key) => {
            const selected = key === this.current;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-checked', String(selected));
            button.tabIndex = key === focusable ? 0 : -1;
        });
    }

    private select(value: T) {
        if (value === this.current) return;
        this.setValue(value);
        this.onChange?.(value);
    }

    private onKeyDown = (e: KeyboardEvent) => {
        const values = [...this.buttons.keys()];
        const index = values.findIndex(v => this.buttons.get(v) === document.activeElement);
        if (index < 0) return;
        let next: number;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % values.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + values.length) % values.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = values.length - 1;
        else return;
        e.preventDefault();
        this.select(values[next]);
        this.buttons.get(values[next])!.focus();
    };
}
