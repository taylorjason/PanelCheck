import { parseCSV, parseJSON, extractObservationsFromText } from '../js/parser.js';
import { lookupLOINC } from '../js/loinc-map.js';

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

    assert.equal(result.length, 2, 'Parses two observations');

    const firstObs = result[0];
    assert.equal(firstObs.resourceType, 'Observation', 'Creates FHIR Observation');
    assert.equal(firstObs.status, 'final', 'Sets status to final');
    assert.equal(firstObs.effectiveDateTime, '2023-01-01', 'Sets effectiveDateTime');
    assert.equal(firstObs.valueQuantity.value, 200, 'Sets value');
    assert.equal(firstObs.valueQuantity.unit, 'mg/dL', 'Sets unit');
    assert.equal(firstObs.interpretation[0].coding[0].code, 'H', 'Sets interpretation');
});

QUnit.test('parseCSV applies LOINC codes to known markers', function(assert) {
    const csv = `date,panel,marker,value,unit,referenceMin,referenceMax,status,source
2023-01-01,Lipid Panel,Cholesterol,200,mg/dL,0,200,high,test
2023-01-01,CMP,Glucose,95,mg/dL,70,99,normal,test`;

    const result = parseCSV(csv);

    assert.equal(result[0].code.coding[0].code, '2093-3', 'Cholesterol gets correct LOINC code');
    assert.equal(result[0].code.coding[0].display, 'Total Cholesterol', 'Cholesterol gets canonical display name');
    assert.equal(result[1].code.coding[0].code, '2345-7', 'Glucose gets correct LOINC code');
});

QUnit.test('parseCSV uses UNK LOINC code for unknown markers', function(assert) {
    const csv = `date,panel,marker,value,unit,referenceMin,referenceMax,status,source
2023-01-01,Custom Panel,Mystery Marker,42,units,0,100,normal,test`;

    const result = parseCSV(csv);

    assert.equal(result[0].code.coding[0].code, 'UNK', 'Unknown marker gets UNK LOINC code');
    assert.equal(result[0].code.coding[0].display, 'Mystery Marker', 'Unknown marker preserves original display name');
});

QUnit.test('parseCSV handles malformed rows', function(assert) {
    const csv = `date,panel,marker,value,unit,referenceMin,referenceMax,status,source
2023-01-01,Lipid Panel,Cholesterol,200,mg/dL,0,200,high,test
invalid,row,with,fewer,fields
2023-01-02,Complete Blood Count,White Blood Cells,7.5,10^9/L,4,11,normal,test`;

    const result = parseCSV(csv);
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
    assert.equal(result.length, 1, 'Parses one observation');
    assert.equal(result[0].resourceType, 'Observation', 'Converts to FHIR Observation');
    assert.equal(result[0].effectiveDateTime, '2023-01-01', 'Sets date');
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
    const obs = result[0];
    assert.equal(obs.resourceType, 'Observation', 'Returns FHIR Observation');
    assert.equal(obs.id, 'chol-1', 'Preserves ID');
    assert.equal(obs.effectiveDateTime, '2023-01-01', 'Preserves date');
    assert.equal(obs.valueQuantity.value, 200, 'Preserves value');
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

// ── PDF text extraction tests ─────────────────────────────────────────────────

QUnit.module('PDF Text Extraction');

QUnit.test('extractObservationsFromText parses space-separated lab line with ref range', function(assert) {
    const text = `
Patient: John Doe
Date: 2024-01-15

Glucose        95        mg/dL       70-99
Cholesterol    185       mg/dL       0-200
TSH            2.45      uIU/mL      0.45-4.50
`;
    const result = extractObservationsFromText(text);

    assert.ok(result.length >= 3, 'Extracts at least 3 observations');

    const glucose = result.find(o => o.code.coding[0].display === 'Glucose');
    assert.ok(glucose, 'Finds Glucose');
    assert.equal(glucose.valueQuantity.value, 95, 'Correct Glucose value');
    assert.equal(glucose.valueQuantity.unit, 'mg/dL', 'Correct Glucose unit');
    assert.equal(glucose.code.coding[0].code, '2345-7', 'Correct LOINC code for Glucose');
    assert.equal(glucose.effectiveDateTime, '2024-01-15', 'Extracts date from text');
    assert.deepEqual(glucose.referenceRange[0], { low: { value: 70, unit: 'mg/dL' }, high: { value: 99, unit: 'mg/dL' } }, 'Extracts reference range');
    assert.equal(glucose.interpretation[0].coding[0].code, 'N', 'Derives normal status from ref range');
});

QUnit.test('extractObservationsFromText marks high/low values correctly', function(assert) {
    const text = `
Date: 2024-03-01
Cholesterol    250       mg/dL       0-200
Glucose        55        mg/dL       70-99
`;
    const result = extractObservationsFromText(text);

    const chol = result.find(o => o.code.coding[0].display === 'Total Cholesterol');
    assert.ok(chol, 'Finds Cholesterol');
    assert.equal(chol.interpretation[0].coding[0].code, 'H', 'High cholesterol flagged as H');

    const glucose = result.find(o => o.code.coding[0].display === 'Glucose');
    assert.ok(glucose, 'Finds Glucose');
    assert.equal(glucose.interpretation[0].coding[0].code, 'L', 'Low glucose flagged as L');
});

QUnit.test('extractObservationsFromText handles line without ref range', function(assert) {
    const text = `
Date: 2024-03-01
TSH    2.45    uIU/mL
`;
    const result = extractObservationsFromText(text);

    assert.equal(result.length, 1, 'Parses one observation');
    assert.equal(result[0].referenceRange.length, 0, 'No reference range');
    assert.equal(result[0].interpretation[0].coding[0].code, 'UNK', 'Status unknown without ref range');
});

QUnit.test('extractObservationsFromText skips lines with no date available', function(assert) {
    // No date anywhere in the text — observations with no date should be skipped
    const text = 'Glucose  95  mg/dL  70-99';
    const result = extractObservationsFromText(text);
    assert.equal(result.length, 0, 'Skips observations when no date can be found');
});

QUnit.test('extractObservationsFromText infers panels from markers', function(assert) {
    const text = `
Date: 2024-01-15
WBC            6.5       10^9/L      4-11
Cholesterol    185       mg/dL       0-200
TSH            2.45      uIU/mL      0.45-4.50
`;
    const result = extractObservationsFromText(text);

    const wbc = result.find(o => o.code.coding[0].display === 'WBC');
    assert.ok(wbc, 'Finds WBC');
    assert.equal(wbc.code.text.split(' - ')[0], 'CBC', 'WBC inferred to CBC panel');

    const chol = result.find(o => o.code.coding[0].display === 'Total Cholesterol');
    assert.ok(chol, 'Finds Cholesterol');
    assert.equal(chol.code.text.split(' - ')[0], 'Lipid Panel', 'Cholesterol inferred to Lipid Panel');
});

QUnit.test('extractObservationsFromText parses US date format', function(assert) {
    const text = `
Collected: 03/15/2024
Glucose    95    mg/dL    70-99
`;
    const result = extractObservationsFromText(text);
    assert.equal(result.length, 1, 'Parses one observation');
    assert.equal(result[0].effectiveDateTime, '2024-03-15', 'US date format converted to ISO');
});

QUnit.test('extractObservationsFromText parses written date format', function(assert) {
    const text = `
Date of Service: January 15, 2024
Glucose    95    mg/dL    70-99
`;
    const result = extractObservationsFromText(text);
    assert.equal(result.length, 1, 'Parses one observation');
    assert.equal(result[0].effectiveDateTime, '2024-01-15', 'Written date converted to ISO');
});

QUnit.test('extractObservationsFromText returns valid FHIR Observation structure', function(assert) {
    const text = `
Date: 2024-01-15
Glucose    95    mg/dL    70-99
`;
    const result = extractObservationsFromText(text);
    assert.equal(result.length, 1, 'Parses one observation');

    const obs = result[0];
    assert.equal(obs.resourceType, 'Observation', 'resourceType is Observation');
    assert.equal(obs.status, 'final', 'status is final');
    assert.ok(obs.id, 'id is present');
    assert.ok(obs.category, 'category is present');
    assert.equal(obs.category[0].coding[0].code, 'laboratory', 'category is laboratory');
    assert.ok(obs.code, 'code is present');
    assert.ok(obs.effectiveDateTime, 'effectiveDateTime is present');
    assert.ok(obs.valueQuantity, 'valueQuantity is present');
    assert.ok(obs.interpretation, 'interpretation is present');
});

// ── LOINC mapping tests ───────────────────────────────────────────────────────

QUnit.module('LOINC Mapping');

QUnit.test('lookupLOINC finds exact matches', function(assert) {
    assert.equal(lookupLOINC('Glucose').code, '2345-7', 'Glucose');
    assert.equal(lookupLOINC('TSH').code, '3016-3', 'TSH');
    assert.equal(lookupLOINC('HbA1c').code, '4548-4', 'HbA1c');
    assert.equal(lookupLOINC('HDL').code, '2085-9', 'HDL');
    assert.equal(lookupLOINC('LDL').code, '13457-7', 'LDL');
});

QUnit.test('lookupLOINC is case-insensitive', function(assert) {
    assert.equal(lookupLOINC('glucose').code, lookupLOINC('GLUCOSE').code, 'glucose === GLUCOSE');
    assert.equal(lookupLOINC('tsh').code, lookupLOINC('TSH').code, 'tsh === TSH');
});

QUnit.test('lookupLOINC handles alternate names', function(assert) {
    assert.equal(lookupLOINC('Hemoglobin A1c').code, '4548-4', 'Hemoglobin A1c → HbA1c code');
    assert.equal(lookupLOINC('Blood Urea Nitrogen').code, '3094-0', 'Blood Urea Nitrogen → BUN code');
    assert.equal(lookupLOINC('ALT').code, lookupLOINC('Alanine Aminotransferase').code, 'ALT aliases match');
});

QUnit.test('lookupLOINC returns UNK for unknown markers', function(assert) {
    const result = lookupLOINC('Completely Unknown Marker XYZ');
    assert.equal(result.code, 'UNK', 'Unknown marker gets UNK code');
    assert.equal(result.display, 'Completely Unknown Marker XYZ', 'Unknown marker preserves original name');
});

QUnit.test('lookupLOINC trims whitespace', function(assert) {
    assert.equal(lookupLOINC('  Glucose  ').code, '2345-7', 'Trims leading/trailing whitespace');
});
