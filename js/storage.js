const STORAGE_KEY = 'bloodwork_records';

/**
 * Save records to localStorage
 * @param {Array} records - Array of bloodwork records
 */
export function saveRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/**
 * Load records from localStorage
 * @returns {Array} Array of bloodwork records
 */
export function loadRecords() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

/**
 * Clear all records from localStorage
 */
export function clearRecords() {
    localStorage.removeItem(STORAGE_KEY);
}
