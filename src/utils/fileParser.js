/**
 * Professional File Parser
 * Supports: CSV, XLSX, XLS
 * Features: Auto-column detection, Lat/Lon extraction, Junk removal
 */
export const parseFile = async (file) => {
    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'csv') {
        return parseCsvFile(file);
    }

    if (extension === 'xlsx' || extension === 'xls') {
        return parseExcelFile(file);
    }

    throw new Error('Formato não suportado. Use .csv ou .xlsx');
};

const parseCsvFile = async (file) => {
    const { default: Papa } = await import('papaparse');
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: 'greedy',
            encoding: 'UTF-8',
            complete: (results) => {
                if (results.errors.length > 0 && results.data.length === 0) {
                    reject(new Error('Erro ao ler CSV: Formato inválido.'));
                    return;
                }
                resolve(processData(results.data));
            },
            error: (error) => reject(new Error(`Erro no CSV: ${error.message}`))
        });
    });
};

const parseExcelFile = async (file) => {
    const XLSX = await import('xlsx');
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = parseExcelRows(worksheet, XLSX);
                resolve(processData(jsonData));
            } catch {
                reject(new Error('Erro ao processar Excel. Verifique se o arquivo não está protegido.'));
            }
        };
        reader.onerror = () => reject(new Error('Falha na leitura do arquivo.'));
        reader.readAsArrayBuffer(file);
    });
};

const normalizeText = (value) =>
    String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const normalizeKey = (value) => normalizeText(value).replace(/[^a-z0-9]/g, '');

const isLikelyAddressText = (value) => {
    const text = normalizeText(value);
    if (text.length < 8) return false;
    const hasNumber = /\d/.test(text);
    const hasStreetHint = /(rua|avenida|av|alameda|travessa|rodovia|estrada|praca|logradouro|address|r\.)/.test(text);
    const hasSeparator = /,|-/.test(text);
    return (hasNumber && hasSeparator) || hasStreetHint;
};

const isLikelyAddressHeader = (value) => {
    const text = normalizeText(value);
    if (!text) return false;
    if (/\d/.test(text)) return false;
    return /(endereco|endereço|address|destino|logradouro|local)/.test(text);
};

const parseExcelRows = (worksheet, XLSX) => {
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    if (jsonData.length === 0) return [];

    const firstRowKeys = Object.keys(jsonData[0]);
    if (firstRowKeys.length !== 1) return jsonData;

    const possibleHeader = firstRowKeys[0];
    const sampleValues = jsonData
        .slice(0, 20)
        .map((row) => row[possibleHeader])
        .filter((v) => String(v ?? '').trim().length > 0);

    const sampleLooksLikeAddress = sampleValues.filter(isLikelyAddressText).length;
    const shouldTreatAsData =
        isLikelyAddressText(possibleHeader) &&
        sampleValues.length > 0 &&
        sampleLooksLikeAddress / sampleValues.length >= 0.6;

    if (!shouldTreatAsData) return jsonData;

    const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    return matrix
        .map((row) => ({ endereco: row[0] }))
        .filter((row) => {
            const text = String(row.endereco ?? '').trim();
            if (!text) return false;
            // Ignore the original header when we reinterpret first column as raw data.
            if (isLikelyAddressHeader(possibleHeader) && normalizeText(text) === normalizeText(possibleHeader)) return false;
            return true;
        });
};

const processData = (data) => {
    if (!data || data.length === 0) return [];

    // Mapping synonyms for better detection
    const maps = {
        address: ['endereco', 'endereço', 'rua', 'address', 'logradouro', 'local', 'destino', 'destination address', 'destinationaddress', 'delivery address'],
        number: ['numero', 'número', 'n', 'num', 'nº'],
        city: ['cidade', 'city', 'municipio', 'município', 'loc'],
        state: ['estado', 'uf', 'state', 'est'],
        zip: ['cep', 'zip', 'postal', 'cod_postal', 'zipcode', 'postal code'],
        lat: ['lat', 'latitude', 'y'],
        lon: ['lon', 'long', 'longitude', 'x'],
        name: ['nome', 'cliente', 'razao_social', 'destinatario'],
        priority: ['prioridade', 'priority', 'prio', 'urgencia', 'urgência'],
        windowStart: ['janela_inicio', 'janela inicio', 'inicio_janela', 'start_time', 'hora_inicio', 'inicio'],
        windowEnd: ['janela_fim', 'janela fim', 'fim_janela', 'end_time', 'hora_fim', 'fim'],
        windowRange: ['janela', 'time_window', 'horario', 'horário', 'sla'],
        platform: ['plataforma', 'marketplace', 'canal', 'origem']
    };

    const parsePriorityWeight = (value) => {
        if (value === null || value === undefined || value === '') return 1;
        const text = String(value).trim().toLowerCase();
        if (!text) return 1;
        if (['alta', 'high', 'urgente', 'critica', 'crítica', 'p1'].includes(text)) return 3;
        if (['media', 'média', 'medium', 'normal', 'p2'].includes(text)) return 2;
        if (['baixa', 'low', 'p3'].includes(text)) return 1;
        const numeric = Number(text.replace(',', '.'));
        if (!Number.isFinite(numeric)) return 1;
        if (numeric >= 3) return 3;
        if (numeric >= 2) return 2;
        return 1;
    };

    const parseMinuteOfDay = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const text = String(value).trim();
        if (!text) return null;
        const timeMatch = text.match(/^(\d{1,2}):(\d{2})$/);
        if (!timeMatch) return null;
        const hours = Number(timeMatch[1]);
        const minutes = Number(timeMatch[2]);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
        return (hours * 60) + minutes;
    };

    const parseTimeWindowRange = (value) => {
        const text = String(value ?? '').trim();
        if (!text) return { start: null, end: null };
        const rangeMatch = text.match(/(\d{1,2}:\d{2})\s*[-aA]\s*(\d{1,2}:\d{2})/);
        if (!rangeMatch) return { start: null, end: null };
        return {
            start: parseMinuteOfDay(rangeMatch[1]),
            end: parseMinuteOfDay(rangeMatch[2])
        };
    };

    const findKey = (row, candidates) => {
        const keys = Object.keys(row ?? {});
        const normalizedCandidates = candidates.map(normalizeKey);
        return keys.find((key) => {
            const keyNorm = normalizeKey(key);
            return normalizedCandidates.some((candidate) =>
                keyNorm === candidate || (candidate.length >= 3 && keyNorm.includes(candidate))
            );
        });
    };

    const extractAddressFromValues = (row, usedKeys) => {
        const candidates = Object.entries(row ?? {})
            .filter(([key, value]) => !usedKeys.has(key) && typeof value === 'string' && value.trim())
            .map(([, value]) => value.trim());
        if (candidates.length === 0) return '';
        const likely = candidates.find(isLikelyAddressText);
        return likely || candidates.sort((a, b) => b.length - a.length)[0] || '';
    };

    return data.map((row, index) => {
        const safeRow = row && typeof row === 'object' ? row : { endereco: String(row ?? '') };

        const addrKey = findKey(safeRow, maps.address);
        const numKey = findKey(safeRow, maps.number);
        const cityKey = findKey(safeRow, maps.city);
        const stateKey = findKey(safeRow, maps.state);
        const zipKey = findKey(safeRow, maps.zip);
        const nameKey = findKey(safeRow, maps.name);
        const priorityKey = findKey(safeRow, maps.priority);
        const windowStartKey = findKey(safeRow, maps.windowStart);
        const windowEndKey = findKey(safeRow, maps.windowEnd);
        const windowRangeKey = findKey(safeRow, maps.windowRange);
        const platformKey = findKey(safeRow, maps.platform);

        // Direct Coords detection
        const latK = findKey(safeRow, maps.lat);
        const lonK = findKey(safeRow, maps.lon);

        let fullAddress = "";
        if (addrKey && safeRow[addrKey]) {
            fullAddress = String(safeRow[addrKey]).trim();
            if (numKey && safeRow[numKey] && !fullAddress.includes(String(safeRow[numKey]))) {
                fullAddress += `, ${safeRow[numKey]}`;
            }
        }
        if (!fullAddress) {
            fullAddress = extractAddressFromValues(safeRow, new Set([numKey, cityKey, stateKey, zipKey, nameKey, latK, lonK]));
        }

        const city = cityKey ? String(safeRow[cityKey]).trim() : "";
        const state = stateKey ? String(safeRow[stateKey]).trim() : "";
        const zip = zipKey ? String(safeRow[zipKey]).trim() : "";
        const name = nameKey ? String(safeRow[nameKey]).trim() : "";
        const latValue = latK ? parseFloat(String(safeRow[latK]).replace(',', '.')) : NaN;
        const lonValue = lonK ? parseFloat(String(safeRow[lonK]).replace(',', '.')) : NaN;
        const hasValidCoords = Number.isFinite(latValue) && Number.isFinite(lonValue);
        const rangeWindow = windowRangeKey ? parseTimeWindowRange(safeRow[windowRangeKey]) : { start: null, end: null };
        const timeWindowStart = windowStartKey ? parseMinuteOfDay(safeRow[windowStartKey]) : rangeWindow.start;
        const timeWindowEnd = windowEndKey ? parseMinuteOfDay(safeRow[windowEndKey]) : rangeWindow.end;
        const normalizedPlatformRaw = platformKey ? normalizeText(safeRow[platformKey]) : '';
        const platform = normalizedPlatformRaw.includes('mercado livre')
            ? 'mercado_livre'
            : normalizedPlatformRaw.includes('shopee')
                ? 'shopee'
                : null;
        const priorityWeight = priorityKey ? parsePriorityWeight(safeRow[priorityKey]) : 1;

        // Clean address construction
        let lookupString = String(fullAddress || '').trim();
        if (city && !lookupString.toLowerCase().includes(city.toLowerCase())) lookupString += `, ${city}`;
        if (state && !lookupString.toLowerCase().includes(state.toLowerCase())) lookupString += `, ${state}`;
        if (zip && !lookupString.includes(zip)) lookupString += `, ${zip}`;
        if (lookupString && !lookupString.toLowerCase().includes('brasil')) lookupString += ', Brasil';

        return {
            id: `item-${index}-${Date.now()}`,
            label: name || `Entrega #${index + 1}`,
            address: lookupString.trim(),
            displayAddress: `${fullAddress}${city ? ', ' + city : ''}`.trim(),
            coords: hasValidCoords ? { lat: latValue, lon: lonValue } : null,
            status: 'pending',
            priorityWeight,
            platform,
            timeWindowStartMin: Number.isFinite(timeWindowStart) ? timeWindowStart : null,
            timeWindowEndMin: Number.isFinite(timeWindowEnd) ? timeWindowEnd : null,
            originalData: safeRow
        };
    }).filter((item) => {
        const normalized = normalizeText(item.address).replace(/[,\s]/g, '');
        return item.address.length > 8 && normalized !== 'brasil';
    }); // Filter junk lines
};
