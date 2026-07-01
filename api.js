/**
 * api.js
 * ---------------------------------------------------------------------------
 * Thin wrapper around every backend REST call. No UI logic lives here -
 * app.js is responsible for rendering and interaction; this file only
 * knows how to talk to Apps Script.
 *
 * IMPORTANT: POST requests use Content-Type: text/plain (not
 * application/json) on purpose. Apps Script Web Apps cannot respond to a
 * CORS preflight (OPTIONS) request, and application/json triggers one.
 * text/plain is a "simple request" so the browser skips the preflight
 * entirely - the body is still valid JSON, Backend.gs parses it as such.
 * ---------------------------------------------------------------------------
 */

// -----------------------------------------------------------------------
// EDIT THIS WHEN REUSING THE PROJECT
// -----------------------------------------------------------------------

/** Paste your deployed Apps Script Web App URL here (ends in /exec). */
const API_URL = 'https://script.google.com/macros/s/AKfycbx7RDf-TTSnS5KmOt-ghJqbhetCCDPz6LzAMQuPjzXyiFwUGhzt2AHyUzUq-XOVjNhdRA/exec';

// -----------------------------------------------------------------------
// CORE REQUEST HELPERS
// -----------------------------------------------------------------------

/**
 * Performs a GET request against a named backend action.
 * @param {string} action - e.g. 'dashboard', 'emi', 'transactions'
 * @return {Promise<*>} The `data` field of the backend's JSON response.
 */
async function apiGet(action) {
  const response = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, {
    method: 'GET'
  });
  return parseApiResponse(response);
}

/**
 * Performs a POST request against a named backend action.
 * @param {string} action - e.g. 'markPaid', 'addExpense'
 * @param {Object} payload - Additional fields sent alongside the action.
 * @return {Promise<*>} The `data` field of the backend's JSON response.
 */
async function apiPost(action, payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    // text/plain avoids a CORS preflight - see file header note.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ action: action }, payload))
  });
  return parseApiResponse(response);
}

/**
 * Parses the backend's standard { success, data } / { success, error }
 * envelope and throws on failure so callers can use a single try/catch.
 * @param {Response} response
 * @return {Promise<*>}
 */
async function parseApiResponse(response) {
  if (!response.ok) {
    throw new Error(`Network error: ${response.status}`);
  }
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || 'Unknown API error.');
  }
  return json.data;
}

// -----------------------------------------------------------------------
// PUBLIC API SURFACE
// -----------------------------------------------------------------------

const api = {
  getDashboard: () => apiGet('dashboard'),
  getEmi: () => apiGet('emi'),
  getTransactions: () => apiGet('transactions'),

  markPaid: (rowNumber) => apiPost('markPaid', { rowNumber }),
  resetMonth: () => apiPost('resetMonth', {}),
  addExpense: (card, amount, comment) => apiPost('addExpense', { card, amount, comment }),
  addPayment: (card, amount, comment) => apiPost('addPayment', { card, amount, comment })
};
