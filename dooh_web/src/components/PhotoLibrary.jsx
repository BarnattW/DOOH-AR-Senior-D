import { useEffect, useMemo, useState } from "react";

export default function PhotoLibrary({ photos, onClose, onPostcard }) {
  const [selectedPhotoId, setSelectedPhotoId] = useState(photos[0]?.id ?? null);
  const [sharing, setSharing] = useState(false);

  const selectedPhoto = useMemo(
    () => photos.find((photo) => photo.id === selectedPhotoId) ?? photos[0],
    [photos, selectedPhotoId]
  );

  useEffect(() => {
    if (!photos.length) {
      setSelectedPhotoId(null);
      return;
    }
    if (!photos.some((photo) => photo.id === selectedPhotoId)) {
      setSelectedPhotoId(photos[0].id);
    }
  }, [photos, selectedPhotoId]);

  const handleShare = async () => {
    if (!selectedPhoto) return;
    const filename = `dooh-ar-${formatPhotoTimestamp(selectedPhoto.capturedAt)}.png`;
    setSharing(true);
    try {
      if (navigator.share) {
        const resp = await fetch(selectedPhoto.url);
        const blob = await resp.blob();
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "NYC AR Photo" });
          return;
        }
      }
      // Desktop fallback: trigger download
      const a = document.createElement("a");
      a.href = selectedPhoto.url;
      a.download = filename;
      a.click();
    } catch (err) {
      if (err?.name === "AbortError") return;
      // Non-abort error: fall back to download
      const a = document.createElement("a");
      a.href = selectedPhoto.url;
      a.download = filename;
      a.click();
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black/90 text-white backdrop-blur-md">
      <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5 sm:pt-5">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/45">
            Library
          </div>
          <div className="mt-1 text-sm text-white/85">
            {photos.length} {photos.length === 1 ? "photo" : "photos"}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo library"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-2xl leading-none text-white/80 transition active:scale-95"
        >
          ×
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-5">
        {selectedPhoto ? (
          <>
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-black">
              <img src={selectedPhoto.url} alt="" className="h-full w-full object-contain" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-white/55">
                {selectedPhoto.capturedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPostcard?.(selectedPhoto)}
                  className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white backdrop-blur-md transition active:scale-95"
                >
                  Postcard
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={sharing}
                  className="flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition active:scale-95 disabled:opacity-50"
                >
                  {sharing ? (
                    "…"
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M7 1v8M3.5 4.5 7 1l3.5 3.5M2 11h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Share
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="grid max-h-24 grid-flow-col auto-cols-[5rem] gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setSelectedPhotoId(photo.id)}
                  aria-label={`View photo captured at ${photo.capturedAt.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}`}
                  className={`h-20 w-20 overflow-hidden rounded-lg border transition active:scale-95 ${
                    selectedPhoto.id === photo.id
                      ? "border-white ring-2 ring-white/80"
                      : "border-white/10 opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={photo.url}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable="false"
                  />
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-white/50">
            No photos yet
          </div>
        )}
      </div>
    </div>
  );
}

function formatPhotoTimestamp(date) {
  return date
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");
}
