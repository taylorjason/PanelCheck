import { saveRecords, loadRecords, clearRecords } from '../js/storage.js';

QUnit.module('Storage Module', {
    beforeEach: function() {
        localStorage.clear();
    },
    afterEach: function() {
        localStorage.clear();
    }
});

QUnit.test('saveRecords stores observations in localStorage', function(assert) {
    const observations = [
        {
            resourceType: 'Observation',
            id: '1',
            status: 'final',
            effectiveDateTime: '2023-01-01',
            code: { text: 'Lipid Panel - Cholesterol' },
            valueQuantity: { value: 200, unit: 'mg/dL' },
            interpretation: [{ coding: [{ code: 'H' }] }]
        }
    ];

    saveRecords(observations);

    const stored = JSON.parse(localStorage.getItem('bloodwork_observations'));
    assert.deepEqual(stored, observations, 'Observations are stored correctly');
});

QUnit.test('loadRecords returns empty array when no records', function(assert) {
    const records = loadRecords();
    assert.deepEqual(records, [], 'Returns empty array when no records stored');
});

QUnit.test('loadRecords returns stored observations', function(assert) {
    const observations = [
        {
            resourceType: 'Observation',
            id: '1',
            status: 'final',
            effectiveDateTime: '2023-01-01',
            code: { text: 'Lipid Panel - Cholesterol' },
            valueQuantity: { value: 200, unit: 'mg/dL' },
            interpretation: [{ coding: [{ code: 'H' }] }]
        }
    ];

    localStorage.setItem('bloodwork_observations', JSON.stringify(observations));

    const loaded = loadRecords();
    assert.deepEqual(loaded, observations, 'Returns stored observations');
});

QUnit.test('clearRecords removes all observations', function(assert) {
    localStorage.setItem('bloodwork_observations', JSON.stringify([{ id: '1' }]));
    clearRecords();
    assert.equal(localStorage.getItem('bloodwork_observations'), null, 'Observations are cleared from localStorage');
});
