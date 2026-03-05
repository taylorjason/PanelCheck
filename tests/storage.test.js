import { saveRecords, loadRecords, clearRecords } from '../js/storage.js';

QUnit.module('Storage Module', {
    beforeEach: function() {
        // Clear localStorage before each test
        localStorage.clear();
    },
    afterEach: function() {
        // Clean up after each test
        localStorage.clear();
    }
});

QUnit.test('saveRecords stores records in localStorage', function(assert) {
    const records = [
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
    ];

    saveRecords(records);

    const stored = JSON.parse(localStorage.getItem('bloodwork_records'));
    assert.deepEqual(stored, records, 'Records are stored correctly');
});

QUnit.test('loadRecords returns empty array when no records', function(assert) {
    const records = loadRecords();
    assert.deepEqual(records, [], 'Returns empty array when no records stored');
});

QUnit.test('loadRecords returns stored records', function(assert) {
    const records = [
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
    ];

    localStorage.setItem('bloodwork_records', JSON.stringify(records));

    const loaded = loadRecords();
    assert.deepEqual(loaded, records, 'Returns stored records');
});

QUnit.test('clearRecords removes all records', function(assert) {
    const records = [
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
    ];

    localStorage.setItem('bloodwork_records', JSON.stringify(records));
    clearRecords();

    const stored = localStorage.getItem('bloodwork_records');
    assert.equal(stored, null, 'Records are cleared from localStorage');
});
