import { loadRecords, saveRecords } from './storage.js';
import { parseFile, mapMarkerToPanel } from './parser.js';
import { renderCharts } from './charts.js';

let allObservations = [];
let filteredObservations = [];

/**
 * Initialize the UI
 */
export function initUI() {
    document.getElementById('upload-btn').addEventListener('click', handleFileUpload);
    document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);
    document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);
    setupMarkerDropdown();

    // Load existing observations and re-process to apply updated panel mappings
    allObservations = loadRecords();
    allObservations = reprocessObservations(allObservations);
    saveRecords(allObservations);

    filteredObservations = [...allObservations];
    displayObservations(filteredObservations);
    updateFilters();
    renderCharts(filteredObservations);
}

/**
 * Handle file upload — routes to the correct parser via parseFile(),
 * which selects the adapter based on file extension.
 * PDFs are read as ArrayBuffer; all other formats as text.
 */
function handleFileUpload() {
    console.log('handleFileUpload called');
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    if (!file) {
        showStatus('Please select a file');
        return;
    }

    const isPDF = file.name.toLowerCase().endsWith('.pdf');
    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const newObservations = await parseFile(file, e.target.result);

            if (newObservations.length === 0) {
                showStatus('No observations found in file. Check that the file contains lab results.');
                return;
            }

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
            showStatus(`Uploaded ${newObservations.length} observation(s)`);
        } catch (error) {
            showStatus(`Error: ${error.message}`);
        }
    };

    if (isPDF) {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file);
    }
}

/**
 * Re-process observations to apply updated panel mappings.
 * Ensures any previously stored data uses the current panel names.
 */
function reprocessObservations(observations) {
    return observations.map(obs => {
        if (obs.code && obs.code.text) {
            const parts = obs.code.text.split(' - ');
            if (parts.length > 1) {
                const marker = parts[1];
                obs.code.text = `${mapMarkerToPanel(marker)} - ${marker}`;
            } else {
                const marker = obs.code.text;
                obs.code.text = `${mapMarkerToPanel(marker)} - ${marker}`;
            }
        }
        return obs;
    });
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
 * Clear all filter selections
 */
function clearFilters() {
    // Clear panel selection
    document.getElementById('panel-filter').value = '';
    
    // Clear marker selections
    updateSelectedMarkersDisplay([]);
    updateMarkerOptionsHighlight();
    
    // Clear date filters
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    
    // Close marker dropdown
    document.getElementById('marker-dropdown').style.display = 'none';
    document.getElementById('marker-search').value = '';
}
function updateFilters() {
    const panelSelect = document.getElementById('panel-filter');

    const panels = [...new Set(allObservations.map(obs => {
        if (obs.code && obs.code.text) {
            const parts = obs.code.text.split(' - ');
            return parts.length > 1 ? parts[0] : mapMarkerToPanel(obs.code.text);
        }
        return '';
    }))].filter(Boolean).sort();

    const markers = [...new Set(allObservations.map(obs => {
        if (obs.code && obs.code.text) {
            const parts = obs.code.text.split(' - ');
            return parts.length > 1 ? parts[1] : obs.code.text;
        } else if (obs.code && obs.code.coding && obs.code.coding[0]) {
            return obs.code.coding[0].display || '';
        }
        return '';
    }))].filter(Boolean).sort();

    panelSelect.innerHTML = '<option value="">All</option>';
    panels.forEach(panel => {
        panelSelect.innerHTML += `<option value="${panel}">${panel}</option>`;
    });

    updateMarkerOptions(markers);
}

/**
 * Update marker options in the chip dropdown
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
        selectedMarkers.splice(index, 1);
    } else {
        selectedMarkers.push(marker);
    }

    // Store current scroll position
    const markerOptions = document.getElementById('marker-options');
    const scrollTop = markerOptions.scrollTop;

    updateSelectedMarkersDisplay(selectedMarkers);
    updateMarkerOptionsHighlight();

    // Keep dropdown open and maintain current search filter
    const dropdown = document.getElementById('marker-dropdown');
    const searchInput = document.getElementById('marker-search');
    dropdown.style.display = 'block';
    filterMarkerOptions(searchInput.value);
    
    // Restore scroll position
    markerOptions.scrollTop = scrollTop;
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
    
    // Store current scroll position
    const markerOptions = document.getElementById('marker-options');
    const scrollTop = markerOptions.scrollTop;
    
    updateSelectedMarkersDisplay(selectedMarkers);
    updateMarkerOptionsHighlight();

    const dropdown = document.getElementById('marker-dropdown');
    const searchInput = document.getElementById('marker-search');
    dropdown.style.display = 'block';
    filterMarkerOptions(searchInput.value);
    
    // Restore scroll position
    markerOptions.scrollTop = scrollTop;
};

/**
 * Update highlighting of selected markers in dropdown
 */
function updateMarkerOptionsHighlight() {
    const selectedMarkers = getSelectedMarkers();
    const options = document.querySelectorAll('.marker-option');

    options.forEach(option => {
        if (selectedMarkers.includes(option.dataset.marker)) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

/**
 * Set up the marker search/dropdown behaviour
 */
function setupMarkerDropdown() {
    const searchInput = document.getElementById('marker-search');
    const dropdown = document.getElementById('marker-dropdown');

    searchInput.addEventListener('focus', () => {
        dropdown.style.display = 'block';
        filterMarkerOptions('');
    });

    searchInput.addEventListener('blur', () => {
        setTimeout(() => { dropdown.style.display = 'none'; }, 150);
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
        option.style.display = option.dataset.marker.toLowerCase().includes(searchLower) ? 'block' : 'none';
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
        // Markers take priority: if any are selected, ignore the panel filter
        if (selectedMarkers.length > 0) {
            return selectedMarkers.includes(obsMarker);
        }
        if (panel && obsPanel !== panel) return false;
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
