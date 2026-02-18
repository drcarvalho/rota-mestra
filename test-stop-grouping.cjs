const assert = require('node:assert/strict');

const run = async () => {
    const { buildStopGroups } = await import('./src/utils/stopGrouping.js');

    const route = [
        { id: 'start', address: 'Base, Centro, Bauru, SP, Brasil', coords: { lat: -22.315, lon: -49.06 } },
        { id: 'a', address: 'Rua A, N 5-12, Bauru, SP, Brasil', coords: { lat: -22.316, lon: -49.061 } },
        { id: 'b', address: 'Rua A, N 512, Bauru, SP, Brasil', coords: { lat: -22.3161, lon: -49.0611 } },
        { id: 'c', address: 'Rua A, N 5/18, Bauru, SP, Brasil', coords: { lat: -22.3162, lon: -49.0612 } },
        { id: 'd', address: 'Rua A, N 5-22, Apto 3, Bauru, SP, Brasil', coords: { lat: -22.3163, lon: -49.0613 } },
        { id: 'e', address: 'Rua B, N 8-10, Bauru, SP, Brasil', coords: { lat: -22.319, lon: -49.065 } }
    ];

    const grouped = buildStopGroups(route);
    assert.equal(grouped.length, 2, 'deve agrupar a mesma quadra em uma única parada');
    assert.equal(grouped[0].items.length, 4, 'parada 1 deve conter 4 pacotes');
    assert.equal(grouped[0].stopOrder, 1, 'parada 1 deve manter ordem');
    assert.equal(grouped[1].stopOrder, 2, 'parada 2 deve manter ordem');

    const geoFallbackRoute = [
        { id: 'start', address: 'Base', coords: { lat: -22.31, lon: -49.05 } },
        { id: 'p1', address: 'Condominio Sem Numero, Bauru, SP', coords: { lat: -22.32011, lon: -49.07011 } },
        { id: 'p2', address: 'Condominio Sem Numero, Bauru, SP', coords: { lat: -22.32019, lon: -49.07019 } },
        { id: 'p3', address: 'Condominio Sem Numero, Bauru, SP', coords: { lat: -22.3308, lon: -49.08 } }
    ];
    const geoGrouped = buildStopGroups(geoFallbackRoute);
    assert.equal(geoGrouped.length, 2, 'fallback por proximidade deve agrupar pontos muito próximos');
    assert.equal(geoGrouped[0].items.length, 2, 'primeira célula geográfica deve conter 2 pacotes');

    const orderedRoute = [
        { id: 'start', address: 'Base' },
        { id: 'x1', address: 'Rua X, N 9-11, Bauru, SP, Brasil' },
        { id: 'y1', address: 'Rua Y, N 4-10, Bauru, SP, Brasil' },
        { id: 'x2', address: 'Rua X, N 9-15, Bauru, SP, Brasil' }
    ];
    const orderedGroups = buildStopGroups(orderedRoute);
    assert.equal(orderedGroups[0].stopOrder, 1);
    assert.equal(orderedGroups[0].items[0].id, 'x1', 'ordem da parada deve seguir primeira ocorrência na rota');
    assert.equal(orderedGroups[1].stopOrder, 2);

    console.log('ok - stop grouping');
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
