/**
 * Tests for js/llm-parser.js
 *
 * fetch() is mocked to avoid real API calls.
 * localStorage is reset between tests.
 */

import {
    getApiKey,
    setApiKey,
    clearApiKey,
    parseLLM,
} from '../js/llm-parser.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeMockFetch(status, body) {
    return async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    });
}

const VALID_CLAUDE_RESPONSE = {
    content: [{
        text: JSON.stringify([{
            date: '2024-01-15',
            panel: 'CMP',
            marker: 'Glucose',
            value: 95,
            unit: 'mg/dL',
            referenceMin: 70,
            referenceMax: 99,
            status: 'normal',
            source: 'LLM',
        }]),
    }],
};

// ─── API key management ───────────────────────────────────────────────────────

QUnit.module('LLM Parser – API key management', {
    beforeEach() { localStorage.clear(); },
    afterEach() { localStorage.clear(); },
});

QUnit.test('getApiKey returns null when not set', assert => {
    assert.strictEqual(getApiKey(), null);
});

QUnit.test('setApiKey persists key in localStorage', assert => {
    setApiKey('sk-ant-test-key');
    assert.strictEqual(localStorage.getItem('claude_api_key'), 'sk-ant-test-key');
    assert.strictEqual(getApiKey(), 'sk-ant-test-key');
});

QUnit.test('clearApiKey removes key from localStorage', assert => {
    setApiKey('sk-ant-test-key');
    clearApiKey();
    assert.strictEqual(getApiKey(), null);
    assert.strictEqual(localStorage.getItem('claude_api_key'), null);
});

// ─── parseLLM ─────────────────────────────────────────────────────────────────

QUnit.module('LLM Parser – parseLLM', {
    beforeEach() {
        localStorage.clear();
        this._fetch = window.fetch;
    },
    afterEach() {
        window.fetch = this._fetch;
        localStorage.clear();
    },
});

QUnit.test('throws when no API key is configured', async assert => {
    const file = new File(['hello'], 'report.txt', { type: 'text/plain' });
    try {
        await parseLLM('hello', file);
        assert.ok(false, 'should have thrown');
    } catch (err) {
        assert.ok(err.message.toLowerCase().includes('api key'), err.message);
    }
});

QUnit.test('calls the Anthropic messages endpoint', async assert => {
    setApiKey('sk-ant-test');
    let capturedUrl = null;
    let capturedHeaders = null;
    window.fetch = async (url, opts) => {
        capturedUrl = url;
        capturedHeaders = opts.headers;
        return { ok: true, status: 200, json: async () => VALID_CLAUDE_RESPONSE };
    };
    const file = new File(['Glucose 95 mg/dL'], 'report.txt', { type: 'text/plain' });
    await parseLLM('Glucose 95 mg/dL', file);
    assert.ok(capturedUrl.includes('api.anthropic.com'), 'called Anthropic API');
    assert.strictEqual(capturedHeaders['x-api-key'], 'sk-ant-test', 'sent API key');
});

QUnit.test('converts valid Claude response to FHIR Observations', async assert => {
    setApiKey('sk-ant-test');
    window.fetch = makeMockFetch(200, VALID_CLAUDE_RESPONSE);
    const file = new File(['Glucose 95 mg/dL'], 'report.txt', { type: 'text/plain' });
    const obs = await parseLLM('Glucose 95 mg/dL', file);
    assert.equal(obs.length, 1, 'one observation returned');
    assert.equal(obs[0].resourceType, 'Observation', 'is an Observation resource');
    assert.equal(obs[0].effectiveDateTime, '2024-01-15', 'date preserved');
    assert.equal(obs[0].valueQuantity.value, 95, 'value preserved');
    assert.equal(obs[0].valueQuantity.unit, 'mg/dL', 'unit preserved');
});

QUnit.test('throws readable error on 401 (invalid API key)', async assert => {
    setApiKey('bad-key');
    window.fetch = makeMockFetch(401, { error: { message: 'Unauthorized' } });
    const file = new File(['test'], 'report.txt', { type: 'text/plain' });
    try {
        await parseLLM('test', file);
        assert.ok(false, 'should have thrown');
    } catch (err) {
        assert.ok(err.message.toLowerCase().includes('api key') || err.message.includes('401'), err.message);
    }
});

QUnit.test('throws readable error on 429 (rate limit)', async assert => {
    setApiKey('sk-ant-test');
    window.fetch = makeMockFetch(429, { error: { message: 'Too many requests' } });
    const file = new File(['test'], 'report.txt', { type: 'text/plain' });
    try {
        await parseLLM('test', file);
        assert.ok(false, 'should have thrown');
    } catch (err) {
        assert.ok(err.message.toLowerCase().includes('rate limit') || err.message.includes('429'), err.message);
    }
});

QUnit.test('throws when response text is not valid JSON', async assert => {
    setApiKey('sk-ant-test');
    window.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ content: [{ text: 'Sorry, I cannot process this.' }] }),
    });
    const file = new File(['test'], 'report.txt', { type: 'text/plain' });
    try {
        await parseLLM('test', file);
        assert.ok(false, 'should have thrown');
    } catch (err) {
        assert.ok(err.message.length > 0, 'throws a non-empty error message');
    }
});
