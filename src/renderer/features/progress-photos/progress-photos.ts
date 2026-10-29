import {ProgressPhoto, Pose, Angle, ProgressPhotoSettings} from '../../../shared/types/index.js';
import {Dropdown} from '../../components/dropdown/dropdown.js';
import {initSlider, updateSliderPosition} from '../../components/slider/slider.js';
import {computeCropRect} from '../../utils/crop.js';

let poseDropdown: Dropdown | null = null;

let allPhotos: ProgressPhoto[] = [];
let allPoses: Pose[] = [];
let allAngles: Angle[] = [];
let settings: ProgressPhotoSettings = {};
let currentPoseId: string | null = null;

type ViewMode = 'date-rows' | 'angle-rows';
let currentViewMode: ViewMode = 'date-rows';
let initialized = false;

// Enabled angle names for a pose, sorted by their configured order
function getPoseAngles(poseId: string): string[] {
    const pose = allPoses.find(p => p.poseId === parseInt(poseId, 10));
    return pose ? pose.angles.map(a => a.angle) : [];
}

export async function loadProgressPhotos(): Promise<void> {
    const dashboard = document.getElementById('progress-photo-dashboard');
    const gridRoot = document.getElementById('photo-grid-root');

    if (!dashboard || !gridRoot) return;

    currentPoseId = null;
    gridRoot.innerHTML = '';
    const loadingMsg = document.createElement('p');
    loadingMsg.textContent = 'Loading photos...';
    gridRoot.appendChild(loadingMsg);
    dashboard.style.display = 'block';

    console.log('Loading progress photos...');
    try {
        const [photos, poses, angles, appSettings] = await Promise.all([
            window.api.getProgressPhotos(),
            window.api.getProgressPoses(),
            window.api.getProgressAngles(),
            window.api.getSettings()
        ]);
        allPhotos = photos;
        allPoses = poses;
        allAngles = angles;
        settings = appSettings?.progress_photo ?? {};
        console.log(`Loaded ${allPhotos?.length} photos and ${allPoses?.length} poses.`);

        if (!allPhotos || allPhotos.length === 0) {
            gridRoot.innerHTML = '';
            const noPhotosMsg = document.createElement('p');
            noPhotosMsg.textContent = 'No photos found in database.';
            gridRoot.appendChild(noPhotosMsg);
            return;
        }

        renderDashboard();

    } catch (error) {
        console.error('Failed to load photos:', error);
        gridRoot.innerHTML = '';
        const errMsg = document.createElement('p');
        errMsg.textContent = 'Error loading photos.';
        gridRoot.appendChild(errMsg);
    }
}


function renderDashboard(): void {
    console.log('Rendering dashboard...');
    // Re-query new elements
    const poseSelectBtnEl = document.getElementById('pose-select-btn') as HTMLButtonElement;
    const poseSelectDropdownEl = document.getElementById('pose-select-dropdown') as HTMLDivElement;
    const sizeSliderEl = document.getElementById('size-slider') as HTMLInputElement;
    const sizeValueEl = document.getElementById('size-value') as HTMLElement;
    const cropSliderEl = document.getElementById('crop-slider') as HTMLInputElement;
    const cropValueEl = document.getElementById('crop-value') as HTMLElement;
    const aspectSliderEl = document.getElementById('aspect-slider') as HTMLInputElement;
    const aspectValueEl = document.getElementById('aspect-value') as HTMLElement;
    const viewToggleEl = document.getElementById('view-toggle') as HTMLButtonElement;
    const columnToggleBtnEl = document.getElementById('column-toggle-btn') as HTMLButtonElement;
    const columnPickerDropdownEl = document.getElementById('column-picker-dropdown') as HTMLDivElement;

    // Set view mode
    currentViewMode = (settings.view_mode as ViewMode) || 'date-rows';
    viewToggleEl.textContent = currentViewMode === 'date-rows' ? 'Vertical' : 'Horizontal';

    // Set default pose from settings
    let defaultPoseId = settings.default_pose;

    let poseIdToLoad = '';

    // Check if the default pose exists in the list
    if (defaultPoseId && allPoses.some(p => p.poseId === parseInt(defaultPoseId.toString(), 10))) {
        poseIdToLoad = defaultPoseId.toString();
    } else if (allPoses.length > 0) {
        // Fallback to the first pose if none set or if set one no longer exists
        poseIdToLoad = allPoses[0].poseId.toString();
        // Update settings with this first pose
        settings.default_pose = poseIdToLoad;
        window.api.updateSetting('progress_photo', 'default_pose', poseIdToLoad);
    }

    // Set slider values based on the SELECTED pose
    const currentPose = allPoses.find(p => p.poseId === parseInt(poseIdToLoad || '', 10));

    // Update button text
    if (currentPose) {
        poseSelectBtnEl.textContent = `${currentPose.poseName}`;
    }

    renderPosePicker(poseSelectDropdownEl, poseSelectBtnEl, sizeSliderEl, sizeValueEl, cropSliderEl, cropValueEl, aspectSliderEl, aspectValueEl, columnPickerDropdownEl);

    // TODO: "singleSize" represents the size of the photos when rendered in their horizontal view (angle-rows mode).
    // It should be renamed to something more descriptive in the future.
    let currentSize = currentViewMode === 'date-rows'
        ? (currentPose?.collectionSize || settings.size || 150)
        : (currentPose?.singleSize || settings.size || 150);

    currentSize = Math.round(currentSize / 25) * 25;
    sizeSliderEl.value = currentSize.toString();
    sizeValueEl.textContent = `${currentSize}px`;

    let currentCrop = currentPose?.croppingPercent || settings.crop || 50;
    currentCrop = Math.round(currentCrop / 10) * 10;
    cropSliderEl.value = currentCrop.toString();
    cropValueEl.textContent = `${currentCrop}%`;

    let currentAspect = currentPose?.aspectRatio || settings.aspect || 1.0;
    currentAspect = Math.round(currentAspect * 10) / 10;
    aspectSliderEl.value = currentAspect.toString();
    aspectValueEl.textContent = currentAspect.toString();
    [sizeSliderEl, cropSliderEl, aspectSliderEl].forEach(updateSliderPosition);

    renderColumnPicker(columnPickerDropdownEl, poseIdToLoad || '', sizeSliderEl.value, cropSliderEl.value, aspectSliderEl.value);
    if (!initialized) {
        setupListeners(
            poseSelectBtnEl,
            poseSelectDropdownEl,
            sizeSliderEl,
            sizeValueEl,
            cropSliderEl,
            cropValueEl,
            aspectSliderEl,
            aspectValueEl,
            viewToggleEl,
            columnToggleBtnEl,
            columnPickerDropdownEl
        );
        initialized = true;
    }
    // Initial render of the grid
    updatePhotoGrid(poseIdToLoad || '', sizeSliderEl.value, cropSliderEl.value, aspectSliderEl.value);
    renderColumnPicker(columnPickerDropdownEl, poseIdToLoad || '', sizeSliderEl.value, cropSliderEl.value, aspectSliderEl.value);

    // Ensure initial styles are applied (in case they differ from defaults)
    refreshPhotoStyles(sizeSliderEl.value, cropSliderEl.value, aspectSliderEl.value);
}

function setupListeners(
    poseSelectBtnEl: HTMLButtonElement,
    poseSelectDropdownEl: HTMLDivElement,
    sizeSliderEl: HTMLInputElement,
    sizeValueEl: HTMLElement,
    cropSliderEl: HTMLInputElement,
    cropValueEl: HTMLElement,
    aspectSliderEl: HTMLInputElement,
    aspectValueEl: HTMLElement,
    viewToggleEl: HTMLButtonElement,
    columnToggleBtnEl: HTMLButtonElement,
    columnPickerDropdownEl: HTMLDivElement
): void {
    poseDropdown = new Dropdown(poseSelectBtnEl, poseSelectDropdownEl);
    new Dropdown(columnToggleBtnEl, columnPickerDropdownEl);
    [sizeSliderEl, cropSliderEl, aspectSliderEl].forEach(initSlider);

    sizeSliderEl.addEventListener('input', (e) => {
        const newSize = (e.target as HTMLInputElement).value;
        sizeValueEl.textContent = `${newSize}px`;
        refreshPhotoStyles(newSize, cropSliderEl.value, aspectSliderEl.value);
    });

    sizeSliderEl.addEventListener('change', (e) => {
        const newSize = parseInt((e.target as HTMLInputElement).value, 10);
        const poseId = parseInt(currentPoseId || '', 10);
        const pose = allPoses.find(p => p.poseId === poseId);

        if (pose) {
            if (currentViewMode === 'date-rows') {
                pose.collectionSize = newSize;
                window.api.updatePoseSettings(poseId, {collectionSize: newSize});
            } else {
                // TODO: "singleSize" represents the size of the photos when rendered in their horizontal view (angle-rows mode).
                pose.singleSize = newSize;
                window.api.updatePoseSettings(poseId, {singleSize: newSize});
            }
        }
    });

    cropSliderEl.addEventListener('input', (e) => {
        const newCrop = (e.target as HTMLInputElement).value;
        cropValueEl.textContent = `${newCrop}%`;
        refreshPhotoStyles(sizeSliderEl.value, newCrop, aspectSliderEl.value);
    });

    cropSliderEl.addEventListener('change', (e) => {
        const newCrop = parseInt((e.target as HTMLInputElement).value, 10);
        const poseId = parseInt(currentPoseId || '', 10);
        const pose = allPoses.find(p => p.poseId === poseId);
        if (pose) pose.croppingPercent = newCrop;
        window.api.updatePoseSettings(poseId, {croppingPercent: newCrop});
    });

    aspectSliderEl.addEventListener('input', (e) => {
        const newAspect = (e.target as HTMLInputElement).value;
        aspectValueEl.textContent = newAspect;
        refreshPhotoStyles(sizeSliderEl.value, cropSliderEl.value, newAspect);
    });

    aspectSliderEl.addEventListener('change', (e) => {
        const newAspect = parseFloat((e.target as HTMLInputElement).value);
        const poseId = parseInt(currentPoseId || '', 10);
        const pose = allPoses.find(p => p.poseId === poseId);
        if (pose) pose.aspectRatio = newAspect;
        window.api.updatePoseSettings(poseId, {aspectRatio: newAspect});
    });

    viewToggleEl.addEventListener('click', () => {
        currentViewMode = currentViewMode === 'date-rows' ? 'angle-rows' : 'date-rows';
        viewToggleEl.textContent = currentViewMode === 'date-rows' ? 'Vertical' : 'Horizontal';

        // Update size slider to reflect the new view mode's specific size
        const currentPose = allPoses.find(p => p.poseId === parseInt(currentPoseId || '', 10));
        if (currentPose) {
            // TODO: "singleSize" represents the size of the photos when rendered in their horizontal view (angle-rows mode).
            const newSize = currentViewMode === 'date-rows' ? (currentPose.collectionSize || 150) : (currentPose.singleSize || 150);
            sizeSliderEl.value = newSize.toString();
            sizeValueEl.textContent = `${newSize}px`;
            updateSliderPosition(sizeSliderEl);
        }

        // Clear currentPoseId to force full re-render
        const lastPoseId = currentPoseId || '';
        currentPoseId = null;
        updatePhotoGrid(lastPoseId, sizeSliderEl.value, cropSliderEl.value, aspectSliderEl.value);
        settings.view_mode = currentViewMode;
        window.api.updateSetting('progress_photo', 'view_mode', currentViewMode);
        renderColumnPicker(columnPickerDropdownEl, lastPoseId, sizeSliderEl.value, cropSliderEl.value, aspectSliderEl.value);
    });

}

function updatePhotoGrid(poseId: string, customSize: string, customCrop: string, customAspect: string): void {
    const gridRoot = document.getElementById('photo-grid-root');
    if (!gridRoot) return;

    // Check if we already have the correct pose rendered and it's not empty
    // We use a specific check for "Loading photos..." or "No photos..." placeholders
    const isActuallyRendered = gridRoot.querySelector('.photo-row') !== null || gridRoot.querySelector('p') === null;
    
    if (currentPoseId === poseId && isActuallyRendered && gridRoot.children.length > 0) {
        console.log('Pose already rendered, refreshing styles only.');
        refreshPhotoStyles(customSize, customCrop, customAspect);
        return;
    }
    currentPoseId = poseId;

    const numericPoseId = parseInt(poseId, 10);
    const filteredPhotos = allPhotos.filter(p => p.poseId === numericPoseId);
    const poseSettings = allPoses.find(p => p.poseId === numericPoseId);

    // TODO: "singleSize" represents the size of the photos when rendered in their horizontal view (angle-rows mode).
    const defaultSize = currentViewMode === 'date-rows'
        ? (poseSettings?.collectionSize || 150)
        : (poseSettings?.singleSize || 150);

    // Create a fragment to build the new grid content
    const fragment = document.createDocumentFragment();

    if (filteredPhotos.length === 0) {
        const noPhotosMsg = document.createElement('p');
        noPhotosMsg.textContent = 'No photos found for this pose.';
        fragment.appendChild(noPhotosMsg);

        gridRoot.innerHTML = '';
        gridRoot.appendChild(fragment);
        return;
    }

    // Group photos by date
    const groupedPhotos = filteredPhotos.reduce((acc, photo) => {
        const date = new Date(photo.date * 1000).toLocaleDateString();
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(photo);
        return acc;
    }, {} as Record<string, ProgressPhoto[]>);

    // Sort dates ascending
    const sortedDates = Object.keys(groupedPhotos).sort((a, b) => {
        return new Date(a).getTime() - new Date(b).getTime();
    });

    const photoMap = new Map<string, ProgressPhoto>();
    filteredPhotos.forEach(p => {
        const dateStr = new Date(p.date * 1000).toLocaleDateString();
        photoMap.set(`${dateStr}-${p.angle}`, p);
    });

    // Update Header
    const gridHeader = document.getElementById('photo-grid-header');
    if (!gridHeader) return;

    const targetWidth = parseInt(customSize, 10) || defaultSize;
    const aspectRatio = parseFloat(customAspect) || (poseSettings ? (poseSettings.aspectRatio || 1.0) : 1.0);
    const targetHeight = targetWidth / aspectRatio;

    const headerFragment = document.createDocumentFragment();
    const headerLabelCol = document.createElement('div');
    headerLabelCol.className = 'header-label-column grid-header-cell';
    headerLabelCol.textContent = '';
    headerFragment.appendChild(headerLabelCol);

    const headerItems = document.createElement('div');
    headerItems.className = 'header-items';

    const headerTpl = document.getElementById('tpl-header-item') as HTMLTemplateElement;

    const poseAngles = getPoseAngles(poseId);
    const columns = currentViewMode === 'date-rows' ? poseAngles : sortedDates;

    for (const colValue of columns) {
        const item = (headerTpl.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLElement;
        item.style.setProperty('--item-width', `${targetWidth}px`);
        item.textContent = colValue;
        headerItems.appendChild(item);
    }
    headerFragment.appendChild(headerItems);

    gridHeader.innerHTML = '';
    gridHeader.appendChild(headerFragment);

    const rowTpl = document.getElementById('tpl-photo-row') as HTMLTemplateElement;
    const itemTpl = document.getElementById('tpl-photo-item') as HTMLTemplateElement;
    const blankTpl = document.getElementById('tpl-blank-item') as HTMLTemplateElement;

    const rows = currentViewMode === 'date-rows' ? sortedDates : poseAngles;

    for (const rowValue of rows) {
        const row = (rowTpl.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLElement;
        const labelCol = row.querySelector('.photo-date-column'); // Re-using class name for simplicity
        if (labelCol) labelCol.textContent = rowValue;
        const itemsContainer = row.querySelector('.photo-items');
        if (!itemsContainer) continue;

        for (const colValue of columns) {
            const dateStr = currentViewMode === 'date-rows' ? rowValue : colValue;
            const angleStr = currentViewMode === 'date-rows' ? colValue : rowValue;
            const photo = photoMap.get(`${dateStr}-${angleStr}`);

            if (photo) {
                const item = (itemTpl.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLElement;
                const img = item.querySelector('img') as HTMLImageElement;
                const placeholder = item.querySelector('.photo-placeholder') as HTMLElement;

                item.style.setProperty('--item-width', `${targetWidth}px`);
                const container = item.querySelector('.photo-container') as HTMLElement;
                container.style.setProperty('--container-width', `${targetWidth}px`);
                container.style.setProperty('--container-height', `${targetHeight}px`);

                const fileName = `${photo.photoId}.${photo.extension}`;
                img.src = `photo://${fileName}`;
                img.alt = photo.angle;
                img.dataset.photo = JSON.stringify(photo);

                // Merge custom crop and aspect into a settings object for the image
                const effectiveSettings = {
                    ...poseSettings,
                    croppingPercent: parseFloat(customCrop) || (poseSettings ? poseSettings.croppingPercent : 50),
                    aspectRatio: aspectRatio
                };
                img.dataset.poseSettings = JSON.stringify(effectiveSettings);

                placeholder.innerHTML = `ID: ${photo.photoId}<br>${photo.angle}`;

                itemsContainer.appendChild(item);
            } else {
                const item = (blankTpl.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLElement;
                item.style.setProperty('--item-width', `${targetWidth}px`);
                const container = item.querySelector('.photo-container') as HTMLElement;
                container.style.setProperty('--container-width', `${targetWidth}px`);
                container.style.setProperty('--container-height', `${targetHeight}px`);

                itemsContainer.appendChild(item);
            }
        }
        fragment.appendChild(row);
    }

    gridRoot.innerHTML = '';
    gridRoot.appendChild(fragment);

    // After adding photos to DOM, ensure dynamic crop is applied to already-loaded images
    const images = gridRoot.querySelectorAll('img.progress-photo');
    images.forEach(img => {
        const htmlImg = img as HTMLImageElement;
        if (htmlImg.complete && htmlImg.naturalWidth > 0) {
            window.applyDynamicCrop(htmlImg);
        }
    });
}

function refreshPhotoStyles(customSize: string, customCrop: string, customAspect: string): void {
    const targetWidth = parseInt(customSize, 10);
    const aspectRatio = parseFloat(customAspect);
    const targetHeight = targetWidth / aspectRatio;

    // Update Header Styles
    const headerItems = document.querySelectorAll('.header-item');
    headerItems.forEach(item => {
        (item as HTMLElement).style.setProperty('--item-width', `${targetWidth}px`);
    });

    // Update Photo Items Styles
    const photoItems = document.querySelectorAll('.photo-item');
    photoItems.forEach(item => {
        const htmlItem = item as HTMLElement;
        htmlItem.style.setProperty('--item-width', `${targetWidth}px`);

        const container = htmlItem.querySelector('.photo-container') as HTMLElement;
        if (container) {
            container.style.setProperty('--container-width', `${targetWidth}px`);
            container.style.setProperty('--container-height', `${targetHeight}px`);
        }

        const img = htmlItem.querySelector('img') as HTMLImageElement;
        if (img && img.dataset.poseSettings) {
            const poseSettings = JSON.parse(img.dataset.poseSettings);
            poseSettings.croppingPercent = parseFloat(customCrop);
            poseSettings.aspectRatio = aspectRatio;
            img.dataset.poseSettings = JSON.stringify(poseSettings);

            // Re-apply crop if image is already loaded
            if (img.complete && img.naturalWidth > 0) {
                window.applyDynamicCrop(img);
            }
        }
    });
}

window.applyDynamicCrop = function (img: HTMLImageElement): void {
    if (!img.dataset.photo || !img.dataset.poseSettings) {
        img.style.display = 'block';
        return;
    }

    const photo: ProgressPhoto = JSON.parse(img.dataset.photo);
    const poseSettings = JSON.parse(img.dataset.poseSettings);

    if (!photo || !poseSettings) {
        img.style.display = 'block';
        return;
    }

    const crop = computeCropRect(photo, poseSettings);

    img.style.setProperty('--photo-width', `${(img.naturalWidth / crop.width) * 100}%`);
    img.style.setProperty('--photo-left', `${-(crop.left / crop.width) * 100}%`);
    img.style.setProperty('--photo-top', `${-(crop.top / crop.height) * 100}%`);
    img.style.display = 'block';
};

function renderColumnPicker(container: HTMLElement, poseId: string, size: string, crop: string, aspect: string): void {
    const pose = allPoses.find(p => p.poseId === parseInt(poseId, 10));
    container.innerHTML = '';
    if (!pose) return;

    // Enabled angles first (in their order), then the remaining disabled ones
    const enabledIds = pose.angles.map(a => a.angleId);
    const orderedAngles = [
        ...pose.angles,
        ...allAngles.filter(a => !enabledIds.includes(a.angleId))
    ];

    orderedAngles.forEach(({angleId, angle}) => {
        const item = document.createElement('label');
        item.className = 'interactable-dropdown-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = enabledIds.includes(angleId);

        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                if (!pose.angles.some(a => a.angleId === angleId)) {
                    const nextOrder = Math.max(0, ...pose.angles.map(a => a.order)) + 1;
                    pose.angles.push({angleId, angle, order: nextOrder});
                }
            } else {
                pose.angles = pose.angles.filter(a => a.angleId !== angleId);
            }
            window.api.setPoseAngleEnabled(pose.poseId, angleId, checkbox.checked);

            // Force re-render of the grid
            currentPoseId = null;
            updatePhotoGrid(poseId, size, crop, aspect);
        });

        item.appendChild(checkbox);
        item.appendChild(document.createTextNode(angle));
        container.appendChild(item);
    });
}

function renderPosePicker(
    container: HTMLElement,
    btn: HTMLButtonElement,
    sizeSliderEl: HTMLInputElement,
    sizeValueEl: HTMLElement,
    cropSliderEl: HTMLInputElement,
    cropValueEl: HTMLElement,
    aspectSliderEl: HTMLInputElement,
    aspectValueEl: HTMLElement,
    columnPickerDropdownEl: HTMLDivElement
): void {
    container.innerHTML = '';
    allPoses.forEach(pose => {
        const item = document.createElement('div');
        item.className = 'interactable-dropdown-item';
        item.textContent = pose.poseName;
        item.addEventListener('click', () => {
            const newPoseId = pose.poseId.toString();
            if (poseDropdown) {
                poseDropdown.setLabel(pose.poseName);
                poseDropdown.close();
            } else {
                btn.textContent = `${pose.poseName}`;
            }

            // Update sliders based on the new pose
            const newPose = allPoses.find(p => p.poseId === pose.poseId);
            if (newPose) {
                const poseSize = currentViewMode === 'date-rows' ? newPose.collectionSize : newPose.singleSize;
                sizeSliderEl.value = (poseSize || 150).toString();
                sizeValueEl.textContent = `${sizeSliderEl.value}px`;
                cropSliderEl.value = (newPose.croppingPercent || 50).toString();
                cropValueEl.textContent = `${cropSliderEl.value}%`;
                aspectSliderEl.value = (newPose.aspectRatio || 1.0).toString();
                aspectValueEl.textContent = aspectSliderEl.value;
                [sizeSliderEl, cropSliderEl, aspectSliderEl].forEach(updateSliderPosition);
            }

            updatePhotoGrid(newPoseId, sizeSliderEl.value, cropSliderEl.value, aspectSliderEl.value);
            settings.default_pose = newPoseId;
            window.api.updateSetting('progress_photo', 'default_pose', newPoseId);
            renderColumnPicker(columnPickerDropdownEl, newPoseId, sizeSliderEl.value, cropSliderEl.value, aspectSliderEl.value);
        });
        container.appendChild(item);
    });
}
