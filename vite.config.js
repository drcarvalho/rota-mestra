import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const geocodeApiPlugin = () => ({
  name: 'geocode-api-proxy',
  configureServer(server) {
    server.middlewares.use('/api/geocode', async (req, res) => {
      try {
        const requestUrl = new URL(req.url || '', 'http://localhost');
        const query = String(requestUrl.searchParams.get('q') || '').trim();
        const limit = String(requestUrl.searchParams.get('limit') || '3').trim();
        const countrycodes = String(requestUrl.searchParams.get('countrycodes') || 'br').trim();
        if (!query) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: 'Missing query parameter: q' }));
          return;
        }

        const upstream = new URL('https://nominatim.openstreetmap.org/search');
        upstream.searchParams.set('format', 'json');
        upstream.searchParams.set('addressdetails', '1');
        upstream.searchParams.set('accept-language', 'pt-BR');
        upstream.searchParams.set('q', query);
        upstream.searchParams.set('limit', limit || '3');
        upstream.searchParams.set('countrycodes', countrycodes || 'br');

        const upstreamRes = await fetch(upstream.toString(), {
          headers: {
            'User-Agent': 'RotaBoa-Vite-Backend/1.0'
          }
        });

        const text = await upstreamRes.text();
        res.statusCode = upstreamRes.status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          ok: upstreamRes.ok,
          source: 'vite-proxy',
          data: upstreamRes.ok ? JSON.parse(text) : [],
          status: upstreamRes.status
        }));
      } catch {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, error: 'geocode backend failed' }));
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), geocodeApiPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          maps: ['leaflet', 'react-leaflet'],
          ui: ['lucide-react', 'canvas-confetti']
        }
      }
    }
  }
})
