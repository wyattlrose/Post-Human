let allPhotos = [];
let allPoses = [];
let settings = {};

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
    
    // Add Pose Selector
    html += `
        <div class="filter-container">
            <label for="pose-select">Filter by Pose:</label>
            <select id="pose-select">
                ${allPoses.map(pose => `<option value="${pose.pose_id}">${pose.pose_name}</option>`).join('')}
            </select>
        </div>
    `;

    html += '<div id="photo-grid-root" class="photo-grid-container">';
    html += '</div>';
    
    mainContent.innerHTML = html;

    const poseSelect = document.getElementById('pose-select');
    
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

    // Initial render of the grid
    updatePhotoGrid(poseSelect.value);
}

function updatePhotoGrid(poseId) {
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

    let html = '';
    for (const date of sortedDates) {
        html += `<div class="photo-row">`;
        html += `<div class="photo-date-header">${date}</div>`;
        html += `<div class="photo-items">`;
        
        for (const photo of groupedPhotos[date]) {
            const fileName = `${photo.PHOTO_ID}.${photo.EXTENSION}`;
            const photoUrl = `photo://${fileName}`;
            
            // Dynamic Cropping Logic
            let containerStyle = '';
            
            if (poseSettings && photo.Y_LANDMARK_1 !== null && photo.Y_LANDMARK_2 !== null && photo.X_LANDMARK !== null) {
                const aspectRatio = poseSettings.aspect_ratio || 1.0;
                const targetWidth = poseSettings.collection_size || 150;

                containerStyle = `
                    position: relative;
                    overflow: hidden;
                    width: ${targetWidth}px;
                    height: ${targetWidth / aspectRatio}px;
                    background-color: #f0f0f0;
                `;
            }

            html += `
                <div class="photo-item" style="${poseSettings ? `width: ${poseSettings.collection_size || 150}px;` : ''}">
                    <div class="photo-container" style="${containerStyle}">
                        <img src="${photoUrl}" alt="${photo.ANGLE}" class="progress-photo" style="display: none;" 
                             data-photo='${JSON.stringify(photo)}' 
                             data-pose-settings='${JSON.stringify(poseSettings)}'
                             onload="applyDynamicCrop(this)"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="photo-placeholder" style="display: none;">
                            ID: ${photo.PHOTO_ID}<br>
                            ${photo.ANGLE}
                        </div>
                    </div>
                    <div class="photo-label">${photo.ANGLE}</div>
                </div>
            `;
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
    const naturalHeight = img.naturalHeight;

    const cropPercent = poseSettings.cropping_percent || 50;
    const aspectRatio = poseSettings.aspect_ratio || 1.0;
    const targetWidth = poseSettings.collection_size || 150;

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

    const cropTop = centerY - (cropHeight / 2);
    const cropLeft = centerX - (cropWidth / 2);

    const scale = targetWidth / cropWidth;

    img.style.width = (naturalWidth * scale) + 'px';
    img.style.height = (naturalHeight * scale) + 'px';
    img.style.top = (-cropTop * scale) + 'px';
    img.style.left = (-cropLeft * scale) + 'px';
    img.style.position = 'absolute';
    img.style.display = 'block';
    img.style.maxWidth = 'none';
    img.style.maxHeight = 'none';
};
