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
            const template = document.getElementById('tpl-biometrics-dashboard');
            document.body.replaceChildren(Object.assign(document.createElement('div'), {id: 'main-content'}), template);
            const now = Math.floor(Date.now() / 1000), day = 86400;
            const efforts = [
                {effortId: 1, startDate: now - 99 * day, typeKey: 2, description: 'Left edge'},
                {effortId: 2, startDate: now - 98 * day, typeKey: 1, description: 'Close'},
                {effortId: 3, startDate: now - 50 * day, typeKey: 3, description: 'Twin A'},
                {effortId: 4, startDate: now - 50 * day, typeKey: 2, description: 'Twin B'},
                {effortId: 5, startDate: now - 30 * day, typeKey: 3, description: 'Short'},
                {effortId: 6, startDate: now - day, typeKey: 2, description: 'Right edge'}
            ];
            const assertHoveredLabelStyle = (label, context) => {
                const style = getComputedStyle(label);
                assert(style.color === 'rgba(255, 255, 255, 0.98)', context + ' label text did not brighten');
                assert(style.backgroundColor === 'rgba(255, 255, 255, 0.035)', context + ' label did not gain a faint neutral background');
            };
            window.api = {
                getBiometricWeight: async () => [{date: now - 100 * day, weight: 150}, {date: now, weight: 1}],
                getBiometricEfforts: async () => efforts,
                getEffortTypes: async () => [{key: 1, text: 'Cut'}, {key: 2, text: 'Maintain'}, {key: 3, text: 'Bulk'}]
            };
            const page = await import('../../dist/src/renderer/features/biometrics/biometrics.js');
            const waitForRender = async count => {
                const deadline = Date.now() + 5000;
                while (Date.now() < deadline) {
                    const plot = document.querySelector('.lc-plot');
                    const svg = plot?.querySelector('.lc-svg');
                    if (document.querySelectorAll('.biometrics-effort-marker-label').length === count
                        && plot && svg && Math.abs(Number(svg.getAttribute('width')) - plot.getBoundingClientRect().width) < 1) return;
                    await new Promise(resolve => setTimeout(resolve, 20));
                }
                throw new Error('timed out waiting for chart rendering with ' + count + ' labels');
            };
            await page.loadBiometrics();
            await waitForRender(efforts.length);

            const checkLabels = () => {
                const plot = document.querySelector('.lc-plot').getBoundingClientRect();
                const labels = [...document.querySelectorAll('.biometrics-effort-marker-label')];
                const markers = [...document.querySelectorAll('.biometrics-effort-marker')];
                const effortColors = {
                    'effort-type-cut': 'rgb(255, 124, 91)',
                    'effort-type-maintain': 'rgb(255, 208, 52)',
                    'effort-type-bulk': 'rgb(114, 198, 116)'
                };
                const chart = document.querySelector('.biometrics-chart .line-chart');
                const chartStyle = getComputedStyle(chart);
                assert(chartStyle.getPropertyValue('--effort-label-row-height').trim() === '26px', 'effort label row height is not 26px');
                assert(Math.abs(parseFloat(chartStyle.height) - parseFloat(chartStyle.getPropertyValue('--lc-height')) - 26) < 1, 'effort label row did not add its height above the plot');
                assert(labels.length === efforts.length && markers.length === efforts.length, 'all visible effort labels and markers should be present');
                const labelRects = labels.map(label => label.getBoundingClientRect());
                const markerRects = markers.map(marker => marker.getBoundingClientRect());

                labels.forEach((label, index) => {
                    const rect = labelRects[index];
                    const labelStyle = getComputedStyle(label);
                    const lineStyle = getComputedStyle(markers[index], '::before');
                    const effortType = [...markers[index].classList].find(className => className in effortColors);
                    assert(rect.left >= plot.left + 4 && rect.right <= plot.right + 1, 'label exceeds plot bounds or left inset');
                    assert(Math.abs(rect.bottom - plot.top) < 1, 'label border does not meet the plot top');
                    assert(labelStyle.fontSize === '12px' && labelStyle.fontWeight === '500', 'effort label typography is incorrect');
                    assert(labelStyle.color === 'rgba(255, 255, 255, 0.85)', 'effort label text is not softly bright');
                    assert(labelStyle.backgroundColor === 'rgba(0, 0, 0, 0)', 'effort label has a background before hover');
                    assert(labelStyle.paddingLeft === '6px' && labelStyle.paddingRight === '6px', 'effort label does not have 6px horizontal padding');
                    assert(labelStyle.height === '26px' && labelStyle.lineHeight === '24px', 'effort label text is not vertically aligned in the 26px row');
                    assert(label.textContent === efforts[index].description, 'description changed');
                    assert(label.scrollWidth <= label.clientWidth + 1 && rect.width > 0, 'description was truncated');
                    assert(effortType, 'effort marker is missing its type color class');
                    assert(lineStyle.backgroundColor === effortColors[effortType], effortType + ' marker line color was not restored');
                    assert(labelStyle.borderBottomColor === effortColors[effortType], effortType + ' description border color was not restored');
                    assert(labelStyle.borderBottomColor === lineStyle.backgroundColor, 'label border color does not match its effort line');
                    assert(labelStyle.borderBottomWidth === lineStyle.width, 'label border thickness does not match its effort line');
                    assert(labelStyle.textOverflow !== 'ellipsis' && labelStyle.overflow === 'visible', 'label still clips or truncates text');
                    if (index < labels.length - 1 && rect.width > 0 && labelRects[index + 1].width > 0) {
                        assert(labelRects[index + 1].left - rect.right >= 7, 'neighboring effort descriptions overlap or lack their gap');
                    }
                });

                assert(Math.abs(labelRects[0].left - (plot.left + 5)) < 1, 'left-edge label did not retain a 5px inset');
                assert(Math.abs(labelRects.at(-1).right - plot.right) < 1, 'right-edge label did not extend to the plot edge');
                assert(labelRects[1].left > markerRects[1].left + markerRects[1].width / 2, 'left-edge label did not push its neighbor right');
                assert(labelRects[2].left + labelRects[2].width / 2 < markerRects[2].left + markerRects[2].width / 2, 'overlapping label was not moved left');
                assert(Math.abs(labelRects[4].left + labelRects[4].width / 2 - (markerRects[4].left + markerRects[4].width / 2)) < 1, 'unconstrained label was not centered');
                return {plot, labels, markers, labelRects};
            };

            let result = checkLabels();
            const plot = document.querySelector('.lc-plot');
            const plotRect = plot.getBoundingClientRect();
            const hoverLayer = plot.querySelector('.lc-hover');
            const highestPoint = [...plot.querySelectorAll('.lc-point')]
                .sort((a, b) => Number(a.getAttribute('cy')) - Number(b.getAttribute('cy')))[0];
            const pointX = Number(highestPoint.getAttribute('cx'));
            plot.dispatchEvent(new PointerEvent('pointermove', {
                bubbles: true,
                clientX: plotRect.left + pointX,
                clientY: plotRect.top + Number(highestPoint.getAttribute('cy'))
            }));

            const tooltip = document.querySelector('.lc-tooltip');
            const tooltipRect = tooltip.getBoundingClientRect();
            const tooltipStyle = getComputedStyle(tooltip);
            const date = tooltip.querySelector('.lc-tooltip-x');
            const weight = tooltip.querySelector('.lc-tooltip-y');
            assert(!tooltip.hidden, 'data-point tooltip did not appear on hover');
            assert(Math.abs(tooltipRect.left + tooltipRect.width / 2 - (plotRect.left + pointX)) < 1, 'tooltip is not centered above its point');
            assert(Math.abs(tooltipRect.top - plotRect.top) < 1, 'tooltip top edge was not clamped to the plot top');
            assert(tooltipStyle.backgroundColor === 'rgb(20, 20, 20)', 'tooltip background is not a solid dark color');
            assert(tooltipStyle.borderRadius === '6px', 'tooltip edges are not rounded');
            assert(tooltipStyle.padding === '8px 16px', 'tooltip padding was not doubled');
            assert(tooltipStyle.gap === '6px', 'tooltip rows do not have the requested reduced spacing');
            assert(tooltipStyle.textAlign === 'center' && tooltipStyle.alignItems === 'center', 'tooltip text is not centered');
            assert(tooltipStyle.borderTopWidth === '1px' && tooltipStyle.borderTopColor === 'rgba(255, 255, 255, 0.04)', 'tooltip outline is not subtle white');
            assert(tooltipStyle.boxShadow.includes('rgba(0, 0, 0, 0.7)'), 'tooltip has no dark shadow');
            assert(date && weight, 'tooltip date and weight rows are not separately identifiable');
            assert(getComputedStyle(date).color === 'rgba(255, 255, 255, 0.55)', 'date text is not the darker tooltip color');
            assert(getComputedStyle(weight).color === 'rgba(255, 255, 255, 0.95)', 'weight text is not the brighter tooltip color');

            for (const [effortType, expectedColor] of Object.entries({
                'effort-type-cut': 'rgb(255, 124, 91)',
                'effort-type-maintain': 'rgb(255, 208, 52)',
                'effort-type-bulk': 'rgb(114, 198, 116)'
            })) {
                const index = result.markers.findIndex(candidate => candidate.classList.contains(effortType));
                assert(index >= 0, effortType + ' marker was not rendered');
                const marker = result.markers[index];
                const label = result.labels[index];
                marker.dispatchEvent(new Event('mouseenter'));
                const lineGlow = getComputedStyle(marker, '::before').boxShadow;
                const labelGlow = getComputedStyle(label, '::after').boxShadow;
                assert(marker.classList.contains('is-hovered'), effortType + ' effort line did not respond to marker hover');
                assert(label.classList.contains('is-hovered'), effortType + ' effort label border did not respond to marker hover');
                assertHoveredLabelStyle(label, effortType + ' marker hover');
                assert(lineGlow === labelGlow && lineGlow.includes('6px') && lineGlow.includes(expectedColor.slice(4, -1)), effortType + ' label border glow does not match its colored effort line');
                assert(tooltip.hidden && hoverLayer.childElementCount === 0, 'effort marker hover did not suppress the data-point highlight and tooltip');
                marker.dispatchEvent(new PointerEvent('pointermove', {
                    bubbles: true,
                    clientX: plotRect.left + pointX,
                    clientY: plotRect.top + Number(highestPoint.getAttribute('cy'))
                }));
                assert(tooltip.hidden && hoverLayer.childElementCount === 0, 'pointer movement within an effort marker restored the data-point highlight or tooltip');
                marker.dispatchEvent(new Event('mouseleave'));
                assert(!marker.classList.contains('is-hovered'), effortType + ' effort line glow remained after marker hover ended');
                assert(!label.classList.contains('is-hovered'), effortType + ' effort label glow remained after marker hover ended');

                plot.dispatchEvent(new PointerEvent('pointermove', {
                    bubbles: true,
                    clientX: plotRect.left + pointX,
                    clientY: plotRect.top + Number(highestPoint.getAttribute('cy'))
                }));
                assert(!tooltip.hidden, 'data-point hover did not resume after leaving an effort marker');
                const labelRect = label.getBoundingClientRect();
                const hitTarget = document.elementFromPoint(labelRect.left + labelRect.width / 2, labelRect.top + labelRect.height / 2);
                assert(getComputedStyle(label).pointerEvents === 'auto' && (hitTarget === label || label.contains(hitTarget)), 'effort description cannot receive pointer input');
                label.dispatchEvent(new Event('mouseenter'));
                assert(label.classList.contains('is-hovered') && marker.classList.contains('is-hovered'), effortType + ' effort description hover did not highlight its effort');
                assertHoveredLabelStyle(label, effortType + ' description hover');
                assert(tooltip.hidden && hoverLayer.childElementCount === 0, 'effort description hover did not suppress the data-point highlight and tooltip');
                label.dispatchEvent(new Event('mouseleave'));
                assert(!label.classList.contains('is-hovered') && !marker.classList.contains('is-hovered'), effortType + ' effort description glow remained after hover ended');
            }

            document.querySelector('.biometrics-chart').style.width = '480px';
            await waitForRender(efforts.length);
            result = checkLabels();
            assert(result.plot.width < 480, 'chart did not resize');
            result.labels[1].click();
            assert(document.querySelector('.biometrics-effort-btn').textContent.includes('Close'), 'effort description click did not select its effort');
            page.cleanupBiometrics();
            assert(!document.querySelector('.line-chart'), 'chart was not cleaned up');

            efforts.splice(0, efforts.length,
                {effortId: 7, startDate: now - 80 * day, typeKey: 1, description: 'Centered'},
                {effortId: 8, startDate: now - 2 * day, typeKey: 2, description: 'Near right'},
                {effortId: 9, startDate: now - day, typeKey: 3, description: 'Last right'}
            );
            await page.loadBiometrics();
            document.querySelector('.biometrics-chart').style.width = '480px';
            await waitForRender(efforts.length);
            let rects = [...document.querySelectorAll('.biometrics-effort-marker-label')].map(label => label.getBoundingClientRect());
            let markerRects = [...document.querySelectorAll('.biometrics-effort-marker')].map(marker => marker.getBoundingClientRect());
            let currentPlot = document.querySelector('.lc-plot').getBoundingClientRect();
            assert(rects.length === 3 && markerRects.length === 3, 'right-edge scenario labels missing: ' + rects.length + ', markers: ' + markerRects.length);
            assert(Math.abs(rects[0].left + rects[0].width / 2 - (markerRects[0].left + markerRects[0].width / 2)) < 1, 'separate label lost its centered position');
            assert(Math.abs(rects[2].right - currentPlot.right) < 1, 'rightmost label was not shifted inside the right edge');
            assert(rects[1].right <= rects[2].left - 7, 'right-edge collision was not resolved');
            assert(rects[1].left + rects[1].width / 2 < markerRects[1].left + markerRects[1].width / 2, 'right-edge collision did not move its neighbor left');
            page.cleanupBiometrics();

            efforts.splice(0, efforts.length,
                {effortId: 10, startDate: now - 80 * day, typeKey: 1, description: 'A very long description '.repeat(5)},
                {effortId: 11, startDate: now - 20 * day, typeKey: 2, description: 'Another long description '.repeat(5)}
            );
            await page.loadBiometrics();
            document.querySelector('.biometrics-chart').style.width = '480px';
            await waitForRender(efforts.length);
            let longLabels = [...document.querySelectorAll('.biometrics-effort-marker-label')];
            rects = longLabels.map(label => label.getBoundingClientRect());
            currentPlot = document.querySelector('.lc-plot').getBoundingClientRect();
            assert(getComputedStyle(document.querySelector('.biometrics-effort-labels')).overflow === 'visible', 'overflowing descriptions are clipped by the label row');
            assert(longLabels.every(label => label.scrollWidth <= label.clientWidth + 1 && getComputedStyle(label).overflow === 'visible'), 'long descriptions were truncated');
            assert(Math.abs(rects[0].left - (currentPlot.left + 5)) < 1 && rects[1].left >= rects[0].right + 7, 'long descriptions overlap or lack the left inset');
            assert(rects[1].right > currentPlot.right, 'impossible-to-fit descriptions should extend beyond the right edge');

            document.querySelector('.biometrics-chart').style.width = '2200px';
            await waitForRender(efforts.length);
            longLabels = [...document.querySelectorAll('.biometrics-effort-marker-label')];
            rects = longLabels.map(label => label.getBoundingClientRect());
            currentPlot = document.querySelector('.lc-plot').getBoundingClientRect();
            assert(rects[0].left >= currentPlot.left + 4 && rects[1].right <= currentPlot.right + 1, 'long descriptions did not fit after enlarging the chart');
            assert(rects[1].left >= rects[0].right + 7 && longLabels.every(label => label.scrollWidth <= label.clientWidth + 1), 'resizing caused overlap or truncation');
            page.cleanupBiometrics();
        })()`);
        console.log('Electron label layout and hover styling, tooltip placement, resize, selection and cleanup checks passed.');
        app.exit(0);
    } catch (error) {
        console.error(error);
        app.exit(1);
    }
});