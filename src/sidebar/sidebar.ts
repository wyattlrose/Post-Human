import { loadProgressPhotos } from '../progress-photos/progress-photos.js';

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.createElement('div');
    sidebar.id = 'sidebar';
    sidebar.className = 'sidebar';

    const icons = [
        { name: 'Progress Photos', icon: 'src/sidebar/assets/camera.svg', id: 'dash-photos', isSvg: true },
        { name: 'Dashboard', icon: '📊', id: 'dash-main' },
        { name: 'Analytics', icon: '📈', id: 'dash-analytics' },
        { name: 'Users', icon: '👥', id: 'dash-users' },
        { name: 'Settings', icon: '⚙️', id: 'dash-settings' }
    ];

    icons.forEach(item => {
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

        sidebar.appendChild(iconContainer);
    });

    // Auto-click the first icon to load the dashboard
    setTimeout(() => {
        const firstIcon = document.getElementById('dash-photos');
        if (firstIcon) firstIcon.click();
    }, 100);

    function switchDashboard(id: string) {
        const welcomeScreen = document.getElementById('welcome-screen');
        const progressDashboard = document.getElementById('progress-photo-dashboard');
        
        // Hide all dashboard containers
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (progressDashboard) progressDashboard.style.display = 'none';
        
        // Remove any dynamically added content from other dashboards
        const temps = document.querySelectorAll('.temp-dashboard');
        temps.forEach(t => t.remove());

        if (id === 'dash-photos') {
            loadProgressPhotos();
        } else {
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                mainContent.insertAdjacentHTML('beforeend', `
                    <div class="temp-dashboard">
                        <h1>${id.replace('dash-', '').toUpperCase()}</h1>
                        <p>Content for ${id} dashboard.</p>
                    </div>
                `);
            }
        }
    }

    document.body.prepend(sidebar);
});
