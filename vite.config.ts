import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

/**
 * Serves the subscription feed handler (server/calendar.ts) during `vite dev` so the subscription
 * feed works locally without `vercel dev`. Production routing is handled by Vercel.
 */
const apiDevServer = (): Plugin => ({
  name: 'astromoon-api-dev-server',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/calendar')) return next();
      try {
        const mod = await server.ssrLoadModule('/server/calendar.ts');
        const handler = req.method === 'HEAD' ? mod.HEAD : mod.GET;
        const response: Response = await handler(
          new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {method: req.method})
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
