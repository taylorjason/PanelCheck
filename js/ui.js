import { loadRecords, saveRecords } from './storage.js';
import { parseCSV, parseJSON } from './parser.js';
import { renderCharts } from './charts.js';

let allRecords = [];
let filteredRecords = [];

/**
 * Initialize the UI
 */
export function initUI() {
    document.getElementById('upload-btn').addEventListener('click', handleFileUpload);
    document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);

    // Load existing records
    allRecords = loadRecords();
    filteredRecords = [...allRecords];
    displayRecords(filteredRecords);
    updateFilters();
    renderCharts(filteredRecords);
}

/**
 * Handle file upload
 */
function handleFileUpload() {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    if (!file) {
        showStatus('Please select a file');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            let newRecords = [];
            if (file.name.endsWith('.csv')) {
                newRecords = parseCSV(e.target.result);
            } else if (file.name.endsWith('.json')) {
                newRecords = parseJSON(e.target.result);
            } else {
                throw new Error('Unsupported file type');
            }

            // Save new records (append to existing)
            allRecords = [...allRecords, ...newRecords];
            saveRecords(allRecords);
            filteredRecords = [...allRecords];
            displayRecords(filteredRecords);
            updateFilters();
            renderCharts(filteredRecords);
            showStatus(`Uploaded ${newRecords.length} records`);
        } catch (error) {
            showStatus(`Error: ${error.message}`);
        }
    };
    reader.readAsText(file);
}

/**
 * Display records in a table
 * @param {Array} records
 */
export function displayRecords(records) {
    const container = document.getElementById('records-table');
    if (records.length === 0) {
        container.innerHTML = '<p>No records to display</p>';
        return;
    }

    let html = '<table><thead><tr>';
    html += '<th>Date</th><th>Panel</th><th>Marker</th><th>Value</th><th>Unit</th><th>Status</th>';
    html += '</tr></thead><tbody>';

    records.forEach(record => {
        html += `<tr>
            <td>${record.date}</td>
            <td>${record.panel}</td>
            <td>${record.marker}</td>
            <td>${record.value}</td>
            <td>${record.unit}</td>
            <td>${record.status}</td>
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

    const panels = [...new Set(allRecords.map(r => r.panel))].sort();
    const markers = [...new Set(allRecords.map(r => r.marker))].sort();

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

    filteredRecords = allRecords.filter(record => {
        if (dateFrom && record.date < dateFrom) return false;
        if (dateTo && record.date > dateTo) return false;
        if (panel && record.panel !== panel) return false;
        if (marker && record.marker !== marker) return false;
        return true;
    });

    displayRecords(filteredRecords);
    renderCharts(filteredRecords);
}

/**
 * Show status message
 * @param {string} message
 */
function showStatus(message) {
    document.getElementById('upload-status').textContent = message;
}
