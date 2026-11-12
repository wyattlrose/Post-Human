// Drag and drop box (also clickable to open a file picker) that accepts image files of any type

export interface DropZoneOptions {
    onFiles: (files: File[]) => void;
    icon?: string;
}

// Some formats (e.g. HEIC, RAW) may have no MIME type reported, so fall back to the file extension
const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|bmp|tiff?|svg|avif|heic|heif|ico|jxl|raw|cr2|nef|arw|dng)$/i;
const isImage = (file: File): boolean => file.type.startsWith('image/') || (!file.type && IMAGE_EXTENSIONS.test(file.name));

export class DropZone {
    readonly element: HTMLElement;
    private readonly input: HTMLInputElement;
    private dragDepth = 0;

    constructor(container: HTMLElement, private readonly options: DropZoneOptions) {
        this.element = document.createElement('div');
        this.element.className = 'drop-zone';
        this.element.tabIndex = 0;

        this.element.title = 'Drop photos here or click to browse';
        const icon = document.createElement('img');
        icon.className = 'drop-zone-icon';
        icon.src = options.icon ?? 'features/sidebar/assets/photo-upload.svg';
        icon.alt = '';
        icon.draggable = false;
        this.element.appendChild(icon);

        this.input = document.createElement('input');
        this.input.type = 'file';
        this.input.accept = 'image/*';
        this.input.multiple = true;
        this.input.hidden = true;
        this.element.appendChild(this.input);

        this.element.addEventListener('click', () => this.input.click());
        this.element.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.input.click();
            }
        });
        this.input.addEventListener('change', () => {
            this.emit([...(this.input.files ?? [])]);
            this.input.value = '';
        });

        this.element.addEventListener('dragenter', (e) => {
            e.preventDefault();
            this.dragDepth++;
            this.element.classList.add('drag-over');
        });
        this.element.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        });
        this.element.addEventListener('dragleave', () => {
            this.dragDepth = Math.max(0, this.dragDepth - 1);
            if (this.dragDepth === 0) this.element.classList.remove('drag-over');
        });
        this.element.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dragDepth = 0;
            this.element.classList.remove('drag-over');
            this.emit([...(e.dataTransfer?.files ?? [])]);
        });

        container.appendChild(this.element);
    }

    private emit(files: File[]): void {
        const images = files.filter(isImage);
        if (images.length > 0) this.options.onFiles(images);
    }
}
