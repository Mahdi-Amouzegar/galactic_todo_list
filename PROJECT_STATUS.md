# Current Status

## Completed

- Core task, plan, and recurring-task flows
- Local IndexedDB storage with legacy localStorage migration
- Jalali calendar, reminders, and PWA support
- Map integration and location selection
- Responsive mobile interface
- Desktop two-column layout with an independently scrolling task column
- Full map teardown when the map is disabled
- Scrollable template-plan editor with top action controls
- Type icons for tasks, plans, and recurring series
- IndexedDB-only task loading (legacy localStorage migration removed)
- Core page layout is now represented directly in `index.html` instead of runtime DOM-rearrangement fixes
- Detail-page accordions are now structural HTML instead of runtime-generated wrappers
- Route and saved-location styles are loaded statically instead of being injected at runtime
- Map lifecycle and route state are separated; map readiness/destruction are communicated with explicit events
- Legacy duplicate routing implementation was removed from `map.js`

## Currently working on

- Manual cross-browser verification of the refactored layout and map lifecycle

## Remaining

- Automated regression coverage
- Deeper map UX and routing improvements

## Known issues

- External map tiles, routing, and time synchronization need an internet connection.
