import { useEffect, useRef, useState } from 'react';
import { useProjectDispatch, useProjectState } from '../state/ProjectContext';
import { useImageElements } from '../lib/imageCache';
import { EDITOR_PX_PER_MM } from '../lib/units';
import CellCanvas from './CellCanvas';
import LayerList from './LayerList';

const MIN_SCALE = 0.05;
const MAX_SCALE = 20;
const SNAP_THRESHOLD_MM = 2.5;

export default function CellEditor() {
  const { grid, images, labels, ui } = useProjectState();
  const dispatch = useProjectDispatch();
  const imageElements = useImageElements(images);
  const canvasRef = useRef(null);
  const dragState = useRef(null);
  const [snap, setSnap] = useState({ x: false, y: false });

  const cellKey = ui.selectedCellKey;
  const layers = cellKey ? labels[cellKey]?.layers ?? [] : [];
  const activeLayer =
    layers.find((l) => l.id === ui.selectedLayerId) ??
    layers.reduce((top, l) => (!top || l.zIndex > top.zIndex ? l : top), null);

  // Kept in a ref so the native (non-passive) wheel listener below always
  // sees the latest values without needing to re-attach on every render.
  const latestRef = useRef({ cellKey, activeLayer });
  useEffect(() => {
    latestRef.current = { cellKey, activeLayer };
  });

  // React's onWheel prop is attached passively in some browsers/versions,
  // which silently breaks preventDefault. Attach manually as non-passive
  // so scrolling the wheel over the canvas reliably scales instead of
  // scrolling the sidebar.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function onWheel(e) {
      const { cellKey, activeLayer } = latestRef.current;
      if (!activeLayer) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.001);
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, activeLayer.scale * factor));
      dispatch({
        type: 'UPDATE_LAYER',
        payload: { cellKey, layerId: activeLayer.id, changes: { scale: nextScale } },
      });
    }

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [dispatch]);

  if (!cellKey) {
    return (
      <section className="panel">
        <h2>Editor</h2>
        <p className="hint">Select a label on the sheet to edit its layers.</p>
      </section>
    );
  }

  function updateActiveLayer(changes) {
    if (!activeLayer) return;
    dispatch({ type: 'UPDATE_LAYER', payload: { cellKey, layerId: activeLayer.id, changes } });
  }

  function handlePointerDown(e) {
    if (!activeLayer) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { layerId: activeLayer.id };
  }

  function handlePointerMove(e) {
    if (!dragState.current || dragState.current.layerId !== activeLayer?.id) return;
    const dxMm = e.movementX / EDITOR_PX_PER_MM;
    const dyMm = e.movementY / EDITOR_PX_PER_MM;

    const centerXMm = grid.cellWidthMm / 2;
    const centerYMm = grid.cellHeightMm / 2;
    let nextX = activeLayer.xMm + dxMm;
    let nextY = activeLayer.yMm + dyMm;

    const snappedX = Math.abs(nextX - centerXMm) < SNAP_THRESHOLD_MM;
    const snappedY = Math.abs(nextY - centerYMm) < SNAP_THRESHOLD_MM;
    if (snappedX) nextX = centerXMm;
    if (snappedY) nextY = centerYMm;
    setSnap({ x: snappedX, y: snappedY });

    updateActiveLayer({ xMm: nextX, yMm: nextY });
  }

  function handlePointerUp(e) {
    dragState.current = null;
    setSnap({ x: false, y: false });
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <section className="panel">
      <h2>Editor</h2>
      <div className="cell-editor-canvas-wrap">
        <div className="cell-editor-stage">
          <CellCanvas
            canvasRef={canvasRef}
            widthMm={grid.cellWidthMm}
            heightMm={grid.cellHeightMm}
            radiusMm={grid.cornerRadiusMm}
            layers={layers}
            imageElements={imageElements}
            displayPxPerMm={EDITOR_PX_PER_MM}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
          {snap.x && <div className="snap-guide snap-guide-vertical" />}
          {snap.y && <div className="snap-guide snap-guide-horizontal" />}
        </div>
      </div>

      {activeLayer ? (
        <div className="field-grid">
          <label className="field">
            <span>Scale ({activeLayer.scale.toFixed(2)}x)</span>
            <input
              type="range"
              min={MIN_SCALE}
              max={3}
              step={0.01}
              value={Math.min(activeLayer.scale, 3)}
              onChange={(e) => updateActiveLayer({ scale: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Rotation ({Math.round(activeLayer.rotationDeg)}°)</span>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={activeLayer.rotationDeg}
              onChange={(e) => updateActiveLayer({ rotationDeg: Number(e.target.value) })}
            />
          </label>
        </div>
      ) : (
        <p className="hint">Drag &amp; drop an image from the library onto this label.</p>
      )}

      <h3>Layers</h3>
      <LayerList cellKey={cellKey} />
    </section>
  );
}
