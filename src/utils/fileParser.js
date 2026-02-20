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

    throw new Error('Formato não suportado. Use CSV ou Excel.');
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
                    reject(new Error('Erro ao ler CSV. Verifique o formato do arquivo.'));
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
                reject(new Error('Erro ao abrir Excel. Verifique se o arquivo está liberado.'));
            }
        };
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
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

const normalizeStreetNumberToken = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    const withoutPrefix = raw
        .replace(/^\s*(?:n(?:um(?:ero)?)?|n[º°o]?\.?)\s*/i, '')
        .trim();
    if (!withoutPrefix) return '';

    const withSeparator = withoutPrefix.match(/^(\d+)\s*[-/.]\s*(\d+)$/);
    if (withSeparator) return `${withSeparator[1]}-${withSeparator[2]}`;

    return withoutPrefix;
};

const normalizeAddressNumberNotation = (value) => {
    let text = String(value ?? '').trim();
    if (!text) return '';
    const hasQuadraHint = /\b(?:quadra|qd)\s*\d+/i.test(text);

    if (hasQuadraHint) {
        text = text.replace(
            /\b(?:n(?:um(?:ero)?)?|n[º°o]?\.?)\s*(\d{3,})\b/gi,
            (_, digits) => `N ${digits.length >= 3 ? `${digits.slice(0, digits.length - 2)}-${digits.slice(-2)}` : digits}`
        );
    }

    text = text.replace(
        /\b(?:n(?:um(?:ero)?)?|n[º°o]?\.?)\s*(\d+\s*[-/.]\s*\d+)\b/gi,
        (_, token) => `N ${normalizeStreetNumberToken(token)}`
    );

    return text.replace(/(\d+)\s*[/.]\s*(\d+)/g, '$1-$2');
};

const toTitleCase = (value) => {
    const smallWords = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
    return String(value ?? '')
        .split(' ')
        .filter(Boolean)
        .map((word, idx) => {
            const lower = word.toLowerCase();
            if (idx > 0 && smallWords.has(lower)) return lower;
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
};

const normalizeZipCode = (value) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return String(value ?? '').trim();
};

const BR_STATE_NAME_TO_UF = {
    acre: 'AC',
    alagoas: 'AL',
    amapa: 'AP',
    amazonas: 'AM',
    bahia: 'BA',
    ceara: 'CE',
    'distrito federal': 'DF',
    espiritosanto: 'ES',
    goias: 'GO',
    maranhao: 'MA',
    matogrosso: 'MT',
    matogrossodosul: 'MS',
    minasgerais: 'MG',
    para: 'PA',
    paraiba: 'PB',
    parana: 'PR',
    pernambuco: 'PE',
    piaui: 'PI',
    riodejaneiro: 'RJ',
    riograndedonorte: 'RN',
    riograndedosul: 'RS',
    rondonia: 'RO',
    roraima: 'RR',
    santacatarina: 'SC',
    saopaulo: 'SP',
    sergipe: 'SE',
    tocantins: 'TO'
};

const normalizeStateCode = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const lettersOnly = raw.replace(/[^a-zA-Z]/g, '');
    if (lettersOnly.length === 2) return lettersOnly.toUpperCase();

    const normalizedName = normalizeText(raw).replace(/\s+/g, '');
    return BR_STATE_NAME_TO_UF[normalizedName] || '';
};

export const sanitizeAddressSegment = (value) => {
    let text = String(value ?? '').trim();
    if (!text) return '';
    const hasQuadraHint = /\b(?:quadra|qd)\s*\d+/i.test(text);
    text = normalizeAddressNumberNotation(text);
    text = text.replace(/\b(\d{5})-(\d{3})\b/g, '$1__ZIP__$2');
    text = text
        .replace(/[;|]/g, ', ')
        .replace(/\s*-\s*/g, '-')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s{2,}/g, ' ')
        .replace(/\bav\.\s*/gi, 'Avenida ')
        .replace(/\bav\b/gi, 'Avenida')
        .replace(/\bavenida\b/gi, 'Avenida')
        .replace(/\br\.\s*/gi, 'Rua ')
        .replace(/\brua\b/gi, 'Rua')
        .replace(/\btrav\.\s*/gi, 'Travessa ')
        .replace(/\btravessa\b/gi, 'Travessa')
        .replace(/\best\.\s*/gi, 'Estrada ')
        .replace(/\bestrada\b/gi, 'Estrada')
        .replace(/\brod\.\s*/gi, 'Rodovia ')
        .replace(/\brod\b/gi, 'Rodovia')
        .replace(/\brodovia\b/gi, 'Rodovia')
        .replace(/\bqd(?:\.|ra)?\b/gi, 'Quadra')
        .replace(/\blt(?:\.|e)?\b/gi, 'Lote')
        .replace(/\bs\/?n\b/gi, 'S/N')
        .replace(/\bbr[-\s]?(\d{2,3})\b/gi, 'BR-$1')
        .replace(/\bn(?:um(?:ero)?)?\s+/gi, 'N ')
        .replace(/,\s*(\d{3,4})\s*(?=,|$)/g, (_, digits) => (hasQuadraHint ? `, N ${digits.length >= 3 ? `${digits.slice(0, digits.length - 2)}-${digits.slice(-2)}` : digits}` : `, ${digits}`))
        .replace(/\b(\d{3,4})\s*(?=,)/g, (_, digits) => (hasQuadraHint && digits.length >= 3 ? `${digits.slice(0, digits.length - 2)}-${digits.slice(-2)}` : digits))
        .replace(/\s+,/g, ',')
        .replace(/,+/g, ',')
        .replace(/^,\s*|\s*,\s*$/g, '')
        .trim();
    text = text.replace(/(\d{5})__ZIP__(\d{3})/g, '$1-$2');
    let formatted = toTitleCase(text);
    formatted = formatted
        .replace(/\bQuadra(\d+)\b/g, 'Quadra $1')
        .replace(/\bQuadra\s*(\d+)\s*(?:E|,|-|\/)\s*N?\s*(\d{1,3})(?!-)\b/gi, (_, q, n) => `Quadra ${q}, N ${q}-${n}`)
        .replace(/\bQuadra\s*(\d+)\s+N\s*(\d{1,3})(?!-)\b/gi, (_, q, n) => `Quadra ${q}, N ${q}-${n}`)
        .replace(/\bQuadra\s*(\d+)\s*,\s*N\s*(\d{1,3})(?!-)\b/gi, (_, q, n) => `Quadra ${q}, N ${q}-${n}`)
        .replace(/\bQuadra\s*(\d+)\s*,\s*(\d{1,3})(?!-)\b/gi, (_, q, n) => `Quadra ${q}, N ${q}-${n}`)
        .replace(/\bBr-(\d{2,3})\b/g, 'BR-$1')
        .replace(/\bS\/n\b/g, 'S/N');
    return formatted;
};

export const buildSanitizedAddress = ({ fullAddress, city, state, zip }) => {
    const parts = [];
    const sanitizedStreet = sanitizeAddressSegment(fullAddress);
    const sanitizedCity = sanitizeAddressSegment(city);
    const sanitizedState = normalizeStateCode(state);
    const sanitizedZip = normalizeZipCode(zip);
    const hasPartSegment = (needle) => {
        const needleNorm = normalizeText(needle);
        return parts.some((part) => normalizeText(part)
            .split(',')
            .map((segment) => segment.trim())
            .includes(needleNorm));
    };

    if (sanitizedStreet) parts.push(sanitizedStreet);
    if (sanitizedCity && !hasPartSegment(sanitizedCity)) parts.push(sanitizedCity);
    if (sanitizedState && !hasPartSegment(sanitizedState)) parts.push(sanitizedState);
    if (sanitizedZip && !parts.some((part) => part.includes(sanitizedZip))) parts.push(sanitizedZip);
    if (!parts.some((part) => normalizeText(part) === 'brasil')) parts.push('Brasil');

    return parts.join(', ').replace(/\s{2,}/g, ' ').replace(/^,\s*|\s*,\s*$/g, '').trim();
};

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
        state: ['estado', 'uf', 'state'],
        zip: ['cep', 'zip', 'postal', 'cod_postal', 'zipcode', 'postal code'],
        lat: ['lat', 'latitude', 'y'],
        lon: ['lon', 'long', 'longitude', 'x'],
        name: ['nome', 'cliente', 'razao_social', 'destinatario'],
        priority: ['prioridade', 'priority', 'prio', 'urgencia', 'urgência'],
        windowStart: ['janela_inicio', 'janela inicio', 'inicio_janela', 'start_time', 'hora_inicio', 'inicio'],
        windowEnd: ['janela_fim', 'janela fim', 'fim_janela', 'end_time', 'hora_fim', 'fim'],
        windowRange: ['janela', 'time_window', 'horario', 'horário', 'sla'],
        platform: ['plataforma', 'marketplace', 'canal', 'origem']
        ,
        observation: ['observacao', 'observação', 'obs', 'referencia', 'referência', 'complemento', 'nota', 'note']
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
        const observationKey = findKey(safeRow, maps.observation);

        // Direct Coords detection
        const latK = findKey(safeRow, maps.lat);
        const lonK = findKey(safeRow, maps.lon);

        const normalizedNumber = numKey ? normalizeStreetNumberToken(safeRow[numKey]) : '';

        let fullAddress = "";
        if (addrKey && safeRow[addrKey]) {
            fullAddress = normalizeAddressNumberNotation(safeRow[addrKey]);
            if (normalizedNumber && !fullAddress.includes(normalizedNumber)) {
                fullAddress += `, ${normalizedNumber}`;
            }
        }
        if (!fullAddress) {
            fullAddress = extractAddressFromValues(safeRow, new Set([numKey, cityKey, stateKey, zipKey, nameKey, latK, lonK]));
        }
        fullAddress = normalizeAddressNumberNotation(fullAddress);

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
        const observation = observationKey ? String(safeRow[observationKey] ?? '').trim() : '';

        // Clean address construction
        const lookupString = buildSanitizedAddress({
            fullAddress,
            city,
            state,
            zip
        });
        const displayAddress = [sanitizeAddressSegment(fullAddress), sanitizeAddressSegment(city)]
            .filter(Boolean)
            .join(', ');

        return {
            id: `item-${index}-${Date.now()}`,
            label: name || `Entrega #${index + 1}`,
            address: lookupString,
            displayAddress: displayAddress || sanitizeAddressSegment(fullAddress),
            coords: hasValidCoords ? { lat: latValue, lon: lonValue } : null,
            status: 'pending',
            priorityWeight,
            platform,
            observation: observation || null,
            timeWindowStartMin: Number.isFinite(timeWindowStart) ? timeWindowStart : null,
            timeWindowEndMin: Number.isFinite(timeWindowEnd) ? timeWindowEnd : null,
            originalData: safeRow
        };
    }).filter((item) => {
        const normalized = normalizeText(item.address).replace(/[,\s]/g, '');
        return item.address.length > 8 && normalized !== 'brasil';
    }); // Filter junk lines
};
