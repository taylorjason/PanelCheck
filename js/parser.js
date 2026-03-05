/**
 * Parse CSV string into bloodwork records
 * @param {string} csv - CSV string with headers: date,panel,marker,value,unit,referenceMin,referenceMax,status,source
 * @returns {Array} Array of normalized bloodwork records
 */
export function parseCSV(csv) {
    if (!csv.trim()) {
        return [];
    }

    const lines = csv.trim().split('\n');
    if (lines.length < 2) {
        return [];
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const expectedHeaders = ['date', 'panel', 'marker', 'value', 'unit', 'referenceMin', 'referenceMax', 'status', 'source'];

    // Check if headers match expected
    if (headers.length !== expectedHeaders.length || !headers.every((h, i) => h === expectedHeaders[i])) {
        throw new Error('Invalid CSV headers');
    }

    const records = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) {
            // Skip malformed rows
            continue;
        }

        const record = {
            id: generateId(),
            date: values[0],
            panel: values[1],
            marker: values[2],
            value: parseFloat(values[3]),
            unit: values[4],
            referenceMin: values[5] === '' ? null : parseFloat(values[5]),
            referenceMax: values[6] === '' ? null : parseFloat(values[6]),
            status: values[7],
            source: values[8]
        };

        // Basic validation
        if (isNaN(record.value) || !record.date || !record.panel || !record.marker) {
            continue; // Skip invalid records
        }

        records.push(record);
    }

    return records;
}

/**
 * Parse JSON string into bloodwork records
 * @param {string} json - JSON string array of records
 * @returns {Array} Array of normalized bloodwork records
 */
export function parseJSON(json) {
    try {
        const data = JSON.parse(json);
        if (!Array.isArray(data)) {
            throw new Error('JSON must be an array of records');
        }

        return data.map(record => {
            // Ensure id exists, generate if not
            if (!record.id) {
                record.id = generateId();
            }
            // Validate required fields
            if (!record.date || !record.panel || !record.marker || typeof record.value !== 'number') {
                throw new Error('Invalid record structure');
            }
            return record;
        });
    } catch (error) {
        throw new Error(`JSON parsing error: ${error.message}`);
    }
}

/**
 * Generate a unique ID for a record
 * @returns {string} Unique ID
 */
function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random();
}
