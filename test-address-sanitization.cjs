const assert = require('node:assert/strict');

const run = async () => {
    const { sanitizeAddressSegment, buildSanitizedAddress } = await import('./src/utils/fileParser.js');

    assert.equal(
        sanitizeAddressSegment('  r. das flores ; n 512  '),
        'Rua das Flores, N 512'
    );

    assert.equal(
        sanitizeAddressSegment('av brasil | n 5/12, apto 4'),
        'Avenida Brasil, N 5-12, Apto 4'
    );

    assert.equal(
        sanitizeAddressSegment('rod br153 km 10 s/n'),
        'Rodovia BR-153 Km 10 S/N'
    );

    assert.equal(
        sanitizeAddressSegment('alameda pascal, quadra11 e 78, casa'),
        'Alameda Pascal, Quadra 11, N 11-78, Casa'
    );

    assert.equal(
        sanitizeAddressSegment('quadra 1, n 137'),
        'Quadra 1, N 1-37'
    );

    assert.equal(
        sanitizeAddressSegment('rua x, 17066-520, brasil'),
        'Rua X, 17066-520, Brasil'
    );

    assert.equal(
        buildSanitizedAddress({
            fullAddress: 'r. a, n 5/12',
            city: 'bauru',
            state: 'sp',
            zip: '17000000'
        }),
        'Rua A, N 5-12, Bauru, SP, 17000-000, Brasil'
    );

    assert.equal(
        buildSanitizedAddress({
            fullAddress: 'rua b, n 5-12, bauru',
            city: 'bauru',
            state: 'sp',
            zip: '17000-000'
        }),
        'Rua B, N 5-12, Bauru, SP, 17000-000, Brasil'
    );

    assert.equal(
        buildSanitizedAddress({
            fullAddress: 'Rua Ernesto Gomes da Silva, 1-81',
            city: 'Bauru',
            state: 'Ruaernestogomesdasilva',
            zip: '17066-520'
        }),
        'Rua Ernesto Gomes da Silva, 1-81, Bauru, 17066-520, Brasil'
    );

    console.log('ok - address sanitization');
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
