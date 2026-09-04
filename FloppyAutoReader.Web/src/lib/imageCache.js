import { useEffect, useState } from 'react';

const elementCache = new Map();

function loadImageElement(dataUrl) {
  if (elementCache.has(dataUrl)) return elementCache.get(dataUrl);

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  elementCache.set(dataUrl, promise);
  return promise;
}

// Loads (and caches) an HTMLImageElement for every dataUrl in `images`,
// keyed by imageId. Returns {} until an entry's image has finished loading.
export function useImageElements(images) {
  const [elements, setElements] = useState({});

  useEffect(() => {
    let cancelled = false;

    Object.entries(images).forEach(([imageId, { dataUrl }]) => {
      loadImageElement(dataUrl).then((img) => {
        if (cancelled) return;
        setElements((prev) => (prev[imageId] === img ? prev : { ...prev, [imageId]: img }));
      });
    });

    return () => {
      cancelled = true;
    };
  }, [images]);

  return elements;
}
