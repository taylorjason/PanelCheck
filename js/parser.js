/**
 * Parser module for bloodwork data ingestion
 *
 * All parsers output FHIR R4 Observation resources.
 *
 * Adapter interface:
 *   adapter.name    {string}   - human-readable name for error messages
 *   adapter.detect  {Function} - (file: File) => boolean
 *   adapter.parse   {Function} - (content: string|ArrayBuffer) => Observation[]
 *
 * Public API:
 *   parseFile(file, content) → Observation[]
 *   parseCSV(csv)            → Observation[]  (kept for tests / direct use)
 *   parseJSON(json)          → Observation[]  (kept for tests / direct use)
 *   mapMarkerToPanel(marker) → string
 */

import { lookupLOINC } from './loinc-map.js';

// ─── Adapter registry ────────────────────────────────────────────────────────

const adapters = [];

function registerAdapter(adapter) {
    adapters.push(adapter);
}

/**
 * Dispatch a file to the first adapter that claims it.
 * @param {File}               file    - the File object from the input element
 * @param {string|ArrayBuffer} content - pre-read file content
 * @returns {Object[]} Array of FHIR Observation resources
 */
export async function parseFile(file, content) {
    for (const adapter of adapters) {
        if (adapter.detect(file)) {
            return adapter.parse(content);
        }
    }
    throw new Error(`Unsupported file type: ${file.name}`);
}

// ─── CSV adapter ─────────────────────────────────────────────────────────────

registerAdapter({
    name: 'CSV',
    detect: (file) => file.name.toLowerCase().endsWith('.csv'),
    parse: (content) => parseCSV(content),
});

/**
 * Parse canonical CSV into FHIR Observations.
 * Expected headers: date,panel,marker,value,unit,referenceMin,referenceMax,status,source
 * @param {string} csv
 * @returns {Object[]} Array of FHIR Observation resources
 */
export function parseCSV(csv) {
    if (!csv.trim()) return [];

    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const expected = ['date', 'panel', 'marker', 'value', 'unit', 'referenceMin', 'referenceMax', 'status', 'source'];
    if (headers.length !== expected.length || !headers.every((h, i) => h === expected[i])) {
        throw new Error('Invalid CSV headers');
    }

    const observations = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) continue;

        try {
            const flat = {
                date: values[0],
                panel: values[1],
                marker: values[2],
                value: parseFloat(values[3]),
                unit: values[4],
                referenceMin: values[5] === '' ? null : parseFloat(values[5]),
                referenceMax: values[6] === '' ? null : parseFloat(values[6]),
                status: values[7],
                source: values[8],
            };
            if (isNaN(flat.value) || !flat.date || !flat.panel || !flat.marker) continue;
            observations.push(flatToObservation(flat));
        } catch (err) {
            console.error('Error parsing CSV row', i, ':', err);
        }
    }
    return observations;
}

// ─── FHIR JSON adapter ───────────────────────────────────────────────────────

registerAdapter({
    name: 'FHIR JSON',
    detect: (file) => file.name.toLowerCase().endsWith('.json'),
    parse: (content) => parseJSON(content),
});

/**
 * Parse JSON (flat array or FHIR Bundle) into FHIR Observations.
 * @param {string} json
 * @returns {Object[]} Array of FHIR Observation resources
 */
export function parseJSON(json) {
    let data;
    try {
        data = JSON.parse(json);
    } catch (err) {
        throw new Error(`JSON parsing error: ${err.message}`);
    }

    if (data.resourceType === 'Bundle') {
        return parseFHIRBundle(data);
    }

    if (!Array.isArray(data)) {
        throw new Error('JSON must be an array of records or a FHIR Bundle');
    }

    return data.map(record => {
        if (!record.date || !record.panel || !record.marker || typeof record.value !== 'number') {
            throw new Error('Invalid record structure');
        }
        return flatToObservation(record);
    });
}

function parseFHIRBundle(bundle) {
    if (!bundle.entry || !Array.isArray(bundle.entry)) {
        throw new Error('Invalid FHIR Bundle: missing or invalid entry array');
    }

    const observations = [];
    const seenIds = new Set();

    for (const entry of bundle.entry) {
        const resource = entry.resource;
        if (resource.resourceType !== 'Observation') continue;

        // Ensure unique ID
        if (!resource.id) {
            resource.id = generateId();
        } else if (seenIds.has(resource.id)) {
            console.warn('Duplicate ID detected:', resource.id, '— generating new ID');
            resource.id = generateId();
        }
        seenIds.add(resource.id);

        if (resource.status !== 'final' && resource.status !== 'amended') continue;
        if (!resource.effectiveDateTime || !resource.valueQuantity || !resource.code) continue;

        // Extract marker name and assign a logical panel
        let marker = '';
        if (resource.code.text) {
            marker = resource.code.text;
        } else if (resource.code.coding && resource.code.coding[0]) {
            marker = resource.code.coding[0].display || '';
        }
        const panel = mapMarkerToPanel(marker);
        resource.code.text = `${panel} - ${marker}`;

        observations.push(resource);
    }

    if (observations.length === 0) {
        throw new Error('Invalid FHIR Bundle');
    }
    return observations;
}

// ─── PDF adapter ─────────────────────────────────────────────────────────────

registerAdapter({
    name: 'PDF',
    detect: (file) => file.name.toLowerCase().endsWith('.pdf'),
    parse: (content) => parsePDF(content),
});

/**
 * Parse a PDF ArrayBuffer into FHIR Observations using PDF.js text extraction.
 * Falls back gracefully: returns whatever observations can be extracted.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<Object[]>} Promise resolving to FHIR Observation resources
 */
export async function parsePDF(buffer) {
    if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js is not loaded');
    }

    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;

    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }

    return extractObservationsFromText(fullText);
}

/**
 * Heuristic extraction of lab values from raw PDF text.
 *
 * Handles common lab report layouts:
 *   "Glucose        95        mg/dL       70-99"
 *   "Glucose 95 mg/dL (70-99)"
 *   "GLUCOSE: 95 mg/dL  Ref: 70-99  Status: Normal"
 *   "TSH 2.45 uIU/mL 0.45-4.50"
 *
 * @param {string} text - raw text from all PDF pages
 * @returns {Object[]} Array of FHIR Observation resources
 */
export function extractObservationsFromText(text) {
    const observations = [];
    const lines = text.split('\n');

    // Try to find a date in the document (used for all observations if no per-row date)
    const docDate = extractDateFromText(text);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const result = parseLabLine(trimmed);
        if (!result) continue;

        const date = result.date || docDate;
        if (!date) continue; // Skip if we can't associate a date

        const loinc = lookupLOINC(result.marker);
        const status = deriveStatus(result.value, result.refMin, result.refMax);

        observations.push(buildObservation({
            id: generateId(),
            date,
            panel: result.panel || mapMarkerToPanel(result.marker),
            marker: loinc.display,
            loincCode: loinc.code,
            value: result.value,
            unit: result.unit,
            refMin: result.refMin,
            refMax: result.refMax,
            status,
            source: 'PDF',
        }));
    }

    return observations;
}

/**
 * Attempt to parse a single line as a lab result row.
 * Returns null if the line doesn't look like a lab result.
 *
 * Patterns matched:
 *   1. "MarkerName  123.4  unit  (refMin-refMax)"
 *   2. "MarkerName  123.4  unit  refMin-refMax"
 *   3. "MarkerName: 123.4 unit"
 */
function parseLabLine(line) {
    const normalized = line.replace(/[*†‡]/g, '').trim();

    // Handles: "Glucose  95  mg/dL  70-99" or "Glucose  95  mg/dL  (70-99)"
    const MAIN = /^([A-Za-z][A-Za-z0-9 /()%._-]{1,50?}?)\s{2,}(\d+\.?\d*)\s+([\w/%]+)\s+\(?([\d.]+)[-–]([\d.]+)\)?/;
    let m = normalized.match(MAIN);
    if (m) {
        return {
            marker: m[1].trim(),
            value: parseFloat(m[2]),
            unit: m[3].trim(),
            refMin: parseFloat(m[4]),
            refMax: parseFloat(m[5]),
        };
    }

    // No ref range: "Glucose  95  mg/dL"
    const NO_REF = /^([A-Za-z][A-Za-z0-9 /()%._-]{1,50?}?)\s{2,}(\d+\.?\d*)\s+([\w/%]+)/;
    m = normalized.match(NO_REF);
    if (m) {
        return {
            marker: m[1].trim(),
            value: parseFloat(m[2]),
            unit: m[3].trim(),
            refMin: null,
            refMax: null,
        };
    }

    // Colon-separated: "Glucose: 95 mg/dL"
    const COLON = /^([A-Za-z][A-Za-z0-9 /()%._-]{1,50?}):\s*(\d+\.?\d*)\s*([\w/%]*)/;
    m = normalized.match(COLON);
    if (m && m[2]) {
        return {
            marker: m[1].trim(),
            value: parseFloat(m[2]),
            unit: m[3].trim() || '',
            refMin: null,
            refMax: null,
        };
    }

    return null;
}

/**
 * Extract the most likely collection date from PDF text.
 * Looks for ISO, US (MM/DD/YYYY), and written (Jan 15, 2024) formats.
 */
function extractDateFromText(text) {
    let m = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (m) return m[1];

    m = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (m) {
        const [, month, day, year] = m;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
                     jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
    m = text.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/);
    if (m) {
        const monthNum = MONTHS[m[1].toLowerCase().slice(0, 3)];
        if (monthNum) {
            return `${m[3]}-${String(monthNum).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
        }
    }

    return null;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Map a marker name to a logical panel name.
 * Used by FHIR bundle parsing, CSV/JSON ingestion, and PDF extraction.
 * @param {string} marker
 * @returns {string} Panel name
 */
export function mapMarkerToPanel(marker) {
    const lower = marker.toLowerCase();

    // Lipid Panel
    if (lower.includes('hdl') || lower.includes('ldl') || lower.startsWith('chol') ||
        lower.includes('cholesterol') || lower.includes('triglyceride') || lower.includes('vldl')) {
        return 'Lipid Panel';
    }

    // CBC
    if (['wbc', 'rbc', 'hemoglobin', 'hgb', 'hematocrit', 'hct', 'mcv', 'mch', 'mchc',
         'platelets', 'plt', 'rdw', 'neutrophils', 'lymphocytes', 'monocytes',
         'eosinophils', 'basophils'].some(k => lower.includes(k))) {
        return 'CBC';
    }

    // Kidney Function
    if (lower.includes('egfr') || lower.includes('creatinine') || lower.includes('bun') ||
        lower.includes('urea nitrogen') || lower.includes('bun/creat')) {
        return 'Kidney Function';
    }

    // Liver Function
    if (lower.includes('alt') || lower.includes('ast') || lower.includes('bilirubin') ||
        lower.includes('alk phos') || lower.includes('alkaline phosphatase') || lower.includes('ggt')) {
        return 'Liver Function';
    }

    // Metabolic Panel / Electrolytes
    if (['glucose', 'sodium', 'potassium', 'chloride', 'co2', 'bicarbonate', 'calcium',
         'albumin', 'protein', 'agap', 'anion gap'].some(k => lower.includes(k))) {
        return 'Metabolic Panel';
    }

    // Thyroid
    if (['tsh', 'thyrotropin', 'thyroxine', 't3', 't4', 'free t'].some(k => lower.includes(k))) {
        return 'Thyroid';
    }

    // Glucose Control / Diabetes
    if (lower.includes('hba1c') || lower.includes('hemoglobin a1c') || lower.includes('a1c') ||
        lower.includes('insulin') || lower.includes('avg glucose')) {
        return 'Glucose Control';
    }

    // Vitamins & Minerals
    if (['vitamin', 'ferritin', 'iron', 'folate', 'b12', 'cobalamin', 'magnesium',
         'zinc', 'phosphorus', 'tibc'].some(k => lower.includes(k))) {
        return 'Vitamins & Minerals';
    }

    // Hormones
    if (['testosterone', 'estradiol', 'progesterone', 'cortisol', 'dhea',
         'shbg', ' lh', 'fsh', 'prolactin'].some(k => lower.includes(k))) {
        return 'Hormones';
    }

    // Inflammation / Cardiac Risk
    if (lower.includes('crp') || lower.includes('homocysteine') || lower.includes('esr') ||
        lower.includes('uric acid')) {
        return 'Inflammation';
    }

    return 'Other';
}

/**
 * Convert a flat record (canonical CSV columns) to a FHIR Observation.
 */
function flatToObservation(record) {
    const loinc = lookupLOINC(record.marker);
    return buildObservation({
        id: record.id || generateId(),
        date: record.date,
        panel: record.panel,
        marker: loinc.display,
        loincCode: loinc.code,
        value: record.value,
        unit: record.unit,
        refMin: record.referenceMin,
        refMax: record.referenceMax,
        status: record.status || deriveStatus(record.value, record.referenceMin, record.referenceMax),
        source: record.source,
    });
}

/**
 * Build a FHIR R4 Observation resource from normalized fields.
 */
function buildObservation({ id, date, panel, marker, loincCode, value, unit, refMin, refMax, status, source }) {
    const interpretationCode = { high: 'H', low: 'L', normal: 'N', unknown: 'UNK' }[status] || 'UNK';

    const obs = {
        resourceType: 'Observation',
        id,
        status: 'final',
        category: [{
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'laboratory',
                display: 'Laboratory',
            }],
        }],
        code: {
            coding: [{
                system: 'http://loinc.org',
                code: loincCode,
                display: marker,
            }],
            text: `${panel} - ${marker}`,
        },
        subject: { reference: 'Patient/example' },
        effectiveDateTime: date,
        valueQuantity: {
            value,
            unit,
            system: 'http://unitsofmeasure.org',
        },
        interpretation: [{
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                code: interpretationCode,
                display: status,
            }],
        }],
        extension: [{
            url: 'http://example.org/source',
            valueString: source,
        }],
    };

    if (refMin !== null && refMax !== null) {
        obs.referenceRange = [{
            low:  { value: refMin, unit },
            high: { value: refMax, unit },
        }];
    } else {
        obs.referenceRange = [];
    }

    return obs;
}

/**
 * Derive interpretation status from value and reference range.
 */
function deriveStatus(value, refMin, refMax) {
    if (refMin === null && refMax === null) return 'unknown';
    if (refMax !== null && value > refMax) return 'high';
    if (refMin !== null && value < refMin) return 'low';
    return 'normal';
}

let idCounter = 0;
function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'id-' + Date.now() + '-' + (idCounter++);
}
