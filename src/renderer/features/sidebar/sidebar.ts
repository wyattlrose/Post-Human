import {loadProgressPhotos} from '../progress-photos/progress-photos.js';
import {loadPhotoEditor} from '../photo-editor/photo-editor.js';
import {loadPhotoUpload} from '../photo-upload/photo-upload.js';
import {cleanupBiometrics, loadBiometrics} from '../biometrics/biometrics.js';
import {cleanupIntegrations, loadIntegrations} from '../integrations/integrations.js';
import {cleanupSettings, loadSettings} from '../settings/settings.js';

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.createElement('div');
    sidebar.id = 'sidebar';
    sidebar.className = 'sidebar';

    const dashboardIcons = [
        {name: 'Progress Photos', icon: 'features/sidebar/assets/camera.svg', id: 'dash-photos', isSvg: true},
        {name: 'Photo Editor', icon: 'features/sidebar/assets/photo-editor.svg', id: 'dash-photo-editor', isSvg: true},
        {name: 'Photo Upload', icon: 'features/sidebar/assets/photo-upload.svg', id: 'dash-photo-upload', isSvg: true},
        {name: 'Biometrics', icon: 'features/sidebar/assets/heart.svg', id: 'dash-biometrics', isSvg: true}
    ];
    const settingsIcons = [
        {name: 'Integrations', icon: 'features/sidebar/assets/integrations.svg', id: 'dash-integrations', isSvg: true},
        {name: 'Settings', icon: 'features/sidebar/assets/settings.svg', id: 'dash-settings', isSvg: true}
    ];

    const createIcon = (item: typeof dashboardIcons[number] | typeof settingsIcons[number]) => {
        const iconContainer = document.createElement('div');
        iconContainer.className = 'sidebar-icon';
        iconContainer.title = item.name;
        if (item.isSvg) {
            iconContainer.innerHTML = `<img src="${item.icon}" style="width: 24px; height: 24px; filter: invert(100%);">`;
        } else {
            iconContainer.innerHTML = `<span>${item.icon}</span>`;
        }
        iconContainer.id = item.id;

        iconContainer.addEventListener('click', () => {
            console.log(`Navigating to ${item.name}`);
            switchDashboard(item.id);
            document.querySelectorAll('.sidebar-icon').forEach(i => i.classList.remove('active'));
            iconContainer.classList.add('active');
        });

        return iconContainer;
    };

    const dashboardGroup = document.createElement('div');
    dashboardGroup.className = 'sidebar-group sidebar-dashboard-group';
    dashboardIcons.forEach(item => dashboardGroup.appendChild(createIcon(item)));
    sidebar.appendChild(dashboardGroup);

    const settingsGroup = document.createElement('div');
    settingsGroup.className = 'sidebar-group sidebar-settings-group';
    settingsIcons.forEach(item => settingsGroup.appendChild(createIcon(item)));
    sidebar.appendChild(settingsGroup);

    // Auto-click the first icon to load the dashboard
    setTimeout(() => {
        const firstIcon = document.getElementById('dash-photos');
        if (firstIcon) firstIcon.click();
    }, 100);

    function switchDashboard(id: string) {
        cleanupIntegrations();
        cleanupBiometrics();
        cleanupSettings();

        const welcomeScreen = document.getElementById('welcome-screen');
        const progressDashboard = document.getElementById('progress-photo-dashboard');

        // Hide all dashboard containers
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (progressDashboard) progressDashboard.style.display = 'none';
        const photoEditorDashboard = document.getElementById('photo-editor-dashboard');
        if (photoEditorDashboard) photoEditorDashboard.style.display = 'none';
        const photoUploadDashboard = document.getElementById('photo-upload-dashboard');
        if (photoUploadDashboard) photoUploadDashboard.style.display = 'none';

        // Remove any dynamically added content from other dashboards
        const temps = document.querySelectorAll('.temp-dashboard');
        temps.forEach(t => t.remove());

        if (id === 'dash-photos') {
            loadProgressPhotos();
        } else if (id === 'dash-photo-editor') {
            loadPhotoEditor();
        } else if (id === 'dash-biometrics') {
            loadBiometrics();
        } else if (id === 'dash-photo-upload') {
            loadPhotoUpload();
        } else if (id === 'dash-integrations') {
            loadIntegrations();
        } else if (id === 'dash-settings') {
            loadSettings();
        }
    }

    document.body.prepend(sidebar);
});
