/**
 * Reusable dropdown: a toggle button paired with a menu element.
 * Only one dropdown is open at a time, and clicking outside closes it.
 */
export class Dropdown {
    private static instances = new Set<Dropdown>();
    private static documentListenerAdded = false;

    constructor(private button: HTMLButtonElement, private menu: HTMLElement) {
        Dropdown.instances.add(this);
        Dropdown.addDocumentListener();

        this.button.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
            }
        });
    }

    get isOpen(): boolean {
        return this.menu.style.display !== 'none';
    }

    get content(): HTMLElement {
        return this.menu;
    }

    open(): void {
        Dropdown.instances.forEach(d => {
            if (d !== this) d.close();
        });
        this.menu.style.display = 'block';
        this.button.classList.add('active');
    }

    close(): void {
        this.menu.style.display = 'none';
        this.button.classList.remove('active');
    }

    setLabel(text: string): void {
        this.button.textContent = text;
    }

    private static addDocumentListener(): void {
        if (Dropdown.documentListenerAdded) return;
        Dropdown.documentListenerAdded = true;

        document.addEventListener('click', (e) => {
            Dropdown.instances.forEach(d => {
                if (!d.menu.contains(e.target as Node) && e.target !== d.button) d.close();
            });
        });
    }
}
