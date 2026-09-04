import { useEffect, useRef } from 'react';
import { MM_PER_INCH, PRINT_DPI } from '../lib/units';
import { drawLabelToCanvas } from '../lib/render';

// Two sizing modes:
//  - print/preview mode (default): backing store rendered at `dpi`, displayed
//    at true physical size via CSS mm units (screen and print match exactly).
//  - editor mode (`displayPxPerMm` set): backing store and CSS size both use
//    the same px-per-mm, so on-screen pointer movement maps 1:1 to canvas px.
export default function CellCanvas({
  widthMm,
  heightMm,
  radiusMm,
  layers,
  imageElements,
  dpi = PRINT_DPI,
  displayPxPerMm,
  className,
  style,
  canvasRef: externalRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) {
  const internalRef = useRef(null);
  const canvasRef = externalRef ?? internalRef;

  const pxPerMm = displayPxPerMm ?? dpi / MM_PER_INCH;
  const widthPx = Math.round(widthMm * pxPerMm);
  const heightPx = Math.round(heightMm * pxPerMm);
  const radiusPx = radiusMm * pxPerMm;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawLabelToCanvas(ctx, { widthPx, heightPx, radiusPx, layers, imageElements, dpi: pxPerMm * MM_PER_INCH });
  }, [widthPx, heightPx, radiusPx, layers, imageElements, pxPerMm]);

  const displayStyle = displayPxPerMm
    ? { width: `${widthPx}px`, height: `${heightPx}px` }
    : { width: `${widthMm}mm`, height: `${heightMm}mm` };

  return (
    <canvas
      ref={canvasRef}
      width={widthPx}
      height={heightPx}
      className={className}
      style={{ ...displayStyle, ...style }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}
