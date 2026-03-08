/**
 * LLM-powered document parser using the Claude API.
 *
 * This module sends document text to Claude and asks it to extract
 * bloodwork data in a structured format, then converts the result
 * into FHIR Observations using the same helpers as the built-in adapters.
 *
 * API key is stored in localStorage under 'claude_api_key'.
 * Users are warned that this is plaintext storage.
 *
 * Public API:
 *   getApiKey()             → string | null
 *   setApiKey(key)          → void
 *   clearApiKey()           → void
 *   parseLLM(content, file) → Promise<Observation[]>
 */

import { flatToObservation, extractTextFromPDF } from './parser.js';

const API_KEY_STORAGE_KEY = 'claude_api_key';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Max characters sent to the model — keeps requests within token budget.
const MAX_TEXT_CHARS = 12000;

// ─── API key helpers ──────────────────────────────────────────────────────────

export function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setApiKey(key) {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function clearApiKey() {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
}

// ─── Main parse function ──────────────────────────────────────────────────────

/**
 * Parse a document using the Claude API.
 *
 * For PDFs the ArrayBuffer is first decoded to text via PDF.js.
 * All other formats are sent as-is (string content).
 *
 * @param {string|ArrayBuffer} content - file content from FileReader
 * @param {File}               file    - the original File object
 * @returns {Promise<Object[]>} FHIR Observation resources
 */
export async function parseLLM(content, file) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('No Claude API key configured. Enter your key in AI Settings.');
    }

    let text;
    if (file.name.toLowerCase().endsWith('.pdf')) {
        text = await extractTextFromPDF(content);
    } else if (typeof content === 'string') {
        text = content;
    } else {
        text = new TextDecoder().decode(content);
    }

    const truncated = text.slice(0, MAX_TEXT_CHARS);
    const rawJson = await callClaude(truncated, apiKey);

    let records;
    try {
        records = JSON.parse(rawJson);
    } catch {
        throw new Error('AI returned an unexpected format. Try uploading again or use the standard parser.');
    }

    if (!Array.isArray(records)) {
        throw new Error('AI returned an unexpected format. Try uploading again or use the standard parser.');
    }

    return records
        .filter(r => r && r.date && r.marker && typeof r.value === 'number')
        .map(r => flatToObservation({
            date: r.date,
            panel: r.panel || 'General',
            marker: r.marker,
            value: r.value,
            unit: r.unit || '',
            referenceMin: typeof r.referenceMin === 'number' ? r.referenceMin : null,
            referenceMax: typeof r.referenceMax === 'number' ? r.referenceMax : null,
            status: r.status || 'unknown',
            source: 'LLM',
        }));
}

// ─── Claude API call ──────────────────────────────────────────────────────────

async function callClaude(text, apiKey) {
    const prompt = buildPrompt(text);

    let response;
    try {
        response = await fetch(ANTHROPIC_API_URL, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 8096,
                messages: [{ role: 'user', content: prompt }],
            }),
        });
    } catch (err) {
        throw new Error(`Network error contacting Claude API: ${err.message}`);
    }

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Invalid API key (401). Check your key in AI Settings.');
        }
        if (response.status === 429) {
            throw new Error('Rate limit reached (429). Wait a moment and try again.');
        }
        throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const text_out = data?.content?.[0]?.text;
    if (!text_out) {
        throw new Error('Empty response from Claude API.');
    }

    // Extract the JSON array — find outermost [ ... ] to handle any surrounding text or fences
    const start = text_out.indexOf('[');
    if (start === -1) {
        throw new Error('AI response contained no JSON array.');
    }
    let end = text_out.lastIndexOf(']');
    if (end === -1 || end < start) {
        // Response was truncated — salvage complete records by finding the last '}' inside the array
        const lastBrace = text_out.lastIndexOf('}');
        if (lastBrace === -1 || lastBrace < start) {
            throw new Error('AI response was truncated before any complete records.');
        }
        return text_out.slice(start, lastBrace + 1) + ']';
    }
    return text_out.slice(start, end + 1);
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(text) {
    return `You are a medical lab data extractor. Extract every laboratory test result from the document below.

Return ONLY a valid JSON array — no explanation, no markdown fences.

Each element must have these exact fields:
  "date"         – collection/result date as YYYY-MM-DD (required)
  "panel"        – lab panel name, e.g. "CBC", "CMP", "Lipid Panel", "Thyroid" (required)
  "marker"       – test/analyte name, e.g. "Glucose", "Hemoglobin", "TSH" (required)
  "value"        – numeric result only, no units (required, must be a number)
  "unit"         – measurement unit, e.g. "mg/dL", "g/dL", "%" (required)
  "referenceMin" – lower bound of reference range as a number, or null
  "referenceMax" – upper bound of reference range as a number, or null
  "status"       – one of "normal", "high", "low", or "unknown"
  "source"       – always "LLM"

If a date applies to all results on the page, use it for every record.
If a field cannot be determined, use null for numbers and "unknown" for status.
Do not include rows that are not actual test results (headers, addresses, notes).

Document:
${text}`;
}
