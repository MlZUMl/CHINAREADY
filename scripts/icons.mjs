// Génère les icônes de l'appli (PNG) à partir d'un dessin SVG.
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

const motif = (fg, accent) => `
  <circle cx="256" cy="282" r="110" fill="${accent}" opacity=".9"/>
  <path d="M256 392 V228" stroke="${fg}" stroke-width="26" stroke-linecap="round"/>
  <path d="M256 276 C 256 206 196 172 132 178 C 134 244 186 282 256 276 Z" fill="${fg}"/>
  <path d="M256 236 C 258 162 318 118 390 122 C 388 196 330 240 256 236 Z" fill="${fg}"/>
  <path d="M136 392 H376" stroke="${fg}" stroke-width="22" stroke-linecap="round"/>`

const full = (rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7d4668"/><stop offset="1" stop-color="#4a2340"/></linearGradient></defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#g)"/>
  <g transform="${rounded ? '' : 'translate(51 51) scale(.8)'}">${motif('#fbf6ef', '#c4878d')}</g>
</svg>`

const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path d="M256 430 V228" stroke="#fff" stroke-width="40" stroke-linecap="round"/>
  <path d="M256 290 C 256 200 180 156 96 164 C 98 250 166 298 256 290 Z" fill="#fff"/>
  <path d="M256 240 C 258 146 336 92 428 96 C 426 190 352 246 256 240 Z" fill="#fff"/>
</svg>`

const out = 'public/icons/'
await sharp(Buffer.from(full(true))).resize(192, 192).png().toFile(out + 'icon-192.png')
await sharp(Buffer.from(full(true))).resize(512, 512).png().toFile(out + 'icon-512.png')
await sharp(Buffer.from(full(false))).resize(512, 512).png().toFile(out + 'maskable-512.png')
await sharp(Buffer.from(badge)).resize(96, 96).png().toFile(out + 'badge-96.png')
writeFileSync(out + 'icon.svg', full(true))
console.log('icônes générées')
