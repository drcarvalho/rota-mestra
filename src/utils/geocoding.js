const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export const geocodeAddress = async (address) => {
    const tryGeocode = async (q) => {
        try {
            const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1&countrycodes=br`;
            const response = await fetch(url, {
                headers: {
                    'Accept-Language': 'pt-BR',
                    'User-Agent': 'RotaMestra-App-v2'
                }
            });
            if (!response.ok) return null;
            const data = await response.json();
            return (data && data.length > 0) ? {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon),
                display_name: data[0].display_name
            } : null;
        } catch {
            return null;
        }
    };

    // Attempt 1: Full structured address
    let result = await tryGeocode(address);
    if (result) return result;

    // Attempt 2: Without CEP/Postal Code
    const simplified = address.replace(/\d{5}-?\d{3}/, '').replace(/,,/g, ',').trim();
    if (simplified !== address) {
        result = await tryGeocode(simplified);
        if (result) return result;
    }

    // Attempt 3: Only street and city (very broad fallback)
    const parts = address.split(',');
    if (parts.length > 2) {
        const broad = `${parts[0]}, ${parts[parts.length - 2]}`;
        result = await tryGeocode(broad);
    }

    return result;
};

// Batch geocoding with concurrency control and delay
export const geocodeBatch = async (items, onProgress) => {
    const results = [];
    let completed = 0;
    const hasValidCoords = (item) =>
        Boolean(item?.coords && Number.isFinite(item.coords.lat) && Number.isFinite(item.coords.lon));

    for (const item of items) {
        if (hasValidCoords(item)) {
            results.push({ ...item, status: 'success' });
            completed++;
            if (onProgress) onProgress(completed, items.length);
            continue;
        }

        const coords = await geocodeAddress(item.address);
        results.push({ ...item, coords, status: coords ? 'success' : 'error' });
        completed++;
        if (onProgress) onProgress(completed, items.length);

        // Respect Nominatim usage policy (1 request per second is recommended,
        // but we'll do a small delay to be safe and responsive)
        await new Promise(r => setTimeout(r, 600));
    }

    return results;
};
