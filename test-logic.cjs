// Automated Test Script for RotaMestra Logic
const { optimizeRoute } = require('./src/utils/optimizer.js');

// Mock data: Points in Bauru
const mockItems = [
    { id: 1, address: 'Rua A', coords: { lat: -22.32, lon: -49.07 } },
    { id: 2, address: 'Rua B', coords: { lat: -22.33, lon: -49.08 } },
    { id: 3, address: 'Rua C', coords: { lat: -22.31, lon: -49.06 } }
];

async function testOptimizer() {
    console.log('🧪 Iniciando Teste de Lógica do Otimizador...');

    try {
        // We Mock the fetch for OSRM
        global.fetch = async (url) => {
            console.log(`🔗 Mocking API: ${url}`);
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

        const result = await optimizeRoute(mockItems, { roundTrip: false, startIndex: 0 });

        console.log('✅ Teste de Ordenação Concluído!');
        console.log(`Ordem esperada: 1 -> 3 -> 2`);
        console.log(`Ordem obtida: ${result.orderedItems.map(i => i.id).join(' -> ')}`);

        if (result.orderedItems[1].id === 3) {
            console.log('🌟 SUCESSO: Algoritmo de roteamento está integrando corretamente com a lógica OSRM!');
        } else {
            throw new Error('Falha na ordenação dos pontos.');
        }

    } catch (err) {
        console.error('❌ FALHA NO TESTE:', err.message);
        process.exit(1);
    }
}

// Minimal stub for optimization.js needs
global.Math = Math;
testOptimizer();
