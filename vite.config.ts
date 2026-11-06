import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Serves the Vercel function at /api/analyze from the dev server, so `npm run dev`
 * works end to end without the Vercel CLI.
 */
function localApi(): Plugin {
  // Connect strips the mount path from req.url and keeps the full path in originalUrl.
  async function handle(server: ViteDevServer, req: IncomingMessage & { originalUrl?: string }, res: ServerResponse) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    const request = new Request(`http://localhost${req.originalUrl ?? req.url}`, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
    });
    const { handleAnalyze } = (await server.ssrLoadModule('/server/analyze.js')) as {
      handleAnalyze: (r: Request) => Promise<Response>;
    };
    const response = await handleAnalyze(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  }

  return {
    name: 'plate-local-api',
    configureServer(server) {
      server.middlewares.use('/api/analyze', (req, res) => {
        handle(server, req as IncomingMessage, res).catch((error: unknown) => {
          console.error(error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Local API crashed — see the terminal.' }));
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make non-VITE_ variables from .env.local (e.g. OPENAI_API_KEY) visible to the local API.
  // They are never bundled into the app — only VITE_-prefixed variables are.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    process.env[key] ??= value;
  }

  return {
    // The Firebase SDK is one large lazily-loaded chunk; that's expected.
    build: { chunkSizeWarningLimit: 800 },
    plugins: [
      localApi(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'Plate — Calorie Tracker',
          short_name: 'Plate',
          description: 'Say what you ate or snap a photo. Plate counts the calories.',
          theme_color: '#F5F5F7',
          background_color: '#F5F5F7',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          // Long-press the installed app's icon to jump straight into logging (handled in Home).
          shortcuts: [
            {
              name: 'Snap a meal',
              short_name: 'Snap',
              description: 'Take a photo of your food',
              url: '/?capture=photo',
              icons: [{ src: 'shortcut-photo.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'Say what you ate',
              short_name: 'Speak',
              url: '/?capture=voice',
              icons: [{ src: 'shortcut-voice.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'Type what you ate',
              short_name: 'Type',
              url: '/?capture=text',
              icons: [{ src: 'shortcut-text.png', sizes: '192x192', type: 'image/png' }],
            },
          ],
        },
        workbox: {
          // Only the Latin subset of Inter is needed offline.
          globPatterns: ['**/*.{js,css,html,svg,png,ico}', 'assets/inter-latin-wght-normal-*.woff2'],
          navigateFallback: '/index.html',
          // /__/ is Firebase's auth handler (proxied in production) and /api/ is the server.
          navigateFallbackDenylist: [/^\/__\//, /^\/api\//],
        },
      }),
    ],
  };
});
