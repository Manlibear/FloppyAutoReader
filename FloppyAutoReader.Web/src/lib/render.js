import { roundRectPath } from './geometry';
import { mmToPx, PRINT_DPI } from './units';

// Single shared compositing routine used by both the sheet preview and the
// zoomed cell editor, so there is exactly one place that draws a label.
export function drawLabelToCanvas(
  ctx,
  { widthPx, heightPx, radiusPx, layers, imageElements, dpi = PRINT_DPI }
) {
  ctx.save();
  ctx.clearRect(0, 0, widthPx, heightPx);
  roundRectPath(ctx, 0, 0, widthPx, heightPx, radiusPx);
  ctx.clip();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);

  const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
  for (const layer of sorted) {
    const img = imageElements[layer.imageId];
    if (!img) continue;

    const wPx = mmToPx(layer.baseWidthMm * layer.scale, dpi);
    const hPx = mmToPx(layer.baseHeightMm * layer.scale, dpi);
    const cxPx = mmToPx(layer.xMm, dpi);
    const cyPx = mmToPx(layer.yMm, dpi);

    ctx.save();
    ctx.translate(cxPx, cyPx);
    ctx.rotate((layer.rotationDeg * Math.PI) / 180);
    ctx.drawImage(img, -wPx / 2, -hPx / 2, wPx, hPx);
    ctx.restore();
  }

  ctx.restore();
}

// "Cover" fit (like CSS background-size: cover): smallest size that fully
// covers the cell while preserving the image's aspect ratio, centered.
export function coverFitLayer({ naturalWidth, naturalHeight, cellWidthMm, cellHeightMm }) {
  const cellAspect = cellWidthMm / cellHeightMm;
  const imageAspect = naturalWidth / naturalHeight;

  let baseWidthMm;
  let baseHeightMm;
  if (imageAspect > cellAspect) {
    baseHeightMm = cellHeightMm;
    baseWidthMm = cellHeightMm * imageAspect;
  } else {
    baseWidthMm = cellWidthMm;
    baseHeightMm = cellWidthMm / imageAspect;
  }

  return {
    baseWidthMm,
    baseHeightMm,
    xMm: cellWidthMm / 2,
    yMm: cellHeightMm / 2,
  };
}
