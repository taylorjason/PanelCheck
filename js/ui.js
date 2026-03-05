import { loadRecords, saveRecords } from './storage.js';
import { parseCSV, parseJSON, mapMarkerToPanel } from './parser.js';
import { renderCharts } from './charts.js';

let allObservations = [];
let filteredObservations = [];

/**
 * Initialize the UI
 */
export function initUI() {
    document.getElementById('upload-btn').addEventListener('click', handleFileUpload);
    document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);
    setupMarkerDropdown();

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

            // Save new observations (append to existing and deduplicate by content)
            allObservations = [...allObservations, ...newObservations];
            console.log('Parsed observations:', newObservations.length);
            console.log('Total observations before dedup:', allObservations.length);
            // Deduplication happens in saveRecords via storage.js
            saveRecords(allObservations);
            // Reload from storage to get deduplicated list
            allObservations = loadRecords();
            console.log('Total observations after dedup:', allObservations.length);
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

    // Extract panels from observations
    const panels = [...new Set(allObservations.map(obs => {
        if (obs.code && obs.code.text) {
            const parts = obs.code.text.split(' - ');
            if (parts.length > 1) {
                // code.text is in "Panel - Marker" format
                return parts[0];
            } else {
                // code.text is just the marker, map it to a panel
                return mapMarkerToPanel(obs.code.text);
            }
        }
        return '';
    }))].filter(Boolean).sort();

    // Extract markers from observations
    const markers = [...new Set(allObservations.map(obs => {
        if (obs.code && obs.code.text) {
            const parts = obs.code.text.split(' - ');
            if (parts.length > 1) {
                // code.text is in "Panel - Marker" format, take the marker
                return parts[1];
            } else {
                // code.text is just the marker
                return obs.code.text;
            }
        } else if (obs.code && obs.code.coding && obs.code.coding[0]) {
            return obs.code.coding[0].display || '';
        }
        return '';
    }))].filter(Boolean).sort();

    panelSelect.innerHTML = '<option value="">All</option>';
    panels.forEach(panel => {
        panelSelect.innerHTML += `<option value="${panel}">${panel}</option>`;
    });

    // Update marker options for the dropdown
    updateMarkerOptions(markers);
}

/**
 * Update marker options in the dropdown
 */
function updateMarkerOptions(markers) {
    const markerOptions = document.getElementById('marker-options');
    markerOptions.innerHTML = '';
    
    markers.forEach(marker => {
        const option = document.createElement('div');
        option.className = 'marker-option';
        option.textContent = marker;
        option.dataset.marker = marker;
        option.addEventListener('click', () => toggleMarker(marker));
        markerOptions.appendChild(option);
    });
}

/**
 * Toggle marker selection (add/remove chip)
 */
function toggleMarker(marker) {
    const selectedMarkers = getSelectedMarkers();
    const index = selectedMarkers.indexOf(marker);
    
    if (index > -1) {
        // Remove marker
        selectedMarkers.splice(index, 1);
    } else {
        // Add marker
        selectedMarkers.push(marker);
    }
    
    updateSelectedMarkersDisplay(selectedMarkers);
    updateMarkerOptionsHighlight();
    
    // Keep dropdown open and maintain current search filter
    const dropdown = document.getElementById('marker-dropdown');
    const searchInput = document.getElementById('marker-search');
    dropdown.style.display = 'block';
    filterMarkerOptions(searchInput.value);
}

/**
 * Get currently selected markers from chips
 */
function getSelectedMarkers() {
    const chips = document.querySelectorAll('.marker-chip');
    return Array.from(chips).map(chip => chip.dataset.marker);
}

/**
 * Update the display of selected marker chips
 */
function updateSelectedMarkersDisplay(selectedMarkers) {
    const selectedMarkersDiv = document.getElementById('selected-markers');
    selectedMarkersDiv.innerHTML = '';
    
    selectedMarkers.forEach(marker => {
        const chip = document.createElement('span');
        chip.className = 'marker-chip';
        chip.dataset.marker = marker;
        chip.innerHTML = `${marker}<span class="remove-chip" onclick="removeMarker('${marker}')">×</span>`;
        selectedMarkersDiv.appendChild(chip);
    });
}

/**
 * Remove a specific marker chip (global function for HTML onclick)
 */
window.removeMarker = function(marker) {
    const selectedMarkers = getSelectedMarkers().filter(m => m !== marker);
    updateSelectedMarkersDisplay(selectedMarkers);
    updateMarkerOptionsHighlight();
    
    // Keep dropdown open and maintain current search filter
    const dropdown = document.getElementById('marker-dropdown');
    const searchInput = document.getElementById('marker-search');
    dropdown.style.display = 'block';
    filterMarkerOptions(searchInput.value);
};

/**
 * Update highlighting of selected markers in dropdown
 */
function updateMarkerOptionsHighlight() {
    const selectedMarkers = getSelectedMarkers();
    const options = document.querySelectorAll('.marker-option');
    
    options.forEach(option => {
        const marker = option.dataset.marker;
        if (selectedMarkers.includes(marker)) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

/**
 * Show/hide marker dropdown based on search input focus
 */
function setupMarkerDropdown() {
    const searchInput = document.getElementById('marker-search');
    const dropdown = document.getElementById('marker-dropdown');
    
    searchInput.addEventListener('focus', () => {
        dropdown.style.display = 'block';
        filterMarkerOptions('');
    });
    
    searchInput.addEventListener('blur', () => {
        // Delay hiding to allow clicks on options
        setTimeout(() => {
            dropdown.style.display = 'none';
        }, 150);
    });
    
    searchInput.addEventListener('input', (e) => {
        filterMarkerOptions(e.target.value);
    });
}

/**
 * Filter marker options based on search text
 */
function filterMarkerOptions(searchText) {
    const options = document.querySelectorAll('.marker-option');
    const searchLower = searchText.toLowerCase();
    
    options.forEach(option => {
        const marker = option.dataset.marker.toLowerCase();
        if (marker.includes(searchLower)) {
            option.style.display = 'block';
        } else {
            option.style.display = 'none';
        }
    });
}

/**
 * Apply filters to records
 */
function applyFilters() {
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    const panel = document.getElementById('panel-filter').value;
    const selectedMarkers = getSelectedMarkers();

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
        // If any markers are selected, only show those; otherwise show all
        if (selectedMarkers.length > 0 && !selectedMarkers.includes(obsMarker)) return false;
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
