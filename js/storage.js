const STORAGE_KEY = 'bloodwork_observations';

/**
 * Deduplicate observations by ID
 * @param {Array} observations - Array of FHIR Observation resources
 * @returns {Array} Array with duplicates removed (keeping first occurrence)
 */
function deduplicateObservations(observations) {
    const seen = new Set();
    return observations.filter(obs => {
        if (seen.has(obs.id)) {
            return false;
        }
        seen.add(obs.id);
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
