import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import * as PIXI3D from 'pixi3d/pixi7';

export function usePixiOverlay({ canvasRef: containerRef, videoRef, isRunning, lastDetectionsRef, activeFilterRef }) {
  const appRef = useRef(null);
  const filterCacheRef = useRef({});
  const preloadCacheRef = useRef({});
  const renderCacheRef = useRef({});

  useEffect(() => {
    if (!isRunning || !containerRef.current || !videoRef.current) return;

    const container = containerRef.current;
    const video = videoRef.current;
    let cancelled = false;
    let dirLight = null;
    let pointLight = null;

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
      container.__pixiApp = app;
      filterCacheRef.current = {};
      renderCacheRef.current = {};

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

      dirLight = new PIXI3D.Light();
      dirLight.type = PIXI3D.LightType.directional;
      dirLight.intensity = 1.05;
      dirLight.position.set(-4, 7, -4);
      dirLight.rotationQuaternion.setEulerAngles(45, 45, 0);

      pointLight = new PIXI3D.Light();
      pointLight.type = PIXI3D.LightType.point;
      pointLight.intensity = 18;
      pointLight.range = 40;
      pointLight.position.set(1, 1.5, 3);

      PIXI3D.LightingEnvironment.main.lights.push(dirLight, pointLight);

      const occlusionMaskGfx = new PIXI.Graphics();
      const foregroundSprite = new PIXI.Sprite(videoTex);
      foregroundSprite.width = width;
      foregroundSprite.height = height;
      foregroundSprite.mask = occlusionMaskGfx;
      app.stage.addChild(occlusionMaskGfx);
      app.stage.addChild(foregroundSprite);

      const decorGfx = new PIXI.Graphics();
      app.stage.addChild(decorGfx);

      const textContainer = new PIXI.Container();
      app.stage.addChild(textContainer);

      // Smoothed box — lerps toward a velocity-extrapolated target every frame
      let smoothBox = null;
      const LERP = 0.28;
      const EXTRAPOLATE_MAX_MS = 400;

      let prevRawBox = null;
      let prevRawTime = 0;
      let velocity = { dx1: 0, dy1: 0, dx2: 0, dy2: 0 };
      let extrapolatedBox = null;

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
          if (filter.animate) filter.animate(filters, time, detections);
        } else {
          effectSprite.filters = [];
        }

        const rawTarget = detections.length > 0 ? detections[0].box : null;
        const now = performance.now();
        const delta = app.ticker.deltaMS;

        if (rawTarget) {
          if (prevRawBox && prevRawTime > 0) {
            const dt = now - prevRawTime;
            if (dt > 16 && dt < 1000) {
              velocity.dx1 = (rawTarget.x1 - prevRawBox.x1) / dt;
              velocity.dy1 = (rawTarget.y1 - prevRawBox.y1) / dt;
              velocity.dx2 = (rawTarget.x2 - prevRawBox.x2) / dt;
              velocity.dy2 = (rawTarget.y2 - prevRawBox.y2) / dt;
            }
          }
          prevRawBox = { ...rawTarget };
          prevRawTime = now;
          extrapolatedBox = { ...rawTarget };
        } else if (extrapolatedBox && prevRawTime > 0) {
          if (now - prevRawTime < EXTRAPOLATE_MAX_MS) {
            extrapolatedBox.x1 += velocity.dx1 * delta;
            extrapolatedBox.y1 += velocity.dy1 * delta;
            extrapolatedBox.x2 += velocity.dx2 * delta;
            extrapolatedBox.y2 += velocity.dy2 * delta;
          } else {
            extrapolatedBox = null;
          }
        }

        const targetBox = extrapolatedBox;

        if (targetBox) {
          if (!smoothBox) {
            smoothBox = { ...targetBox };
          } else {
            smoothBox.x1 += (targetBox.x1 - smoothBox.x1) * LERP;
            smoothBox.y1 += (targetBox.y1 - smoothBox.y1) * LERP;
            smoothBox.x2 += (targetBox.x2 - smoothBox.x2) * LERP;
            smoothBox.y2 += (targetBox.y2 - smoothBox.y2) * LERP;
          }
        } else {
          smoothBox = null;
          prevRawBox = null;
          prevRawTime = 0;
          velocity = { dx1: 0, dy1: 0, dx2: 0, dy2: 0 };
        }

        maskGfx.clear();
        occlusionMaskGfx.clear();
        if (smoothBox) {
          const { x1, y1, x2, y2 } = smoothBox;
          maskGfx.beginFill(0xffffff);
          maskGfx.drawRect(x1, y1, x2 - x1, y2 - y1);
          maskGfx.endFill();
        }

        const renderDetections = smoothBox && detections.length > 0
          ? [{ ...detections[0], box: { ...smoothBox } }, ...detections.slice(1)]
          : [];

        scene3d.removeChildren();
        const renderContext = filter?.id
          ? (renderCacheRef.current[filter.id] ??= { objects: new Map() })
          : null;

        if (filter.draw3d && renderDetections.length > 0) {
          filter.draw3d(scene3d, renderDetections, time, app.screen, renderContext);
        }

        if (filter.drawOcclusion && renderDetections.length > 0) {
          filter.drawOcclusion(occlusionMaskGfx, renderDetections, time, app.screen, renderContext);
        }

        decorGfx.clear();
        textContainer.removeChildren();
        if (filter.draw && renderDetections.length > 0) {
          filter.draw(decorGfx, textContainer, renderDetections, time, app.screen, renderContext);
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
      Object.values(renderCacheRef.current).forEach((cache) => {
        cache.objects?.forEach((object) => {
          if (object?.objects instanceof Map) {
            object.objects.forEach((childObject) => childObject?.destroy?.({ children: true }));
          } else {
            object?.destroy?.({ children: true });
          }
        });
      });
      renderCacheRef.current = {};
      if (PIXI3D.LightingEnvironment.main) {
        PIXI3D.LightingEnvironment.main.lights = PIXI3D.LightingEnvironment.main.lights.filter(
          (light) => light !== dirLight && light !== pointLight
        );
      }
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      if (containerRef.current) {
        delete containerRef.current.__pixiApp;
      }
    };
  }, [isRunning, containerRef, videoRef, lastDetectionsRef, activeFilterRef]);
}
