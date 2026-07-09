# Design Document: Expense and Budget Visualizer

## Overview

The Expense and Budget Visualizer is a fully client-side web application built with vanilla HTML, CSS, and JavaScript — no frameworks, no build tooling. It allows users to record daily spending transactions, view a running total balance, browse a scrollable transaction history, and visualize category spending via a Chart.js pie chart. All data is persisted in the browser's `localStorage`.

The application is a single-page experience delivered as three files:

```
index.html
css/styles.css
js/app.js
```

Chart.js is loaded from a CDN. No `package.json`, no bundler, no transpiler. Opening `index.html` in a browser is sufficient to run the app.

### Design Goals

- **Zero-dependency runtime** (except Chart.js CDN): no npm, no Webpack, no React.
- **Mobile-first**: designed at 320px, enhanced at 768px and 1280px.
- **Resilience**: graceful degradation when `localStorage` is blocked or Chart.js fails to load.
- **Correctness**: a small, pure-function core makes the data model independently testable.

---

## Architecture

The app follows a unidirectional data-flow pattern:

```
User Action
    │
    ▼
EventHandler (form submit / delete click)
    │
    ▼
Validator ──── fails ──► ErrorRenderer
    │
  passes
    │
    ▼
TransactionStore (in-memory array)
    │
    ▼
LocalStorageAdapter (write-through)
    │
    ▼
Renderers (ListRenderer, BalanceRenderer, ChartManager)
```

1. **User action** triggers an event handler.
2. The handler calls the **Validator**; on failure, inline errors are shown and execution stops.
3. On success, the **TransactionStore** is mutated (add or delete).
4. The **LocalStorageAdapter** writes the updated store immediately (synchronously).
5. All three **Renderers** are called to re-paint the UI.

This flow runs entirely synchronously (except for Chart.js canvas operations which are handled in the same call stack microtask), ensuring the 100ms UI-update budget is met.

### Module Boundaries (all within `js/app.js`)

Because there is no module bundler, the code is organized as a collection of pure functions and IIFE-scoped state. Each logical module is a plain object or a group of named functions:

| Module | Responsibility |
|---|---|
| `TransactionStore` | In-memory array of transactions; add/delete/getAll |
| `Validator` | Pure functions that validate a raw form input object |
| `LocalStorageAdapter` | `read()` / `write()` wrappers with try/catch |
| `ListRenderer` | Renders the `<ul>` transaction list from a transactions array |
| `BalanceRenderer` | Computes and displays the total balance |
| `ChartManager` | Creates and updates the Chart.js pie chart instance |
| `ErrorRenderer` | Shows and clears inline validation errors and toast notifications |
| `App` | Bootstrap — wires DOM events, calls `LocalStorageAdapter.read()` on init |

---

## Components and Interfaces

### HTML Structure (`index.html`)

```
<body>
  <header>
    <h1>Expense Tracker</h1>
    <div id="balance-display">$0.00</div>       <!-- BalanceRenderer target -->
  </header>

  <main>
    <!-- Toast notification area -->
    <div id="toast" role="alert" aria-live="polite"></div>

    <!-- Transaction input form -->
    <section id="form-section">
      <form id="transaction-form" novalidate>
        <div class="field-group">
          <label for="item-name">Item Name</label>
          <input id="item-name" type="text" maxlength="100" autocomplete="off" />
          <span class="field-error" id="item-name-error"></span>
        </div>
        <div class="field-group">
          <label for="amount">Amount ($)</label>
          <input id="amount" type="number" min="0.01" max="999999999.99" step="0.01" />
          <span class="field-error" id="amount-error"></span>
        </div>
        <div class="field-group">
          <label for="category">Category</label>
          <select id="category">
            <option value="">-- Select --</option>
            <option value="Food">Food</option>
            <option value="Transport">Transport</option>
            <option value="Fun">Fun</option>
          </select>
          <span class="field-error" id="category-error"></span>
        </div>
        <button type="submit" id="add-btn">Add Transaction</button>
      </form>
    </section>

    <!-- Spending chart -->
    <section id="chart-section">
      <div id="chart-container">
        <canvas id="spending-chart"></canvas>
        <p id="chart-empty-msg" hidden>No spending data yet.</p>
        <p id="chart-error-msg" hidden>Chart unavailable.</p>
      </div>
    </section>

    <!-- Transaction list -->
    <section id="list-section">
      <h2>Transactions</h2>
      <ul id="transaction-list" aria-live="polite">
        <!-- ListRenderer target -->
      </ul>
      <p id="list-empty-msg" hidden>No transactions yet.</p>
    </section>
  </main>
</body>
```

### Function Signatures

#### `TransactionStore`

```js
const TransactionStore = {
  _transactions: [],          // [Transaction]

  load(transactions),         // replace _transactions with provided array
  getAll(),                   // → Transaction[] (shallow copy, newest-first)
  add(transaction),           // appends to _transactions; returns void
  delete(id),                 // removes by id; returns void
  getTotalBalance(),          // → number (sum of all amounts)
  getCategoryTotals(),        // → { Food: number, Transport: number, Fun: number }
};
```

#### `Validator`

```js
// All functions are pure (no side-effects).
Validator.validateName(name)     // → { ok: bool, error: string|null }
Validator.validateAmount(raw)    // → { ok: bool, value: number|null, error: string|null }
Validator.validateCategory(cat)  // → { ok: bool, error: string|null }
Validator.validateForm(formData) // → { ok: bool, errors: { name, amount, category } }
```

`validateForm` is a composed call of the three field validators. It returns an aggregate result so the handler can display all errors in one pass.

#### `LocalStorageAdapter`

```js
LocalStorageAdapter.read()     // → Transaction[] | null (null on failure)
LocalStorageAdapter.write(arr) // → { ok: bool, error: string|null }
```

Both methods contain `try/catch` blocks. `write` serializes with `JSON.stringify`; `read` deserializes with `JSON.parse` and performs a basic structure check (see Error Handling).

#### `ListRenderer`

```js
ListRenderer.render(transactions) // re-builds <ul id="transaction-list"> from scratch
```

Each list item is built with `document.createElement` to avoid `innerHTML` XSS risk.

#### `BalanceRenderer`

```js
BalanceRenderer.render(total) // updates #balance-display text content
```

`total` is a `number`. Formatting uses `toFixed(2)` preceded by `$`.

#### `ChartManager`

```js
ChartManager.init(canvasId)         // creates Chart.js instance; must be called once
ChartManager.update(categoryTotals) // calls chart.data.datasets[0].data = ... + chart.update()
ChartManager.destroy()              // tears down chart instance (used in tests)
ChartManager.showEmpty()            // hides canvas, shows #chart-empty-msg
ChartManager.showError()            // hides canvas, shows #chart-error-msg
```

`ChartManager.init` is wrapped in a `try/catch`; if Chart.js is absent (CDN blocked), `showError()` is called.

#### `ErrorRenderer`

```js
ErrorRenderer.showFieldError(fieldId, message)   // sets text content on #<fieldId>-error
ErrorRenderer.clearFieldErrors()                 // clears all .field-error elements
ErrorRenderer.showToast(message, type)           // 'info' | 'warning' | 'error'; auto-dismisses after 4s
```

#### `App` (bootstrap)

```js
App.init() // called on DOMContentLoaded
```

`App.init` performs the following sequence:
1. Detect `localStorage` availability (see Browser Compatibility).
2. Call `LocalStorageAdapter.read()` and handle error/corruption.
3. Call `TransactionStore.load(transactions)`.
4. Render all three UI components.
5. Attach `submit` listener to `#transaction-form`.
6. Attach delegated `click` listener to `#transaction-list` for delete buttons.

---

## Data Models

### Transaction Object

```js
/**
 * @typedef {Object} Transaction
 * @property {string} id          - UUID v4 generated with crypto.randomUUID()
 * @property {string} name        - Item name; 1–100 chars
 * @property {number} amount      - Positive number; 0.01–999,999,999.99
 * @property {string} category    - One of: 'Food' | 'Transport' | 'Fun'
 * @property {number} timestamp   - Unix ms from Date.now() at save time
 */
```

#### Example

```json
{
  "id": "3f2e1b0a-...",
  "name": "Coffee",
  "amount": 4.50,
  "category": "Food",
  "timestamp": 1720000000000
}
```

#### Validation Constraints (used by `Validator`)

| Field | Rule |
|---|---|
| `name` | Non-empty string, trimmed length 1–100 |
| `amount` | Parseable as `float`, value `0.01 ≤ x ≤ 999,999,999.99` |
| `category` | One of `['Food', 'Transport', 'Fun']` |
| `id` | Auto-generated, not user-supplied |
| `timestamp` | Auto-generated, not user-supplied |

### LocalStorage Schema

Key: `"expense-tracker-transactions"`  
Value: `JSON.stringify(Transaction[])`

On `read`, the adapter checks:
- `JSON.parse` succeeds.
- Result is an array.
- Every element has `id` (string), `name` (string), `amount` (positive number), `category` (valid enum), `timestamp` (number).

Any element failing the check is dropped (partial corruption recovery) and a warning toast is shown.

### Category Totals (computed, not persisted)

```js
// Derived in TransactionStore.getCategoryTotals()
{ Food: 0, Transport: 0, Fun: 0 }
```

Defaults to 0 for each category so ChartManager always receives a complete object.

---

## Event Flow

### Form Submit

```
#transaction-form 'submit'
  │ preventDefault()
  │
  ├─ ErrorRenderer.clearFieldErrors()
  │
  ├─ Validator.validateForm({ name, amount, category })
  │     fail → ErrorRenderer.showFieldError(...) × N   [stop]
  │
  ├─ Transaction = buildTransaction(formData)         (id=randomUUID, ts=Date.now())
  │
  ├─ TransactionStore.add(transaction)
  │
  ├─ LocalStorageAdapter.write(TransactionStore.getAll())
  │     fail → ErrorRenderer.showToast(warning)
  │
  ├─ ListRenderer.render(TransactionStore.getAll())
  ├─ BalanceRenderer.render(TransactionStore.getTotalBalance())
  └─ ChartManager.update(TransactionStore.getCategoryTotals())
       └─ reset form fields
```

### Delete Transaction

```
#transaction-list 'click' (event delegation)
  │ if target.dataset.deleteId exists:
  │
  ├─ TransactionStore.delete(id)
  │
  ├─ LocalStorageAdapter.write(TransactionStore.getAll())
  │     fail → ErrorRenderer.showToast(warning)
  │
  ├─ ListRenderer.render(TransactionStore.getAll())
  ├─ BalanceRenderer.render(TransactionStore.getTotalBalance())
  └─ ChartManager.update(TransactionStore.getCategoryTotals())
```

### Page Load

```
DOMContentLoaded
  └─ App.init()
       │
       ├─ localStorage availability check
       │     fail → ErrorRenderer.showToast(info) + operate in-memory mode
       │
       ├─ LocalStorageAdapter.read()
       │     parse error → discard + ErrorRenderer.showToast(warning)
       │     partial corruption → drop invalid items + ErrorRenderer.showToast(warning)
       │
       ├─ TransactionStore.load(validTransactions)
       │
       ├─ ListRenderer.render(...)
       ├─ BalanceRenderer.render(...)
       ├─ ChartManager.init('spending-chart')
       │     fail → ChartManager.showError()
       └─ ChartManager.update(...)
```

---

## CSS Architecture

### Mobile-First Responsive Layout

`css/styles.css` is organized in three layers:

#### 1. Reset & Base (no media query)

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --color-food: #FF6384;
  --color-transport: #36A2EB;
  --color-fun: #FFCE56;
  --color-bg: #f8f9fa;
  --color-surface: #ffffff;
  --color-text: #212529;
  --color-error: #dc3545;
  --radius: 8px;
  --spacing: 1rem;
}
```

#### 2. Single-Column Layout (base / < 768px)

```
<body>
  header (sticky, full-width)
  main (single column, max-width: 100%, padding: var(--spacing))
    #form-section
    #chart-section
    #list-section
```

All sections stacked vertically. `#transaction-list` has `max-height: 40vh; overflow-y: auto` to allow independent scrolling without affecting page layout.

#### 3. Two-Column Enhancement (≥ 768px)

```css
@media (min-width: 768px) {
  main {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "form  chart"
      "list  list";
    gap: var(--spacing);
    max-width: 1280px;
    margin-inline: auto;
  }
  #form-section  { grid-area: form; }
  #chart-section { grid-area: chart; }
  #list-section  { grid-area: list; }
}
```

#### Tap Target Enforcement

```css
button, input, select {
  min-height: 44px;
  min-width: 44px;
}
```

Applied unconditionally so mobile users always get compliant touch targets.

#### Chart Container

```css
#chart-container {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;   /* square canvas, scales with container width */
  max-width: 320px;
  margin-inline: auto;
}
#spending-chart {
  width: 100% !important;
  height: 100% !important;
}
```

Chart.js requires explicit `width`/`height` overrides to respect CSS dimensions correctly.

---

## Chart.js Integration

### CDN Loading

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<script src="js/app.js"></script>
```

`app.js` is loaded after Chart.js so `window.Chart` is available synchronously. No async loading needed.

### Initialization Pattern

```js
ChartManager.init = function(canvasId) {
  try {
    const canvas = document.getElementById(canvasId);
    ChartManager._instance = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: ['Food', 'Transport', 'Fun'],
        datasets: [{
          data: [0, 0, 0],
          backgroundColor: [
            getComputedStyle(document.documentElement).getPropertyValue('--color-food'),
            getComputedStyle(document.documentElement).getPropertyValue('--color-transport'),
            getComputedStyle(document.documentElement).getPropertyValue('--color-fun'),
          ],
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed.toFixed(2)}%`
            }
          }
        }
      }
    });
  } catch (e) {
    ChartManager.showError();
  }
};
```

### Update Pattern

```js
ChartManager.update = function(categoryTotals) {
  const total = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  if (total === 0) {
    ChartManager.showEmpty();
    return;
  }

  // Show canvas, hide messages
  document.getElementById('spending-chart').hidden = false;
  document.getElementById('chart-empty-msg').hidden = true;

  const inst = ChartManager._instance;
  // Update data in-place to preserve animation context
  inst.data.datasets[0].data = [
    categoryTotals.Food,
    categoryTotals.Transport,
    categoryTotals.Fun,
  ];
  inst.update();
};
```

Segment percentages are computed by Chart.js's built-in tooltip formatter; labels are the static `labels` array. For the percentage display requirement (1 decimal place), a custom `datalabels` plugin or tooltip callback handles the formatting.

---

## Error Handling

### Validation Errors (inline)

- Each field error element (`#item-name-error`, `#amount-error`, `#category-error`) is a `<span>` with `role="alert"`.
- `ErrorRenderer.showFieldError(id, msg)` sets `textContent` and adds `.has-error` class to the parent `.field-group`.
- `ErrorRenderer.clearFieldErrors()` resets all spans and removes `.has-error` classes before each submit attempt.

### LocalStorage Failure

| Scenario | Behavior |
|---|---|
| `localStorage` unavailable (blocked/denied) | Toast: "Data persistence is disabled. Your transactions will be lost when you close this page." Operate with in-memory array. |
| Write failure (e.g., quota exceeded) | Toast: "Could not save your transaction. Storage may be full." In-memory state is still updated. |
| Read: invalid JSON | Toast: "Saved data is corrupted and could not be loaded. Starting fresh." Initialize with empty array. |
| Read: partial corruption (bad items) | Drop invalid items, Toast: "Some saved transactions could not be read and were removed." |

All toasts auto-dismiss after 4 seconds. They use `role="alert"` and `aria-live="polite"` for screen readers.

### Chart.js Failure

| Scenario | Behavior |
|---|---|
| CDN script fails to load | `window.Chart` is undefined; `ChartManager.init` try/catch catches the `ReferenceError`, calls `ChartManager.showError()` displaying "Chart unavailable." Transaction list and balance remain fully functional. |
| `chart.update()` throws | Caught in `ChartManager.update`, calls `ChartManager.showError()`. |

---

## Testing Strategy

### Overview

The app uses a **dual testing approach**:
- **Unit/example-based tests** for specific behaviors, error conditions, and edge cases
- **Property-based tests** for universal invariants across the pure-function core

Because the app has no build step, tests are run by loading a separate `test.html` that imports the same `js/app.js` (or an extracted pure-function module) alongside a property-based testing library.

**Recommended library**: [fast-check](https://fast-check.io/) (CDN UMD build), which runs in the browser without a build step:

```html
<script src="https://cdn.jsdelivr.net/npm/fast-check/lib/bundle/fast-check.js"></script>
```

Each property test runs a minimum of **100 iterations**.

### Unit Tests

| Area | Test Description |
|---|---|
| Validator | Empty name rejected; whitespace-only name rejected |
| Validator | Amount = 0 rejected; amount = 0.005 rounds correctly |
| Validator | Amount below 0.01 rejected; above 999,999,999.99 rejected |
| Validator | No category selected returns error |
| LocalStorageAdapter | Non-array JSON returns null |
| LocalStorageAdapter | Array with missing fields drops corrupt items |
| BalanceRenderer | Zero transactions → "$0.00" |
| ListRenderer | Empty array → empty-state message shown |
| ChartManager | No transactions → showEmpty() called |
| ChartManager | Chart.js absent → showError() called |
| App.init | localStorage blocked → toast shown, in-memory mode |

### Integration Tests

| Area | Test Description |
|---|---|
| Form submit flow | Valid form → transaction appears in list, balance updates |
| Delete flow | Delete → transaction removed from list and balance |
| Page reload | Transactions survive page reload via localStorage |
| Corruption recovery | Corrupt localStorage → empty state, warning toast |

### Property-Based Tests

See Correctness Properties section below. Each property maps to a tagged fast-check test:

```js
fc.assert(
  fc.property(/* arbitraries */, (input) => { /* assertion */ }),
  { numRuns: 100 }
);
// Tag: Feature: expense-budget-visualizer, Property N: <property_text>
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transaction persistence round-trip

*For any* valid array of transactions, serializing the array to JSON with `JSON.stringify` and then deserializing with `JSON.parse` should produce an array of transaction objects structurally equal to the original (same `id`, `name`, `amount`, `category`, and `timestamp` on every element).

**Validates: Requirements 5.1, 5.2**

### Property 2: Balance equals sum of amounts

*For any* array of transactions (including the empty array), the value returned by `TransactionStore.getTotalBalance()` should equal the arithmetic sum of all `amount` fields. When the array is empty, the result should be `0`.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 3: Whitespace and empty names are always invalid

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines) or the empty string, `Validator.validateName()` should return `{ ok: false }`.

**Validates: Requirements 1.3**

### Property 4: Amount validation respects the accepted range boundary

*For any* numeric value strictly less than `0.01` or strictly greater than `999,999,999.99`, `Validator.validateAmount()` should return `{ ok: false }`. Conversely, *for any* numeric value in the closed interval `[0.01, 999,999,999.99]`, `Validator.validateAmount()` should return `{ ok: true }`.

**Validates: Requirements 1.2, 1.4**

### Property 5: Delete removes exactly the targeted transaction

*For any* non-empty array of transactions and any `id` that exists in that array, after calling `TransactionStore.delete(id)` the resulting array should have a length exactly one less than before, and should contain no element with the deleted `id`.

**Validates: Requirements 2.4**

### Property 6: Category totals partition the total balance

*For any* array of valid transactions, the sum of all per-category values returned by `TransactionStore.getCategoryTotals()` should equal `TransactionStore.getTotalBalance()`. No transaction amount should be counted in more than one category.

**Validates: Requirements 4.1, 3.1**

### Property 7: Corrupt items are dropped; valid items are fully preserved

*For any* mixed array containing some valid transaction objects and some invalid objects (missing required fields, wrong types, or out-of-range values), the `LocalStorageAdapter` validation pass should return an array that contains every valid transaction unchanged and excludes every invalid object.

**Validates: Requirements 5.5**

### Property 8: Transaction list is always in reverse-chronological order

*For any* array of transactions with distinct `timestamp` values, `TransactionStore.getAll()` should return them sorted so that the element with the highest `timestamp` appears at index `0` and each subsequent element has a `timestamp` less than or equal to the previous one.

**Validates: Requirements 2.1**

### Property 9: Category percentage labels are always correct to one decimal place

*For any* set of non-zero category totals, the percentage computed for each category (as `(categoryTotal / sum) * 100`) formatted with one decimal place should equal `(categoryTotal / sum * 100).toFixed(1)`, and the percentages of all categories should sum to `100.0` (within floating-point rounding of `±0.1`).

**Validates: Requirements 4.5, 4.6**
