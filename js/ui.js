import { loadRecords, saveRecords } from './storage.js';
import { parseCSV, parseJSON } from './parser.js';
import { renderCharts } from './charts.js';

let allObservations = [];
let filteredObservations = [];

/**
 * Initialize the UI
 */
export function initUI() {
    document.getElementById('upload-btn').addEventListener('click', handleFileUpload);
    document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);

    // Load existing observations
    allObservations = loadRecords();
    filteredObservations = [...allObservations];
    displayObservations(filteredObservations);
    updateFilters();
    renderCharts(filteredObservations);
}

/**
 * Handle file upload
 */
function handleFileUpload() {
    console.log('handleFileUpload called');
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    if (!file) {
        showStatus('Please select a file');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            let newObservations = [];
            if (file.name.endsWith('.csv')) {
                newObservations = parseCSV(e.target.result);
            } else if (file.name.endsWith('.json')) {
                newObservations = parseJSON(e.target.result);
            } else {
                throw new Error('Unsupported file type');
            }

            // Save new observations (append to existing and deduplicate by ID)
            allObservations = [...allObservations, ...newObservations];
            console.log('Parsed observations:', newObservations);
            console.log('Total observations before dedup:', allObservations.length);
            // Remove duplicates by ID, keeping first occurrence
            const seenIds = new Set();
            allObservations = allObservations.filter(obs => {
                if (seenIds.has(obs.id)) {
                    return false;
                }
                seenIds.add(obs.id);
                return true;
            });
            console.log('Total observations after dedup:', allObservations.length);
            saveRecords(allObservations);
            filteredObservations = [...allObservations];
            displayObservations(filteredObservations);
            updateFilters();
            renderCharts(filteredObservations);
            showStatus(`Uploaded ${newObservations.length} observations`);
        } catch (error) {
            showStatus(`Error: ${error.message}`);
        }
    };
    reader.readAsText(file);
}

/**
 * Display observations in a table
 * @param {Array} observations
 */
export function displayObservations(observations) {
    const container = document.getElementById('records-table');
    if (observations.length === 0) {
        container.innerHTML = '<p>No observations to display</p>';
        return;
    }

    let html = '<table><thead><tr>';
    html += '<th>Date</th><th>Panel</th><th>Marker</th><th>Value</th><th>Unit</th><th>Status</th>';
    html += '</tr></thead><tbody>';

    observations.forEach(obs => {
        // Extract panel and marker with fallbacks
        let panel = '';
        let marker = '';
        if (obs.code && obs.code.text) {
            const parts = obs.code.text.split(' - ');
            panel = parts[0] || '';
            marker = parts[1] || (obs.code.coding && obs.code.coding[0] && obs.code.coding[0].display) || '';
        } else if (obs.code && obs.code.coding && obs.code.coding[0]) {
            marker = obs.code.coding[0].display || '';
        }

        const date = obs.effectiveDateTime ? obs.effectiveDateTime.split('T')[0] : '';
        const value = obs.valueQuantity && obs.valueQuantity.value;
        const unit = obs.valueQuantity && obs.valueQuantity.unit;
        const status = obs.interpretation && obs.interpretation[0] && obs.interpretation[0].coding[0] && obs.interpretation[0].coding[0].code;

        html += `<tr>
            <td>${date}</td>
            <td>${panel}</td>
            <td>${marker}</td>
            <td>${value}</td>
            <td>${unit}</td>
            <td>${status}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Update filter options
 */
function updateFilters() {
    const panelSelect = document.getElementById('panel-filter');
    const markerSelect = document.getElementById('marker-filter');

    const panels = [...new Set(allObservations.map(obs => {
        if (obs.code && obs.code.text) {
            return obs.code.text.split(' - ')[0];
        }
        return '';
    }))].filter(Boolean).sort();

    const markers = [...new Set(allObservations.map(obs => {
        if (obs.code && obs.code.text) {
            const parts = obs.code.text.split(' - ');
            return parts[1] || '';
        } else if (obs.code && obs.code.coding && obs.code.coding[0]) {
            return obs.code.coding[0].display || '';
        }
        return '';
    }))].filter(Boolean).sort();

    panelSelect.innerHTML = '<option value="">All</option>';
    panels.forEach(panel => {
        panelSelect.innerHTML += `<option value="${panel}">${panel}</option>`;
    });

    markerSelect.innerHTML = '<option value="">All</option>';
    markers.forEach(marker => {
        markerSelect.innerHTML += `<option value="${marker}">${marker}</option>`;
    });
}

/**
 * Apply filters to records
 */
function applyFilters() {
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    const panel = document.getElementById('panel-filter').value;
    const marker = document.getElementById('marker-filter').value;

    filteredObservations = allObservations.filter(obs => {
        const obsDate = obs.effectiveDateTime ? obs.effectiveDateTime.split('T')[0] : '';
        let obsPanel = '';
        let obsMarker = '';
        
        if (obs.code && obs.code.text) {
            const parts = obs.code.text.split(' - ');
            obsPanel = parts[0];
            obsMarker = parts[1] || '';
        } else if (obs.code && obs.code.coding && obs.code.coding[0]) {
            obsMarker = obs.code.coding[0].display || '';
        }

        if (dateFrom && obsDate < dateFrom) return false;
        if (dateTo && obsDate > dateTo) return false;
        if (panel && obsPanel !== panel) return false;
        if (marker && obsMarker !== marker) return false;
        return true;
    });

    displayObservations(filteredObservations);
    renderCharts(filteredObservations);
}

/**
 * Show status message
 * @param {string} message
 */
function showStatus(message) {
    document.getElementById('upload-status').textContent = message;
}
