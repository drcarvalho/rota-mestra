import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = '0.0.0.0';

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // API Route
    if (url.pathname === '/api/geocode') {
        try {
            const q = url.searchParams.get('q');
            const limit = url.searchParams.get('limit') || '3';
            const countrycodes = url.searchParams.get('countrycodes') || 'br';

            const upstream = new URL('https://nominatim.openstreetmap.org/search');
            upstream.searchParams.set('format', 'json');
            upstream.searchParams.set('addressdetails', '1');
            upstream.searchParams.set('accept-language', 'pt-BR');
            upstream.searchParams.set('q', q);
            upstream.searchParams.set('limit', limit);
            upstream.searchParams.set('countrycodes', countrycodes);

            const upstreamRes = await fetch(upstream, {
                headers: { 'User-Agent': 'RotaBoa-Prod/1.0' }
            });
            const data = await upstreamRes.json();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, data }));
        } catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ ok: false, error: e.message }));
        }
        return;
    }

    // Static Files
    let filePath = path.join(__dirname, 'dist', url.pathname === '/' ? 'index.html' : url.pathname);

    // SPA fallback
    if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, 'dist', 'index.html');
    }

    const ext = path.extname(filePath);
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
    };

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500);
            res.end('Error loading file');
        } else {
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
            res.end(content);
        }
    });
});

server.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
});
