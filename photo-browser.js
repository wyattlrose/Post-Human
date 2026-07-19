/**
 * Photo Browser Logic for Progress Photos
 */

let browserPoseDropdown = null;
let browserPhotoSizeSlider = null;
let singleAnglePhotoSizeSlider = null;
let browserPoseCropSlider = null;
let browserPoses = [];
let isBrowserInitialized = false;
let isSingleAngleFlipped = false;

window.initPhotoBrowser = initPhotoBrowser;

/**
 * Initializes the Photo Browser page components.
 */
function initPhotoBrowser() {
    if (!isBrowserInitialized) {
        initBrowserControls();
        isBrowserInitialized = true;
    }
    
    // Check if we have an active page that is the browser page
    const browserPage = document.getElementById('progress-photos-page');
    if (browserPage && browserPage.classList.contains('active')) {
        loadBrowserPoses();
    }
}

/**
 * Initializes browser controls and event listeners.
 */
function initBrowserControls() {
    if (!browserPoseDropdown) {
        browserPoseDropdown = new Dropdown('browser-pose-select', {
            onChange: () => {
                const val = browserPoseDropdown.getValue();
                if (!val || val === "") return;
                const poseId = parseInt(val);
                if (!isNaN(poseId)) {
                    const pose = browserPoses.find(p => p.pose_id === poseId);
                    if (pose) {
                        if (pose.collection_size !== undefined && pose.collection_size !== null) browserPhotoSizeSlider.setValue(pose.collection_size);
                        if (pose.single_size !== undefined && pose.single_size !== null) singleAnglePhotoSizeSlider.setValue(pose.single_size);
                        if (browserPoseCropSlider) browserPoseCropSlider.setValue(pose.cropping_percent || 50);
                        const aspectInput = document.getElementById('browser-pose-aspect-input');
                        if (aspectInput) {
                            aspectInput.value = pose.aspect_ratio || 1.0;
                            // Trigger real-time update on load to ensure UI matches settings
                            updateProceduralCropsRealtime(poseId, pose.cropping_percent || 50, pose.aspect_ratio || 1.0);
                        }
                    }
                    loadBrowserPhotos(poseId);
                }
            }
        });
    }

    if (!browserPhotoSizeSlider) {
        browserPhotoSizeSlider = new SliderInput('browser-photo-size-slider', 'browser-photo-size-input', {
            min: 100,
            max: 500,
            onInput: (val) => {
                updatePhotoSizes(val, false);
            },
            onChange: (val) => {
                const container = document.getElementById('single-angle-view-container');
                if (container && !container.classList.contains('hidden')) {
                    // Update sizes on final release as well
                    updatePhotoSizes(val, false);
                } else {
                    const val = browserPoseDropdown.getValue();
                    if (val && val !== "") {
                        // For collection view, we still might want to re-render 
                        // because of horizontal scroll sync and header row alignment
                        loadBrowserPhotos(parseInt(val));
                    }
                }
            }
        });
    }

    if (!singleAnglePhotoSizeSlider) {
        singleAnglePhotoSizeSlider = new SliderInput('single-angle-photo-size-slider', 'single-angle-photo-size-input', {
            min: 100,
            max: 500,
            onInput: (val) => {
                const singleViewContainer = document.getElementById('single-angle-view-container');
                if (singleViewContainer && !singleViewContainer.classList.contains('hidden')) {
                    updatePhotoSizes(val, true);
                }
            },
            onChange: (val) => {
                const singleViewContainer = document.getElementById('single-angle-view-container');
                if (singleViewContainer && !singleViewContainer.classList.contains('hidden')) {
                    updatePhotoSizes(val, true);
                }
            }
        });
    }

    if (!browserPoseCropSlider) {
        browserPoseCropSlider = new SliderInput('browser-pose-crop-slider', 'browser-pose-crop-input', {
            min: 0,
            max: 200,
            onInput: (val) => {
                const poseId = parseInt(browserPoseDropdown.getValue());
                if (!isNaN(poseId)) {
                    updateProceduralCropsRealtime(poseId, val, null);
                }
            },
            onChange: (val) => {
                const poseId = parseInt(browserPoseDropdown.getValue());
                if (!isNaN(poseId)) {
                    updateProceduralCropsRealtime(poseId, val, null);
                }
            }
        });
    }

    const aspectInput = document.getElementById('browser-pose-aspect-input');
    if (aspectInput) {
        aspectInput.oninput = () => {
            const poseId = parseInt(browserPoseDropdown.getValue());
            if (!isNaN(poseId)) {
                const val = parseFloat(aspectInput.value);
                if (!isNaN(val)) {
                    updateProceduralCropsRealtime(poseId, null, val);
                }
            }
        };
    }

    const savePoseSettingsBtn = document.getElementById('save-browser-pose-settings');
    if (savePoseSettingsBtn) {
        savePoseSettingsBtn.onclick = async () => {
            const poseId = parseInt(browserPoseDropdown.getValue());
            if (isNaN(poseId)) return;
            
            const croppingPercent = browserPoseCropSlider.getValue();
            const aspectRatio = parseFloat(document.getElementById('browser-pose-aspect-input').value);
            
            const pose = browserPoses.find(p => p.pose_id === poseId);
            if (!pose) return;

            const result = await window.electronAPI.updateProgressPose({
                pose_id: poseId,
                cropping_percent: croppingPercent,
                aspect_ratio: aspectRatio,
                y_landmark_1: pose.y_landmark_1,
                y_landmark_2: pose.y_landmark_2,
                x_landmark: pose.x_landmark
            });

            if (result && result.success) {
                pose.cropping_percent = croppingPercent;
                pose.aspect_ratio = aspectRatio;
                console.log('Pose settings saved');
            }
        };
    }

    const backBtn = document.getElementById('back-to-collections');
    if (backBtn) {
        backBtn.onclick = () => {
            document.getElementById('single-angle-view-container').classList.add('hidden');
            document.getElementById('photo-browser-container').classList.remove('hidden');
            document.getElementById('browser-selection').classList.remove('hidden');
            document.getElementById('single-angle-zoom-controls').classList.add('hidden');
        };
    }

    const saveCollectionBtn = document.getElementById('save-collection-size');
    if (saveCollectionBtn) {
        saveCollectionBtn.onclick = async () => {
            const poseId = parseInt(browserPoseDropdown.getValue());
            if (isNaN(poseId)) return;
            const size = browserPhotoSizeSlider.getValue();
            const result = await window.electronAPI.updateProgressPoseSizes({
                pose_id: poseId,
                collection_size: size
            });
            if (result && result.success) {
                // Update local storage/state if needed
                const pose = browserPoses.find(p => p.pose_id === poseId);
                if (pose) pose.collection_size = size;
                console.log('Collection size saved');
            }
        };
    }

    const saveSingleBtn = document.getElementById('save-single-size');
    if (saveSingleBtn) {
        saveSingleBtn.onclick = async () => {
            const poseId = parseInt(browserPoseDropdown.getValue());
            if (isNaN(poseId)) return;
            const size = singleAnglePhotoSizeSlider.getValue();
            const result = await window.electronAPI.updateProgressPoseSizes({
                pose_id: poseId,
                single_size: size
            });
            if (result && result.success) {
                const pose = browserPoses.find(p => p.pose_id === poseId);
                if (pose) pose.single_size = size;
                console.log('Single view size saved');
            }
        };
    }

    const flipCheckbox = document.getElementById('flip-photos');
    if (flipCheckbox) {
        flipCheckbox.onchange = () => {
            isSingleAngleFlipped = flipCheckbox.checked;
            const container = document.getElementById('single-angle-view-container');
            if (container && !container.classList.contains('hidden')) {
                updateFlippedState(isSingleAngleFlipped);
            }
        };
    }
}

/**
 * Loads available poses for the browser dropdown.
 */
async function loadBrowserPoses() {
    const result = await window.electronAPI.getProgressPoses();
    if (result && result.success) {
        browserPoses = result.poses;
        if (!result.poses || result.poses.length === 0) {
            browserPoseDropdown.setOptions([{ pose_id: "", pose_name: "No poses available" }], {
                valueKey: 'pose_id',
                textKey: 'pose_name'
            });
            return;
        }

        browserPoseDropdown.setOptions(result.poses, {
            valueKey: 'pose_id',
            textKey: 'pose_name',
            silent: true
        });

        const currentPoseId = parseInt(browserPoseDropdown.getValue());
        const selectedPose = result.poses.find(p => p.pose_id === currentPoseId) || result.poses[0];

        if (selectedPose) {
            if (selectedPose.collection_size !== undefined && selectedPose.collection_size !== null) browserPhotoSizeSlider.setValue(selectedPose.collection_size);
            if (selectedPose.single_size !== undefined && selectedPose.single_size !== null) singleAnglePhotoSizeSlider.setValue(selectedPose.single_size);
            if (browserPoseCropSlider) browserPoseCropSlider.setValue(selectedPose.cropping_percent || 50);
            const aspectInput = document.getElementById('browser-pose-aspect-input');
            if (aspectInput) aspectInput.value = selectedPose.aspect_ratio || 1.0;

            if (isNaN(currentPoseId)) {
                browserPoseDropdown.setValue(selectedPose.pose_id, true);
                loadBrowserPhotos(selectedPose.pose_id);
            } else {
                loadBrowserPhotos(currentPoseId);
            }
        }
    }
}

/**
 * Loads and renders photos for a specific pose.
 * @param {number} poseId 
 */
async function loadBrowserPhotos(poseId) {
    const container = document.getElementById('photo-browser-container');
    container.innerHTML = '<p>Loading photos...</p>';
    container.classList.remove('hidden');

    // Get all dates for this pose
    const datesResult = await window.electronAPI.getProgressDatesWithPhotos(poseId);
    if (!datesResult.success || datesResult.dates.length === 0) {
        container.innerHTML = '<p>No photos found for this pose.</p>';
        return;
    }

    const photoWidth = browserPhotoSizeSlider ? browserPhotoSizeSlider.getValue() : 200;
    container.style.setProperty('--browser-photo-width', `${photoWidth}px`);

    const pose = browserPoses.find(p => p.pose_id === poseId);
    const croppingPercent = pose ? (pose.cropping_percent || 50) : 50;
    const aspectRatio = pose ? (pose.aspect_ratio || 1.0) : 1.0;

    // Define angle order
    const angleOrder = [
        '90° Right',
        '45° Right',
        'Front',
        '45° Left',
        '90° Left',
        'Back'
    ];

    container.innerHTML = ''; // Clear loading

    // Fetch all photos for all dates for this pose to determine active angles
    const allDatesPhotos = [];
    const existingAngles = new Set();

    for (const dateInfo of datesResult.dates) {
        const photosResult = await window.electronAPI.getPhotosForDate({
            date_id: dateInfo.date_id,
            pose_id: poseId
        });
        if (photosResult.success && photosResult.photos.length > 0) {
            allDatesPhotos.push({
                dateInfo,
                photos: photosResult.photos
            });
            photosResult.photos.forEach(p => existingAngles.add(p.angle));
        }
    }

    if (allDatesPhotos.length === 0) {
        container.innerHTML = '<p>No photos found for this pose.</p>';
        return;
    }

    // Filter angle order based on what actually exists across ALL dates
    const activeAngles = angleOrder.filter(angle => existingAngles.has(angle));

    // Create a header row for angles
    const headerRow = document.createElement('div');
    headerRow.className = 'browser-header-row';
    
    // Empty spacer for the date column
    const spacer = document.createElement('div');
    spacer.className = 'browser-date-container spacer';
    headerRow.appendChild(spacer);
    
    const angleHeaderContainer = document.createElement('div');
    angleHeaderContainer.className = 'browser-angle-header-container';
    
    for (const angle of activeAngles) {
        const angleLabel = document.createElement('div');
        angleLabel.className = 'browser-angle-header';
        angleLabel.textContent = angle;
        angleHeaderContainer.appendChild(angleLabel);
    }
    headerRow.appendChild(angleHeaderContainer);
    container.appendChild(headerRow);

    // For each date, render its photos
    for (const batch of allDatesPhotos) {
        const dateInfo = batch.dateInfo;
        const dateRow = document.createElement('div');
        dateRow.className = 'photo-browser-date-row';

        const dateContainer = document.createElement('div');
        dateContainer.className = 'browser-date-container';
        const dateHeader = document.createElement('h3');
        dateHeader.textContent = dateInfo.date_value;
        dateContainer.appendChild(dateHeader);

        // Fetch and display weight
        const weightResult = await window.electronAPI.getWeightForDate(dateInfo.date_id);
        if (weightResult) {
            const weightLabel = document.createElement('div');
            weightLabel.className = 'browser-weight-label';
            weightLabel.textContent = `${weightResult.weight.toFixed(1)} kg`;
            dateContainer.appendChild(weightLabel);
        }

        dateRow.appendChild(dateContainer);

        const photoRow = document.createElement('div');
        photoRow.className = 'photo-browser-row';

        // Create a map for quick lookup by angle
        const photoMap = {};
        batch.photos.forEach(p => {
            photoMap[p.angle] = p;
        });

        // Iterate through active angles to maintain vertical alignment
        for (const angle of activeAngles) {
            const photoWrapper = document.createElement('div');
            photoWrapper.className = 'browser-photo-wrapper';
            
            const photo = photoMap[angle];
            if (photo) {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'browser-img-container';
                
                const img = document.createElement('img');
                const urlResult = await window.electronAPI.getPhotoUrl(photo.file_path);
                img.src = urlResult.success ? urlResult.url : '';
                
                // Apply procedural cropping/stretching
                if (photo.processed) {
                    img.dataset.photo = JSON.stringify(photo);
                    img.dataset.croppingPercent = croppingPercent;
                    img.dataset.aspectRatio = aspectRatio;
                    applyProceduralCrop(img, imgContainer, photo, croppingPercent, aspectRatio, photoWidth, false);
                } else {
                    img.style.width = '100%';
                    imgContainer.style.aspectRatio = aspectRatio.toString();
                    imgContainer.classList.add('unprocessed-browser-photo');
                }

                imgContainer.appendChild(img);
                
                // Add edit icon
                const editIcon = document.createElement('div');
                editIcon.className = 'browser-edit-icon';
                editIcon.innerHTML = '<i class="fas fa-edit"></i>';
                editIcon.title = 'Edit landmarks';
                editIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Navigate to editor for this date
                    if (typeof setEditorContext === 'function') {
                        setEditorContext(poseId, dateInfo.date_value);
                        const editorNavItem = document.querySelector('.nav-item[data-page="photo-editor-page"]');
                        if (editorNavItem) editorNavItem.click();
                    }
                });
                imgContainer.appendChild(editIcon);
                
                // Add delete icon
                const deleteIcon = document.createElement('div');
                deleteIcon.className = 'browser-delete-icon';
                deleteIcon.innerHTML = '<i class="fas fa-trash-alt"></i>';
                deleteIcon.title = 'Delete photo';
                deleteIcon.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const result = await window.electronAPI.deleteProgressPhoto({photo_id: photo.photo_id});
                    if (result.success) {
                        loadBrowserPhotos(poseId);
                    } else {
                        alert('Error deleting photo: ' + result.error);
                    }
                });
                imgContainer.appendChild(deleteIcon);

                imgContainer.addEventListener('click', () => {
                    showSingleAngleView(angle);
                });

                photoWrapper.appendChild(imgContainer);
                
                if (!photo.processed) {
                    const label = document.createElement('div');
                    label.className = 'browser-unprocessed-indicator';
                    label.textContent = '(*)';
                    photoWrapper.appendChild(label);
                }
            } else {
                // Placeholder for missing angle to keep alignment
                photoWrapper.classList.add('placeholder');
                const placeholder = document.createElement('div');
                placeholder.className = 'browser-img-placeholder';
                placeholder.style.aspectRatio = aspectRatio.toString();
                photoWrapper.appendChild(placeholder);
            }

            photoRow.appendChild(photoWrapper);
        }

        photoRow.addEventListener('wheel', (e) => {
            if (e.deltaX !== 0) {
                // If there's actual horizontal wheel movement, use it
                e.preventDefault();
                photoRow.scrollLeft += e.deltaX;
            } else if (e.shiftKey && e.deltaY !== 0) {
                // If Shift is held, treat vertical scroll as horizontal
                e.preventDefault();
                photoRow.scrollLeft += e.deltaY;
            }
            // Otherwise, allow default vertical scrolling of the page
        });

        photoRow.addEventListener('scroll', () => {
            angleHeaderContainer.scrollLeft = photoRow.scrollLeft;
            // Also sync other photo rows if they exist
            const allPhotoRows = container.querySelectorAll('.photo-browser-row');
            allPhotoRows.forEach(row => {
                if (row !== photoRow) row.scrollLeft = photoRow.scrollLeft;
            });
        });
        
        dateRow.appendChild(photoRow);
        container.appendChild(dateRow);
    }
}

/**
 * Shows all photos for a specific angle in a horizontal list.
 * @param {string} angle 
 */
async function showSingleAngleView(angle) {
    const poseId = parseInt(browserPoseDropdown.getValue());
    if (isNaN(poseId)) return;

    const browserContainer = document.getElementById('photo-browser-container');
    const browserSelection = document.getElementById('browser-selection');
    const singleViewContainer = document.getElementById('single-angle-view-container');
    const photoList = document.getElementById('single-angle-photo-list');
    const title = document.getElementById('single-angle-title');

    browserContainer.classList.add('hidden');
    browserSelection.classList.add('hidden');
    singleViewContainer.classList.remove('hidden');
    document.getElementById('single-angle-zoom-controls').classList.remove('hidden');

    title.textContent = `Photos: ${angle}`;
    photoList.innerHTML = '<p>Loading photos...</p>';

    const photoWidth = singleAnglePhotoSizeSlider ? singleAnglePhotoSizeSlider.getValue() : 200;
    singleViewContainer.style.setProperty('--browser-photo-width', `${photoWidth}px`);

    const pose = browserPoses.find(p => p.pose_id === poseId);
    const croppingPercent = pose ? (pose.cropping_percent || 50) : 50;
    const aspectRatio = pose ? (pose.aspect_ratio || 1.0) : 1.0;

    // Get all dates for this pose
    const datesResult = await window.electronAPI.getProgressDatesWithPhotos(poseId);
    if (!datesResult.success || datesResult.dates.length === 0) {
        photoList.innerHTML = '<p>No photos found for this pose.</p>';
        return;
    }

    photoList.innerHTML = '';

    for (const dateInfo of datesResult.dates) {
        const photosResult = await window.electronAPI.getPhotosForDate({
            date_id: dateInfo.date_id,
            pose_id: poseId
        });

        if (photosResult.success) {
            const photo = photosResult.photos.find(p => p.angle === angle);
            if (photo) {
                const photoWrapper = document.createElement('div');
                photoWrapper.className = 'browser-photo-wrapper';

                const dateLabel = document.createElement('div');
                dateLabel.className = 'single-angle-date-label';
                dateLabel.textContent = dateInfo.date_value;
                photoWrapper.appendChild(dateLabel);

                // Fetch and display weight
                const weightResult = await window.electronAPI.getWeightForDate(dateInfo.date_id);
                if (weightResult) {
                    const weightLabel = document.createElement('div');
                    weightLabel.className = 'single-angle-weight-label';
                    weightLabel.textContent = `${weightResult.weight.toFixed(1)} kg`;
                    photoWrapper.appendChild(weightLabel);
                }

                const imgContainer = document.createElement('div');
                imgContainer.className = 'browser-img-container';

                const img = document.createElement('img');
                const urlResult = await window.electronAPI.getPhotoUrl(photo.file_path);
                img.src = urlResult.success ? urlResult.url : '';
                if (isSingleAngleFlipped) {
                    img.classList.add('flipped');
                }

                if (photo.processed) {
                    img.dataset.photo = JSON.stringify(photo);
                    img.dataset.croppingPercent = croppingPercent;
                    img.dataset.aspectRatio = aspectRatio;
                    applyProceduralCrop(img, imgContainer, photo, croppingPercent, aspectRatio, photoWidth, isSingleAngleFlipped);
                } else {
                    img.style.width = '100%';
                    imgContainer.style.aspectRatio = aspectRatio.toString();
                    imgContainer.classList.add('unprocessed-browser-photo');
                }

                imgContainer.appendChild(img);

                // Add edit icon
                const editIcon = document.createElement('div');
                editIcon.className = 'browser-edit-icon';
                editIcon.innerHTML = '<i class="fas fa-edit"></i>';
                editIcon.title = 'Edit landmarks';
                editIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof setEditorContext === 'function') {
                        setEditorContext(poseId, dateInfo.date_value);
                        const editorNavItem = document.querySelector('.nav-item[data-page="photo-editor-page"]');
                        if (editorNavItem) editorNavItem.click();
                    }
                });
                imgContainer.appendChild(editIcon);

                // Add delete icon
                const deleteIcon = document.createElement('div');
                deleteIcon.className = 'browser-delete-icon';
                deleteIcon.innerHTML = '<i class="fas fa-trash-alt"></i>';
                deleteIcon.title = 'Delete photo';
                deleteIcon.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const result = await window.electronAPI.deleteProgressPhoto({photo_id: photo.photo_id});
                    if (result.success) {
                        showSingleAngleView(angle);
                    } else {
                        alert('Error deleting photo: ' + result.error);
                    }
                });
                imgContainer.appendChild(deleteIcon);

                photoWrapper.appendChild(imgContainer);

                if (!photo.processed) {
                    const label = document.createElement('div');
                    label.className = 'browser-unprocessed-indicator';
                    label.textContent = '(*)';
                    photoWrapper.appendChild(label);
                }

                photoList.appendChild(photoWrapper);
            }
        }
    }

    photoList.addEventListener('wheel', (e) => {
        if (e.deltaX !== 0) {
            e.preventDefault();
            photoList.scrollLeft += e.deltaX;
        } else if (e.deltaY !== 0) {
            // In single angle view, keep the behavior of mapping vertical wheel to horizontal scroll
            // but we could also allow vertical scroll if the page is scrollable.
            // However, the user said "In the single photo progress view, you use the scroll wheel to scroll horizontally."
            e.preventDefault();
            photoList.scrollLeft += e.deltaY;
        }
    });
}

/**
 * Updates the size of all photos currently on screen without re-rendering the whole page.
 */
function updatePhotoSizes(newWidth, isSingleAngle = false) {
    const containerId = isSingleAngle ? 'single-angle-view-container' : 'photo-browser-container';
    const container = document.getElementById(containerId);
    if (!container) return;

    container.style.setProperty('--browser-photo-width', `${newWidth}px`);

    const images = container.querySelectorAll('img');
    images.forEach(img => {
        if (img.dataset.photo) {
            const photo = JSON.parse(img.dataset.photo);
            const croppingPercent = parseFloat(img.dataset.croppingPercent);
            const aspectRatio = parseFloat(img.dataset.aspectRatio);
            const imgContainer = img.parentElement;
            const isFlipped = isSingleAngle ? isSingleAngleFlipped : false;
            
            // Re-apply crop with new width
            // We call it directly to avoid waiting for img.onload if possible, 
            // but applyProceduralCrop currently relies on img.onload.
            // Let's modify applyProceduralCrop to be callable immediately if naturalWidth is available.
            applyProceduralCrop(img, imgContainer, photo, croppingPercent, aspectRatio, newWidth, isFlipped);
        }
    });
}

/**
 * Toggles the flipped state of all photos in the single angle view.
 */
function updateFlippedState(isFlipped) {
    const container = document.getElementById('single-angle-photo-list');
    if (!container) return;

    const photoWidth = singleAnglePhotoSizeSlider ? singleAnglePhotoSizeSlider.getValue() : 200;

    const images = container.querySelectorAll('img');
    images.forEach(img => {
        if (isFlipped) {
            img.classList.add('flipped');
        } else {
            img.classList.remove('flipped');
        }

        if (img.dataset.photo) {
            const photo = JSON.parse(img.dataset.photo);
            const croppingPercent = parseFloat(img.dataset.croppingPercent);
            const aspectRatio = parseFloat(img.dataset.aspectRatio);
            const imgContainer = img.parentElement;
            
            applyProceduralCrop(img, imgContainer, photo, croppingPercent, aspectRatio, photoWidth, isFlipped);
        }
    });
}

/**
 * Applies procedural cropping and scaling to an image element.
 */
function applyProceduralCrop(img, container, photo, cropPercent, aspectRatio, targetWidth, isFlipped = false) {
    const performCrop = () => {
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;

        const y1 = photo.y_landmark_1;
        const y2 = photo.y_landmark_2;
        const x3 = photo.x_landmark;

        const yDist = Math.abs(y2 - y1);
        const margin = yDist * (cropPercent / 100);
        
        const cropHeight = yDist + (2 * margin);
        const cropWidth = cropHeight * aspectRatio;

        const centerY = (y1 + y2) / 2;
        const centerX = x3;

        const cropTop = centerY - (cropHeight / 2);
        const cropLeft = centerX - (cropWidth / 2);

        container.style.position = 'relative';
        container.style.overflow = 'hidden';
        container.style.aspectRatio = aspectRatio.toString();
        container.style.width = targetWidth + 'px';

        img.style.position = 'absolute';
        
        const containerWidth = targetWidth;
        const scale = containerWidth / cropWidth;
        
        const scaledWidth = naturalWidth * scale;
        const scaledHeight = naturalHeight * scale;
        
        img.style.width = scaledWidth + 'px';
        img.style.height = scaledHeight + 'px';
        img.style.top = (-cropTop * scale) + 'px';
        
        if (isFlipped) {
            img.style.left = (-(scaledWidth - (cropLeft + cropWidth) * scale)) + 'px';
        } else {
            img.style.left = (-cropLeft * scale) + 'px';
        }
    };

    if (img.complete && img.naturalWidth > 0) {
        performCrop();
    } else {
        img.onload = performCrop;
    }
    }

    /**
    * Updates procedural crops for all photos on screen in real-time.
    */
    function updateProceduralCropsRealtime(poseId, newCropPercent, newAspectRatio) {
    const containers = ['photo-browser-container', 'single-angle-photo-list'];

    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;
    
        const isSingleAngle = (containerId === 'single-angle-photo-list');
        const photoWidth = isSingleAngle ? 
            (singleAnglePhotoSizeSlider ? singleAnglePhotoSizeSlider.getValue() : 200) : 
            (browserPhotoSizeSlider ? browserPhotoSizeSlider.getValue() : 200);

        // Update aspect ratio for unprocessed photos and placeholders
        if (newAspectRatio !== null) {
            const unprocessed = container.querySelectorAll('.unprocessed-browser-photo, .browser-img-placeholder');
            unprocessed.forEach(el => {
                el.style.aspectRatio = newAspectRatio.toString();
            });
        }

        const images = container.querySelectorAll('img');
        images.forEach(img => {
            if (img.dataset.photo) {
                const photo = JSON.parse(img.dataset.photo);
                // Only update if the photo belongs to the current pose
                const currentImgPoseId = parseInt(photo.pose_id);
                const targetPoseId = parseInt(poseId);
                
                if (currentImgPoseId !== targetPoseId) {
                    return;
                }

                const cropPercent = newCropPercent !== null ? parseFloat(newCropPercent) : parseFloat(img.dataset.croppingPercent);
                const aspectRatio = newAspectRatio !== null ? parseFloat(newAspectRatio) : parseFloat(img.dataset.aspectRatio);
            
                // Update datasets for future resizing
                if (newCropPercent !== null) img.dataset.croppingPercent = newCropPercent.toString();
                if (newAspectRatio !== null) img.dataset.aspectRatio = newAspectRatio.toString();

                const imgContainer = img.parentElement;
                const isFlipped = isSingleAngle ? isSingleAngleFlipped : false;
            
                applyProceduralCrop(img, imgContainer, photo, cropPercent, aspectRatio, photoWidth, isFlipped);
            }
        });
    });
    }