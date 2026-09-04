import { useRef } from 'react';
import { ProjectProvider, useProjectDispatch, useProjectState } from './state/ProjectContext';
import { exportProjectFile, importProjectFile } from './lib/storage';
import { useTheme } from './lib/theme';
import GridSettingsPanel from './components/GridSettingsPanel';
import ImageLibrary from './components/ImageLibrary';
import CellEditor from './components/CellEditor';
import A4Sheet from './components/A4Sheet';

function Toolbar() {
  const { grid, images, labels } = useProjectState();
  const dispatch = useProjectDispatch();
  const importInputRef = useRef(null);
  const [theme, setTheme] = useTheme();

  return (
    <header className="toolbar app-sidebar">
      <h1>Floppy Label Designer</h1>
      <div className="toolbar-actions">
        <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <button type="button" onClick={() => window.print()}>
          Print
        </button>
        <button type="button" onClick={() => exportProjectFile({ grid, images, labels })}>
          Export JSON
        </button>
        <button type="button" onClick={() => importInputRef.current?.click()}>
          Import JSON
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm('Reset the whole project? This clears the grid, images and layers.')) {
              dispatch({ type: 'RESET' });
            }
          }}
        >
          Reset
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              const project = await importProjectFile(file);
              dispatch({ type: 'LOAD_PROJECT', payload: project });
            } catch (err) {
              alert('Could not read that project file.');
              console.error(err);
            }
          }}
        />
      </div>
    </header>
  );
}

function Layout() {
  return (
    <div className="app-layout">
      <Toolbar />
      <div className="app-body">
        <aside className="sidebar app-sidebar">
          <GridSettingsPanel />
          <ImageLibrary />
          <CellEditor />
        </aside>
        <main className="sheet-viewport">
          <A4Sheet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ProjectProvider>
      <Layout />
    </ProjectProvider>
  );
}
