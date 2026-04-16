import { useEffect, useRef, useState } from "react";

export function usePhotoLibrary({ canvasContainerRef, zoom, zoomCaps }) {
  const photoUrlsRef = useRef([]);
  const [photos, setPhotos] = useState([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  useEffect(() => {
    return () => {
      photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      photoUrlsRef.current = [];
    };
  }, []);

  const capturePhoto = async () => {
    const sourceCanvas = canvasContainerRef.current?.querySelector("canvas");
    if (!sourceCanvas) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = sourceCanvas.width;
    exportCanvas.height = sourceCanvas.height;

    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    const softwareZoom = !zoomCaps ? zoom : 1;
    const drawWidth = sourceCanvas.width * softwareZoom;
    const drawHeight = sourceCanvas.height * softwareZoom;
    const drawX = (sourceCanvas.width - drawWidth) / 2;
    const drawY = (sourceCanvas.height - drawHeight) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sourceCanvas, drawX, drawY, drawWidth, drawHeight);

    const blob = await new Promise((resolve) => {
      exportCanvas.toBlob(resolve, "image/png");
    });
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    photoUrlsRef.current.push(url);

    setPhotos((current) => [
      {
        id: crypto.randomUUID?.() ?? `${Date.now()}`,
        url,
        capturedAt: new Date(),
      },
      ...current,
    ]);
  };

  return {
    photos,
    latestPhoto: photos[0] ?? null,
    isLibraryOpen,
    capturePhoto,
    openLibrary: () => setIsLibraryOpen(true),
    closeLibrary: () => setIsLibraryOpen(false),
  };
}
