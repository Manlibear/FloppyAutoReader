import { useProjectDispatch, useProjectState } from '../state/ProjectContext';

export default function LayerList({ cellKey }) {
  const { images, labels, ui } = useProjectState();
  const dispatch = useProjectDispatch();

  const layers = [...(labels[cellKey]?.layers ?? [])].sort((a, b) => b.zIndex - a.zIndex);

  if (layers.length === 0) {
    return <p className="hint">Drop an image onto this label to add a layer.</p>;
  }

  return (
    <ul className="layer-list">
      {layers.map((layer, index) => {
        const image = images[layer.imageId];
        const isSelected = ui.selectedLayerId === layer.id;
        return (
          <li
            key={layer.id}
            className={`layer-row${isSelected ? ' layer-row-selected' : ''}`}
            onClick={() => dispatch({ type: 'SELECT_LAYER', payload: layer.id })}
          >
            {image && <img src={image.dataUrl} alt={image.name} className="layer-thumb" />}
            <span className="layer-name">{image?.name ?? 'image'}</span>
            <div className="layer-actions">
              <button
                type="button"
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'REORDER_LAYER', payload: { cellKey, layerId: layer.id, direction: 'up' } });
                }}
                title="Bring forward"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === layers.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'REORDER_LAYER', payload: { cellKey, layerId: layer.id, direction: 'down' } });
                }}
                title="Send backward"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'REMOVE_LAYER', payload: { cellKey, layerId: layer.id } });
                }}
                title="Delete layer"
              >
                ✕
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
