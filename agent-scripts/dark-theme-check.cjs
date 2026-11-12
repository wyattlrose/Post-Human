const {app, BrowserWindow} = require('electron');
const path = require('node:path');

app.whenReady().then(async () => {
    const win = new BrowserWindow({
        width: 900,
        height: 800,
        show: false,
        webPreferences: {contextIsolation: false, nodeIntegration: false, backgroundThrottling: false}
    });
    try {
        await win.loadFile(path.join(__dirname, '../src/renderer/index.html'));
        await win.webContents.executeJavaScript(`(() => {
            const assert = (condition, message) => { if (!condition) throw new Error(message); };
            document.body.innerHTML = \`
                <div class="sidebar"><div class="sidebar-icon active"></div></div>
                <div class="filter-container"></div>
                <div class="integrations-card"><p class="integrations-status is-error">Error</p></div>
                <div id="upload-thumbnail-strip"><div class="photo-strip-item needs-settings"><span class="photo-strip-label">Needs settings</span></div></div>
                <button class="interactable-button">Button</button>
                <button class="interactable-button interactable-selector-btn">Selector</button>
                <div class="interactable-dropdown-menu">Menu</div>
                <input class="text-input" placeholder="Text">
                <input type="range">
                <div class="segmented-control"><button class="segmented-control-option is-selected">Selected</button></div>
                <div class="drop-zone"></div><div class="drop-zone drag-over"></div>
                <div class="line-chart"></div>
                <div class="editor-canvas"><div class="editor-landmark"></div></div>
                <div class="effort-type-cut"></div><div class="effort-type-maintain"></div><div class="effort-type-bulk"></div>
            \`;
            document.head.insertAdjacentHTML('beforeend', '<style>* { transition: none !important; }</style>');
            const style = selector => getComputedStyle(document.querySelector(selector));
            const isGrey = value => {
                const match = value.match(/^rgba?\\((\\d+), (\\d+), (\\d+)/);
                return match && match[1] === match[2] && match[2] === match[3];
            };
            const root = style(':root');
            for (const token of ['--bg-color', '--sidebar-bg', '--surface-color', '--border-color', '--track-color', '--text-primary', '--text-secondary']) {
                const probe = document.createElement('span');
                probe.style.color = root.getPropertyValue(token);
                document.body.appendChild(probe);
                assert(isGrey(getComputedStyle(probe).color), token + ' is not greyscale');
                probe.remove();
            }
            assert(root.colorScheme === 'dark', 'native controls do not use the dark color scheme');
            for (const selector of ['body', '.sidebar', '.filter-container', '.integrations-card']) {
                assert(isGrey(style(selector).backgroundColor), selector + ' background is not greyscale');
            }
            for (const selector of ['.integrations-status.is-error', '.needs-settings .photo-strip-label']) {
                assert(isGrey(style(selector).color), selector + ' text is not greyscale');
                assert(Number(style(selector).fontWeight) >= 700, selector + ' is not visually distinguished');
            }
            const expected = [
                ['.interactable-button', 'backgroundColor', 'rgb(59, 130, 246)'],
                ['.interactable-selector-btn', 'backgroundColor', 'rgb(30, 58, 100)'],
                ['.interactable-dropdown-menu', 'backgroundColor', 'rgb(30, 58, 100)'],
                ['.text-input', 'backgroundColor', 'rgb(30, 58, 100)'],
                ['.segmented-control-option.is-selected', 'backgroundColor', 'rgb(59, 130, 246)'],
                ['.sidebar-icon.active', 'backgroundColor', 'rgb(59, 130, 246)'],
                ['.drop-zone:not(.drag-over)', 'backgroundColor', 'rgb(26, 36, 56)'],
                ['.drop-zone:not(.drag-over)', 'borderColor', 'rgb(42, 54, 80)'],
                ['.drop-zone.drag-over', 'backgroundColor', 'rgb(30, 58, 100)'],
                ['.drop-zone.drag-over', 'borderColor', 'rgb(59, 130, 246)'],
                ['.editor-landmark', 'backgroundColor', 'rgb(77, 171, 247)']
            ];
            expected.forEach(([selector, property, color]) => assert(style(selector)[property] === color, selector + ' lost its blue ' + property));
            assert(root.getPropertyValue('--interactive-track').trim() === '#33415c', 'slider track lost its blue tint');
            const rules = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules]);
            const inputFocus = rules.find(rule => rule.selectorText?.includes('.text-input:focus'));
            const sliderTrack = rules.find(rule => rule.selectorText === 'input[type="range"]::-webkit-slider-runnable-track');
            const sliderThumb = rules.find(rule => rule.selectorText === 'input[type="range"]::-webkit-slider-thumb');
            assert(inputFocus?.style.backgroundColor === 'var(--selector-hover)', 'focused input lost its blue hover/focus color');
            assert(sliderTrack?.style.backgroundColor === 'var(--interactive-track)', 'slider does not use its blue track color');
            assert(sliderThumb?.style.backgroundColor === 'var(--accent-color)', 'slider does not use its blue thumb color');
            assert(root.getPropertyValue('--chart-accent-color').trim() === '#009BCE', 'chart series lost its root accent color');
            const expectedEffortColors = {
                cut: 'rgb(255, 124, 91)',
                maintain: 'rgb(255, 208, 52)',
                bulk: 'rgb(114, 198, 116)'
            };
            const shades = ['cut', 'maintain', 'bulk'].map(type => {
                const probe = document.createElement('span');
                probe.style.color = style('.effort-type-' + type).getPropertyValue('--effort-color');
                document.body.appendChild(probe);
                const color = getComputedStyle(probe).color;
                probe.remove();
                assert(color === expectedEffortColors[type], type + ' effort color differs from the shared chart palette');
                return color;
            });
            assert(new Set(shades).size === 3, 'effort types do not have distinct shades');
        })()`);
        console.log('Dark surfaces, greyscale statuses, shared chart palette, and preserved blue controls verified.');
        app.exit(0);
    } catch (error) {
        console.error(error);
        app.exit(1);
    }
});