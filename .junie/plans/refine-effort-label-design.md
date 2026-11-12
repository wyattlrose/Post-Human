---
sessionId: session-261112-004838-tla7
---

# Design

### Direction
Use the selected **subtle underline** style: calm, readable labels rather than badges. Keep the existing red, yellow, and green effort lines and matching underlines.

### Proposed appearance
- Use 12px medium-weight, softly bright text with 6px horizontal breathing room.
- Increase the label row from 22px to 26px, keeping the underline aligned with the plot’s top edge. This increases the overall chart height by 4px rather than shrinking the plot.
- On marker or label hover, brighten the text and add a very faint neutral background while retaining the existing matching line and underline glow.

Keep full descriptions, collision and edge handling, hover exclusivity, and click selection unchanged. Tooltips, axes, and other app styling are outside scope.

# Technical Design

### Implementation
- In `src/renderer/features/biometrics/biometrics.css`, adjust `--effort-label-row-height` and `.biometrics-effort-marker-label` typography, padding, and vertical alignment. Apply the hover text/background to `.is-hovered`, which `renderEffortMarkers` already synchronizes for marker and label hover.
- Retain the 2px `--effort-color` bottom border and existing `::after` glow so they continue matching the marker. Do not alter marker hit areas.
- Keep the measured-width positioning in `src/renderer/features/biometrics/biometrics.ts`: its existing measurement includes the added padding, so labels still center and resolve collisions using their full visible widths. Larger labels can reach the existing overflow case sooner when space is insufficient.
- Update `src/renderer/features/biometrics/_spec.md` to describe the refined appearance without weakening its existing placement and interaction requirements.

# Testing

### Validation
- Extend `agent-scripts/biometrics-label-layout-check.cjs` to check the label typography, padding, height, and hover appearance for marker and description hover.
- Retain coverage for colored borders and matching glows, centered and displaced labels, the 5px left inset, collisions, oversized descriptions, resize, selection, and exclusive point hover. Adjust fixtures if the padded labels need more room, without weakening those assertions.
- Run `npm run build`, the biometrics Electron check, and the existing line-chart hover and frame checks.

# Delivery Steps

### ✓ Step 1: Refine label typography and spacing
Effort descriptions have a cleaner, roomier underline treatment while retaining their existing layout rules.

- Update label typography, horizontal padding, vertical alignment, and row height in `src/renderer/features/biometrics/biometrics.css`.
- Preserve the colored 2px underline and measured-width placement in `biometrics.ts`.
- Extend the biometrics Electron check for the new base styling and existing edge, collision, overflow, and resize behavior.

### ✓ Step 2: Polish hover feedback and document the design
Hovering either an effort line or its description gives the label a restrained, coordinated highlight.

- Add a subtle neutral hover background and brighter text using the existing synchronized `.is-hovered` state; retain matching colored glows.
- Update `src/renderer/features/biometrics/_spec.md` with the refined appearance and preserved interaction contract.
- Extend hover assertions and run the build, biometrics check, and line-chart hover and frame regression checks.