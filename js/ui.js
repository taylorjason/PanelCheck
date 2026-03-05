import { loadRecords, saveRecords } from './storage.js';
import { parseFile } from './parser.js';
import { renderCharts } from './charts.js';
import { getApiKey, setApiKey, clearApiKey, parseLLM } from './llm-parser.js';

let allObservations = [];
let filteredObservations = [];

// File + content from the last upload attempt, kept so "Try AI Parsing" can
// reuse them without asking the user to pick the file again.
let _lastFile = null;
let _lastContent = null;

/**
 * Initialize the UI
 */
export function initUI() {
    // Upload
    document.getElementById('upload-btn').addEventListener('click', handleFileUpload);

    // AI suggestion banner
    document.getElementById('try-ai-btn').addEventListener('click', handleTryAI);

    // Settings toggle (collapsible)
    document.getElementById('settings-toggle').addEventListener('click', toggleSettings);

    // API key controls
    document.getElementById('save-api-key-btn').addEventListener('click', handleSaveApiKey);
    document.getElementById('clear-api-key-btn').addEventListener('click', handleClearApiKey);

    // Restore API key field if one was previously saved
    const savedKey = getApiKey();
    if (savedKey) {
        document.getElementById('api-key-input').value = savedKey;
        setApiKeyStatus('Key loaded from storage');
    }

    // Filters
    document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);

    // Load existing observations
    allObservations = loadRecords();
    filteredObservations = [...allObservations];
    displayObservations(filteredObservations);
    updateFilters();
    renderCharts(filteredObservations);
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Handle file upload — tries the built-in adapters first.
 * If the result looks incomplete (PDF with very few rows, or 0 results for any
 * format), surfaces an "Try AI Parsing" suggestion without blocking the user.
 */
function handleFileUpload() {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    if (!file) {
        showStatus('Please select a file');
        return;
    }

    hideAISuggestion();

    const isPDF = file.name.toLowerCase().endsWith('.pdf');
    const reader = new FileReader();

    reader.onload = async (e) => {
        const content = e.target.result;
        _lastFile = file;
        _lastContent = content;

        try {
            const newObservations = await parseFile(file, content);
            _handleParseResult(newObservations, isPDF);
        } catch (err) {
            // Unsupported format or complete parse failure
            showStatus(`Could not parse file: ${err.message}`);
            showAISuggestion('The built-in parser could not read this format.');
        }
    };

    if (isPDF) {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file);
    }
}

/**
 * Decide what to show based on parse results:
 *   - 0 results          → save nothing, always suggest AI
 *   - PDF, few results   → save & display, suggest AI (may have missed data)
 *   - Good results       → save & display, no AI suggestion needed
 *
 * "Few" means < 3 observations — heuristic threshold for suspicious PDF parses.
 */
function _handleParseResult(newObservations, isPDF) {
    if (newObservations.length === 0) {
        showStatus('No observations found.');
        showAISuggestion('The built-in parser found nothing. AI parsing handles more formats.');
        return;
    }

    // Save and display whatever was found
    _saveAndRefresh(newObservations);
    showStatus(`Uploaded ${newObservations.length} observation(s).`);

    // For PDFs with suspiciously few results, offer AI as a more accurate option
    if (isPDF && newObservations.length < 3) {
        showAISuggestion(
            `Only ${newObservations.length} result(s) found — PDF layouts vary. AI parsing may extract more.`
        );
    }
}

// ─── AI suggestion ────────────────────────────────────────────────────────────

/**
 * Called when the user clicks "Try AI Parsing".
 * If no API key is set, expands the settings panel and prompts the user.
 */
async function handleTryAI() {
    if (!getApiKey()) {
        openSettings();
        setApiKeyStatus('Enter your Claude API key above, then click "Try AI Parsing" again.');
        return;
    }

    if (!_lastFile || _lastContent === null) {
        showStatus('Please upload a file first.');
        return;
    }

    hideAISuggestion();
    showStatus('AI parsing in progress…');

    try {
        const newObservations = await parseLLM(_lastContent, _lastFile);
        if (newObservations.length === 0) {
            showStatus('AI found no observations in this document.');
            return;
        }
        _saveAndRefresh(newObservations);
        showStatus(`AI extracted ${newObservations.length} observation(s).`);
    } catch (err) {
        showStatus(`AI parsing failed: ${err.message}`);
        // Re-show the suggestion so the user can fix the key and retry
        showAISuggestion('AI parsing encountered an error. Check your API key in AI Settings.');
    }
}

function showAISuggestion(message) {
    document.getElementById('ai-suggestion-msg').textContent = message;
    document.getElementById('ai-suggestion').classList.remove('hidden');
}

function hideAISuggestion() {
    document.getElementById('ai-suggestion').classList.add('hidden');
}

// ─── Settings ────────────────────────────────────────────────────────────────

function toggleSettings() {
    const body = document.getElementById('settings-body');
    const indicator = document.querySelector('.toggle-indicator');
    const isHidden = body.classList.contains('hidden');
    body.classList.toggle('hidden', !isHidden);
    indicator.classList.toggle('open', isHidden);
}

function openSettings() {
    const body = document.getElementById('settings-body');
    const indicator = document.querySelector('.toggle-indicator');
    body.classList.remove('hidden');
    indicator.classList.add('open');
}

function handleSaveApiKey() {
    const input = document.getElementById('api-key-input');
    const key = input.value.trim();
    if (!key) {
        setApiKeyStatus('Please enter a key first.');
        return;
    }
    setApiKey(key);
    setApiKeyStatus('Key saved.');
}

function handleClearApiKey() {
    clearApiKey();
    document.getElementById('api-key-input').value = '';
    setApiKeyStatus('Key cleared.');
}

function setApiKeyStatus(msg) {
    document.getElementById('api-key-status').textContent = msg;
}

// ─── Data management ──────────────────────────────────────────────────────────

function _saveAndRefresh(newObservations) {
    allObservations = [...allObservations, ...newObservations];
    saveRecords(allObservations);
    allObservations = loadRecords();   // deduplication happens in loadRecords/saveRecords
    filteredObservations = [...allObservations];
    displayObservations(filteredObservations);
    updateFilters();
    renderCharts(filteredObservations);
}

// ─── Display ──────────────────────────────────────────────────────────────────

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

// ─── Filters ──────────────────────────────────────────────────────────────────

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

    markerSelect.innerHTML = '';
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
    const markerSelect = document.getElementById('marker-filter');
    const selectedMarkers = Array.from(markerSelect.selectedOptions).map(o => o.value);

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
        if (selectedMarkers.length > 0 && !selectedMarkers.includes(obsMarker)) return false;
        return true;
    });

    displayObservations(filteredObservations);
    renderCharts(filteredObservations);
}

// ─── Status ───────────────────────────────────────────────────────────────────

/**
 * Show status message
 * @param {string} message
 */
function showStatus(message) {
    document.getElementById('upload-status').textContent = message;
}
