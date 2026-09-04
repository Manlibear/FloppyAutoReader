import { useProjectDispatch, useProjectState } from '../state/ProjectContext';
import { useImageElements } from '../lib/imageCache';
import { cellKey } from '../lib/geometry';
import { A4_WIDTH_MM, A4_HEIGHT_MM } from '../lib/units';
import CellCanvas from './CellCanvas';
import { IMAGE_DRAG_MIME } from './ImageLibrary';

export default function A4Sheet() {
  const { grid, images, labels, ui } = useProjectState();
  const dispatch = useProjectDispatch();
  const imageElements = useImageElements(images);

  const cells = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.columns; col++) {
      const key = cellKey(row, col);
      const leftMm = grid.marginLeftMm + col * (grid.cellWidthMm + grid.gapXMm);
      const topMm = grid.marginTopMm + row * (grid.cellHeightMm + grid.gapYMm);
      const layers = labels[key]?.layers ?? [];
      const isSelected = ui.selectedCellKey === key;

      cells.push(
        <div
          key={key}
          className={`cell-wrapper${isSelected ? ' cell-selected' : ''}`}
          style={{
            left: `${leftMm}mm`,
            top: `${topMm}mm`,
            width: `${grid.cellWidthMm}mm`,
            height: `${grid.cellHeightMm}mm`,
          }}
          onClick={() => dispatch({ type: 'SELECT_CELL', payload: key })}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const imageId = e.dataTransfer.getData(IMAGE_DRAG_MIME);
            if (imageId) dispatch({ type: 'ADD_LAYER', payload: { cellKey: key, imageId } });
          }}
        >
          <CellCanvas
            widthMm={grid.cellWidthMm}
            heightMm={grid.cellHeightMm}
            radiusMm={grid.cornerRadiusMm}
            layers={layers}
            imageElements={imageElements}
          />
        </div>
      );
    }
  }

  return (
    <div className="a4-sheet" style={{ width: `${A4_WIDTH_MM}mm`, height: `${A4_HEIGHT_MM}mm` }}>
      {cells}
    </div>
  );
}
