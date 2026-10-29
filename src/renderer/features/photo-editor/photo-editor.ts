import {ProgressPhoto, Pose, LandmarkKey} from '../../../shared/types/index.js';
import {Dropdown} from '../../components/dropdown/dropdown.js';
import {initSlider, updateSliderPosition} from '../../components/slider/slider.js';
import {computeCropRect, CropSettings} from '../../utils/crop.js';

let poseDropdown: Dropdown | null = null;
let dateDropdown: Dropdown | null = null;

let allPhotos: ProgressPhoto[] = [];
let allPoses: Pose[] = [];
let currentPoseId: number | null = null;
let currentDate: number | null = null;
let editingPhoto: ProgressPhoto | null = null;
let editorInitialized = false;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 10;
const ZOOM_STEP = 1.15;
let zoom = 1;
let panX = 0;
let panY = 0;

export async function loadPhotoEditor(): Promise<void> {
    const dashboard = document.getElementById('photo-editor-dashboard');
    const poseBtn = document.getElementById('editor-pose-select-btn') as HTMLButtonElement;
    const poseMenu = document.getElementById('editor-pose-select-dropdown') as HTMLDivElement;
    const dateBtn = document.getElementById('editor-date-select-btn') as HTMLButtonElement;
    const dateMenu = document.getElementById('editor-date-select-dropdown') as HTMLDivElement;
    if (!dashboard || !poseBtn || !poseMenu || !dateBtn || !dateMenu) return;

    dashboard.style.display = 'flex';
    if (!poseDropdown) poseDropdown = new Dropdown(poseBtn, poseMenu);
    if (!dateDropdown) dateDropdown = new Dropdown(dateBtn, dateMenu);

    try {
        const [photos, poses] = await Promise.all([
            window.api.getProgressPhotos(),
            window.api.getProgressPoses()
        ]);
        allPhotos = photos ?? [];
        allPoses = poses ?? [];
    } catch (error) {
        console.error('Failed to load photo editor data:', error);
        allPhotos = [];
        allPoses = [];
    }

    // Default to the pose with the most recent photo
    const latest = allPhotos.reduce<ProgressPhoto | null>((best, p) => (!best || p.date > best.date) ? p : best, null);
    currentPoseId = latest?.poseId ?? allPoses[0]?.poseId ?? null;

    if (!editorInitialized) {
        setupLandmarkDragging();
        setupZoom();
        setupPanning();
        setupSidebar();
        editorInitialized = true;
    }

    renderPosePicker(poseMenu);
    selectPose(currentPoseId, dateMenu);
}

// Distinct upload dates for a pose, most recent first
function getPoseDates(poseId: number | null): number[] {
    const dates = new Set(allPhotos.filter(p => p.poseId === poseId).map(p => p.date));
    return [...dates].sort((a, b) => b - a);
}

function formatDate(date: number): string {
    return new Date(date * 1000).toLocaleDateString();
}

function selectPose(poseId: number | null, dateMenu: HTMLDivElement): void {
    currentPoseId = poseId;
    const pose = allPoses.find(p => p.poseId === poseId);
    poseDropdown?.setLabel(pose ? pose.poseName : 'Select Pose');

    renderSidebar();

    const dates = getPoseDates(poseId);
    renderDatePicker(dateMenu, dates);
    selectDate(dates[0] ?? null);
}

function selectDate(date: number | null): void {
    currentDate = date;
    dateDropdown?.setLabel(date !== null ? formatDate(date) : 'No dates');
    renderThumbnails();
    autoSelectPhoto();
}

const hasLandmarkValue = (v: number | null | undefined): boolean => v !== null && v !== undefined && isFinite(v);

// First photo (in angle order) missing any landmark value, otherwise the first photo
function autoSelectPhoto(): void {
    const photos = getSelectedPhotos();
    const photo = photos.find(p => ![p.yLandmark1, p.yLandmark2, p.xLandmark].every(hasLandmarkValue)) ?? photos[0] ?? null;
    document.querySelectorAll('#editor-thumbnail-strip .editor-thumbnail.selected').forEach(el => el.classList.remove('selected'));
    if (photo) document.querySelector(`#editor-thumbnail-strip .editor-thumbnail[data-photo-id="${photo.photoId}"]`)?.classList.add('selected');
    openEditor(photo);
}

const THUMBNAIL_WIDTH = 100;

// Photos for the current pose and date, ordered by the pose's angle order (unlisted angles last)
function getSelectedPhotos(): ProgressPhoto[] {
    const pose = allPoses.find(p => p.poseId === currentPoseId);
    const orderOf = (angleId: number): number => {
        const pa = pose?.angles.find(a => a.angleId === angleId);
        return pa ? pa.order : Number.MAX_SAFE_INTEGER;
    };
    return allPhotos
        .filter(p => p.poseId === currentPoseId && p.date === currentDate)
        .sort((a, b) => orderOf(a.angleId) - orderOf(b.angleId) || a.angleId - b.angleId);
}

function renderThumbnails(): void {
    const strip = document.getElementById('editor-thumbnail-strip');
    if (!strip) return;
    strip.innerHTML = '';

    const photos = getSelectedPhotos();
    if (photos.length === 0) {
        const msg = document.createElement('p');
        msg.textContent = 'No photos for this pose and date.';
        strip.appendChild(msg);
        return;
    }

    const pose = allPoses.find(p => p.poseId === currentPoseId);
    const aspectRatio = pose?.aspectRatio || 1.0;
    const poseSettings = {...pose, croppingPercent: pose?.croppingPercent || 50, aspectRatio};
    const tpl = document.getElementById('tpl-editor-thumbnail') as HTMLTemplateElement;

    photos.forEach(photo => {
        const item = (tpl.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLElement;
        item.dataset.photoId = photo.photoId.toString();
        const container = item.querySelector('.photo-container') as HTMLElement;
        container.style.setProperty('--container-width', `${THUMBNAIL_WIDTH}px`);
        container.style.setProperty('--container-height', `${THUMBNAIL_WIDTH / aspectRatio}px`);

        const img = item.querySelector('img') as HTMLImageElement;
        img.dataset.photo = JSON.stringify(photo);
        img.dataset.poseSettings = JSON.stringify(poseSettings);
        img.alt = photo.angle;
        img.src = `photo://${photo.photoId}.${photo.extension}`;

        (item.querySelector('.photo-placeholder') as HTMLElement).textContent = `ID: ${photo.photoId}`;
        (item.querySelector('.editor-thumbnail-label') as HTMLElement).textContent = photo.angle;
        item.addEventListener('click', () => {
            strip.querySelectorAll('.editor-thumbnail.selected').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            openEditor(photo);
        });
        strip.appendChild(item);
    });
}

// ---------- Sidebar ----------

type PoseLabelField = 'yLandmark1Label' | 'yLandmark2Label' | 'xLandmarkLabel';

function getSidebarInputs(): HTMLInputElement[] {
    return [...document.querySelectorAll<HTMLInputElement>('#editor-sidebar input[data-pose-field]')];
}

function renderSidebar(): void {
    const sidebar = document.getElementById('editor-sidebar');
    if (!sidebar) return;
    const pose = allPoses.find(p => p.poseId === currentPoseId);
    sidebar.style.display = pose ? 'flex' : 'none';
    if (!pose) return;
    getSidebarInputs().forEach(input => {
        input.value = pose[input.dataset.poseField as PoseLabelField] ?? '';
    });
    getNumberInputs().forEach(input => {
        const field = input.dataset.poseNumber as PoseNumberField;
        input.value = String(NUMBER_FIELDS[field].normalize(pose[field]));
        updateSliderLabel(input);
        updateSliderPosition(input);
    });
}

function updateSliderLabel(input: HTMLInputElement): void {
    const label = document.getElementById(`${input.id}-value`);
    if (label) label.textContent = NUMBER_FIELDS[input.dataset.poseNumber as PoseNumberField].suffix
        ? `${input.value}%` : input.value;
}

type PoseNumberField = 'croppingPercent' | 'aspectRatio' | 'verticalOffset' | 'horizontalOffset';

// Defaults and rounding (crop/aspect match the Progress Photos sliders); offsets default to 0
const NUMBER_FIELDS: Record<PoseNumberField, {normalize: (v: number | undefined) => number, suffix: boolean}> = {
    croppingPercent: {normalize: v => Math.round((v || 50) / 10) * 10, suffix: true},
    aspectRatio: {normalize: v => Math.round((v || 1.0) * 10) / 10, suffix: false},
    verticalOffset: {normalize: v => Math.round((v ?? 0) / 5) * 5, suffix: true},
    horizontalOffset: {normalize: v => Math.round((v ?? 0) / 5) * 5, suffix: true}
};

function getNumberInputs(): HTMLInputElement[] {
    return [...document.querySelectorAll<HTMLInputElement>('#editor-sidebar input[data-pose-number]')];
}

// Each description is saved to PROGRESS_POSE as soon as the input is committed (blur / Enter)
function setupSidebar(): void {
    getSidebarInputs().forEach(input => {
        const field = input.dataset.poseField as PoseLabelField;
        input.addEventListener('change', () => {
            const pose = allPoses.find(p => p.poseId === currentPoseId);
            if (!pose) return;
            pose[field] = input.value;
            window.api.updatePoseSettings(pose.poseId, {[field]: input.value});
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
        });
    });
    getNumberInputs().forEach(input => {
        const field = input.dataset.poseNumber as PoseNumberField;
        initSlider(input);
        // Live preview of the crop rectangle while dragging
        input.addEventListener('input', () => {
            updateSliderLabel(input);
            positionLandmarks();
        });
        // Saved when the slider is released
        input.addEventListener('change', () => {
            const pose = allPoses.find(p => p.poseId === currentPoseId);
            if (!pose) return;
            const value = parseFloat(input.value);
            pose[field] = value;
            window.api.updatePoseSettings(pose.poseId, {[field]: value});
            const selectedId = editingPhoto?.photoId;
            renderThumbnails();
            if (selectedId !== undefined) {
                document.querySelector(`#editor-thumbnail-strip .editor-thumbnail[data-photo-id="${selectedId}"]`)?.classList.add('selected');
            }
            positionLandmarks();
        });
    });
}

// Crop settings for the current pose, preferring the (possibly uncommitted) sidebar values
function getCropSettings(): CropSettings {
    const pose = allPoses.find(p => p.poseId === currentPoseId);
    const read = (field: PoseNumberField) => {
        const input = document.querySelector<HTMLInputElement>(`#editor-sidebar input[data-pose-number="${field}"]`);
        const v = input ? parseFloat(input.value) : NaN;
        return isFinite(v) ? v : pose?.[field];
    };
    return {
        croppingPercent: read('croppingPercent'),
        aspectRatio: read('aspectRatio'),
        verticalOffset: read('verticalOffset'),
        horizontalOffset: read('horizontalOffset')
    };
}

// ---------- Landmark editor ----------

function openEditor(photo: ProgressPhoto | null): void {
    editingPhoto = photo;
    const canvas = document.getElementById('editor-canvas');
    const img = document.getElementById('editor-image') as HTMLImageElement | null;
    if (!canvas || !img) return;

    if (!photo) {
        canvas.style.display = 'none';
        img.removeAttribute('src');
        return;
    }
    canvas.style.display = 'flex';
    resetZoom();
    img.alt = photo.angle;
    img.onload = () => positionLandmarks();
    img.src = `photo://${photo.photoId}.${photo.extension}`;
    if (img.complete && img.naturalWidth > 0) positionLandmarks();
}

// Base (zoom = 1) displayed size of the photo: fit inside the canvas
function getBaseSize(img: HTMLImageElement, canvas: HTMLElement): {width: number, height: number} {
    const aspect = img.naturalWidth / img.naturalHeight;
    let height = canvas.clientHeight;
    let width = height * aspect;
    if (width > canvas.clientWidth) {
        width = canvas.clientWidth;
        height = width / aspect;
    }
    return {width, height};
}

// The photo and overlays are laid out in real screen pixels (no CSS scale transforms), which avoids
// sub-pixel repaint artifacts. Landmark values are pixel coordinates in the original image.
function positionLandmarks(): void {
    const img = document.getElementById('editor-image') as HTMLImageElement | null;
    const canvas = document.getElementById('editor-canvas');
    if (!img || !canvas || !editingPhoto || img.naturalWidth === 0) return;
    const {naturalWidth, naturalHeight} = img;
    const base = getBaseSize(img, canvas);
    const width = Math.round(base.width * zoom);
    const height = Math.round(base.height * zoom);
    const left = Math.round(panX);
    const top = Math.round(panY);

    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
    img.style.left = `${left}px`;
    img.style.top = `${top}px`;

    // Final crop area, shared with applyDynamicCrop on Progress Photos (image pixel coordinates)
    const crop = computeCropRect(editingPhoto, getCropSettings());
    const sx = width / naturalWidth;
    const sy = height / naturalHeight;
    const rl = Math.round(left + crop.left * sx);
    const rt = Math.round(top + crop.top * sy);
    const rw = Math.round(left + (crop.left + crop.width) * sx) - rl;
    const rh = Math.round(top + (crop.top + crop.height) * sy) - rt;

    // Lines span the crop rectangle rather than the whole photo
    document.querySelectorAll<HTMLElement>('#editor-canvas [data-landmark]').forEach(el => {
        const key = el.dataset.landmark as LandmarkKey;
        const value = editingPhoto![key];
        const isHandle = el.classList.contains('editor-landmark');
        const along = handleAlong[key];
        if (key === 'xLandmark') {
            const x = Math.round(left + (value / naturalWidth) * width);
            if (isHandle) {
                el.style.left = `${x}px`;
                // Handle sits where the pointer is along its line (clamped to the line)
                const hy = along !== undefined ? Math.min(rt + rh, Math.max(rt, along)) : top + height / 2;
                el.style.top = `${Math.round(hy)}px`;
            } else {
                el.style.left = `${x}px`;
                el.style.top = `${rt}px`;
                el.style.height = `${rh}px`;
            }
        } else {
            const y = Math.round(top + (value / naturalHeight) * height);
            if (isHandle) {
                el.style.top = `${y}px`;
                const hx = along !== undefined ? Math.min(rl + rw, Math.max(rl, along)) : left + width / 2;
                el.style.left = `${Math.round(hx)}px`;
            } else {
                el.style.top = `${y}px`;
                el.style.left = `${rl}px`;
                el.style.width = `${rw}px`;
            }
        }
    });

    const rectEl = document.getElementById('editor-crop-rect');
    if (rectEl) {
        rectEl.style.left = `${rl}px`;
        rectEl.style.top = `${rt}px`;
        rectEl.style.width = `${rw}px`;
        rectEl.style.height = `${rh}px`;
    }
}

// Minimum gap between the Y landmarks, as a fraction of the photo height
const Y_LANDMARK_BUFFER = 0.02;

// Position of each handle along its line, in canvas pixels (follows the pointer while hovering the line)
const handleAlong: Partial<Record<LandmarkKey, number>> = {};

function setupLandmarkDragging(): void {
    const img = document.getElementById('editor-image') as HTMLImageElement | null;
    const canvas = document.getElementById('editor-canvas');
    if (!img || !canvas) return;

    document.querySelectorAll<HTMLElement>('#editor-canvas .editor-landmark').forEach(handle => {
        const key = handle.dataset.landmark as LandmarkKey;
        const line = document.querySelector<HTMLElement>(`#editor-canvas .editor-landmark-line[data-landmark="${key}"]`);
        let dragging = false;
        let moved = false;

        const updateFromPointer = (e: PointerEvent) => {
            if (!editingPhoto) return;
            const rect = img.getBoundingClientRect();
            if (key === 'xLandmark') {
                const ratio = (e.clientX - rect.left) / rect.width;
                editingPhoto.xLandmark = ratio * img.naturalWidth;
            } else {
                const ratio = (e.clientY - rect.top) / rect.height;
                // Y Landmark 1 must stay above Y Landmark 2 by a small buffer so they can't be swapped
                const buffer = img.naturalHeight * Y_LANDMARK_BUFFER;
                let y = ratio * img.naturalHeight;
                if (key === 'yLandmark1') y = Math.min(y, editingPhoto.yLandmark2 - buffer);
                else y = Math.max(y, editingPhoto.yLandmark1 + buffer);
                editingPhoto[key] = y;
            }
            moved = true;
            positionLandmarks();
        };

        const setState = (cls: string, on: boolean) => {
            document.querySelectorAll(`#editor-canvas [data-landmark="${key}"]`).forEach(el => el.classList.toggle(cls, on));
        };
        const followPointer = (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            handleAlong[key] = key === 'xLandmark' ? e.clientY - rect.top : e.clientX - rect.left;
            positionLandmarks();
        };
        handle.addEventListener('pointerenter', () => setState('hover', true));
        handle.addEventListener('pointerleave', () => setState('hover', false));

        const startDrag = (e: PointerEvent) => {
            if (!editingPhoto || e.button !== 0) return;
            dragging = true;
            setState('dragging', true);
            moved = false;
            handle.setPointerCapture(e.pointerId);
            e.preventDefault();
        };
        handle.addEventListener('pointerdown', startDrag);
        handle.addEventListener('pointermove', (e) => {
            if (dragging) {
                followPointer(e);
                updateFromPointer(e);
            }
        });

        if (line) {
            line.addEventListener('pointerenter', (e) => {
                setState('hover', true);
                followPointer(e);
            });
            line.addEventListener('pointermove', (e) => {
                if (!dragging) followPointer(e);
            });
            line.addEventListener('pointerleave', () => setState('hover', false));
            line.addEventListener('pointerdown', (e) => {
                followPointer(e);
                startDrag(e);
            });
        }
        const endDrag = (e: PointerEvent) => {
            if (!dragging) return;
            dragging = false;
            setState('dragging', false);
            if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
            if (moved && editingPhoto) saveLandmark(editingPhoto, key);
        };
        handle.addEventListener('pointerup', endDrag);
        handle.addEventListener('pointercancel', endDrag);
    });
}

function applyZoom(): void {
    positionLandmarks();
}

function resetZoom(): void {
    zoom = 1;
    panX = 0;
    panY = 0;
    applyZoom();
}

// Click and drag on the photo (not on a landmark) pans the zoomed view
function setupPanning(): void {
    const canvas = document.getElementById('editor-canvas');
    if (!canvas) return;
    let panning = false;
    let startX = 0;
    let startY = 0;

    canvas.addEventListener('pointerdown', (e) => {
        if (!editingPhoto || e.button !== 0) return;
        if ((e.target as HTMLElement).closest('.editor-landmark, .editor-landmark-line')) return;
        panning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        canvas.setPointerCapture(e.pointerId);
        canvas.classList.add('panning');
        e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
        if (!panning) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyZoom();
    });
    const endPan = (e: PointerEvent) => {
        if (!panning) return;
        panning = false;
        canvas.classList.remove('panning');
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    canvas.addEventListener('pointerup', endPan);
    canvas.addEventListener('pointercancel', endPan);
}

// Scroll up zooms in, scroll down zooms out, keeping the point under the cursor fixed
function setupZoom(): void {
    const canvas = document.getElementById('editor-canvas');
    if (!canvas) return;
    new ResizeObserver(() => positionLandmarks()).observe(canvas);

    canvas.addEventListener('wheel', (e) => {
        if (!editingPhoto) return;
        e.preventDefault();
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, e.deltaY < 0 ? zoom * ZOOM_STEP : zoom / ZOOM_STEP));
        if (newZoom === zoom) return;
        const rect = canvas.getBoundingClientRect();
        const localX = (e.clientX - rect.left - panX) / zoom;
        const localY = (e.clientY - rect.top - panY) / zoom;
        panX += localX * (zoom - newZoom);
        panY += localY * (zoom - newZoom);
        zoom = newZoom;
        applyZoom();
    }, {passive: false});
}

function saveLandmark(photo: ProgressPhoto, key: LandmarkKey): void {
    window.api.updatePhotoLandmark(photo.photoId, key, photo[key]);

    // Refresh the thumbnail crop to reflect the new landmark
    const thumbImg = document.querySelector<HTMLImageElement>(`.editor-thumbnail[data-photo-id="${photo.photoId}"] img`);
    if (thumbImg) {
        thumbImg.dataset.photo = JSON.stringify(photo);
        if (thumbImg.complete && thumbImg.naturalWidth > 0) window.applyDynamicCrop(thumbImg);
    }
}

function renderPosePicker(container: HTMLDivElement): void {
    const dateMenu = document.getElementById('editor-date-select-dropdown') as HTMLDivElement;
    container.innerHTML = '';
    allPoses.forEach(pose => {
        const item = document.createElement('div');
        item.className = 'interactable-dropdown-item';
        item.textContent = pose.poseName;
        item.addEventListener('click', () => {
            poseDropdown?.close();
            selectPose(pose.poseId, dateMenu);
        });
        container.appendChild(item);
    });
}

function renderDatePicker(container: HTMLDivElement, dates: number[]): void {
    container.innerHTML = '';
    dates.forEach(date => {
        const item = document.createElement('div');
        item.className = 'interactable-dropdown-item';
        item.textContent = formatDate(date);
        item.addEventListener('click', () => {
            dateDropdown?.close();
            selectDate(date);
        });
        container.appendChild(item);
    });
}
