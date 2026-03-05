import { parseCSV, parseJSON } from '../js/parser.js';

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

QUnit.test('parseJSON parses flat JSON array', function(assert) {
    const json = JSON.stringify([
        {
            id: '1',
            date: '2023-01-01',
            panel: 'Lipid Panel',
            marker: 'Cholesterol',
            value: 200,
            unit: 'mg/dL',
            referenceMin: 0,
            referenceMax: 200,
            status: 'high',
            source: 'test'
        }
    ]);

    const result = parseJSON(json);
    assert.equal(result.length, 1, 'Parses one record');
    assert.equal(result[0].date, '2023-01-01', 'Parses date');
});

QUnit.test('parseJSON parses FHIR Bundle', function(assert) {
    const fhirBundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
            {
                resource: {
                    resourceType: 'Observation',
                    id: 'chol-1',
                    status: 'final',
                    category: [{
                        coding: [{
                            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                            code: 'laboratory'
                        }]
                    }],
                    code: {
                        coding: [{
                            system: 'http://loinc.org',
                            code: '2093-3',
                            display: 'Cholesterol'
                        }],
                        text: 'Lipid Panel - Cholesterol'
                    },
                    subject: { reference: 'Patient/example' },
                    effectiveDateTime: '2023-01-01',
                    valueQuantity: {
                        value: 200,
                        unit: 'mg/dL',
                        system: 'http://unitsofmeasure.org'
                    },
                    referenceRange: [{
                        low: { value: 0, unit: 'mg/dL' },
                        high: { value: 200, unit: 'mg/dL' }
                    }],
                    interpretation: [{
                        coding: [{
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                            code: 'H'
                        }]
                    }]
                }
            }
        ]
    };

    const result = parseJSON(JSON.stringify(fhirBundle));
    assert.equal(result.length, 1, 'Parses one observation');
    const record = result[0];
    assert.equal(record.date, '2023-01-01', 'Extracts date');
    assert.equal(record.marker, 'Cholesterol', 'Extracts marker from display');
    assert.equal(record.value, 200, 'Extracts value');
    assert.equal(record.unit, 'mg/dL', 'Extracts unit');
    assert.equal(record.status, 'high', 'Maps interpretation to status');
    assert.equal(record.panel, 'Lipid Panel', 'Extracts panel from text');
});

QUnit.test('parseJSON handles invalid FHIR', function(assert) {
    const invalidFhir = {
        resourceType: 'Bundle',
        entry: [
            {
                resource: {
                    resourceType: 'Observation',
                    // Missing required fields
                }
            }
        ]
    };

    assert.throws(() => parseJSON(JSON.stringify(invalidFhir)), /Invalid FHIR/, 'Throws for invalid FHIR');
});
