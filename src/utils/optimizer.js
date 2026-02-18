// Haversine distance in KM
const getDistance = (c1, c2) => {
    if (!c1 || !c2) return Infinity;
    const R = 6371;
    const dLat = (c2.lat - c1.lat) * Math.PI / 180;
    const dLon = (c2.lon - c1.lon) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const buildDistanceMatrix = (items) => {
    const n = items.length;
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const d = getDistance(items[i].coords, items[j].coords);
            matrix[i][j] = d;
            matrix[j][i] = d;
        }
    }

    return matrix;
};

const routeDistance = (route, matrix, roundTrip = false) => {
    if (route.length < 2) return 0;

    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
        total += matrix[route[i]][route[i + 1]];
    }

    if (roundTrip) {
        total += matrix[route[route.length - 1]][route[0]];
    }

    return total;
};

const buildBaselineOrder = (length, startIndex) => {
    const baseline = [startIndex];
    for (let i = 0; i < length; i++) {
        if (i !== startIndex) baseline.push(i);
    }
    return baseline;
};

const nearestNeighborRoute = (matrix, startIndex, firstChoiceRank = 0) => {
    const n = matrix.length;
    const unvisited = new Set();
    for (let i = 0; i < n; i++) {
        if (i !== startIndex) unvisited.add(i);
    }

    const route = [startIndex];
    let current = startIndex;

    // Try a few deterministic alternatives for the first hop.
    if (unvisited.size > 0 && firstChoiceRank > 0) {
        const ranked = [...unvisited].sort((a, b) => matrix[current][a] - matrix[current][b]);
        const pick = ranked[Math.min(firstChoiceRank, ranked.length - 1)];
        route.push(pick);
        unvisited.delete(pick);
        current = pick;
    }

    while (unvisited.size > 0) {
        let best = null;
        let bestDist = Infinity;

        for (const candidate of unvisited) {
            const d = matrix[current][candidate];
            if (d < bestDist) {
                bestDist = d;
                best = candidate;
            }
        }

        route.push(best);
        unvisited.delete(best);
        current = best;
    }

    return route;
};

const twoOptImprove = (baseRoute, matrix, roundTrip = false) => {
    const route = [...baseRoute];
    const n = route.length;
    if (n < 4) return route;

    let improved = true;
    while (improved) {
        improved = false;

        for (let i = 1; i < n - 2; i++) {
            for (let k = i + 1; k < n - 1; k++) {
                const a = route[i - 1];
                const b = route[i];
                const c = route[k];
                const d = route[k + 1];

                const delta = (matrix[a][c] + matrix[b][d]) - (matrix[a][b] + matrix[c][d]);
                if (delta < -1e-9) {
                    const reversed = route.slice(i, k + 1).reverse();
                    route.splice(i, reversed.length, ...reversed);
                    improved = true;
                }
            }
        }

        // For round-trip, also optimize edge touching route end -> route start.
        if (roundTrip) {
            const lastIdx = n - 1;
            for (let i = 1; i < n - 1; i++) {
                const a = route[i - 1];
                const b = route[i];
                const c = route[lastIdx];
                const d = route[0];

                const delta = (matrix[a][c] + matrix[b][d]) - (matrix[a][b] + matrix[c][d]);
                if (delta < -1e-9) {
                    const reversed = route.slice(i).reverse();
                    route.splice(i, reversed.length, ...reversed);
                    improved = true;
                }
            }
        }
    }

    return route;
};

const heldKarp = (matrix, startIndex, roundTrip = false) => {
    const n = matrix.length;
    const size = 1 << n;
    const startMask = 1 << startIndex;

    const dp = Array.from({ length: size }, () => new Array(n).fill(Infinity));
    const parent = Array.from({ length: size }, () => new Array(n).fill(-1));

    dp[startMask][startIndex] = 0;

    for (let mask = 0; mask < size; mask++) {
        if ((mask & startMask) === 0) continue;

        for (let last = 0; last < n; last++) {
            const currentCost = dp[mask][last];
            if (!Number.isFinite(currentCost)) continue;

            for (let next = 0; next < n; next++) {
                const nextBit = 1 << next;
                if (mask & nextBit) continue;

                const nextMask = mask | nextBit;
                const nextCost = currentCost + matrix[last][next];
                if (nextCost < dp[nextMask][next]) {
                    dp[nextMask][next] = nextCost;
                    parent[nextMask][next] = last;
                }
            }
        }
    }

    const fullMask = size - 1;
    let bestEnd = -1;
    let bestCost = Infinity;

    for (let end = 0; end < n; end++) {
        if (end === startIndex && n > 1) continue;
        let total = dp[fullMask][end];
        if (!Number.isFinite(total)) continue;
        if (roundTrip) total += matrix[end][startIndex];

        if (total < bestCost) {
            bestCost = total;
            bestEnd = end;
        }
    }

    if (bestEnd === -1) {
        return [startIndex];
    }

    const route = [];
    let mask = fullMask;
    let current = bestEnd;

    while (current !== -1) {
        route.push(current);
        const prev = parent[mask][current];
        mask ^= 1 << current;
        current = prev;
    }

    route.reverse();
    return route;
};

const getBestSequence = (items, startIndex, roundTrip) => {
    const matrix = buildDistanceMatrix(items);
    const n = items.length;

    // Exact solver for smaller inputs, robust and truly minimal.
    if (n <= 12) {
        return heldKarp(matrix, startIndex, roundTrip);
    }

    // Heuristic solver for bigger inputs: multi-start nearest + 2-opt.
    let bestRoute = null;
    let bestDistance = Infinity;
    const firstHopVariants = Math.min(5, n - 1);

    for (let variant = 0; variant < firstHopVariants; variant++) {
        const seed = nearestNeighborRoute(matrix, startIndex, variant);
        const improved = twoOptImprove(seed, matrix, roundTrip);
        const score = routeDistance(improved, matrix, roundTrip);

        if (score < bestDistance) {
            bestDistance = score;
            bestRoute = improved;
        }
    }

    return bestRoute || nearestNeighborRoute(matrix, startIndex, 0);
};

// Reliable optimizer: exact TSP for small N, strong heuristic for large N + OSRM geometry.
export const optimizeRoute = async (items, options = { roundTrip: false, startIndex: 0, optimizeBy: 'distance' }) => {
    if (items.length < 2) return { orderedItems: items, geometry: null, distance: 0, duration: 0 };

    const startIdx = options.startIndex >= 0 && options.startIndex < items.length ? options.startIndex : 0;
    const optimizeBy = options.optimizeBy === 'duration' ? 'duration' : 'distance';
    const baselineOrder = buildBaselineOrder(items.length, startIdx);
    const baselineRoute = baselineOrder.map((idx) => items[idx]);
    const baselineMetrics = await getOSRMRoute(baselineRoute, options.roundTrip);
    const attachBaseline = (result) => ({
        ...result,
        optimizeBy,
        baseline: {
            distance: baselineMetrics.distance,
            duration: baselineMetrics.duration
        }
    });

    // Exact best route on real road costs for smaller inputs.
    // With <=11 points, this is still practical and guarantees optimality.
    if (items.length <= 11) {
        const exactRoad = await getExactRoadOptimized(items, startIdx, options.roundTrip, optimizeBy);
        if (exactRoad) {
            return attachBaseline(exactRoad);
        }
    }

    // Better road heuristic for larger inputs using OSRM matrix + 2-opt.
    const roadHeuristic = await getRoadHeuristicOptimized(items, startIdx, options.roundTrip, optimizeBy);
    if (roadHeuristic) {
        return attachBaseline(roadHeuristic);
    }

    // Fallback road optimizer for larger inputs.
    const tripOptimized = await getOSRMTripOptimized(items, startIdx, options.roundTrip);
    if (tripOptimized) {
        return attachBaseline({
            ...tripOptimized,
            meta: {
                solver: 'osrm-trip',
                exact: false,
                costBasis: optimizeBy
            }
        });
    }

    // Fallback: local optimizer + OSRM route geometry.
    const indexRoute = getBestSequence(items, startIdx, options.roundTrip);
    const route = indexRoute.map((idx) => items[idx]);
    const pathData = await getOSRMRoute(route, options.roundTrip);

    return attachBaseline({
        orderedItems: route,
        geometry: pathData.geometry,
        distance: pathData.distance,
        duration: pathData.duration,
        meta: {
            solver: 'local-haversine',
            exact: false,
            costBasis: optimizeBy
        }
    });
};

const getExactRoadOptimized = async (items, startIndex, roundTrip = false, optimizeBy = 'distance') => {
    const table = await getOSRMTableMatrix(items);
    if (!table) return null;

    const costMatrix = selectCostMatrix(table, optimizeBy);
    if (!costMatrix) return null;

    const indexRoute = heldKarp(costMatrix, startIndex, roundTrip);
    if (!indexRoute || indexRoute.length !== items.length) return null;

    const route = indexRoute.map((idx) => items[idx]);
    const pathData = await getOSRMRoute(route, roundTrip);

    const baselineRoute = buildBaselineOrder(items.length, startIndex);

    return {
        orderedItems: route,
        geometry: pathData.geometry,
        distance: pathData.distance,
        duration: pathData.duration,
        meta: {
            solver: 'osrm-table-held-karp',
            exact: true,
            costBasis: optimizeBy,
            selectedCost: routeDistance(indexRoute, costMatrix, roundTrip),
            baselineCost: routeDistance(baselineRoute, costMatrix, roundTrip)
        }
    };
};

const getRoadHeuristicOptimized = async (items, startIndex, roundTrip = false, optimizeBy = 'distance') => {
    const table = await getOSRMTableMatrix(items);
    if (!table) return null;

    const costMatrix = selectCostMatrix(table, optimizeBy);
    if (!costMatrix) return null;

    const n = items.length;
    const firstHopVariants = Math.min(12, n - 1);
    let bestIndexRoute = null;
    let bestScore = Infinity;

    for (let variant = 0; variant < firstHopVariants; variant++) {
        const seed = nearestNeighborRoute(costMatrix, startIndex, variant);
        const improved = twoOptImprove(seed, costMatrix, roundTrip);
        const score = routeDistance(improved, costMatrix, roundTrip);

        if (score < bestScore) {
            bestScore = score;
            bestIndexRoute = improved;
        }
    }

    if (!bestIndexRoute) return null;

    const route = bestIndexRoute.map((idx) => items[idx]);
    const pathData = await getOSRMRoute(route, roundTrip);

    const baselineRoute = buildBaselineOrder(items.length, startIndex);

    return {
        orderedItems: route,
        geometry: pathData.geometry,
        distance: pathData.distance,
        duration: pathData.duration,
        meta: {
            solver: 'osrm-table-2opt',
            exact: false,
            costBasis: optimizeBy,
            selectedCost: routeDistance(bestIndexRoute, costMatrix, roundTrip),
            baselineCost: routeDistance(baselineRoute, costMatrix, roundTrip)
        }
    };
};

const selectCostMatrix = (table, optimizeBy) => {
    if (optimizeBy === 'duration') {
        return table.durationMatrix || table.distanceMatrix;
    }
    return table.distanceMatrix || table.durationMatrix;
};

const getOSRMTableMatrix = async (items) => {
    if (items.length < 2) return null;
    const coords = items.map((item) => `${item.coords.lon},${item.coords.lat}`).join(';');
    const url = `https://router.project-osrm.org/table/v1/driving/${coords}?annotations=distance,duration`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.code !== 'Ok') return null;

        const distanceMatrix = sanitizeNumericMatrix(data.distances);
        const durationMatrix = sanitizeNumericMatrix(data.durations);

        return { distanceMatrix, durationMatrix };
    } catch (e) {
        console.error('OSRM Table error:', e);
        return null;
    }
};

const sanitizeNumericMatrix = (matrix) => {
    if (!Array.isArray(matrix) || matrix.length === 0) return null;
    const n = matrix.length;
    for (let i = 0; i < n; i++) {
        if (!Array.isArray(matrix[i]) || matrix[i].length !== n) return null;
        for (let j = 0; j < n; j++) {
            if (!Number.isFinite(matrix[i][j])) return null;
        }
    }
    return matrix;
};

const getOSRMTripOptimized = async (items, startIndex, roundTrip = false) => {
    if (items.length < 2) return null;

    // Keep the selected start as the first input point.
    const reorderedInputIndices = [
        startIndex,
        ...items.map((_, idx) => idx).filter((idx) => idx !== startIndex)
    ];
    const reorderedItems = reorderedInputIndices.map((idx) => items[idx]);
    const coords = reorderedItems.map((item) => `${item.coords.lon},${item.coords.lat}`).join(';');

    const url = `https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&roundtrip=${roundTrip ? 'true' : 'false'}&overview=full&geometries=geojson`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.code !== 'Ok' || !data.trips?.[0] || !Array.isArray(data.waypoints)) {
            return null;
        }

        // waypoints are returned in input order, waypoint_index tells optimized visit order.
        const orderedInputPositions = data.waypoints
            .map((waypoint, inputPos) => ({ inputPos, waypointIndex: waypoint.waypoint_index }))
            .sort((a, b) => a.waypointIndex - b.waypointIndex)
            .map((item) => item.inputPos);

        const orderedItems = orderedInputPositions.map((inputPos) => reorderedItems[inputPos]);

        return {
            orderedItems,
            geometry: data.trips[0].geometry,
            distance: data.trips[0].distance,
            duration: data.trips[0].duration
        };
    } catch (e) {
        console.error('OSRM Trip error:', e);
        return null;
    }
};

const getOSRMRoute = async (route, roundTrip = false) => {
    if (route.length < 2) return { geometry: null, distance: 0, duration: 0 };

    // Construct coordinates for OSRM Route API
    let pts = route.map(item => `${item.coords.lon},${item.coords.lat}`);
    if (roundTrip) {
        pts.push(`${route[0].coords.lon},${route[0].coords.lat}`);
    }

    const coords = pts.join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.code === 'Ok') {
            return {
                geometry: data.routes[0].geometry,
                distance: data.routes[0].distance,
                duration: data.routes[0].duration
            };
        }
    } catch (e) {
        console.error('OSRM Route error:', e);
    }

    // Hard fallback to straight lines if API fails
    let d = 0;
    for (let i = 0; i < route.length - 1; i++) d += getDistance(route[i].coords, route[i + 1].coords);
    if (roundTrip) d += getDistance(route[route.length - 1].coords, route[0].coords);

    const straightLineCoords = route.map(item => [item.coords.lon, item.coords.lat]);
    if (roundTrip) {
        straightLineCoords.push([route[0].coords.lon, route[0].coords.lat]);
    }

    return {
        geometry: {
            type: 'LineString',
            coordinates: straightLineCoords
        },
        distance: d * 1000,
        duration: (d / 35) * 3600
    };
};
