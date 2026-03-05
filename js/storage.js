const STORAGE_KEY = 'bloodwork_observations';

/**
 * Save FHIR Observations to localStorage
 * @param {Array} observations - Array of FHIR Observation resources
 */
export function saveRecords(observations) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(observations));
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
