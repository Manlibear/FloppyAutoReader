import { useRef, useState } from 'react';
import { useProjectDispatch, useProjectState } from '../state/ProjectContext';

export const IMAGE_DRAG_MIME = 'application/x-floppy-label-image-id';

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = () =>
        resolve({ dataUrl, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function nextId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ImageLibrary() {
  const { images } = useProjectState();
  const dispatch = useProjectDispatch();
  const fileInputRef = useRef(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  async function addFiles(fileList) {
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/')) continue;
      const { dataUrl, naturalWidth, naturalHeight } = await readImageFile(file);
      dispatch({
        type: 'ADD_IMAGE',
        payload: { id: nextId(), name: file.name, dataUrl, naturalWidth, naturalHeight },
      });
    }
  }

  return (
    <section className="panel">
      <h2>Images</h2>
      <div
        className={`dropzone${isDraggingOver ? ' dropzone-active' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        Click or drop images here
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="image-grid">
        {Object.entries(images).map(([id, image]) => (
          <div
            key={id}
            className="image-thumb"
            draggable
            title={image.name}
            onDragStart={(e) => {
              e.dataTransfer.setData(IMAGE_DRAG_MIME, id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <img src={image.dataUrl} alt={image.name} />
          </div>
        ))}
      </div>
    </section>
  );
}
