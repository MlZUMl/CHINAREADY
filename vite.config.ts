import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Chemins relatifs (base './') : l'appli fonctionne quel que soit le dossier d'hébergement
// (GitHub Pages, sous-dossier, serveur local).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest}'],
        // Polices : seuls les jeux latins servent en français ; les autres se chargent à la demande.
        globIgnores: ['**/*cyrillic*', '**/*vietnamese*', '**/*greek*'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'Élan — ma routine douce',
        short_name: 'Élan',
        description: 'Des rendez-vous concrets, une version minimale pour les jours difficiles, et un univers qui grandit avec tes habitudes.',
        lang: 'fr',
        start_url: './#/',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFFFFF',
        theme_color: '#FFFFFF',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Ma séance du jour', short_name: 'Séance', url: './#/rituel', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Boire un verre', short_name: 'Eau', url: './#/?eau=1', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
    }),
  ],
  build: { target: 'es2020', sourcemap: false },
})
