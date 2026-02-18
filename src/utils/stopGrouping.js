const normalizeCounterText = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeStreetBlockToken = (token) => {
    const value = String(token ?? '').trim();
    if (!/^\d{3,}$/.test(value)) return null;
    const splitAt = value.length - 2;
    return value.slice(0, splitAt);
};

const buildGeoCellKey = (item, city) => {
    const lat = Number(item?.coords?.lat);
    const lon = Number(item?.coords?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    // ~110m cell. Helps grouping addresses without useful number pattern.
    const latCell = Math.round(lat * 1000);
    const lonCell = Math.round(lon * 1000);
    return `geo:${latCell}:${lonCell}|${city}`;
};

const buildStopGroupKey = (item) => {
    const rawAddress = String(item?.displayAddress || item?.address || '').trim();
    if (!rawAddress) return `stop:${String(item?.id || 'sem-endereco')}`;

    const parts = rawAddress.split(',').map((part) => part.trim()).filter(Boolean);
    const normalizedParts = parts.map((part) => normalizeCounterText(part));
    const lastPart = normalizedParts[normalizedParts.length - 1] || '';
    const isUf = /^[a-z]{2}$/.test(lastPart);
    const hasBrazilTail = lastPart === 'brasil';
    let city = '';
    if (hasBrazilTail && normalizedParts.length >= 3) city = normalizedParts[normalizedParts.length - 3];
    else if (isUf && normalizedParts.length >= 2) city = normalizedParts[normalizedParts.length - 2];
    else if (normalizedParts.length >= 2) city = normalizedParts[normalizedParts.length - 1];

    let streetScopeParts = parts;
    if (hasBrazilTail && parts.length >= 3) {
        streetScopeParts = parts.slice(0, parts.length - 3);
    } else if (isUf && parts.length >= 2) {
        streetScopeParts = parts.slice(0, parts.length - 2);
    } else if (parts.length >= 2) {
        streetScopeParts = parts.slice(0, parts.length - 1);
    }
    const compactHead = normalizeCounterText(streetScopeParts.join(' ') || rawAddress).replace(/\s+/g, ' ').trim();
    const cleanContext = (text) => text
        .replace(/\b(?:lote|lt)\s*[a-z0-9-]+\b/gi, '')
        .replace(/\b(?:apto|apartamento|casa|bloco|bl|fundos|sala|loja|complemento|comp)\s*[a-z0-9-]*\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    const quadraMatch = compactHead.match(/\b(?:quadra|qd)\s*([a-z0-9]+)\b/i);
    if (quadraMatch) {
        const quadra = quadraMatch[1];
        const context = cleanContext(compactHead.replace(/\b(?:quadra|qd)\s*[a-z0-9]+\b/gi, ''));
        return `quadra:${context}|${quadra}|${city}`;
    }

    const streetNumberMatch = compactHead.match(/\bn\s*(\d+)\s*[-/.]\s*(\d+)\b/i);
    if (streetNumberMatch) {
        const block = streetNumberMatch[1];
        const context = cleanContext(compactHead.replace(/\bn\s*\d+\s*[-/.]\s*\d+\b/gi, ''));
        return `numero:${context}|${block}|${city}`;
    }

    const bareStreetNumberMatch = compactHead.match(/\b(\d+)\s*[-/.]\s*(\d+)\b/i);
    if (bareStreetNumberMatch) {
        const block = bareStreetNumberMatch[1];
        const context = cleanContext(compactHead.replace(/\b\d+\s*[-/.]\s*\d+\b/gi, ''));
        return `numero:${context}|${block}|${city}`;
    }

    const packedNumberMatch = compactHead.match(/\bn\s*(\d{3,})\b/i);
    if (packedNumberMatch) {
        const block = normalizeStreetBlockToken(packedNumberMatch[1]);
        if (block) {
            const context = cleanContext(compactHead.replace(/\bn\s*\d{3,}\b/gi, ''));
            return `numero:${context}|${block}|${city}`;
        }
    }

    const barePackedNumberMatch = compactHead.match(/\b(\d{3,})\b/i);
    if (barePackedNumberMatch) {
        const block = normalizeStreetBlockToken(barePackedNumberMatch[1]);
        if (block) {
            const context = cleanContext(compactHead.replace(/\b\d{3,}\b/gi, ''));
            return `numero:${context}|${block}|${city}`;
        }
    }

    const geoCell = buildGeoCellKey(item, city);
    if (geoCell) return geoCell;

    return `address:${compactHead}|${city}`;
};

export const buildStopGroups = (routeItems) => {
    const groups = new Map();
    (routeItems || []).forEach((item, idx) => {
        if (idx === 0) return;
        const key = buildStopGroupKey(item);
        const existing = groups.get(key);
        if (existing) {
            existing.items.push(item);
            existing.indices.push(idx);
            if (idx < existing.firstIndex) existing.firstIndex = idx;
            return;
        }
        groups.set(key, { key, items: [item], indices: [idx], firstIndex: idx });
    });
    return Array.from(groups.values())
        .sort((a, b) => a.firstIndex - b.firstIndex)
        .map((group, index) => ({ ...group, stopOrder: index + 1 }));
};
