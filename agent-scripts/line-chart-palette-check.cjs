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
        await win.webContents.executeJavaScript(`(async () => {
            const assert = (condition, message) => { if (!condition) throw new Error(message); };
            const {LineChart} = await import('../../dist/src/renderer/components/line-chart/line-chart.js');
            const container = document.createElement('div');
            container.style.width = '640px';
            document.body.appendChild(container);
            const chart = new LineChart(container, {showLegend: true});
            const series = [
                {id: 'default', label: 'Default', points: [{x: 0, y: 1}, {x: 1, y: 2}]},
                {id: 'custom', label: 'Custom', className: 'custom-series', points: [{x: 0, y: 2}, {x: 1, y: 3}]}
            ];
            chart.setData(series);
            const waitForRender = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const style = (selector, pseudo) => getComputedStyle(document.querySelector(selector), pseudo);
            const colorOf = token => {
                const probe = document.createElement('span');
                probe.style.color = 'var(' + token + ')';
                document.body.appendChild(probe);
                const color = getComputedStyle(probe).color;
                probe.remove();
                return color;
            };
            const effortExamples = {};
            for (const [type, token] of Object.entries({
                cut: '--chart-effort-cut-color',
                maintain: '--chart-effort-maintain-color',
                bulk: '--chart-effort-bulk-color',
                unknown: '--chart-effort-unknown-color'
            })) {
                const wrapper = document.createElement('div');
                wrapper.className = 'effort-type-' + type;
                const swatch = document.createElement('span');
                swatch.className = 'biometrics-effort-swatch';
                const marker = document.createElement('div');
                marker.className = 'biometrics-effort-marker';
                const label = document.createElement('div');
                label.className = 'biometrics-effort-marker-label';
                wrapper.append(swatch, marker, label);
                document.body.appendChild(wrapper);
                effortExamples[type] = {token, wrapper, swatch, marker, label};
            }

            try {
                await waitForRender();
                const defaultLine = document.querySelector('.lc-series[data-series="default"] .lc-line');
                const defaultPoint = document.querySelector('.lc-series[data-series="default"] .lc-point');
                const defaultSwatch = document.querySelector('.lc-legend-item:not(.custom-series) .lc-legend-swatch');
                const customLine = document.querySelector('.lc-series.custom-series .lc-line');
                const customPoint = document.querySelector('.lc-series.custom-series .lc-point');
                const customSwatch = document.querySelector('.lc-legend-item.custom-series .lc-legend-swatch');
                assert(defaultLine && defaultPoint && defaultSwatch && customLine && customPoint && customSwatch, 'chart series and legend swatches were not rendered');
                assert(colorOf('--chart-accent-color') === 'rgb(0, 155, 206)', 'root chart accent default changed');
                assert(getComputedStyle(defaultLine).stroke === 'rgb(0, 155, 206)', 'default series line does not use the chart accent');
                assert(getComputedStyle(defaultPoint).fill === 'rgb(0, 155, 206)', 'default points do not use the chart accent');
                assert(getComputedStyle(defaultSwatch).backgroundColor === 'rgb(0, 155, 206)', 'default legend swatch does not use the chart accent');
                assert(getComputedStyle(customLine).stroke === 'rgb(0, 155, 206)', 'customizable series did not inherit the chart accent');

                const paletteStyle = document.createElement('style');
                paletteStyle.textContent = '.line-chart .custom-series { --lc-series-color: #7a3d8a; }';
                document.head.appendChild(paletteStyle);
                assert(getComputedStyle(customLine).stroke === 'rgb(122, 61, 138)', 'per-series color override is not supported');
                assert(getComputedStyle(customSwatch).backgroundColor === 'rgb(122, 61, 138)', 'per-series override did not reach its legend swatch');

                document.documentElement.style.setProperty('--chart-accent-color', '#1476a3');
                assert(getComputedStyle(defaultLine).stroke === 'rgb(20, 118, 163)', 'root accent update did not reach the series line');
                assert(getComputedStyle(defaultPoint).fill === 'rgb(20, 118, 163)', 'root accent update did not reach points');
                assert(getComputedStyle(defaultSwatch).backgroundColor === 'rgb(20, 118, 163)', 'root accent update did not reach the legend');
                assert(getComputedStyle(customLine).stroke === 'rgb(122, 61, 138)', 'root accent update overrode a local series color');

                for (const [type, expected] of Object.entries({
                    cut: 'rgb(255, 124, 91)',
                    maintain: 'rgb(255, 208, 52)',
                    bulk: 'rgb(114, 198, 116)',
                    unknown: 'rgb(163, 163, 163)'
                })) {
                    const example = effortExamples[type];
                    const color = colorOf(example.token);
                    assert(color === expected, type + ' effort palette token changed');
                    assert(getComputedStyle(example.swatch).backgroundColor === color, type + ' swatch does not use the palette token');
                    assert(getComputedStyle(example.marker, '::before').backgroundColor === color, type + ' marker does not use the palette token');
                    assert(getComputedStyle(example.label).borderBottomColor === color, type + ' label underline does not use the palette token');
                }
                document.documentElement.style.setProperty('--chart-effort-maintain-color', '#8d7b26');
                assert(getComputedStyle(effortExamples.maintain.swatch).backgroundColor === 'rgb(141, 123, 38)', 'root effort update did not reach its swatch');
                assert(getComputedStyle(effortExamples.maintain.marker, '::before').backgroundColor === 'rgb(141, 123, 38)', 'root effort update did not reach its line');
                assert(getComputedStyle(effortExamples.maintain.label).borderBottomColor === 'rgb(141, 123, 38)', 'root effort update did not reach its underline');

                assert(getComputedStyle(document.querySelector('.lc-grid-line')).stroke === 'rgba(64, 64, 64, 0.5)', 'grid does not use the chart neutral palette');
                assert(style('.lc-plot', '::after').borderBottomColor === 'rgba(255, 255, 255, 0.4)', 'plot frame does not use the chart neutral palette');
                assert(style('.lc-x-axis .lc-tick').color === 'rgba(255, 255, 255, 0.7)', 'axis text does not use the chart text role');

                const plot = chart.element.querySelector('.lc-plot');
                const rect = plot.getBoundingClientRect();
                plot.dispatchEvent(new PointerEvent('pointermove', {
                    bubbles: true,
                    clientX: rect.left + chart.scales.x(1),
                    clientY: rect.top + rect.height / 2
                }));
                document.documentElement.style.setProperty('--chart-neutral-white-rgb', '240, 240, 240');
                const hoverPoint = chart.element.querySelector('.lc-hover-point');
                const crosshair = chart.element.querySelector('.lc-crosshair');
                const tooltip = chart.element.querySelector('.lc-tooltip');
                assert(getComputedStyle(hoverPoint).fill === 'rgb(240, 240, 240)', 'root neutral update did not reach highlighted points');
                assert(getComputedStyle(hoverPoint).stroke === 'rgb(240, 240, 240)', 'root neutral update did not reach highlighted point borders');
                assert(getComputedStyle(crosshair).stroke === 'rgba(240, 240, 240, 0.55)', 'root neutral update did not reach the hover guide');
                assert(getComputedStyle(tooltip).borderTopColor === 'rgba(240, 240, 240, 0.04)', 'root neutral update did not reach the tooltip outline');
                assert(getComputedStyle(tooltip).color === 'rgb(240, 240, 240)', 'root neutral update did not reach tooltip text');
                assert(colorOf('--chart-tooltip-date-color') === 'rgba(240, 240, 240, 0.55)', 'root neutral update did not reach chart tooltip roles');
            } finally {
                chart.destroy();
                container.remove();
                Object.values(effortExamples).forEach(({wrapper}) => wrapper.remove());
            }
        })()`).catch(error => { throw error; });
        console.log('Root chart palette defaults, live updates, effort colors, and series overrides passed.');
        app.exit(0);
    } catch (error) {
        console.error(error);
        app.exit(1);
    }
});