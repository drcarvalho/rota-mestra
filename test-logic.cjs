// Teste automatizado da lógica principal de otimização.
const { optimizeRoute } = require('./src/utils/optimizer.js');

// Mock data: Points in Bauru
const mockItems = [
    { id: 1, address: 'Rua A', coords: { lat: -22.32, lon: -49.07 } },
    { id: 2, address: 'Rua B', coords: { lat: -22.33, lon: -49.08 } },
    { id: 3, address: 'Rua C', coords: { lat: -22.31, lon: -49.06 } }
];

async function testOptimizer() {
    console.log('Iniciando teste de lógica do otimizador...');

    try {
        // We Mock the fetch for OSRM
        global.fetch = async (url) => {
            if (url.includes('/route/')) {
                return {
                    ok: true,
                    json: async () => ({
                        code: 'Ok',
                        routes: [{
                            geometry: { type: 'LineString', coordinates: [[-49.07, -22.32], [-49.06, -22.31], [-49.08, -22.33]] },
                            distance: 5000,
                            duration: 600
                        }]
                    })
                };
            }

            if (url.includes('/table/')) {
                return {
                    ok: true,
                    json: async () => ({
                        code: 'Ok',
                        distances: [
                            [0, 3500, 1800],
                            [3500, 0, 2200],
                            [1800, 2200, 0]
                        ],
                        durations: [
                            [0, 460, 240],
                            [460, 0, 290],
                            [240, 290, 0]
                        ]
                    })
                };
            }

            return {
                ok: true,
                json: async () => ({
                    code: 'Ok',
                    waypoints: [
                        { waypoint_index: 0, trips_index: 0 },
                        { waypoint_index: 2, trips_index: 1 },
                        { waypoint_index: 1, trips_index: 2 }
                    ],
                    trips: [{
                        geometry: { type: 'LineString', coordinates: [[-49.07, -22.32], [-49.06, -22.31], [-49.08, -22.33]] },
                        distance: 5000,
                        duration: 600
                    }]
                })
            };
        };

        const resultDistance = await optimizeRoute(mockItems, { roundTrip: false, startIndex: 0, optimizeBy: 'distance' });
        const resultDuration = await optimizeRoute(mockItems, { roundTrip: false, startIndex: 0, optimizeBy: 'duration' });

        const orderDistance = resultDistance.orderedItems.map(i => i.id).join(' -> ');
        const orderDuration = resultDuration.orderedItems.map(i => i.id).join(' -> ');

        console.log(`Ordem (distância): ${orderDistance}`);
        console.log(`Ordem (tempo): ${orderDuration}`);

        if (resultDistance.orderedItems[1].id !== 3) {
            throw new Error('Falha na ordenação por distância.');
        }
        if (resultDuration.orderedItems[1].id !== 3) {
            throw new Error('Falha na ordenação por tempo.');
        }
        if (!resultDistance.baseline || !Number.isFinite(resultDistance.baseline.distance)) {
            throw new Error('Baseline de distância não foi calculada.');
        }
        if (!resultDuration.baseline || !Number.isFinite(resultDuration.baseline.duration)) {
            throw new Error('Baseline de duração não foi calculada.');
        }

        console.log('Teste concluído com sucesso.');

    } catch (err) {
        console.error('Falha no teste:', err.message);
        process.exit(1);
    }
}

// Minimal stub for optimization.js needs
global.Math = Math;
testOptimizer();
