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
                assert(chart.scales || data.length === 0, 'chart did not render');
                return chart;
            };

            const assertDomain = (chart, min, max, context) => {
                const domain = chart.scales.y.domain;
                assert(Math.abs(domain[0] - min) < 1e-9 && Math.abs(domain[1] - max) < 1e-9,
                    context + ': expected y domain [' + min + ', ' + max + '], got [' + domain + ']');
            };

            const tickLabels = chart => [...chart.element.querySelectorAll('.lc-y-axis .lc-tick')].map(tick => Number(tick.textContent));

            try {
                const defaultChart = await createChart([{x: 0, y: 42}, {x: 1, y: 68}]);
                assertDomain(defaultChart, 40, 70, 'default setting');
                const disabledChart = await createChart([{x: 0, y: 42}, {x: 1, y: 68}], {yAxisPadding: false});
                assertDomain(disabledChart, 40, 70, 'explicitly disabled setting');

                const defaultTicksPaddedChart = await createChart([{x: 0, y: 42}, {x: 1, y: 68}], {yAxisPadding: true});
                assertDomain(defaultTicksPaddedChart, 30, 80, 'default tick interval');

                const paddedChart = await createChart([{x: 0, y: 42}, {x: 1, y: 68}], {yAxisPadding: true, yTicks: 10});
                assertDomain(paddedChart, 35, 75, '42–68 padded data');
                assert(tickLabels(paddedChart)[0] === 35 && tickLabels(paddedChart).at(-1) === 75,
                    'padded edge ticks were not rendered');

                const fractionalChart = await createChart([{x: 0, y: -0.75}, {x: 1, y: 1.15}], {yAxisPadding: true, yTicks: 10});
                assertDomain(fractionalChart, -1, 1.4, 'negative fractional data');

                const customTicks = [40, 45, 55, 70];
                const customChart = await createChart([{x: 0, y: 42}, {x: 1, y: 68}], {
                    yAxisPadding: true,
                    yTickValues: () => customTicks
                });
                assertDomain(customChart, 35, 85, 'irregular custom ticks');
                assert(customTicks.join(',') === '40,45,55,70', 'custom tick generator output was mutated');
                assert(tickLabels(customChart).join(',') === '35,40,45,55,70,85', 'custom tick spacing or labels changed');

                const repeatedCustomTicks = [40, 40, 45, 70, 70];
                const customAxisChart = await createChart([{x: 0, y: 42}, {x: 1, y: 68}], {
                    yAxisPadding: true,
                    xTickValues: () => [0, 0.5, 1],
                    yTickValues: () => repeatedCustomTicks,
                    renderXTick: value => 'X:' + value,
                    renderYTick: value => 'Y:' + value
                });
                assertDomain(customAxisChart, 35, 95, 'repeated custom edge ticks');
                assert(repeatedCustomTicks.join(',') === '40,40,45,70,70', 'repeated custom ticks were mutated');
                assert([...customAxisChart.element.querySelectorAll('.lc-y-axis .lc-tick')].map(tick => tick.textContent).join(',') ===
                    'Y:35,Y:40,Y:40,Y:45,Y:70,Y:70,Y:95', 'custom y-axis tick rendering changed repeated values');
                assert([...customAxisChart.element.querySelectorAll('.lc-x-axis .lc-tick')].map(tick => tick.textContent).join(',') ===
                    'X:0,X:0.5,X:1', 'custom x-axis tick rendering changed');

                const singleCustomTickChart = await createChart([{x: 0, y: 42}, {x: 1, y: 68}], {
                    yAxisPadding: true,
                    yTicks: 10,
                    yTickValues: () => [50]
                });
                assertDomain(singleCustomTickChart, 35, 75, 'single custom tick fallback');

                const constantChart = await createChart([{x: 0, y: 7}, {x: 1, y: 7}], {yAxisPadding: true});
                assertDomain(constantChart, 5.5, 8.5, 'constant data');

                const multipleSeriesChart = await createChart([
                    {id: 'lower', points: [{x: 0, y: 42}, {x: 1, y: 50}]},
                    {id: 'upper', points: [{x: 0, y: 68}]}
                ], {yAxisPadding: true, yTicks: 10});
                assertDomain(multipleSeriesChart, 35, 75, 'multiple series');

                paddedChart.setData([{x: 0, y: 22}, {x: 1, y: 28}]);
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                assertDomain(paddedChart, 21, 29, 'rerendered data');

                const emptyChart = await createChart([], {yAxisPadding: true});
                assert(emptyChart.scales === null, 'empty padded chart unexpectedly has scales');
                assert(emptyChart.element.querySelectorAll('.lc-y-axis .lc-tick').length === 0, 'empty chart rendered y ticks');
            } finally {
                charts.forEach(chart => chart.destroy());
            }
        })()`).catch(error => { throw error; });
        console.log('Line-chart y-axis padding, custom ticks, and edge-case checks passed.');
        app.exit(0);
    } catch (error) {
        console.error(error);
        app.exit(1);
    }
});