import {ProgressPhoto, Pose} from '../../../shared/types/index.js';
import {Dropdown} from '../../components/dropdown/dropdown.js';
import {defaultLandmarks} from '../../../shared/constants/photo.js';
import {DropZone} from '../../components/drop-zone/drop-zone.js';
import {DateInput} from '../../components/date-input/date-input.js';
import {renderPhotoStrip, getPhotoStripItem, appendPhotoStripControls} from '../../components/photo-strip/photo-strip.js';

// A dropped photo awaiting its angle. Nothing is persisted until Save is pressed.
interface PendingPhoto {
    key: string;
    file: File;
    url: string;
    extension: string;
    angleId: number | null;
}

let pending: PendingPhoto[] = [];
let allPoses: Pose[] = [];
let existingPhotos: ProgressPhoto[] = [];
let currentDate: number | null = null;
let currentPoseId: number | null = null;
let poseDropdown: Dropdown | null = null;
let dateInput: DateInput | null = null;
let nextKey = 0;
let saving = false;
let uploadInitialized = false;

const THUMBNAIL_WIDTH = 100;

export async function loadPhotoUpload(): Promise<void> {
    const dashboard = document.getElementById('photo-upload-dashboard');
    const dropContainer = document.getElementById('upload-drop-container');
    const poseBtn = document.getElementById('upload-pose-select-btn') as HTMLButtonElement;
    const poseMenu = document.getElementById('upload-pose-select-dropdown') as HTMLDivElement;
    if (!dashboard || !dropContainer || !poseBtn || !poseMenu) return;
    dashboard.style.display = 'flex';
    if (!poseDropdown) poseDropdown = new Dropdown(poseBtn, poseMenu);

    await refreshData();

    if (!uploadInitialized) {
        new DropZone(dropContainer, {onFiles: addFiles});
        setupHeader();
        document.getElementById('upload-save')?.addEventListener('click', save);
        currentDate = todayTimestamp();
        uploadInitialized = true;
    }
    if (!allPoses.some(p => p.poseId === currentPoseId)) currentPoseId = allPoses[0]?.poseId ?? null;

    renderPosePicker(poseMenu);
    renderHeader();
    renderStrip();
}

async function refreshData(): Promise<void> {
    try {
        const [photos, poses] = await Promise.all([
            window.api.getProgressPhotos(),
            window.api.getProgressPoses()
        ]);
        existingPhotos = photos ?? [];
        allPoses = poses ?? [];
    } catch (error) {
        console.error('Failed to load photo upload data:', error);
        existingPhotos = [];
        allPoses = [];
    }
}

function addFiles(files: File[]): void {
    pending.push(...files.map<PendingPhoto>(file => ({
        key: `pending-${nextKey++}`,
        file,
        url: URL.createObjectURL(file),
        extension: getExtension(file),
        angleId: null
    })));
    setStatus('');
    renderStrip();
}

function removePhoto(key: string): void {
    const photo = pending.find(p => p.key === key);
    if (photo) URL.revokeObjectURL(photo.url);
    pending = pending.filter(p => p.key !== key);
    renderStrip();
}

function getExtension(file: File): string {
    const match = /\.([^.]+)$/.exec(file.name);
    if (match) return match[1].toLowerCase();
    return file.type.replace(/^image\//, '').replace('jpeg', 'jpg');
}

// Dates are stored as unix seconds at local midnight
function todayTimestamp(): number {
    const now = new Date();
    return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
}

function toDateInputValue(date: number | null): string {
    if (date === null) return '';
    const d = new Date(date * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromDateInputValue(value: string): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    return Math.floor(new Date(+match[1], +match[2] - 1, +match[3]).getTime() / 1000);
}

// ---------- Header (date and pose shared by every photo) ----------

function setupHeader(): void {
    const input = document.getElementById('upload-date') as HTMLInputElement | null;
    if (!input) return;
    dateInput = new DateInput(input, {
        onChange: value => {
            currentDate = fromDateInputValue(value);
            renderStrip();
        }
    });
}

function renderHeader(): void {
    if (dateInput) dateInput.value = toDateInputValue(currentDate);
    const pose = allPoses.find(p => p.poseId === currentPoseId);
    poseDropdown?.setLabel(pose ? pose.poseName : 'Select Pose');
}

function renderPosePicker(container: HTMLDivElement): void {
    container.innerHTML = '';
    allPoses.forEach(pose => {
        const item = document.createElement('div');
        item.className = 'interactable-dropdown-item';
        item.textContent = pose.poseName;
        item.addEventListener('click', () => {
            poseDropdown?.close();
            currentPoseId = pose.poseId;
            // Angles not available on the new pose are cleared
            pending.forEach(p => {
                if (!pose.angles.some(a => a.angleId === p.angleId)) p.angleId = null;
            });
            renderHeader();
            renderStrip();
        });
        container.appendChild(item);
    });
}

// ---------- Photo strip with a per-photo angle dropdown ----------

// Reason a photo can't be saved yet, or null if it's ready
function getIssue(photo: PendingPhoto): string | null {
    if (photo.angleId === null) return 'Select an angle';
    if (pending.some(p => p !== photo && p.angleId === photo.angleId)) return 'Duplicate angle';
    if (existingPhotos.some(p => p.date === currentDate && p.poseId === currentPoseId && p.angleId === photo.angleId)) {
        return 'Photo already exists';
    }
    return null;
}

function renderStrip(): void {
    const strip = document.getElementById('upload-thumbnail-strip');
    if (!strip) return;
    const pose = allPoses.find(p => p.poseId === currentPoseId);
    const angles = [...(pose?.angles ?? [])].sort((a, b) => a.order - b.order);

    renderPhotoStrip(strip, pending.map(photo => ({
        key: photo.key,
        src: photo.url,
        label: getIssue(photo) ?? '',
        placeholder: photo.file.name
    })), {
        width: THUMBNAIL_WIDTH,
        emptyMessage: ''
    });

    pending.forEach(photo => {
        const item = getPhotoStripItem(strip, photo.key);
        if (!item) return;
        item.classList.toggle('needs-settings', getIssue(photo) !== null);
        item.title = photo.file.name;

        appendPhotoStripControls(item, {
            angles,
            angleId: photo.angleId,
            onAngleChange: angleId => {
                photo.angleId = angleId;
                renderStrip();
            },
            onRemove: () => removePhoto(photo.key)
        });
    });

    updateSaveButton();
}

// ---------- Save ----------

function updateSaveButton(): void {
    const btn = document.getElementById('upload-save') as HTMLButtonElement | null;
    if (!btn) return;
    const actions = btn.closest<HTMLElement>('.upload-actions');
    if (actions) actions.style.display = pending.length === 0 && !saving ? 'none' : 'flex';
    btn.disabled = saving || pending.length === 0 || currentDate === null || currentPoseId === null
        || pending.some(p => getIssue(p) !== null);
}

function setStatus(text: string): void {
    const el = document.getElementById('upload-status');
    if (el) el.textContent = text;
}

async function save(): Promise<void> {
    updateSaveButton();
    const btn = document.getElementById('upload-save') as HTMLButtonElement | null;
    if (btn?.disabled || currentDate === null || currentPoseId === null) return;
    const date = currentDate;
    const poseId = currentPoseId;

    saving = true;
    updateSaveButton();
    setStatus('Saving...');
    try {
        const photos = await Promise.all(pending.map(async p => ({
            date,
            poseId,
            angleId: p.angleId!,
            extension: p.extension,
            ...defaultLandmarks(...await getImageSize(p.url)),
            data: new Uint8Array(await p.file.arrayBuffer())
        })));
        const result = await window.api.saveProgressPhotos(photos);
        if (!result.success) {
            setStatus(`Save failed: ${result.error ?? 'unknown error'}`);
            return;
        }
        const count = pending.length;
        pending.forEach(p => URL.revokeObjectURL(p.url));
        pending = [];
        await refreshData();
        setStatus(`Saved ${count} photo${count === 1 ? '' : 's'}.`);
    } catch (error) {
        console.error('Failed to save photos:', error);
        setStatus('Save failed.');
    } finally {
        saving = false;
        renderStrip();
    }
}

// Natural size of an image; [0, 0] if the browser can't decode it
function getImageSize(url: string): Promise<[number, number]> {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
        img.onerror = () => resolve([0, 0]);
        img.src = url;
    });
}
