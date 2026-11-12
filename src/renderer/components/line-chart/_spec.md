# Line Chart

## Axes and plot frame

- Do not draw short tick marks on either axis. Keep the horizontal and vertical background grid lines and axis labels.
- Draw continuous left and bottom borders around the plot; the borders meet at the lower-left corner.
- The plot border must not change plot dimensions, scales, or pointer interaction.

## Y-axis padding

- `yAxisPadding` is an optional per-chart boolean setting and defaults to `false`.
- When enabled, add one tick interval of empty space below the lowest and above the highest displayed y-axis tick. Use the first and last adjacent distinct tick intervals respectively; for example, data from `42` to `68` with five-unit ticks uses a y domain from `35` to `75`, leaving `35–40` and `70–75` empty.
- With custom `yTickValues`, preserve the supplied tick values and use their edge intervals for padding. If the custom values contain fewer than two distinct ticks, use the built-in ticks for the data range as the padding basis.
- When disabled, preserve the existing tick and domain behavior.

## Data point appearance

- Unhighlighted data points are 3px in diameter, only slightly wider than the 2px chart line.
- Keep highlighted point size and styling as specified below.

## Color palette

- Chart colors are defined in the root `--chart-*` palette in `global.css`; use its named accent, neutral, grid, axis, highlight, and tooltip roles rather than declaring chart colors in component styles.
- The default series accent is `--chart-accent-color` (`#009BCE`) and is shared by series lines, points, and legend swatches. A series-specific `--lc-series-color` override remains supported.
- Grid, axis, hover, and tooltip colors are derived from the root chart palette so changing a root palette token updates the chart consistently.

## Interaction

### Data point hover

- While the pointer is inside the plot, determine the nearest data point using the pointer's x-coordinate only.
- Highlight the selected point and display its value and x-coordinate in the chart tooltip.
- Draw the slightly emphasized dotted vertical hover guide from the bottom of the plot to the highlighted point's y-coordinate. If multiple series have highlighted points at the same x-coordinate, extend the guide to the highest of those points.
- Render highlighted points as solid white dots with a subtle light glow, matching white fill and stroke, and the existing point size.
- Center the tooltip horizontally above the selected point unless that would place its top above the chart; in that case, shift it down until its top aligns with the chart's top edge.
- Use a solid dark background, a subtle translucent white outline, a dark shadow, rounded corners, and centered text in distinct rows for the x-coordinate and point values. Keep a 6px gap between the rows.
- Hide the point highlight and tooltip when the pointer leaves the plot.

### Annotation hover

- Annotations rendered in the plot overlay may have their own independent hover behavior, such as highlighting an annotation line.
- The chart does not require annotation hover and data-point hover to be simultaneous; an annotation may suppress point hover when its interaction requires exclusive highlighting.
- To suppress point hover, an annotation may clear the current point highlight with `hideHover()` and stop relevant pointer events from bubbling to the plot.
- Annotation labels may receive pointer events when explicitly interactive; otherwise, they should not unintentionally change the annotation's hit area.