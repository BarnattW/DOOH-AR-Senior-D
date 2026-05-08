import { useEffect, useRef, useState } from "react";

const DB_NAME  = "dooh-photos";
const STORE    = "photos";
const MAX_KEPT = 30;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = ({ target: { result: db } }) => {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = ({ target: { result } }) => resolve(result);
    req.onerror   = ({ target: { error } })  => reject(error);
  });
}

function dbGetAll(db) {
  return new Promise((res, rej) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

function dbPut(db, record) {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = res;
    tx.onerror    = () => rej(tx.error);
  });
}

function dbDelete(db, id) {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = res;
    tx.onerror    = () => rej(tx.error);
  });
}

export function usePhotoLibrary({ canvasContainerRef, zoom, zoomCaps }) {
  const photoUrlsRef = useRef([]);
  const [photos, setPhotos]               = useState([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const dbRef = useRef(null);

  // Load persisted photos from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    openDB().then(async (db) => {
      if (cancelled) return;
      dbRef.current = db;

      const records = await dbGetAll(db);
      if (cancelled) return;

      // Sort newest first, trim excess beyond cap
      records.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
      const excess = records.splice(MAX_KEPT);
      for (const r of excess) dbDelete(db, r.id);

      const loaded = records.map((r) => {
        const url = URL.createObjectURL(r.blob);
        photoUrlsRef.current.push(url);
        return {
          id:               r.id,
          url,
          capturedAt:       new Date(r.capturedAt),
          detectedBuilding: r.detectedBuilding ?? null,
          filterLabel:      r.filterLabel      ?? null,
          locationLabel:    r.locationLabel     ?? null,
        };
      });
      setPhotos(loaded);
    }).catch(() => {
      // IndexedDB unavailable (some private browsing modes) — degrade silently
    });
    return () => { cancelled = true; };
  }, []);

  // Revoke all blob URLs on unmount
  useEffect(() => {
    return () => {
      photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      photoUrlsRef.current = [];
    };
  }, []);

  const capturePhoto = async (metadata = {}) => {
    const app = canvasContainerRef.current?.__pixiApp;
    const sourceCanvas = app?.renderer?.extract?.canvas
      ? app.renderer.extract.canvas(app.stage)
      : canvasContainerRef.current?.querySelector("canvas");

    if (!sourceCanvas) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width  = sourceCanvas.width;
    exportCanvas.height = sourceCanvas.height;

    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    const softwareZoom = !zoomCaps ? zoom : 1;
    const drawWidth  = sourceCanvas.width  * softwareZoom;
    const drawHeight = sourceCanvas.height * softwareZoom;
    const drawX = (sourceCanvas.width  - drawWidth)  / 2;
    const drawY = (sourceCanvas.height - drawHeight) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sourceCanvas, drawX, drawY, drawWidth, drawHeight);

    const blob = await new Promise((resolve) => exportCanvas.toBlob(resolve, "image/png"));
    if (!blob) return;

    const id         = crypto.randomUUID?.() ?? `${Date.now()}`;
    const capturedAt = new Date();
    const url        = URL.createObjectURL(blob);
    photoUrlsRef.current.push(url);

    const photo = {
      id,
      url,
      capturedAt,
      detectedBuilding: metadata.detectedBuilding ?? null,
      filterLabel:      metadata.filterLabel      ?? null,
      locationLabel:    metadata.locationLabel     ?? null,
    };

    setPhotos((current) => [photo, ...current]);

    if (dbRef.current) {
      dbPut(dbRef.current, {
        id,
        blob,
        capturedAt:       capturedAt.toISOString(),
        detectedBuilding: photo.detectedBuilding,
        filterLabel:      photo.filterLabel,
        locationLabel:    photo.locationLabel,
      }).catch(() => {});
    }
  };

  const addPhoto = (blob, metadata = {}) => {
    const id         = crypto.randomUUID?.() ?? `${Date.now()}`;
    const capturedAt = new Date();
    const url        = URL.createObjectURL(blob);
    photoUrlsRef.current.push(url);

    const photo = {
      id,
      url,
      capturedAt,
      detectedBuilding: metadata.detectedBuilding ?? null,
      filterLabel:      metadata.filterLabel      ?? "Postcard",
      locationLabel:    metadata.locationLabel     ?? null,
    };

    setPhotos((current) => [photo, ...current]);

    if (dbRef.current) {
      dbPut(dbRef.current, {
        id,
        blob,
        capturedAt:       capturedAt.toISOString(),
        detectedBuilding: photo.detectedBuilding,
        filterLabel:      photo.filterLabel,
        locationLabel:    photo.locationLabel,
      }).catch(() => {});
    }
  };

  return {
    photos,
    latestPhoto: photos[0] ?? null,
    isLibraryOpen,
    capturePhoto,
    addPhoto,
    openLibrary:  () => setIsLibraryOpen(true),
    closeLibrary: () => setIsLibraryOpen(false),
  };
}
