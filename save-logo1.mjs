import sharp from "sharp";
import { writeFileSync } from "fs";

// Logo 01 — Lens (from project-logos.html light theme)
const svg = `<svg width="440" height="440" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="p1sky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#ddf0ff"/>
      <stop offset="100%" style="stop-color:#ffffff"/>
    </linearGradient>
  </defs>
  <rect width="220" height="220" fill="white" rx="20"/>
  <circle cx="110" cy="100" r="72" fill="url(#p1sky)" stroke="#1a2e4a" stroke-width="2.5"/>
  <circle cx="110" cy="100" r="56" fill="none" stroke="#1a2e4a" stroke-width="1.2" opacity="0.3"/>
  <ellipse cx="88" cy="78" rx="10" ry="6" fill="white" opacity="0.5" transform="rotate(-30 88 78)"/>
  <clipPath id="lensClip">
    <circle cx="110" cy="100" r="70"/>
  </clipPath>
  <g clip-path="url(#lensClip)">
    <rect x="40" y="40" width="140" height="130" fill="#e8f4ff" opacity="0.6"/>
    <rect x="48"  y="112" width="12" height="58" fill="#1a2e4a" opacity="0.7"/>
    <rect x="62"  y="100" width="10" height="70" fill="#1a2e4a" opacity="0.8"/>
    <rect x="74"  y="88"  width="8"  height="82" fill="#1a2e4a"/>
    <rect x="85"  y="60"  width="10" height="110" fill="#1a2e4a"/>
    <rect x="97"  y="60"  width="10" height="110" fill="#1a2e4a" opacity="0.9"/>
    <rect x="110" y="72"  width="14" height="98" fill="#1a2e4a"/>
    <rect x="112" y="62"  width="10" height="12" fill="#1a2e4a"/>
    <rect x="114" y="54"  width="6"  height="10" fill="#1a2e4a"/>
    <line x1="117" y1="54" x2="117" y2="44" stroke="#1a2e4a" stroke-width="2"/>
    <rect x="127" y="95"  width="11" height="75" fill="#1a2e4a" opacity="0.8"/>
    <rect x="140" y="108" width="9"  height="62" fill="#1a2e4a" opacity="0.7"/>
    <rect x="151" y="118" width="12" height="52" fill="#1a2e4a" opacity="0.6"/>
    <rect x="40" y="168" width="140" height="20" fill="#1a2e4a" opacity="0.9"/>
  </g>
  <line x1="110" y1="32" x2="110" y2="50" stroke="#1a2e4a" stroke-width="1.5" opacity="0.4"/>
  <line x1="110" y1="150" x2="110" y2="168" stroke="#1a2e4a" stroke-width="1.5" opacity="0.4"/>
  <line x1="42" y1="100" x2="60" y2="100" stroke="#1a2e4a" stroke-width="1.5" opacity="0.4"/>
  <line x1="160" y1="100" x2="178" y2="100" stroke="#1a2e4a" stroke-width="1.5" opacity="0.4"/>
  <text x="110" y="188" text-anchor="middle" fill="#1a2e4a" font-size="16" font-weight="900" font-family="sans-serif" letter-spacing="4">AR·DOOH</text>
  <text x="110" y="203" text-anchor="middle" fill="#1a2e4a" font-size="7.5" font-family="sans-serif" letter-spacing="3" opacity="0.45">NYC LANDMARK DETECTION</text>
</svg>`;

const buf = Buffer.from(svg);

sharp(buf)
  .flatten({ background: { r: 255, g: 255, b: 255 } })
  .jpeg({ quality: 95 })
  .toFile("dooh_web/public/logos/logo-lens.jpg")
  .then(() => console.log("✅ logo-lens.jpg saved"))
  .catch((e) => console.error("❌", e.message));
