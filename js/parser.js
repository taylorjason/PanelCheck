/**
 * Parser module for bloodwork data ingestion
 *
 * Supports:
 * - CSV: Normalized format with headers: date,panel,marker,value,unit,referenceMin,referenceMax,status,source
 * - JSON: Flat array of records or FHIR R4 Bundle of Observation resources
 *
 * FHIR R4 Support:
 * - Parses Bundle.entry[].resource (Observation)
 * - Extracts panel/marker from code.text (format: "Panel - Marker")
 * - Maps interpretation codes: H/HH->high, L/LL->low, N->normal
 * - Uses effectiveDateTime, valueQuantity, referenceRange
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
 * @param {string} json - JSON string array of records or FHIR Bundle
 * @returns {Array} Array of normalized bloodwork records
 */
export function parseJSON(json) {
    try {
        const data = JSON.parse(json);

        // Check if it's a FHIR Bundle
        if (data.resourceType === 'Bundle') {
            return parseFHIRBundle(data);
        }

        // Assume it's a flat array of records
        if (!Array.isArray(data)) {
            throw new Error('JSON must be an array of records or a FHIR Bundle');
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
 * Parse FHIR Bundle into bloodwork records
 * @param {Object} bundle - FHIR Bundle object
 * @returns {Array} Array of normalized bloodwork records
 */
function parseFHIRBundle(bundle) {
    if (!bundle.entry || !Array.isArray(bundle.entry)) {
        throw new Error('Invalid FHIR Bundle: missing or invalid entry array');
    }

    const records = [];

    for (const entry of bundle.entry) {
        const resource = entry.resource;
        if (resource.resourceType !== 'Observation') {
            continue; // Skip non-Observation resources
        }

        try {
            const record = convertObservationToRecord(resource);
            records.push(record);
        } catch (error) {
            // Skip invalid observations
            console.warn('Skipping invalid observation:', error.message);
        }
    }

    return records;
}

/**
 * Convert FHIR Observation to internal record format
 * @param {Object} observation - FHIR Observation resource
 * @returns {Object} Normalized record
 */
function convertObservationToRecord(observation) {
    if (observation.status !== 'final' && observation.status !== 'amended') {
        throw new Error('Observation status not final');
    }

    const code = observation.code;
    let panel = 'Laboratory';
    let marker = 'Unknown';

    // Try to extract panel and marker from code.text or display
    const text = code.text || (code.coding && code.coding[0] && code.coding[0].display);
    if (text) {
        const parts = text.split(' - ');
        if (parts.length === 2) {
            panel = parts[0].trim();
            marker = parts[1].trim();
        } else {
            marker = text;
        }
    }

    const valueQuantity = observation.valueQuantity;
    if (!valueQuantity || typeof valueQuantity.value !== 'number') {
        throw new Error('Missing or invalid valueQuantity');
    }

    const referenceRange = observation.referenceRange && observation.referenceRange[0];
    const referenceMin = referenceRange && referenceRange.low ? referenceRange.low.value : null;
    const referenceMax = referenceRange && referenceRange.high ? referenceRange.high.value : null;

    let status = 'unknown';
    const interpretation = observation.interpretation && observation.interpretation[0];
    if (interpretation && interpretation.coding && interpretation.coding[0]) {
        const code = interpretation.coding[0].code;
        if (code === 'H' || code === 'HH') status = 'high';
        else if (code === 'L' || code === 'LL') status = 'low';
        else if (code === 'N') status = 'normal';
    }

    return {
        id: observation.id || generateId(),
        date: observation.effectiveDateTime ? observation.effectiveDateTime.split('T')[0] : '',
        panel: panel,
        marker: marker,
        value: valueQuantity.value,
        unit: valueQuantity.unit || '',
        referenceMin: referenceMin,
        referenceMax: referenceMax,
        status: status,
        source: 'fhir'
    };
}

/**
 * Generate a unique ID for a record
 * @returns {string} Unique ID
 */
function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random();
}
