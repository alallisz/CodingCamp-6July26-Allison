# Implementation Plan: Expense and Budget Visualizer

## Overview

Build a fully client-side, zero-build-step expense tracker using vanilla HTML, CSS, and JavaScript. The implementation is structured as incremental steps: scaffolding → markup → styles → pure-function core modules → renderers → bootstrap wiring → persistence → property tests. Each step produces working, integrated code before the next step begins.

---

## Tasks

- [x] 1. Project scaffolding
  - [x] 1.1 Create the file and folder structure
    - Create `index.html` at the project root (empty boilerplate: `<!DOCTYPE html>`, `<html lang="en">`, `<head>`, `<body>`)
    - Create `css/styles.css` (empty file)
    - Create `js/app.js` (empty file)
    - Create `test.html` at the project root (empty boilerplate for property-based tests)
    - _Requirements: 7.3_

- [x] 2. HTML structure
  - [x] 2.1 Build the full `index.html` document
    - Add `<meta name="viewport" content="width=device-width, initial-scale=1.0">` to `<head>`
    - Link `css/styles.css` in `<head>`
    - Add `<script>` tag for Chart.js CDN (`https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js`) before closing `</body>`
    - Add `<script src="js/app.js"></script>` after the Chart.js `<script>` tag
    - Implement the full `<body>` structure: `<header>` with `<h1>` and `<div id="balance-display">`, `<main>` containing `<div id="toast" role="alert" aria-live="polite">`, `<section id="form-section">` with `#transaction-form` (item-name, amount, category, submit button, field-error spans), `<section id="chart-section">` with `#chart-container`, `<canvas id="spending-chart">`, `#chart-empty-msg`, `#chart-error-msg`, and `<section id="list-section">` with `<ul id="transaction-list" aria-live="polite">` and `#list-empty-msg`
    - Each field must have a `<label>`, an `<input>`/`<select>`, and a `<span class="field-error" id="<fieldId>-error">` sibling
    - Form must have `novalidate` attribute to disable native browser validation
    - _Requirements: 1.1, 2.3, 2.5, 4.4, 4.7, 6.2, 6.3, 8.3_

- [x] 3. CSS styles
  - [x] 3.1 Implement reset, CSS variables, and base typography in `css/styles.css`
    - Universal box-sizing reset
    - `:root` block defining `--color-food`, `--color-transport`, `--color-fun`, `--color-bg`, `--color-surface`, `--color-text`, `--color-error`, `--radius`, `--spacing`
    - Base `body` styles: background, font-family, color
    - _Requirements: 6.1_
  - [x] 3.2 Implement mobile-first single-column layout and component styles
    - `header`: sticky, full-width, flex layout for title and balance side-by-side
    - `main`: single-column, full-width, padding using `--spacing`
    - `.field-group` spacing, `label` display, `input`/`select` full-width
    - `#transaction-list`: `max-height: 40vh; overflow-y: auto`
    - `#list-empty-msg` hidden by default
    - `.field-error` color, font-size
    - `#toast`: fixed positioning, hidden by default, transition for show/hide
    - _Requirements: 6.1, 6.2, 6.4_
  - [x] 3.3 Implement tap-target enforcement and chart container styles
    - `button, input, select { min-height: 44px; min-width: 44px; }`
    - `#chart-container`: `position: relative; width: 100%; aspect-ratio: 1/1; max-width: 320px; margin-inline: auto;`
    - `#spending-chart { width: 100% !important; height: 100% !important; }`
    - _Requirements: 6.5_
  - [x] 3.4 Implement the ≥768px two-column grid enhancement
    - `@media (min-width: 768px)` block: `main` uses `display: grid`, `grid-template-columns: 1fr 1fr`, `grid-template-areas: "form chart" "list list"`, `max-width: 1280px`, `margin-inline: auto`
    - Assign `grid-area` to `#form-section`, `#chart-section`, `#list-section`
    - _Requirements: 6.1, 6.4_

- [x] 4. `TransactionStore` module
  - [x] 4.1 Implement `TransactionStore` object in `js/app.js`
    - Declare `const TransactionStore` as a plain object with `_transactions: []`
    - Implement `load(transactions)`: replace `_transactions` with the provided array
    - Implement `getAll()`: return a shallow copy sorted by `timestamp` descending (newest first)
    - Implement `add(transaction)`: push to `_transactions`
    - Implement `delete(id)`: filter out the element with matching `id`
    - Implement `getTotalBalance()`: sum all `amount` fields; return `0` for empty array
    - Implement `getCategoryTotals()`: return `{ Food: 0, Transport: 0, Fun: 0 }` with amounts accumulated per category
    - _Requirements: 2.1, 3.1, 3.2, 3.3, 3.4, 4.1_

- [x] 5. `Validator` module
  - [x] 5.1 Implement `Validator` object in `js/app.js`
    - Implement `validateName(name)`: trim input; return `{ ok: false, error: '...' }` for empty/whitespace; return `{ ok: true, error: null }` otherwise
    - Implement `validateAmount(raw)`: parse with `parseFloat`; return `{ ok: false, value: null, error: '...' }` if `NaN`, `< 0.01`, or `> 999999999.99`; return `{ ok: true, value: parsedFloat, error: null }` otherwise
    - Implement `validateCategory(cat)`: return `{ ok: false, error: '...' }` if `cat` is not one of `['Food', 'Transport', 'Fun']`; return `{ ok: true, error: null }` otherwise
    - Implement `validateForm(formData)`: call all three validators, aggregate results; return `{ ok: bool, errors: { name, amount, category } }`
    - All functions must be pure (no DOM access, no side effects)
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
    
- [x] 6. `LocalStorageAdapter` module
  - [x] 6.1 Implement `LocalStorageAdapter` object in `js/app.js`
    - Implement `read()`: wrap in `try/catch`; parse JSON from key `"expense-tracker-transactions"`; validate result is an array; for each element validate presence and types of `id` (string), `name` (string), `amount` (positive number), `category` (valid enum), `timestamp` (number); drop invalid items; return valid items array (or `null` on total parse failure)
    - Implement `write(arr)`: wrap in `try/catch`; call `localStorage.setItem` with `JSON.stringify(arr)`; return `{ ok: true, error: null }` on success; return `{ ok: false, error: err.message }` on failure
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [x] 7. `ListRenderer` module
  - [x] 7.1 Implement `ListRenderer` in `js/app.js`
    - Implement `render(transactions)`: clear `#transaction-list`; if `transactions.length === 0`, show `#list-empty-msg` and return
    - Hide `#list-empty-msg` when rendering non-empty list
    - For each transaction, build `<li>` using `document.createElement` (no `innerHTML`); include item name, amount formatted as `$x.xx` with `toFixed(2)`, category label, and a delete `<button>` with `data-delete-id` set to transaction's `id`
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 8. `BalanceRenderer` module
  - [x] 8.1 Implement `BalanceRenderer` in `js/app.js`
    - Implement `render(total)`: set `document.getElementById('balance-display').textContent` to `'$' + total.toFixed(2)`
    - _Requirements: 3.1, 3.4, 3.5_

- [x] 9. `ChartManager` module
  - [x] 9.1 Implement `ChartManager` in `js/app.js`
    - Declare `ChartManager` object with `_instance: null`
    - Implement `showEmpty()`: hide `#spending-chart`, show `#chart-empty-msg`, hide `#chart-error-msg`
    - Implement `showError()`: hide `#spending-chart`, hide `#chart-empty-msg`, show `#chart-error-msg`
    - Implement `init(canvasId)`: wrap in `try/catch`; create `new Chart(canvas, { type: 'pie', ... })` with labels `['Food', 'Transport', 'Fun']`, `backgroundColor` reading CSS variables via `getComputedStyle`, `responsive: true`, `maintainAspectRatio: true`, legend at bottom, tooltip callback formatting to two decimal places; on catch call `showError()`
    - Implement `update(categoryTotals)`: compute total; if `0` call `showEmpty()` and return; otherwise show canvas, update `_instance.data.datasets[0].data` with `[Food, Transport, Fun]` values, call `_instance.update()`
    - Implement `destroy()`: call `_instance.destroy()` and set `_instance = null` (for test teardown)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7_
  

- [x] 10. `ErrorRenderer` module
  - [x] 10.1 Implement `ErrorRenderer` in `js/app.js`
    - Implement `showFieldError(fieldId, message)`: set `textContent` on `#<fieldId>-error` span; add `.has-error` class to parent `.field-group`
    - Implement `clearFieldErrors()`: select all `.field-error` spans, clear `textContent`; remove `.has-error` from all `.field-group` elements
    - Implement `showToast(message, type)`: set `#toast` `textContent` to `message`; set a `data-type` attribute to `type` (`'info'`, `'warning'`, `'error'`); remove `hidden`; after 4000ms restore `hidden` and clear text content
    - _Requirements: 1.3, 1.4, 1.5, 5.4, 5.5, 8.3, 8.4_

- [x] 11. App bootstrap and event wiring
  - [x] 11.1 Implement `App.init()` and event handlers in `js/app.js`
    - Implement `App.init()` called on `DOMContentLoaded`:
      1. Detect `localStorage` availability: wrap a test `setItem`/`removeItem` in `try/catch`; set a module-level `storageAvailable` boolean; if unavailable call `ErrorRenderer.showToast('Data persistence is disabled...', 'info')`
      2. Call `LocalStorageAdapter.read()`; handle `null` (total failure) vs. partial corruption (warnings) with appropriate `ErrorRenderer.showToast` calls
      3. Call `TransactionStore.load(validTransactions)`
      4. Call `ListRenderer.render(TransactionStore.getAll())`, `BalanceRenderer.render(TransactionStore.getTotalBalance())`, `ChartManager.init('spending-chart')`, `ChartManager.update(TransactionStore.getCategoryTotals())`
      5. Attach `submit` listener to `#transaction-form` (call `preventDefault`, clear errors, validate, build transaction with `crypto.randomUUID()` and `Date.now()`, add to store, write to adapter, re-render all three renderers, reset form)
      6. Attach delegated `click` listener to `#transaction-list` (check `e.target.dataset.deleteId`; if present delete from store, write, re-render)
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 2.4, 3.2, 3.3, 4.2, 4.3, 5.1, 8.3, 8.4_

- [x] 12. Checkpoint — Verify core flow end-to-end
  - Ensure all tests pass, ask the user if questions arise.
  - Open `index.html` in a browser; confirm: form renders, a valid submission adds a transaction to the list and updates the balance and chart, delete removes the item, empty state shows when list is empty.

- [x] 13. Property-based test harness setup
  - [x] 13.1 Set up `test.html` with fast-check CDN and test runner
    - Add `<script src="https://cdn.jsdelivr.net/npm/fast-check/lib/bundle/fast-check.js"></script>` to `test.html`
    - Add `<script src="js/app.js"></script>` after fast-check (so all modules are available)
    - Add a minimal console-based test runner: a `run(name, fn)` helper that calls `fn()`, catches exceptions, and logs pass/fail to `document.body` and `console`
    - _Requirements: (testing infrastructure)_
  - [x] 13.2 Implement Property 1 test in `test.html`
    - **Property 1: Transaction persistence round-trip**
    - Use `fc.array(validTransactionArbitrary)` as arbitrary; serialize with `JSON.stringify`, parse with `JSON.parse`; assert each field (`id`, `name`, `amount`, `category`, `timestamp`) equals the original
    - Minimum 100 runs via `fc.assert(..., { numRuns: 100 })`
    - Tag: `Feature: expense-budget-visualizer, Property 1`
    - **Validates: Requirements 5.1, 5.2**

- [x] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Open `test.html` in a browser and confirm all 9 property tests report pass in the console and on-page output.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; core functionality is fully usable without them.
- All property tests (4.2–4.5, 5.2–5.3, 6.2, 9.2, 13.2) use `fc.assert` with `{ numRuns: 100 }` minimum.
- The pure-function modules (`TransactionStore`, `Validator`, `LocalStorageAdapter`) can be tested without a DOM; use a mock `localStorage` object in test.html when needed.
- `document.createElement` must be used for all list item construction — no `innerHTML` — to avoid XSS risk.
- `crypto.randomUUID()` is available in all four target browsers in their latest stable versions.
- Chart.js must be loaded before `app.js` in every HTML file so `window.Chart` is available synchronously.
- Each task references specific requirements for traceability; the design document provides all function signatures and CSS patterns.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "3.4", "4.1", "5.1", "6.1"] },
    { "id": 3, "tasks": ["7.1", "8.1", "9.1", "10.1", "4.2", "5.2", "5.3", "6.2"] },
    { "id": 4, "tasks": ["11.1", "4.3", "4.4", "4.5", "9.2"] },
    { "id": 5, "tasks": ["13.1"] },
    { "id": 6, "tasks": ["13.2"] }
  ]
}
```
