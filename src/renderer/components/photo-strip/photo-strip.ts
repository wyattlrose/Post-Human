// Horizontal strip of photo thumbnails, shared by the Photo Editor and Photo Upload pages

export interface PhotoStripItem {
    key: string;
    src: string;
    label: string;
    placeholder?: string;
    // When both are set, the thumbnail is cropped with applyDynamicCrop; otherwise it is shown uncropped
    photo?: unknown;
    poseSettings?: unknown;
}

export interface PhotoStripOptions {
    width?: number;
    aspectRatio?: number;
    emptyMessage?: string;
    selectedKey?: string | null;
    onSelect?: (key: string) => void;
}

const DEFAULT_WIDTH = 100;

export function renderPhotoStrip(strip: HTMLElement, items: PhotoStripItem[], options: PhotoStripOptions = {}): void {
    strip.innerHTML = '';
    strip.classList.add('photo-strip');

    if (items.length === 0) {
        if (options.emptyMessage === '') return;
        const msg = document.createElement('p');
        msg.textContent = options.emptyMessage ?? 'No photos.';
        strip.appendChild(msg);
        return;
    }

    const width = options.width ?? DEFAULT_WIDTH;
    const aspectRatio = options.aspectRatio || 1.0;
    const tpl = document.getElementById('tpl-photo-strip-item') as HTMLTemplateElement;

    items.forEach(entry => {
        const item = (tpl.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLElement;
        item.dataset.key = entry.key;
        if (entry.key === options.selectedKey) item.classList.add('selected');
        const container = item.querySelector('.photo-container') as HTMLElement;
        container.style.setProperty('--container-width', `${width}px`);
        container.style.setProperty('--container-height', `${width / aspectRatio}px`);

        const img = item.querySelector('img') as HTMLImageElement;
        if (entry.photo && entry.poseSettings) {
            img.dataset.photo = JSON.stringify(entry.photo);
            img.dataset.poseSettings = JSON.stringify(entry.poseSettings);
        } else {
            img.classList.add('uncropped');
        }
        img.alt = entry.label;
        img.src = entry.src;

        (item.querySelector('.photo-placeholder') as HTMLElement).textContent = entry.placeholder ?? entry.label;
        (item.querySelector('.photo-strip-label') as HTMLElement).textContent = entry.label;
        item.addEventListener('click', () => {
            selectPhotoStripItem(strip, entry.key);
            options.onSelect?.(entry.key);
        });
        strip.appendChild(item);
    });
}

export function selectPhotoStripItem(strip: HTMLElement, key: string | null): void {
    strip.querySelectorAll('.photo-strip-item.selected').forEach(el => el.classList.remove('selected'));
    if (key !== null) getPhotoStripItem(strip, key)?.classList.add('selected');
}

export function getPhotoStripItem(strip: HTMLElement, key: string): HTMLElement | null {
    return strip.querySelector<HTMLElement>(`.photo-strip-item[data-key="${CSS.escape(key)}"]`);
}

export interface PhotoStripControls {
    angles: {angleId: number, angle: string}[];
    angleId: number | null;
    onAngleChange: (angleId: number | null) => void;
    onRemove: () => void;
}

// Angle dropdown and Remove button shown under a photo
export function appendPhotoStripControls(item: HTMLElement, controls: PhotoStripControls): void {
    const select = document.createElement('select');
    select.className = 'text-input photo-strip-angle-select';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Angle';
    select.appendChild(placeholder);
    controls.angles.forEach(a => {
        const option = document.createElement('option');
        option.value = String(a.angleId);
        option.textContent = a.angle;
        select.appendChild(option);
    });
    select.value = controls.angleId !== null ? String(controls.angleId) : '';
    select.addEventListener('click', e => e.stopPropagation());
    select.addEventListener('change', () => controls.onAngleChange(select.value ? parseInt(select.value, 10) : null));

    const remove = document.createElement('button');
    remove.className = 'interactable-button photo-strip-remove';
    remove.textContent = 'Remove';
    remove.addEventListener('click', e => {
        e.stopPropagation();
        controls.onRemove();
    });

    item.append(select, remove);
}
