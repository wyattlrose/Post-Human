let allPhotos = [];
let allPoses = [];
let settings = {};

const ANGLE_ORDER = [
    '90° Right',
    '45° Right',
    'Front',
    '45° Left',
    '90° Left'
];

export async function loadProgressPhotos() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '<h1>Progress Photo Dashboard</h1><p>Loading photos...</p>';

    try {
        [allPhotos, allPoses, settings] = await Promise.all([
            window.api.getProgressPhotos(),
            window.api.getProgressPoses(),
            window.api.getSettings()
        ]);
        
        if (!allPhotos || allPhotos.length === 0) {
            mainContent.innerHTML = '<h1>Progress Photo Dashboard</h1><p>No photos found in database.</p>';
            return;
        }

        renderDashboard();

    } catch (error) {
        console.error('Failed to load photos:', error);
        mainContent.innerHTML = '<h1>Progress Photo Dashboard</h1><p>Error loading photos.</p>';
    }
}

function renderDashboard() {
    const mainContent = document.getElementById('main-content');
    
    let html = '<h1>Progress Photo Dashboard</h1>';
    
    // Add Pose Selector and Size Slider
    html += `
        <div class="filter-container">
            <div class="filter-item">
                <label for="pose-select">Filter by Pose:</label>
                <select id="pose-select">
                    ${allPoses.map(pose => `<option value="${pose.pose_id}">${pose.pose_name}</option>`).join('')}
                </select>
            </div>
            <div class="filter-item">
                <label for="size-slider">Photo Size:</label>
                <input type="range" id="size-slider" min="100" max="500" value="${settings.progress_photo_size || 150}">
                <span id="size-value">${settings.progress_photo_size || 150}px</span>
            </div>
        </div>
    `;

    html += '<div id="photo-grid-header" class="photo-grid-header"></div>';
    html += '<div id="photo-grid-root" class="photo-grid-container">';
    html += '</div>';
    
    mainContent.innerHTML = html;

    const poseSelect = document.getElementById('pose-select');
    const sizeSlider = document.getElementById('size-slider');
    const sizeValue = document.getElementById('size-value');
    
    // Set default pose from settings
    let defaultPoseId = settings.progress_photo_default_pose;
    
    // Check if the default pose exists in the list
    if (defaultPoseId && allPoses.some(p => p.pose_id === parseInt(defaultPoseId, 10))) {
        poseSelect.value = defaultPoseId;
    } else if (allPoses.length > 0) {
        // Fallback to the first pose if none set or if set one no longer exists
        poseSelect.value = allPoses[0].pose_id;
        // Update settings with this first pose
        window.api.updateSetting('progress_photo_default_pose', poseSelect.value);
    }

    poseSelect.addEventListener('change', (e) => {
        const newPoseId = e.target.value;
        updatePhotoGrid(newPoseId);
        window.api.updateSetting('progress_photo_default_pose', newPoseId);
    });

    sizeSlider.addEventListener('input', (e) => {
        const newSize = e.target.value;
        sizeValue.textContent = `${newSize}px`;
        updatePhotoGrid(poseSelect.value, newSize);
    });

    sizeSlider.addEventListener('change', (e) => {
        window.api.updateSetting('progress_photo_size', e.target.value);
    });

    // Initial render of the grid
    updatePhotoGrid(poseSelect.value, sizeSlider.value);
}

function updatePhotoGrid(poseId, customSize) {
    const gridRoot = document.getElementById('photo-grid-root');
    
    const numericPoseId = parseInt(poseId, 10);
    const filteredPhotos = allPhotos.filter(p => p.POSE_ID === numericPoseId);
    const poseSettings = allPoses.find(p => p.pose_id === numericPoseId);

    if (filteredPhotos.length === 0) {
        gridRoot.innerHTML = '<p>No photos found for this pose.</p>';
        return;
    }

    // Group photos by date
    const groupedPhotos = filteredPhotos.reduce((acc, photo) => {
        const date = new Date(photo.DATE * 1000).toLocaleDateString();
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(photo);
        return acc;
    }, {});

    // Sort dates ascending
    const sortedDates = Object.keys(groupedPhotos).sort((a, b) => {
        return new Date(a) - new Date(b);
    });


    // Update Header
    const gridHeader = document.getElementById('photo-grid-header');
    const targetWidth = parseInt(customSize, 10) || (poseSettings ? (poseSettings.collection_size || 150) : 150);
    
    gridHeader.innerHTML = `
        <div class="header-date-column">Date</div>
        <div class="header-items">
            ${ANGLE_ORDER.map(angle => `<div class="header-item" style="--item-width: ${targetWidth}px;">${angle}</div>`).join('')}
        </div>
    `;

    let html = '';
    for (const date of sortedDates) {
        html += `<div class="photo-row">`;
        html += `<div class="photo-date-column">${date}</div>`;
        html += `<div class="photo-items">`;
        
        for (const angle of ANGLE_ORDER) {
            const photo = groupedPhotos[date].find(p => p.ANGLE === angle);
            
            const aspectRatio = poseSettings ? (poseSettings.aspect_ratio || 1.0) : 1.0;
            const targetHeight = targetWidth / aspectRatio;

            if (photo) {
                const fileName = `${photo.PHOTO_ID}.${photo.EXTENSION}`;
                const photoUrl = `photo://${fileName}`;

                html += `
                    <div class="photo-item" style="--item-width: ${targetWidth}px;">
                        <div class="photo-container" style="--container-width: ${targetWidth}px; --container-height: ${targetHeight}px;">
                            <img src="${photoUrl}" alt="${photo.ANGLE}" class="progress-photo" 
                                 data-photo='${JSON.stringify(photo)}' 
                                 data-pose-settings='${JSON.stringify(poseSettings)}'
                                 onload="applyDynamicCrop(this)"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="photo-placeholder">
                                ID: ${photo.PHOTO_ID}<br>
                                ${photo.ANGLE}
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Render a blank grey box for missing angles
                html += `
                    <div class="photo-item" style="--item-width: ${targetWidth}px;">
                        <div class="photo-container blank-placeholder" style="--container-width: ${targetWidth}px; --container-height: ${targetHeight}px;">
                        </div>
                    </div>
                `;
            }
        }
        
        html += `</div></div>`;
    }
    
    gridRoot.innerHTML = html;
}

window.applyDynamicCrop = function(img) {
    const photo = JSON.parse(img.dataset.photo);
    const poseSettings = JSON.parse(img.dataset.poseSettings);
    
    if (!photo || !poseSettings) {
        img.style.display = 'block';
        return;
    }

    const naturalWidth = img.naturalWidth;
    const cropPercent = poseSettings.cropping_percent || 50;
    const aspectRatio = poseSettings.aspect_ratio || 1.0;

    // Landmarks are percentages (0-1) of original image dimensions
    const y1 = photo.Y_LANDMARK_1;
    const y2 = photo.Y_LANDMARK_2;
    const x = photo.X_LANDMARK;

    const yDist = Math.abs(y2 - y1);
    const margin = yDist * (cropPercent / 100);
    
    const cropHeight = yDist + (2 * margin);
    const cropWidth = cropHeight * aspectRatio;

    const centerY = (y1 + y2) / 2;
    const centerX = x;

    img.style.setProperty('--photo-width', `${(naturalWidth / cropWidth) * 100}%`);
    img.style.setProperty('--photo-left', `${-((centerX - cropWidth / 2) / cropWidth) * 100}%`);
    img.style.setProperty('--photo-top', `${-((centerY - cropHeight / 2) / cropHeight) * 100}%`);
    img.style.display = 'block';
};
