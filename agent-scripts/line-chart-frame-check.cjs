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
            const chart = new LineChart(container);

            try {
                chart.setData([
                    {x: 0, y: 10},
                    {x: 1, y: 20},
                    {x: 2, y: 30},
                    {x: 3, y: 40}
                ]);
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

                const plot = chart.element.querySelector('.lc-plot');
                const gridLines = [...chart.element.querySelectorAll('.lc-grid-line')];
                const yLabels = [...chart.element.querySelectorAll('.lc-y-axis .lc-tick')];
                const xLabels = [...chart.element.querySelectorAll('.lc-x-axis .lc-tick')];
                const frame = getComputedStyle(plot, '::after');
                const plotStyle = getComputedStyle(plot);
                const points = [...chart.element.querySelectorAll('.lc-point')];
                const dataLine = chart.element.querySelector('.lc-line');

                assert(points.length === 4 && points.every(point => point.getAttribute('r') === '1.5'),
                    'unhighlighted data points are not 3px in diameter');
                assert(dataLine && Number.parseFloat(getComputedStyle(dataLine).strokeWidth) === 2,
                    'chart line width changed');
                assert(!chart.element.querySelector('.lc-axis-tick'), 'axis tick marks were rendered');
                assert(gridLines.length > 0, 'background grid lines were removed');
                assert(gridLines.some(line => line.getAttribute('y1') === line.getAttribute('y2')),
                    'horizontal Y-axis grid lines were removed');
                assert(gridLines.some(line => line.getAttribute('x1') === line.getAttribute('x2')),
                    'vertical X-axis grid lines were removed');
                assert(yLabels.length > 0 && xLabels.length > 0, 'axis labels were removed');
                assert(frame.borderLeftStyle === 'solid' && frame.borderBottomStyle === 'solid',
                    'plot frame does not have left and bottom borders');
                assert(frame.borderLeftWidth === '2px' && frame.borderBottomWidth === '2px',
                    'plot frame border widths changed');
                assert(frame.borderLeftColor === frame.borderBottomColor, 'plot frame border colors do not match');
                assert(frame.position === 'absolute' && frame.inset === '0px', 'plot frame is not inset over the plot');
                assert(frame.boxSizing === 'border-box', 'plot frame extends beyond the plot dimensions');
                assert(['borderLeftWidth', 'borderBottomWidth', 'paddingLeft', 'paddingBottom']
                    .every(property => plotStyle[property] === '0px'), 'plot frame changes plot layout dimensions');
                assert(frame.pointerEvents === 'none', 'plot frame intercepts pointer input');

                const initialWidth = plot.getBoundingClientRect().width;
                container.style.width = '480px';
                await new Promise(resolve => setTimeout(resolve, 100));
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                assert(plot.getBoundingClientRect().width < initialWidth, 'resized plot did not shrink');
                assert(chart.scales, 'chart scales were lost after resize');

                const resizedRect = plot.getBoundingClientRect();
                plot.dispatchEvent(new PointerEvent('pointermove', {
                    bubbles: true,
                    clientX: resizedRect.left + chart.scales.x(1),
                    clientY: resizedRect.top + resizedRect.height / 2
                }));
                assert(chart.element.querySelector('.lc-crosshair'), 'plot pointer interaction stopped working');
                const highlightedPoint = chart.element.querySelector('.lc-hover-point');
                assert(highlightedPoint && highlightedPoint.getAttribute('r') === '5',
                    'highlighted point size changed');
                assert(Number.parseFloat(getComputedStyle(highlightedPoint).strokeWidth) === 2,
                    'highlighted point stroke width changed');
            } finally {
                chart.destroy();
                container.remove();
            }
        })()`).catch(error => { throw error; });
        console.log('Line-chart plot frame, grid, labels, resize, and pointer checks passed.');
        app.exit(0);
    } catch (error) {
        console.error(error);
        app.exit(1);
    }
});