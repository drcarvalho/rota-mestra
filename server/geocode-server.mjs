import http from 'node:http';
import { createClient } from 'redis';

const PORT = Number(process.env.GEOCODE_PORT || process.env.PORT || 8787);
const HOST = process.env.GEOCODE_HOST || '0.0.0.0';
const USER_AGENT = process.env.GEOCODE_USER_AGENT || 'RotaBoa-Geocode-Server/1.0';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Initialize Redis
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', err => console.error('Redis Client Error', err));

try {
    await redisClient.connect();
    console.log('Connected to Redis for caching');
} catch (error) {
    console.error('Could not connect to Redis, caching disabled:', error.message);
}

const sendJson = (res, statusCode, body) => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
    try {
        const baseUrl = `http://${req.headers.host || 'localhost'}`;
        const requestUrl = new URL(req.url || '/', baseUrl);

        if (requestUrl.pathname === '/health') {
            const redisStatus = redisClient.isOpen ? 'connected' : 'disconnected';
            sendJson(res, 200, { ok: true, service: 'geocode-server', redis: redisStatus });
            return;
        }

        if (requestUrl.pathname !== '/api/geocode') {
            sendJson(res, 404, { ok: false, error: 'not_found' });
            return;
        }

        const q = String(requestUrl.searchParams.get('q') || '').trim();
        const limit = String(requestUrl.searchParams.get('limit') || '3').trim();
        const countrycodes = String(requestUrl.searchParams.get('countrycodes') || 'br').trim();

        if (!q) {
            sendJson(res, 400, { ok: false, error: 'missing_q' });
            return;
        }

        // Cache Key
        const cacheKey = `geocode:${countrycodes}:${q}:${limit}`;

        // Try Redis Cache first
        if (redisClient.isOpen) {
            try {
                const cachedData = await redisClient.get(cacheKey);
                if (cachedData) {
                    sendJson(res, 200, {
                        ok: true,
                        source: 'redis-cache',
                        data: JSON.parse(cachedData)
                    });
                    return;
                }
            } catch (cacheErr) {
                console.warn('Redis read error:', cacheErr.message);
            }
        }

        const upstream = new URL('https://nominatim.openstreetmap.org/search');
        upstream.searchParams.set('format', 'json');
        upstream.searchParams.set('addressdetails', '1');
        upstream.searchParams.set('accept-language', 'pt-BR');
        upstream.searchParams.set('q', q);
        upstream.searchParams.set('limit', limit || '3');
        upstream.searchParams.set('countrycodes', countrycodes || 'br');

        const upstreamRes = await fetch(upstream, {
            headers: {
                'User-Agent': USER_AGENT
            }
        });
        const data = await upstreamRes.json().catch(() => []);

        // Store in Redis if successful (TTL 24 hours)
        if (upstreamRes.ok && redisClient.isOpen && Array.isArray(data) && data.length > 0) {
            try {
                await redisClient.set(cacheKey, JSON.stringify(data), {
                    EX: 86400 // 24 hours
                });
            } catch (cacheErr) {
                console.warn('Redis write error:', cacheErr.message);
            }
        }

        sendJson(res, upstreamRes.ok ? 200 : upstreamRes.status, {
            ok: upstreamRes.ok,
            source: 'nominatim-api',
            data: Array.isArray(data) ? data : [],
            status: upstreamRes.status
        });
    } catch (error) {
        sendJson(res, 500, { ok: false, error: 'internal_error', detail: String(error?.message || error) });
    }
});

server.listen(PORT, HOST, () => {
    console.log(`Geocode server running at http://${HOST}:${PORT}`);
});
