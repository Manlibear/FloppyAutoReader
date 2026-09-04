import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { coverFitLayer } from '../lib/render';
import { loadProject, saveProject } from '../lib/storage';

const DEFAULT_GRID = {
  columns: 3,
  rows: 4,
  cellWidthMm: 60,
  cellHeightMm: 60,
  cornerRadiusMm: 6,
  gapXMm: 5,
  gapYMm: 5,
  marginLeftMm: 10,
  marginTopMm: 10,
};

const DEFAULT_PROJECT = {
  grid: DEFAULT_GRID,
  images: {},
  labels: {},
};

const DEFAULT_UI = {
  selectedCellKey: null,
  selectedLayerId: null,
};

function nextId() {
  return Math.random().toString(36).slice(2, 10);
}

function ensureCell(labels, cellKey) {
  return labels[cellKey] ?? { layers: [] };
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_GRID':
      return { ...state, grid: { ...state.grid, ...action.payload } };

    case 'ADD_IMAGE': {
      const { id, ...rest } = action.payload;
      return { ...state, images: { ...state.images, [id]: rest } };
    }

    case 'ADD_LAYER': {
      const { cellKey, imageId } = action.payload;
      const image = state.images[imageId];
      if (!image) return state;

      const cell = ensureCell(state.labels, cellKey);
      const maxZ = cell.layers.reduce((max, l) => Math.max(max, l.zIndex), -1);
      const fit = coverFitLayer({
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        cellWidthMm: state.grid.cellWidthMm,
        cellHeightMm: state.grid.cellHeightMm,
      });

      const layer = {
        id: nextId(),
        imageId,
        scale: 1,
        rotationDeg: 0,
        zIndex: maxZ + 1,
        ...fit,
      };

      return {
        ...state,
        labels: {
          ...state.labels,
          [cellKey]: { layers: [...cell.layers, layer] },
        },
        ui: { selectedCellKey: cellKey, selectedLayerId: layer.id },
      };
    }

    case 'UPDATE_LAYER': {
      const { cellKey, layerId, changes } = action.payload;
      const cell = state.labels[cellKey];
      if (!cell) return state;
      return {
        ...state,
        labels: {
          ...state.labels,
          [cellKey]: {
            layers: cell.layers.map((l) => (l.id === layerId ? { ...l, ...changes } : l)),
          },
        },
      };
    }

    case 'REMOVE_LAYER': {
      const { cellKey, layerId } = action.payload;
      const cell = state.labels[cellKey];
      if (!cell) return state;
      const layers = cell.layers.filter((l) => l.id !== layerId);
      const wasSelected = state.ui.selectedLayerId === layerId;
      return {
        ...state,
        labels: { ...state.labels, [cellKey]: { layers } },
        ui: wasSelected ? { ...state.ui, selectedLayerId: null } : state.ui,
      };
    }

    case 'REORDER_LAYER': {
      const { cellKey, layerId, direction } = action.payload;
      const cell = state.labels[cellKey];
      if (!cell) return state;
      const sorted = [...cell.layers].sort((a, b) => a.zIndex - b.zIndex);
      const index = sorted.findIndex((l) => l.id === layerId);
      const swapWith = direction === 'up' ? index + 1 : index - 1;
      if (index === -1 || swapWith < 0 || swapWith >= sorted.length) return state;

      const a = sorted[index];
      const b = sorted[swapWith];
      const layers = cell.layers.map((l) => {
        if (l.id === a.id) return { ...l, zIndex: b.zIndex };
        if (l.id === b.id) return { ...l, zIndex: a.zIndex };
        return l;
      });

      return { ...state, labels: { ...state.labels, [cellKey]: { layers } } };
    }

    case 'SELECT_CELL':
      return { ...state, ui: { selectedCellKey: action.payload, selectedLayerId: null } };

    case 'SELECT_LAYER':
      return { ...state, ui: { ...state.ui, selectedLayerId: action.payload } };

    case 'LOAD_PROJECT':
      return {
        grid: { ...DEFAULT_GRID, ...action.payload.grid },
        images: action.payload.images ?? {},
        labels: action.payload.labels ?? {},
        ui: DEFAULT_UI,
      };

    case 'RESET':
      return { ...DEFAULT_PROJECT, ui: DEFAULT_UI };

    default:
      return state;
  }
}

function init() {
  const stored = loadProject();
  if (!stored) return { ...DEFAULT_PROJECT, ui: DEFAULT_UI };
  return {
    grid: { ...DEFAULT_GRID, ...stored.grid },
    images: stored.images ?? {},
    labels: stored.labels ?? {},
    ui: DEFAULT_UI,
  };
}

const ProjectStateContext = createContext(null);
const ProjectDispatchContext = createContext(null);

export function ProjectProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const saveTimer = useRef(null);

  useEffect(() => {
    const { grid, images, labels } = state;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveProject({ grid, images, labels }), 300);
    return () => clearTimeout(saveTimer.current);
  }, [state.grid, state.images, state.labels]);

  const value = useMemo(() => state, [state]);

  return (
    <ProjectStateContext.Provider value={value}>
      <ProjectDispatchContext.Provider value={dispatch}>{children}</ProjectDispatchContext.Provider>
    </ProjectStateContext.Provider>
  );
}

export function useProjectState() {
  const ctx = useContext(ProjectStateContext);
  if (!ctx) throw new Error('useProjectState must be used within ProjectProvider');
  return ctx;
}

export function useProjectDispatch() {
  const ctx = useContext(ProjectDispatchContext);
  if (!ctx) throw new Error('useProjectDispatch must be used within ProjectProvider');
  return ctx;
}
