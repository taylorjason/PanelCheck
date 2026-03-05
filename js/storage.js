const STORAGE_KEY = 'bloodwork_observations';

/**
 * Create a content hash for an observation
 * Uses date, panel, marker, and value to identify duplicates
 * @param {Object} obs - FHIR Observation resource
 * @returns {string} Content hash
 */
function getObservationHash(obs) {
    const date = obs.effectiveDateTime ? obs.effectiveDateTime.split('T')[0] : '';
    let panel = '';
    let marker = '';
    
    if (obs.code && obs.code.text) {
        const parts = obs.code.text.split(' - ');
        panel = parts[0];
        marker = parts[1] || '';
    } else if (obs.code && obs.code.coding && obs.code.coding[0]) {
        marker = obs.code.coding[0].display || '';
    }
    
    const value = obs.valueQuantity && obs.valueQuantity.value;
    const hash = `${date}|${panel}|${marker}|${value}`;
    return hash;
}

/**
 * Deduplicate observations by content hash
 * @param {Array} observations - Array of FHIR Observation resources
 * @returns {Array} Array with duplicates removed (keeping first occurrence)
 */
function deduplicateObservations(observations) {
    const seen = new Set();
    return observations.filter(obs => {
        const hash = getObservationHash(obs);
        if (seen.has(hash)) {
            return false;
        }
        seen.add(hash);
        return true;
    });
}

/**
 * Save FHIR Observations to localStorage (with deduplication)
 * @param {Array} observations - Array of FHIR Observation resources
 */
export function saveRecords(observations) {
    const deduplicated = deduplicateObservations(observations);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deduplicated));
}

/**
 * Load FHIR Observations from localStorage
 * @returns {Array} Array of FHIR Observation resources
 */
export function loadRecords() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

/**
 * Clear all FHIR Observations from localStorage
 */
export function clearRecords() {
    localStorage.removeItem(STORAGE_KEY);
}
