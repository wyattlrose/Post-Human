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
            const toSeconds = date => Math.floor(date.getTime() / 1000);
            const {LineChart} = await import('../../dist/src/renderer/components/line-chart/line-chart.js');
            const {timeTicks} = await import('../../dist/src/renderer/components/line-chart/ticks.js');
            const charts = [];

            const createChart = async (data, options = {}) => {
                const container = document.createElement('div');
                container.style.width = '640px';
                document.body.appendChild(container);
                const chart = new LineChart(container, options);
                charts.push(chart);
                chart.setData(data);
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                assert(chart.scales || data.length === 0, 'chart did not render');
                return chart;
            };

            const tickLabels = chart => [...chart.element.querySelectorAll('.lc-x-axis .lc-tick')]
                .map(tick => tick.textContent);

            try {
                const dailyStart = toSeconds(new Date(2024, 0, 1, 12));
                const dailyEnd = toSeconds(new Date(2024, 0, 6, 12));
                const dailyTicks = timeTicks(dailyStart, dailyEnd, 5);
                assert(dailyTicks.map(value => new Date(value * 1000).getDate()).join(',') === '2,3,4,5,6',
                    'daily calendar ticks were not aligned to local midnight in epoch seconds');
                assert(dailyTicks.every(value => {
                    const date = new Date(value * 1000);
                    return value >= dailyStart && value <= dailyEnd && value < 2_000_000_000 &&
                        date.getHours() === 0 && date.getMinutes() === 0;
                }),
                    'daily ticks were not returned as epoch seconds within the requested domain');

                const monthlyStart = toSeconds(new Date(2024, 0, 15, 12));
                const monthlyEnd = toSeconds(new Date(2024, 7, 15, 12));
                const monthlyTicks = timeTicks(monthlyStart, monthlyEnd, 4);
                assert(monthlyTicks.every(value => {
                    const date = new Date(value * 1000);
                    return date.getDate() === 1 && date.getHours() === 0;
                }),
                    'monthly calendar ticks were not aligned to the first day of each month');
                assert(monthlyTicks.map(value => new Date(value * 1000).getMonth()).join(',') === '2,4,6',
                    'monthly tick interval changed');

                const subdayStart = toSeconds(new Date(2024, 2, 1, 8, 15));
                const subdayEnd = toSeconds(new Date(2024, 2, 1, 14, 15));
                const subdayTicks = timeTicks(subdayStart, subdayEnd, 11);
                assert(subdayTicks.length > 1 && subdayTicks.every(value => value >= subdayStart && value <= subdayEnd),
                    'subday ticks were not generated within the epoch-second domain');
                assert(subdayTicks.slice(1).every((value, index) => value - subdayTicks[index] === 2000),
                    'subday ticks no longer use regular numeric intervals in seconds');

                const start = toSeconds(new Date(2024, 0, 1));
                const end = toSeconds(new Date(2024, 0, 2));
                const customCalls = [];
                const customChart = await createChart([{x: start, y: 1}, {x: end, y: 2}], {
                    xTickValues: (min, max) => {
                        customCalls.push([min, max]);
                        return [min, (min + max) / 2, max];
                    },
                    formatX: value => 't:' + value
                });
                assert(customCalls.length === 1 && customCalls[0][0] === start && customCalls[0][1] === end,
                    'custom tick generator did not receive epoch seconds or override calendar ticks');
                assert(tickLabels(customChart).join(',') === [start, (start + end) / 2, end].map(value => 't:' + value).join(','),
                    'epoch-second custom ticks were not formatted for the x-axis');

                const plot = customChart.element.querySelector('.lc-plot');
                const plotRect = plot.getBoundingClientRect();
                plot.dispatchEvent(new PointerEvent('pointermove', {
                    clientX: plotRect.left + customChart.scales.x(start),
                    clientY: plotRect.top + customChart.scales.y(1)
                }));
                assert(customChart.element.querySelector('.lc-tooltip-x').textContent === 't:' + start,
                    'default hover tooltip did not format its epoch-second x value');

                let singleDomainTickCalls = 0;
                const singleDomain = await createChart([{x: start, y: 1}, {x: start, y: 2}], {
                    xTickValues: () => { singleDomainTickCalls++; return []; }
                });
                assert(singleDomainTickCalls === 0 && tickLabels(singleDomain).join(',') === String(start),
                    'single-value x domain did not preserve its sole epoch-second tick');

                const defaultStart = toSeconds(new Date(2024, 0, 1, 12));
                const defaultEnd = toSeconds(new Date(2024, 0, 6, 12));
                const defaultChart = await createChart([{x: defaultStart, y: 1}, {x: defaultEnd, y: 2}], {xTicks: 5});
                const defaultTicks = [...defaultChart.element.querySelectorAll('.lc-x-axis .lc-tick')]
                    .map(tick => Number(tick.textContent));
                assert(defaultTicks.length === 5 && defaultTicks.every(value => {
                    const date = new Date(value * 1000);
                    return value >= defaultStart && value <= defaultEnd && date.getHours() === 0 && date.getMinutes() === 0;
                }), 'default x-axis ticks were not calendar-aligned epoch-second times');
            } finally {
                charts.forEach(chart => chart.destroy());
            }
        })()`).catch(error => { throw error; });
        console.log('Line-chart epoch-second and calendar tick checks passed.');
        app.exit(0);
    } catch (error) {
        console.error(error);
        app.exit(1);
    }
});