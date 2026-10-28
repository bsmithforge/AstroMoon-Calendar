import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, Plugin} from 'vite';

// Serverless handlers by route; each module exports one function per HTTP method.
const API_ROUTES: Record<string, string> = {
  '/api/calendar': '/server/calendar.ts',
  '/api/ask': '/server/ask.ts',
};

/**
 * Serves the serverless handlers in server/ during `vite dev` so the feed and Ask work locally
 * without `vercel dev`. Production routing is handled by Vercel.
 */
const apiDevServer = (): Plugin => ({
  name: 'astromoon-api-dev-server',
  configureServer(server) {
    // AI_* provider settings from .env.local, for server code only. Vite exposes only VITE_*
    // variables to the client bundle, so these never reach the browser.
    for (const [key, value] of Object.entries(loadEnv(server.config.mode, process.cwd(), 'AI_'))) {
      process.env[key] ??= value;
    }

    server.middlewares.use(async (req, res, next) => {
      const modulePath = API_ROUTES[req.url?.split('?')[0] ?? ''];
      if (!modulePath) return next();
      try {
        const mod = await server.ssrLoadModule(modulePath);
        const handler = mod[req.method || 'GET'];
        if (typeof handler !== 'function') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const headers = Object.entries(req.headers).flatMap(([key, value]): [string, string][] =>
          value === undefined ? [] : [[key, Array.isArray(value) ? value.join(', ') : value]]
        );
        const response: Response = await handler(
          new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
            method: req.method,
            headers,
            body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
          })
        );
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(await response.text());
      } catch (error) {
        next(error);
      }
    });
  },
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiDevServer()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
