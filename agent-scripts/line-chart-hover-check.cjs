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
            const charts = [];

            const createChart = async (data, options = {}) => {
                const container = document.createElement('div');
                container.style.width = '640px';
                document.body.appendChild(container);
                const chart = new LineChart(container, options);
                charts.push(chart);
                chart.setData(data);
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                assert(chart.scales, 'chart did not render');
                return chart;
            };

            const hover = (chart, x, values, context) => {
                const plot = chart.element.querySelector('.lc-plot');
                const rect = plot.getBoundingClientRect();
                plot.dispatchEvent(new PointerEvent('pointermove', {
                    bubbles: true,
                    clientX: rect.left + chart.scales.x(x),
                    clientY: rect.top + rect.height / 2
                }));

                const line = chart.element.querySelector('.lc-crosshair');
                assert(line, context + ': hover guide was not rendered');
                const expectedY = Math.min(...values.map(value => chart.scales.y(value)));
                const plotHeight = Number(chart.element.querySelector('.lc-svg').getAttribute('height'));
                assert(Math.abs(Number(line.getAttribute('y1')) - expectedY) < 0.01,
                    context + ': guide did not begin at the highest highlighted point');
                assert(Math.abs(Number(line.getAttribute('y2')) - plotHeight) < 0.01,
                    context + ': guide did not extend to the bottom of the plot');

                const circles = [...chart.element.querySelectorAll('.lc-hover-point')];
                assert(circles.length === values.length, context + ': unexpected highlighted-point count');
                circles.forEach(circle => {
                    const style = getComputedStyle(circle);
                    assert(style.fill === 'rgb(255, 255, 255)', context + ': highlighted point fill is not white');
                    assert(style.stroke === 'rgb(255, 255, 255)', context + ': highlighted point stroke is not white');
                    assert(circle.getAttribute('r') === '5', context + ': highlighted point size changed');
                    assert(Number.parseFloat(style.strokeWidth) === 2, context + ': highlighted point stroke width changed');
                    assert(style.filter.includes('drop-shadow'), context + ': highlighted point has no light glow');
                });
                const guideStyle = getComputedStyle(line);
                assert(Number.parseFloat(guideStyle.strokeWidth) === 1.5, context + ': hover guide is not slightly thicker');
                assert(guideStyle.stroke === 'rgba(255, 255, 255, 0.55)', context + ': hover guide is not slightly brighter');

                const tooltipStyle = getComputedStyle(chart.element.querySelector('.lc-tooltip'));
                assert(tooltipStyle.borderTopWidth === '1px' && tooltipStyle.borderTopColor === 'rgba(255, 255, 255, 0.04)', context + ': tooltip outline is not subtle white');
                assert(tooltipStyle.boxShadow.includes('rgba(0, 0, 0, 0.7)'), context + ': tooltip has no dark shadow');
                assert(tooltipStyle.textAlign === 'center' && tooltipStyle.alignItems === 'center', context + ': tooltip text is not centered');
                assert(tooltipStyle.gap === '6px', context + ': tooltip row gap is not 6px');
            };

            const moveToX = (chart, x) => {
                const plot = chart.element.querySelector('.lc-plot');
                const rect = plot.getBoundingClientRect();
                plot.dispatchEvent(new PointerEvent('pointermove', {
                    bubbles: true,
                    clientX: rect.left + chart.scales.x(x),
                    clientY: rect.top + rect.height / 2
                }));
            };

            try {
                const chart = await createChart([
                    {x: 0, y: 0},
                    {x: 1, y: 10},
                    {x: 2, y: 20},
                    {x: 3, y: 30},
                    {x: 4, y: 40}
                ]);

                const sharedXChart = await createChart([
                    {id: 'lower', points: [{x: 0, y: 0}, {x: 1, y: 15}]},
                    {id: 'upper', points: [{x: 0, y: 40}, {x: 1, y: 30}]}
                ]);
                moveToX(sharedXChart, 1);
                assert([...sharedXChart.element.querySelectorAll('.lc-tooltip-y')].map(row => row.textContent).join(',') === '15,30',
                    'shared-x tooltip values changed');

                const duplicateChart = await createChart([{
                    id: 'duplicates',
                    points: [{x: 2, y: 200}, {x: 1, y: 101}, {x: 1, y: 100}, {x: 0, y: 0}]
                }]);
                moveToX(duplicateChart, 1);
                assert(duplicateChart.element.querySelector('.lc-tooltip-x').textContent === '1',
                    'sorted duplicate points selected the wrong x-coordinate');
                assert(duplicateChart.element.querySelector('.lc-tooltip-y').textContent === '101',
                    'sorted duplicate points did not preserve their stable order');

                const tiedChart = await createChart([
                    {id: 'empty', points: []},
                    {id: 'first', points: [{x: 0, y: 10}, {x: 2, y: 20}]},
                    {id: 'second', points: [{x: 2, y: 30}]}
                ]);
                moveToX(tiedChart, 1);
                assert(tiedChart.element.querySelector('.lc-tooltip-x').textContent === '0',
                    'equal-distance series tie no longer favors the first series');
                assert([...tiedChart.element.querySelectorAll('.lc-tooltip-y')].map(row => row.textContent).join(',') === '10',
                    'equal-distance tie selected unexpected series points');

                let customTooltipHovers = null;
                let customTooltipChart = null;
                const customTooltip = await createChart([{id: 'custom', label: 'Custom', points: [{x: 0, y: 7}, {x: 1, y: 9}]}], {
                    renderTooltip: (hovers, chart) => {
                        customTooltipHovers = hovers;
                        customTooltipChart = chart;
                        const content = document.createElement('span');
                        content.className = 'custom-tooltip';
                        content.textContent = hovers[0].series.label + ':' + hovers[0].point.y;
                        return content;
                    }
                });
                moveToX(customTooltip, 1);
                assert(customTooltipHovers.length === 1 && customTooltipHovers[0].point.x === 1 && customTooltipHovers[0].point.y === 9,
                    'custom tooltip received the wrong hover points');
                assert(customTooltipChart === customTooltip, 'custom tooltip received the wrong chart instance');
                assert(customTooltip.element.querySelector('.custom-tooltip').textContent === 'Custom:9',
                    'custom tooltip content was not rendered');

                hover(chart, 0, [0], 'lower point');
                hover(chart, 4, [40], 'upper point');
                hover(chart, 2, [20], 'interior point');
                assert(!chart.element.querySelector('.lc-tooltip').hidden, 'tooltip was hidden while hovering');
                hover(sharedXChart, 1, [15, 30], 'shared-x points');

                const plot = chart.element.querySelector('.lc-plot');
                plot.dispatchEvent(new PointerEvent('pointerleave'));
                assert(!chart.element.querySelector('.lc-crosshair'), 'hover guide remained after pointer leave');
                assert(chart.element.querySelector('.lc-tooltip').hidden, 'tooltip remained visible after pointer leave');
            } finally {
                charts.forEach(chart => chart.destroy());
            }
        })()`).catch(error => { throw error; });
        console.log('Line-chart hover guide and highlighted-point checks passed.');
        app.exit(0);
    } catch (error) {
        console.error(error);
        app.exit(1);
    }
});