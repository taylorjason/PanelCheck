/**
 * Parser module for bloodwork data ingestion
 *
 * Data Model: FHIR R4 Observation resources
 * All parsers output standardized FHIR Observation objects
 *
 * Supports:
 * - CSV: Converts to FHIR Observations
 * - JSON: Flat arrays converted to FHIR, or FHIR Bundles used directly
 *
 * FHIR Observation structure:
 * - resourceType: "Observation"
 * - id: unique identifier
 * - status: "final"
 * - category: laboratory
 * - code: LOINC coding with display
 * - effectiveDateTime: test date
 * - valueQuantity: result value and unit
 * - referenceRange: normal ranges
 * - interpretation: result status
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

    const observations = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) {
            // Skip malformed rows
            continue;
        }

        try {
            const flatRecord = {
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
            if (isNaN(flatRecord.value) || !flatRecord.date || !flatRecord.panel || !flatRecord.marker) {
                continue; // Skip invalid records
            }

            const observation = convertFlatRecordToObservation(flatRecord);
            observations.push(observation);
        } catch (error) {
            // Skip invalid records
            continue;
        }
    }

    return observations;
}

/**
 * Parse JSON string into FHIR Observations
 * @param {string} json - JSON string array of flat records or FHIR Bundle
 * @returns {Array} Array of FHIR Observation resources
 */
export function parseJSON(json) {
    try {
        const data = JSON.parse(json);

        // Check if it's a FHIR Bundle
        if (data.resourceType === 'Bundle') {
            return parseFHIRBundle(data);
        }

        // Assume it's a flat array of records, convert to FHIR
        if (!Array.isArray(data)) {
            throw new Error('JSON must be an array of records or a FHIR Bundle');
        }

        return data.map(record => {
            // Validate required fields
            if (!record.date || !record.panel || !record.marker || typeof record.value !== 'number') {
                throw new Error('Invalid record structure');
            }
            return convertFlatRecordToObservation(record);
        });
    } catch (error) {
        throw new Error(`JSON parsing error: ${error.message}`);
    }
}

/**
 * Parse FHIR Bundle into FHIR Observations
 * @param {Object} bundle - FHIR Bundle object
 * @returns {Array} Array of FHIR Observation resources
 */
function parseFHIRBundle(bundle) {
    if (!bundle.entry || !Array.isArray(bundle.entry)) {
        throw new Error('Invalid FHIR Bundle: missing or invalid entry array');
    }

    const observations = [];

    for (const entry of bundle.entry) {
        const resource = entry.resource;
        if (resource.resourceType !== 'Observation') {
            continue; // Skip non-Observation resources
        }

        // Ensure it has required fields
        if (!resource.id) {
            resource.id = generateId();
        }
        if (resource.status !== 'final' && resource.status !== 'amended') {
            continue; // Skip non-final observations
        }

        // Validate required fields
        if (!resource.effectiveDateTime || !resource.valueQuantity || !resource.code) {
            continue; // Skip invalid observations
        }

        observations.push(resource);
    }

    if (observations.length === 0) {
        // No valid observations found -> invalid FHIR bundle
        throw new Error('Invalid FHIR Bundle');
    }

    return observations;
}

/**
 * Convert flat record to FHIR Observation
 * @param {Object} record - Flat record object
 * @returns {Object} FHIR Observation resource
 */
function convertFlatRecordToObservation(record) {
    const interpretationCode = {
        'high': 'H',
        'low': 'L',
        'normal': 'N',
        'unknown': 'UNK'
    }[record.status] || 'UNK';

    return {
        resourceType: 'Observation',
        id: record.id || generateId(),
        status: 'final',
        category: [{
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'laboratory',
                display: 'Laboratory'
            }]
        }],
        code: {
            coding: [{
                system: 'http://loinc.org',
                code: 'UNK', // Would need mapping to actual LOINC codes
                display: record.marker
            }],
            text: `${record.panel} - ${record.marker}`
        },
        subject: {
            reference: 'Patient/example' // Placeholder
        },
        effectiveDateTime: record.date,
        valueQuantity: {
            value: record.value,
            unit: record.unit,
            system: 'http://unitsofmeasure.org'
        },
        referenceRange: record.referenceMin !== null && record.referenceMax !== null ? [{
            low: {
                value: record.referenceMin,
                unit: record.unit
            },
            high: {
                value: record.referenceMax,
                unit: record.unit
            }
        }] : [],
        interpretation: [{
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                code: interpretationCode,
                display: record.status
            }]
        }],
        // Add source as extension
        extension: [{
            url: 'http://example.org/source',
            valueString: record.source
        }]
    };
}

/**
 * Generate a unique ID for a record
 * @returns {string} Unique ID
 */
let idCounter = 0;
function generateId() {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback: use timestamp + counter for uniqueness
    return 'id-' + Date.now() + '-' + (idCounter++);
}
