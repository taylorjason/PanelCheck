import { parseCSV } from '../js/parser.js';

QUnit.module('Parser Module');

QUnit.test('parseCSV handles empty input', function(assert) {
    const result = parseCSV('');
    assert.deepEqual(result, [], 'Empty input returns empty array');
});

QUnit.test('parseCSV parses valid CSV', function(assert) {
    const csv = `date,panel,marker,value,unit,referenceMin,referenceMax,status,source
2023-01-01,Lipid Panel,Cholesterol,200,mg/dL,0,200,high,test
2023-01-02,Complete Blood Count,White Blood Cells,7.5,10^9/L,4,11,normal,test`;

    const result = parseCSV(csv);

    assert.equal(result.length, 2, 'Parses two records');

    const firstRecord = result[0];
    assert.equal(typeof firstRecord.id, 'string', 'Generates id');
    assert.equal(firstRecord.date, '2023-01-01', 'Parses date');
    assert.equal(firstRecord.panel, 'Lipid Panel', 'Parses panel');
    assert.equal(firstRecord.marker, 'Cholesterol', 'Parses marker');
    assert.equal(firstRecord.value, 200, 'Parses value as number');
    assert.equal(firstRecord.unit, 'mg/dL', 'Parses unit');
    assert.equal(firstRecord.referenceMin, 0, 'Parses referenceMin');
    assert.equal(firstRecord.referenceMax, 200, 'Parses referenceMax');
    assert.equal(firstRecord.status, 'high', 'Parses status');
    assert.equal(firstRecord.source, 'test', 'Parses source');
});

QUnit.test('parseCSV handles malformed rows', function(assert) {
    const csv = `date,panel,marker,value,unit,referenceMin,referenceMax,status,source
2023-01-01,Lipid Panel,Cholesterol,200,mg/dL,0,200,high,test
invalid,row,with,fewer,fields
2023-01-02,Complete Blood Count,White Blood Cells,7.5,10^9/L,4,11,normal,test`;

    const result = parseCSV(csv);

    // Should skip the malformed row and parse the valid ones
    assert.equal(result.length, 2, 'Skips malformed row and parses valid ones');
});
