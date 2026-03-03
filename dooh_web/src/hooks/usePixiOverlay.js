/**
 * usePixiOverlay — replaces useOverlayLoop.
 *
 * Architecture
 * ─────────────
 *  The <video> element is kept hidden as the media source.
 *  A single PixiJS canvas is the only visible element.
 *
 *  Stage layers (bottom → top):
 *   0  bgSprite      — full-frame video, no effects
 *   1  maskGfx       — Graphics rectangle used as clip mask for effectSprite
 *   2  effectSprite  — same video texture, masked to bounding box, active filter applied
 *   3  decorGfx      — PIXI.Graphics decorations, cleared each frame
 *   4  textContainer — PIXI.Text nodes, cleared each frame
 *
 * Each filter module may export:
 *   getFilters()               → PIXI.Filter[]  (called once, result cached by id)
 *   animate(filters, time)     → void           (called every frame to animate uniforms)
 *   draw(gfx, textContainer, detections, time, screen) → void
 */
import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

export function usePixiOverlay({ canvasRef, videoRef, isRunning, lastDetectionsRef, activeFilterRef }) {
  const appRef         = useRef(null);
  const filterCacheRef = useRef({});

  useEffect(() => {
    if (!isRunning || !canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video  = videoRef.current;

    function init() {
      // ── Create PixiJS application ──────────────────────────────────────────
      const app = new PIXI.Application({
        view:            canvas,
        width:           video.videoWidth  || 640,
        height:          video.videoHeight || 480,
        antialias:       true,
        resolution:      1,
        autoDensity:     false,
        backgroundColor: 0x000000,
      });
      appRef.current   = app;
      filterCacheRef.current = {};

      // ── Video texture (auto-updates from the live stream) ─────────────────
      const videoResource = new PIXI.VideoResource(video, { autoPlay: false });
      const baseTex       = new PIXI.BaseTexture(videoResource);
      const videoTex      = new PIXI.Texture(baseTex);

      const W = app.screen.width;
      const H = app.screen.height;

      // Layer 0: background
      const bgSprite = new PIXI.Sprite(videoTex);
      bgSprite.width  = W;
      bgSprite.height = H;
      app.stage.addChild(bgSprite);

      // Layer 1+2: effect (masked copy of the same texture)
      const maskGfx = new PIXI.Graphics();
      const effectSprite  = new PIXI.Sprite(videoTex);
      effectSprite.width  = W;
      effectSprite.height = H;
      effectSprite.mask   = maskGfx;
      app.stage.addChild(maskGfx);
      app.stage.addChild(effectSprite);

      // Layer 3: vector decorations
      const decorGfx = new PIXI.Graphics();
      app.stage.addChild(decorGfx);

      // Layer 4: text
      const textContainer = new PIXI.Container();
      app.stage.addChild(textContainer);

      // ── Render loop ────────────────────────────────────────────────────────
      app.ticker.add(() => {
        const time       = app.ticker.lastTime / 1000;
        const detections = lastDetectionsRef.current;
        const filter     = activeFilterRef.current;

        // -- Pixel filter on building region ----------------------------------
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

        // -- Update bounding-box mask -----------------------------------------
        maskGfx.clear();
        if (detections.length > 0) {
          const { x1, y1, x2, y2 } = detections[0].box;
          maskGfx.beginFill(0xffffff);
          maskGfx.drawRect(x1, y1, x2 - x1, y2 - y1);
          maskGfx.endFill();
        }

        // -- Decorations ------------------------------------------------------
        decorGfx.clear();
        textContainer.removeChildren();

        if (filter.draw && detections.length > 0) {
          filter.draw(decorGfx, textContainer, detections, time, app.screen);
        }
      });
    }

    // Video may already have dimensions if camera was started before this effect runs
    if (video.videoWidth) {
      init();
    } else {
      video.addEventListener('loadedmetadata', init, { once: true });
    }

    return () => {
      if (appRef.current) {
        appRef.current.destroy(false); // false → keep the canvas DOM element
        appRef.current = null;
      }
    };
  }, [isRunning, canvasRef, videoRef, lastDetectionsRef, activeFilterRef]);
}
