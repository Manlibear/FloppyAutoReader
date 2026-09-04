import { useProjectDispatch, useProjectState } from '../state/ProjectContext';

const FIELDS = [
  { key: 'columns', label: 'Columns', min: 1, step: 1 },
  { key: 'rows', label: 'Rows', min: 1, step: 1 },
  { key: 'cellWidthMm', label: 'Label width (mm)', min: 1, step: 0.5 },
  { key: 'cellHeightMm', label: 'Label height (mm)', min: 1, step: 0.5 },
  { key: 'cornerRadiusMm', label: 'Corner radius (mm)', min: 0, step: 0.5 },
  { key: 'gapXMm', label: 'Horizontal gap (mm)', min: 0, step: 0.5 },
  { key: 'gapYMm', label: 'Vertical gap (mm)', min: 0, step: 0.5 },
  { key: 'marginLeftMm', label: 'Left margin (mm)', min: 0, step: 0.5 },
  { key: 'marginTopMm', label: 'Top margin (mm)', min: 0, step: 0.5 },
];

export default function GridSettingsPanel() {
  const { grid } = useProjectState();
  const dispatch = useProjectDispatch();

  function handleChange(key, rawValue) {
    const value = Number(rawValue);
    if (Number.isNaN(value)) return;
    dispatch({ type: 'SET_GRID', payload: { [key]: value } });
  }

  return (
    <section className="panel">
      <h2>Grid</h2>
      <div className="field-grid">
        {FIELDS.map(({ key, label, min, step }) => (
          <label key={key} className="field">
            <span>{label}</span>
            <input
              type="number"
              min={min}
              step={step}
              value={grid[key]}
              onChange={(e) => handleChange(key, e.target.value)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
