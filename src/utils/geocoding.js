const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const BACKEND_ENDPOINT = (import.meta.env.VITE_GEOCODE_API_URL || '/api/geocode').trim();
const CACHE_KEY = 'geocode_cache_v3';
const CACHE_LIMIT = 3000;
const DEFAULT_LOCALITY_HINT = (import.meta.env.VITE_DEFAULT_CITY_HINT || 'Bauru, SP, Brasil').trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeCacheKey = (address) =>
    String(address ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

const toSettings = (mode) => {
    if (mode === 'accurate') {
        return {
            timeoutMs: 8000,
            minRequestIntervalMs: 800,
            maxNumberVariants: 5,
            maxCandidatesToTry: 8,
            allowWithoutZipFallback: true,
            allowBroadFallback: true
        };
    }

    return {
        timeoutMs: 3000,
        minRequestIntervalMs: 450,
        maxNumberVariants: 2,
        maxCandidatesToTry: 4,
        allowWithoutZipFallback: true,
        allowBroadFallback: false
    };
};

const loadPersistentCache = () => {
    try {
        if (typeof localStorage === 'undefined') return new Map();
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return new Map();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Map();
        return new Map(parsed);
    } catch {
        return new Map();
    }
};

const savePersistentCache = (cache) => {
    try {
        if (typeof localStorage === 'undefined') return;
        const serialized = JSON.stringify(Array.from(cache.entries()).slice(-CACHE_LIMIT));
        localStorage.setItem(CACHE_KEY, serialized);
    } catch {
        // noop
    }
};

export const clearGeocodeCache = () => {
    try {
        if (typeof localStorage === 'undefined') return;
        localStorage.removeItem(CACHE_KEY);
    } catch {
        // noop
    }
};

const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = 5000) => {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    } finally {
        clearTimeout(timerId);
    }
};

const buildNumberVariants = (token) => {
    const cleaned = String(token ?? '').trim();
    const digits = cleaned.replace(/\D/g, '');
    const variants = new Set();
    if (!digits) return [];

    variants.add(digits);
    if (/^\d+-\d+$/.test(cleaned)) variants.add(cleaned);

    if (digits.length === 3) {
        variants.add(`${digits[0]}-${digits.slice(1)}`);
        variants.add(`${digits.slice(0, 2)}-${digits[2]}`);
    } else if (digits.length === 4) {
        variants.add(`${digits.slice(0, 2)}-${digits.slice(2)}`);
        variants.add(`${digits[0]}-${digits.slice(1)}`);
    }

    return Array.from(variants);
};

const buildAddressCandidates = (rawAddress, maxNumberVariants) => {
    const base = String(rawAddress ?? '').trim();
    if (!base) return [];

    const candidates = new Set([base]);
    const numberMatch = base.match(/\bN\s*([0-9-]{2,6})\b/i) || base.match(/,\s*([0-9-]{2,6})\s*,/);

    if (numberMatch?.[1]) {
        const forms = buildNumberVariants(numberMatch[1]).slice(0, maxNumberVariants);
        forms.forEach((form) => {
            const withN = base.replace(/\bN\s*[0-9-]{2,6}\b/i, `N ${form}`);
            candidates.add(withN);
            const bare = base.replace(/,\s*[0-9-]{2,6}\s*,/, `, ${form},`);
            candidates.add(bare);
        });
    }

    const normalized = Array.from(candidates).map((item) => item.replace(/\s{2,}/g, ' ').trim());
    const hasLocalityContext = (query) =>
        /\b(bauru|sao paulo|sp|brasil|\d{5}-?\d{3})\b/i.test(String(query || ''));
    const withHint = new Set(normalized);
    normalized.forEach((candidate) => {
        if (!hasLocalityContext(candidate) && DEFAULT_LOCALITY_HINT) {
            withHint.add(`${candidate}, ${DEFAULT_LOCALITY_HINT}`);
        }
    });
    return Array.from(withHint);
};

const scoreResult = (item, query) => {
    let score = Number(item?.importance || 0);
    const queryNumber = String(query).match(/\bN\s*([0-9-]{2,6})\b/i)?.[1] || String(query).match(/,\s*([0-9-]{2,6})\s*,/)?.[1];
    const responseNumber = item?.address?.house_number || '';
    if (queryNumber && responseNumber) {
        const qn = queryNumber.replace(/\D/g, '');
        const rn = String(responseNumber).replace(/\D/g, '');
        if (qn === rn) score += 0.2;
    }
    if (String(item?.display_name || '').toLowerCase().includes('bauru')) score += 0.05;
    return score;
};

const requestBackendGeocode = async (query, timeoutMs, limit = 3) => {
    const url = `${BACKEND_ENDPOINT}?q=${encodeURIComponent(query)}&limit=${limit}&countrycodes=br`;
    const response = await fetchJsonWithTimeout(url, {
        headers: {
            'Accept': 'application/json'
        }
    }, timeoutMs);
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.data)) return null;
    return payload.data;
};

const requestDirectGeocode = async (query, timeoutMs, limit = 3) => {
    const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1&countrycodes=br`;
    const response = await fetchJsonWithTimeout(url, {
        headers: {
            'Accept-Language': 'pt-BR',
            'User-Agent': 'RotaBoa-App-v2'
        }
    }, timeoutMs);
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data)) return null;
    return data;
};

const geocodeAddress = async (address, settings, runtime) => {
    const requestAndSelectBest = async (query, strategy) => {
        const now = Date.now();
        const waitMs = Math.max(0, settings.minRequestIntervalMs - (now - runtime.lastRequestAt));
        if (waitMs > 0) await sleep(waitMs);

        runtime.networkRequests += 1;
        try {
            let candidates = await requestBackendGeocode(query, settings.timeoutMs);
            runtime.lastRequestAt = Date.now();
            if (!candidates) {
                candidates = await requestDirectGeocode(query, settings.timeoutMs);
                runtime.lastRequestAt = Date.now();
            }
            if (!Array.isArray(candidates) || candidates.length === 0) return null;

            const best = [...candidates].sort((a, b) => scoreResult(b, query) - scoreResult(a, query))[0];
            return {
                lat: parseFloat(best.lat),
                lon: parseFloat(best.lon),
                display_name: best.display_name,
                query_used: query,
                strategy,
                score: scoreResult(best, query)
            };
        } catch {
            runtime.lastRequestAt = Date.now();
            return null;
        }
    };

    const candidates = buildAddressCandidates(address, settings.maxNumberVariants).slice(0, settings.maxCandidatesToTry);
    let bestResult = null;

    for (const candidate of candidates) {
        const found = await requestAndSelectBest(candidate, candidate === address ? 'exact' : 'number-variant');
        if (!found) continue;
        if (!bestResult || Number(found.score || 0) > Number(bestResult.score || 0)) bestResult = found;
        if (Number(bestResult?.score || 0) >= 0.55) break;
    }
    if (bestResult) return bestResult;

    if (settings.allowWithoutZipFallback) {
        const simplified = address.replace(/\d{5}-?\d{3}/, '').replace(/,,/g, ',').trim();
        if (simplified && simplified !== address) {
            const result = await requestAndSelectBest(simplified, 'without-zip');
            if (result) return result;
        }
    }

    if (settings.allowBroadFallback) {
        const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
        if (parts.length > 2) {
            const broad = `${parts[0]}, ${parts[parts.length - 2]}`;
            const result = await requestAndSelectBest(broad, 'broad');
            if (result) return result;
        }
    }

    return null;
};

export const geocodeBatch = async (items, onProgress, options = {}) => {
    const mode = options.mode === 'accurate' ? 'accurate' : 'fast';
    const phaseOneSettings = toSettings(mode === 'accurate' ? 'accurate' : 'fast');
    const phaseTwoSettings = mode === 'fast' ? toSettings('accurate') : null;
    const onMetrics = typeof options.onMetrics === 'function' ? options.onMetrics : null;
    const runtime = { networkRequests: 0, lastRequestAt: 0 };
    const startedAt = Date.now();
    const hasValidCoords = (item) =>
        Boolean(item?.coords && Number.isFinite(item.coords.lat) && Number.isFinite(item.coords.lon));
    const runCache = loadPersistentCache();
    const results = new Array(items.length);
    let completed = 0;
    const addressGroups = new Map();
    const metrics = {
        mode,
        total: items.length,
        processed: 0,
        successCount: 0,
        errorCount: 0,
        cacheHits: 0,
        cacheMisses: 0,
        uniqueAddresses: 0,
        secondPassLookups: 0,
        networkRequests: 0,
        durationMs: 0
    };
    const emitMetrics = () => {
        metrics.networkRequests = runtime.networkRequests;
        metrics.durationMs = Date.now() - startedAt;
        if (onMetrics) onMetrics({ ...metrics });
    };

    items.forEach((item, index) => {
        if (hasValidCoords(item)) {
            results[index] = { ...item, status: 'success' };
            completed += 1;
            metrics.processed = completed;
            metrics.successCount += 1;
            emitMetrics();
            if (onProgress) onProgress(completed, items.length);
            return;
        }

        const cacheKey = normalizeCacheKey(item.address);
        const existing = addressGroups.get(cacheKey);
        if (existing) {
            existing.indices.push(index);
            return;
        }
        addressGroups.set(cacheKey, {
            cacheKey,
            address: item.address,
            indices: [index]
        });
    });
    metrics.uniqueAddresses = addressGroups.size;
    emitMetrics();

    for (const group of addressGroups.values()) {
        const fromCache = runCache.has(group.cacheKey);
        const cachedValue = fromCache ? runCache.get(group.cacheKey) : undefined;
        if (fromCache) metrics.cacheHits += group.indices.length;
        if (!fromCache) metrics.cacheMisses += group.indices.length;
        let geocoded = fromCache ? cachedValue : await geocodeAddress(group.address, phaseOneSettings, runtime);

        if (!geocoded && phaseTwoSettings) {
            metrics.secondPassLookups += 1;
            geocoded = await geocodeAddress(group.address, phaseTwoSettings, runtime);
        }

        if (!fromCache && geocoded) runCache.set(group.cacheKey, geocoded);

        if (geocoded) {
            const shouldNormalizeAddress = geocoded.strategy === 'exact' || geocoded.strategy === 'number-variant';
            const normalizedAddress = shouldNormalizeAddress && geocoded.query_used ? geocoded.query_used : group.address;
            group.indices.forEach((index) => {
                const original = items[index];
                results[index] = {
                    ...original,
                    address: normalizedAddress,
                    coords: { lat: geocoded.lat, lon: geocoded.lon },
                    geocodeMeta: {
                        strategy: geocoded.strategy,
                        displayName: geocoded.display_name,
                        queryUsed: geocoded.query_used
                    },
                    status: 'success'
                };
                metrics.successCount += 1;
                completed += 1;
                metrics.processed = completed;
                emitMetrics();
                if (onProgress) onProgress(completed, items.length);
            });
        } else {
            group.indices.forEach((index) => {
                const original = items[index];
                results[index] = { ...original, coords: null, status: 'error' };
                metrics.errorCount += 1;
                completed += 1;
                metrics.processed = completed;
                emitMetrics();
                if (onProgress) onProgress(completed, items.length);
            });
        }
    }

    savePersistentCache(runCache);
    emitMetrics();
    return results;
};
