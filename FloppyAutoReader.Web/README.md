# Floppy Label Designer

A browser tool for designing sheets of floppy-disk labels: lay out a grid of
label shapes on an A4 page, drag images into each label, stack/position/scale
them as layers, and print the sheet straight from the browser.

Plain JS (no TypeScript) + React, built with Vite, no backend. Everything —
project state, images (as data URLs) — lives in the browser's localStorage.

## Stack & why

- **Vite + React**, JavaScript only (`--template react`, not `react-ts`).
- **HTML5 Canvas** for compositing/clipping each label (not SVG) — one shared
  draw routine (`src/lib/render.js`) is used both for the small sheet preview
  and the zoomed interactive editor, so there's exactly one place that draws
  a label.
- **Browser print** (`window.print()` + `@page` CSS) as the only print path —
  no PDF library, no PNG export. The on-screen sheet is laid out in real `mm`
  CSS units, so what you see on screen is physically what prints (WYSIWYG),
  1:1, no separate print layout code.

## How it fits together

```
src/
  state/ProjectContext.jsx   React Context + useReducer — the single source
                              of truth (grid config, images, per-cell layers).
                              Autosaves to localStorage (debounced) on change.
  lib/
    units.js                 mm<->px conversion, A4/DPI/editor-zoom constants.
    geometry.js               roundRectPath() (manual arc-based rounded-rect
                              path) and cellKey(row, col) -> "row-col".
    render.js                 drawLabelToCanvas() — the one shared compositing
                              routine (clip to rounded rect, draw layers in
                              zIndex order). coverFitLayer() computes the
                              initial CSS-"cover"-style fit for a newly added
                              layer image.
    imageCache.js             useImageElements(images) — loads/caches actual
                              HTMLImageElement objects from the data-URLs
                              stored in project state (canvas needs decoded
                              image elements, not raw data URLs).
    storage.js                 localStorage load/save + JSON export/import.
    theme.js                   useTheme() hook — light/dark toggle, persisted
                              separately from project data, respects OS
                              preference on first run.
  components/
    GridSettingsPanel.jsx      Grid form (columns/rows/cell size/radius/gaps/
                              margins, all mm) -> dispatch SET_GRID.
    ImageLibrary.jsx           Upload/drag-drop images -> ADD_IMAGE. Each
                              thumbnail is HTML5-draggable onto a cell.
    A4Sheet.jsx                 The page: one absolutely-positioned
                              `.cell-wrapper` per grid cell (positioned in mm
                              from grid margins/gaps), each containing a
                              CellCanvas. Handles per-cell onDrop -> ADD_LAYER.
    CellCanvas.jsx              Thin canvas wrapper, two sizing modes:
                              print/preview (backing store at PRINT_DPI,
                              displayed at true mm size) vs editor
                              (`displayPxPerMm` — backing store and CSS size
                              both in the same px-per-mm, so pointer
                              movement maps 1:1 to canvas px).
    CellEditor.jsx              Zoomed, interactive version of the selected
                              cell: drag to move the active layer (with
                              center-snap, see below), mouse-wheel or slider
                              to scale, slider to rotate.
    LayerList.jsx               Per-cell layer list: select/reorder/delete.
```

### Data model

```js
{
  grid: { columns, rows, cellWidthMm, cellHeightMm, cornerRadiusMm,
          gapXMm, gapYMm, marginLeftMm, marginTopMm },
  images: { [imageId]: { name, dataUrl, naturalWidth, naturalHeight } },
  labels: {
    // sparse, only cells the user has touched exist; keyed "row-col"
    [cellKey]: { layers: [
      { id, imageId, xMm, yMm, baseWidthMm, baseHeightMm, scale,
        rotationDeg, zIndex }
    ] }
  },
}
```

`xMm`/`yMm` are the layer's **center** relative to the cell's top-left.
`baseWidthMm`/`baseHeightMm` are fixed at layer-creation time (the CSS
`cover`-equivalent fit for that image in that cell); `scale` is a multiplier
on top of that base size, so scaling and repositioning are independent of the
image's original pixel dimensions.

### Non-obvious things a future change might trip over

- **`.cell-wrapper` uses CSS `outline`, not `border`, for the dashed
  cell-select guide.** A `border` shrinks the element's content box, and the
  canvas inside is sized to fill that box — so a border would get covered
  along the bottom/right edge (border eats into the space the canvas then
  overflows into). `outline` doesn't participate in the box model and always
  paints on top of children, so it can't be covered. If you ever need a
  visible border-like guide anywhere near a canvas that fills its parent,
  reach for `outline`, not `border`.
- **`CellEditor`'s wheel-to-scale handler is attached manually via
  `addEventListener('wheel', ..., { passive: false })`** in a `useEffect`,
  not via React's `onWheel` prop. React can attach wheel listeners passively
  depending on version/browser, which silently breaks `preventDefault()` (the
  page would scroll instead of the layer scaling). If you add more
  gesture-based interactions, check this before assuming `onWheel` "just
  works".
- **`.a4-sheet` background is hardcoded white in both themes**, not a CSS
  variable. It represents the physical printed page, not app UI — it must
  stay print-accurate regardless of the dark-mode toggle.
- **Center-snap** (`CellEditor.jsx`, `SNAP_THRESHOLD_MM`): while dragging a
  layer, if it comes within ~2.5mm of the cell's horizontal/vertical center
  it snaps exactly to center and shows a guide line, Photoshop/Krita-style.
  Snapping is delta-based (accumulates `pointermove` deltas each event, not
  absolute cursor position), which is why it "sticks" while jittering inside
  the threshold and releases cleanly once you drag further.
- **Images are stored as data URLs directly in project JSON/localStorage.**
  Fine for label-sized images; no IndexedDB, no external storage. Large image
  libraries will bloat localStorage — not handled, out of scope for v1.

## Local dev

```bash
npm install
npm run dev          # http://localhost:5173
npm run build         # -> dist/, static files, no server-side anything
npx oxlint             # lint (two pre-existing benign warnings are expected:
                        # only-export-components on ProjectContext's hook
                        # exports, and exhaustive-deps on two intentionally-
                        # scoped effects — see comments at those call sites)
```

No test suite exists yet.

## Deploying on bear-server

This machine (`manlibear@bear-server`) is where it's meant to end up, but
`/srv/http/` is root-owned and `manlibear` does **not** have passwordless
sudo — so any agent working on this later will hit a permissions wall trying
to write there directly. The pattern used for other projects on this box
(see `/srv/http/gamesbacklog`) is a one-time manual step:

```bash
# the human runs this once, interactively (needs sudo password):
sudo mkdir -p /srv/http/floppylabels
sudo chown manlibear:manlibear /srv/http/floppylabels
```

After that exists and is owned by `manlibear`, deploying is just: build
locally, then ship `dist/` over:

```bash
npm run build
tar -czf - dist | ssh manlibear@bear-server \
  "rm -rf /srv/http/floppylabels/* && tar -xzf - -C /srv/http/floppylabels --strip-components=1"
```

It's a static single-page app — no build step needed on the server, no
server-side routing, no API, no env vars. Point any web server's document
root at the directory containing `index.html` and it works. (As of this
writing the built files are parked at `~/Projects/FloppyLabels/dist` on
bear-server, *not yet* moved into `/srv/http/` — that move was left for the
human to do once the `/srv/http/floppylabels` directory exists.)

Source lives at `~/Projects/FloppyLabels` on bear-server too (synced via the
same `tar | ssh` approach, minus `node_modules`/`dist`/`.git`), purely so it
can be reached from other machines — it is not built/served from there.
