import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import * as PIXI3D from 'pixi3d/pixi7';

export function usePixiOverlay({ canvasRef: containerRef, videoRef, isRunning, lastDetectionsRef, activeFilterRef }) {
  const appRef = useRef(null);
  const filterCacheRef = useRef({});
  const preloadCacheRef = useRef({});

  useEffect(() => {
    if (!isRunning || !containerRef.current || !videoRef.current) return;

    const container = containerRef.current;
    const video = videoRef.current;
    let cancelled = false;

    async function ensureFilterPreloaded(filter) {
      if (!filter?.preload) return;

      const cachedPromise = preloadCacheRef.current[filter.id];
      if (cachedPromise) {
        await cachedPromise;
        return;
      }

      const preloadPromise = Promise.resolve(filter.preload()).catch((error) => {
        console.error(`Failed to preload filter "${filter.id}"`, error);
      });

      preloadCacheRef.current[filter.id] = preloadPromise;
      await preloadPromise;
    }

    function init() {
      if (cancelled) return;

      const app = new PIXI.Application({
        width: video.videoWidth || 640,
        height: video.videoHeight || 480,
        antialias: true,
        resolution: 1,
        autoDensity: false,
        backgroundColor: 0x000000,
      });

      appRef.current = app;
      filterCacheRef.current = {};

      container.appendChild(app.view);

      const videoResource = new PIXI.VideoResource(video, { autoPlay: false });
      const baseTex = new PIXI.BaseTexture(videoResource);
      const videoTex = new PIXI.Texture(baseTex);

      const width = app.screen.width;
      const height = app.screen.height;

      const bgSprite = new PIXI.Sprite(videoTex);
      bgSprite.width = width;
      bgSprite.height = height;
      app.stage.addChild(bgSprite);

      const maskGfx = new PIXI.Graphics();
      const effectSprite = new PIXI.Sprite(videoTex);
      effectSprite.width = width;
      effectSprite.height = height;
      effectSprite.mask = maskGfx;
      app.stage.addChild(maskGfx);
      app.stage.addChild(effectSprite);

      const scene3d = app.stage.addChild(new PIXI3D.Container3D());
      if (PIXI3D.Camera.main) {
        PIXI3D.Camera.main.fieldOfView = 60;
      }

      const decorGfx = new PIXI.Graphics();
      app.stage.addChild(decorGfx);

      const textContainer = new PIXI.Container();
      app.stage.addChild(textContainer);

      app.ticker.add(() => {
        const time = app.ticker.lastTime / 1000;
        const detections = lastDetectionsRef.current;
        const filter = activeFilterRef.current;

        void ensureFilterPreloaded(filter);

        if (filter.getFilters) {
          if (!filterCacheRef.current[filter.id]) {
            filterCacheRef.current[filter.id] = filter.getFilters();
          }

          const filters = filterCacheRef.current[filter.id];
          effectSprite.filters = filters;
          if (filter.animate) filter.animate(filters, time);
        } else {
          effectSprite.filters = [];
        }

        maskGfx.clear();
        if (detections.length > 0) {
          const { x1, y1, x2, y2 } = detections[0].box;
          maskGfx.beginFill(0xffffff);
          maskGfx.drawRect(x1, y1, x2 - x1, y2 - y1);
          maskGfx.endFill();
        }

        scene3d.removeChildren();
        if (filter.draw3d && detections.length > 0) {
          filter.draw3d(scene3d, detections, time, app.screen);
        }

        decorGfx.clear();
        textContainer.removeChildren();
        if (filter.draw && detections.length > 0) {
          filter.draw(decorGfx, textContainer, detections, time, app.screen);
        }
      });
    }

    if (video.videoWidth) {
      init();
    } else {
      video.addEventListener('loadedmetadata', init, { once: true });
    }

    return () => {
      cancelled = true;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [isRunning, containerRef, videoRef, lastDetectionsRef, activeFilterRef]);
}
