// ============================================================
// LocalStorageAdapter
// Handles read/write of the transactions array to localStorage.
// Requirements: 5.1, 5.2, 5.4, 5.5
// ============================================================

const STORAGE_KEY = 'expense-tracker-transactions';

const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];

const LocalStorageAdapter = {
  /**
   * Read and validate transactions from localStorage.
   * Returns:
   *   - Transaction[] on success (may have _hadCorruption flag if items were dropped)
   *   - null on total failure (JSON parse error or non-array result)
   */
  read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      // No entry yet — return empty array (not a failure)
      if (raw === null) {
        return [];
      }

      const parsed = JSON.parse(raw);

      // Result must be an array; anything else signals total corruption
      if (!Array.isArray(parsed)) {
        return null;
      }

      const validItems = [];

      for (const item of parsed) {
        // id: must be a string
        if (typeof item.id !== 'string') continue;

        // name: must be a non-empty string
        if (typeof item.name !== 'string' || item.name.trim().length === 0) continue;

        // amount: must be a finite positive number
        if (
          typeof item.amount !== 'number' ||
          !isFinite(item.amount) ||
          item.amount <= 0
        ) continue;

        // category: must be one of the allowed values
        if (!VALID_CATEGORIES.includes(item.category)) continue;

        // timestamp: must be a finite number
        if (typeof item.timestamp !== 'number' || !isFinite(item.timestamp)) continue;

        validItems.push(item);
      }

      // Flag partial corruption so App.init can warn the user
      if (validItems.length < parsed.length) {
        validItems._hadCorruption = true;
      }

      return validItems;
    } catch (err) {
      // JSON.parse failure or any unexpected error → signal total failure
      return null;
    }
  },

  /**
   * Serialize and write the transactions array to localStorage.
   * Returns { ok: true, error: null } on success.
   * Returns { ok: false, error: string } on failure.
   *
   * @param {Array} arr - Array of transaction objects to persist
   */
  write(arr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      return { ok: true, error: null };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
};

// ============================================================
// TransactionStore
// In-memory store for transaction objects.
// Requirements: 2.1, 3.1, 3.2, 3.3, 3.4, 4.1
// ============================================================

const TransactionStore = {
  _transactions: [],

  /**
   * Replace the internal array with a copy of the provided array.
   * @param {Transaction[]} transactions
   */
  load(transactions) {
    this._transactions = transactions.slice();
  },

  /**
   * Return a shallow copy of all transactions sorted newest-first.
   * @returns {Transaction[]}
   */
  getAll() {
    return [...this._transactions].sort((a, b) => b.timestamp - a.timestamp);
  },

  /**
   * Append a transaction to the internal array.
   * @param {Transaction} transaction
   */
  add(transaction) {
    this._transactions.push(transaction);
  },

  /**
   * Remove the transaction with the given id.
   * @param {string} id
   */
  delete(id) {
    this._transactions = this._transactions.filter(t => t.id !== id);
  },

  /**
   * Return the sum of all transaction amounts, or 0 if the array is empty.
   * @returns {number}
   */
  getTotalBalance() {
    return this._transactions.reduce((sum, t) => sum + t.amount, 0);
  },

  /**
   * Return an object mapping each category to its total amount.
   * @returns {{ Food: number, Transport: number, Fun: number }}
   */
  getCategoryTotals() {
    const totals = { Food: 0, Transport: 0, Fun: 0 };
    for (const t of this._transactions) {
      if (t.category in totals) {
        totals[t.category] += t.amount;
      }
    }
    return totals;
  },
};

// ============================================================
// Validator
// Pure validation functions — no DOM access, no side effects.
// Requirements: 1.2, 1.3, 1.4, 1.5
// ============================================================

const Validator = {
  /**
   * Validate the item name field.
   * @param {string} name
   * @returns {{ ok: boolean, error: string|null }}
   */
  validateName(name) {
    const trimmed = String(name).trim();
    if (trimmed.length === 0) {
      return { ok: false, error: 'Item name is required.' };
    }
    return { ok: true, error: null };
  },

  /**
   * Validate the amount field.
   * @param {string|number} raw
   * @returns {{ ok: boolean, value: number|null, error: string|null }}
   */
  validateAmount(raw) {
    const parsed = parseFloat(raw);
    if (isNaN(parsed) || parsed < 0.01 || parsed > 999999999.99) {
      return { ok: false, value: null, error: 'Amount must be between $0.01 and $999,999,999.99.' };
    }
    return { ok: true, value: parsed, error: null };
  },

  /**
   * Validate the category field.
   * @param {string} cat
   * @returns {{ ok: boolean, error: string|null }}
   */
  validateCategory(cat) {
    if (!['Food', 'Transport', 'Fun'].includes(cat)) {
      return { ok: false, error: 'Please select a category.' };
    }
    return { ok: true, error: null };
  },

  /**
   * Validate all three form fields at once.
   * @param {{ name: string, amount: string|number, category: string }} formData
   * @returns {{ ok: boolean, errors: { name: string|null, amount: string|null, category: string|null }, parsedAmount: number|null }}
   */
  validateForm(formData) {
    const nameR   = this.validateName(formData.name);
    const amountR = this.validateAmount(formData.amount);
    const catR    = this.validateCategory(formData.category);

    return {
      ok: nameR.ok && amountR.ok && catR.ok,
      errors: {
        name:     nameR.error,
        amount:   amountR.error,
        category: catR.error,
      },
      parsedAmount: amountR.value,
    };
  },
};

// ============================================================
// ListRenderer
// Renders the transaction list from an array of transactions.
// Requirements: 2.1, 2.2, 2.3, 2.5
// ============================================================

const ListRenderer = {
  render(transactions) {
    const list = document.getElementById('transaction-list');
    const emptyMsg = document.getElementById('list-empty-msg');

    // Clear existing items
    list.innerHTML = '';

    if (transactions.length === 0) {
      emptyMsg.hidden = false;
      return;
    }

    emptyMsg.hidden = true;

    for (const t of transactions) {
      const li = document.createElement('li');

      // Left side: name + category
      const info = document.createElement('div');
      info.className = 'transaction-info';

      const nameEl = document.createElement('span');
      nameEl.className = 'transaction-name';
      nameEl.textContent = t.name.slice(0, 100);

      const metaEl = document.createElement('span');
      metaEl.className = 'transaction-meta';
      metaEl.textContent = t.category;

      info.appendChild(nameEl);
      info.appendChild(metaEl);

      // Right side: amount
      const amountEl = document.createElement('span');
      amountEl.className = 'transaction-amount';
      amountEl.textContent = '$' + t.amount.toFixed(2);

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.dataset.deleteId = t.id;
      deleteBtn.setAttribute('aria-label', 'Delete ' + t.name);

      li.appendChild(info);
      li.appendChild(amountEl);
      li.appendChild(deleteBtn);
      list.appendChild(li);
    }
  },
};

// ============================================================
// BalanceRenderer
// Updates the balance display element.
// Requirements: 3.1, 3.4, 3.5
// ============================================================

const BalanceRenderer = {
  render(total) {
    document.getElementById('balance-display').textContent = '$' + total.toFixed(2);
  },
};

// ============================================================
// ChartManager
// Manages the Chart.js pie chart lifecycle.
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7
// ============================================================

const ChartManager = {
  _instance: null,

  showEmpty() {
    const canvas = document.getElementById('spending-chart');
    const emptyMsg = document.getElementById('chart-empty-msg');
    const errorMsg = document.getElementById('chart-error-msg');
    if (canvas) canvas.hidden = true;
    if (emptyMsg) emptyMsg.hidden = false;
    if (errorMsg) errorMsg.hidden = true;
  },

  showError() {
    const canvas = document.getElementById('spending-chart');
    const emptyMsg = document.getElementById('chart-empty-msg');
    const errorMsg = document.getElementById('chart-error-msg');
    if (canvas) canvas.hidden = true;
    if (emptyMsg) emptyMsg.hidden = true;
    if (errorMsg) errorMsg.hidden = false;
  },

  init(canvasId) {
    try {
      const canvas = document.getElementById(canvasId);
      if (!canvas) { this.showError(); return; }

      // Check Chart.js is available
      if (typeof Chart === 'undefined') { this.showError(); return; }

      const style = getComputedStyle(document.documentElement);
      const colorFood      = style.getPropertyValue('--color-food').trim()      || '#FF6384';
      const colorTransport = style.getPropertyValue('--color-transport').trim() || '#36A2EB';
      const colorFun       = style.getPropertyValue('--color-fun').trim()       || '#FFCE56';

      this._instance = new Chart(canvas, {
        type: 'pie',
        data: {
          labels: ['Food', 'Transport', 'Fun'],
          datasets: [{
            data: [0, 0, 0],
            backgroundColor: [colorFood, colorTransport, colorFun],
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label(ctx) {
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0.0';
                  return ` ${ctx.label}: $${ctx.parsed.toFixed(2)} (${pct}%)`;
                },
              },
            },
          },
        },
      });

      // Show canvas, hide messages
      canvas.hidden = false;
      document.getElementById('chart-empty-msg').hidden = true;
      document.getElementById('chart-error-msg').hidden = true;
    } catch (err) {
      this.showError();
    }
  },

  update(categoryTotals) {
    try {
      const total = categoryTotals.Food + categoryTotals.Transport + categoryTotals.Fun;

      if (total === 0) {
        this.showEmpty();
        return;
      }

      if (!this._instance) { return; }

      const canvas = document.getElementById('spending-chart');
      if (canvas) canvas.hidden = false;
      const emptyMsg = document.getElementById('chart-empty-msg');
      if (emptyMsg) emptyMsg.hidden = true;

      this._instance.data.datasets[0].data = [
        categoryTotals.Food,
        categoryTotals.Transport,
        categoryTotals.Fun,
      ];
      this._instance.update();
    } catch (err) {
      this.showError();
    }
  },

  destroy() {
    if (this._instance) {
      this._instance.destroy();
      this._instance = null;
    }
  },
};

// ============================================================
// ErrorRenderer
// Shows and clears inline field errors and toast notifications.
// Requirements: 1.3, 1.4, 1.5, 5.4, 5.5, 8.3, 8.4
// ============================================================

const ErrorRenderer = {
  showFieldError(fieldId, message) {
    const errorSpan = document.getElementById(fieldId + '-error');
    if (errorSpan) errorSpan.textContent = message;
    const input = document.getElementById(fieldId);
    if (input) {
      const group = input.closest('.field-group');
      if (group) group.classList.add('has-error');
    }
  },

  clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach(el => {
      el.textContent = '';
    });
    document.querySelectorAll('.field-group.has-error').forEach(el => {
      el.classList.remove('has-error');
    });
  },

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.type = type;
    toast.hidden = false;
    clearTimeout(toast._dismissTimer);
    toast._dismissTimer = setTimeout(() => {
      toast.hidden = true;
      toast.textContent = '';
    }, 4000);
  },
};

// ============================================================
// App
// Bootstrap: wires the DOM, initialises state, attaches events.
// Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 2.4, 3.2, 3.3,
//               4.2, 4.3, 5.1, 8.3, 8.4
// ============================================================

const App = {
  // True when localStorage is available; false in session-only mode.
  _storageAvailable: false,

  /**
   * Test whether localStorage is accessible.
   * Returns true if both setItem and removeItem succeed.
   */
  _detectStorage() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Re-render all three UI surfaces from the current store state.
   */
  _renderAll() {
    ListRenderer.render(TransactionStore.getAll());
    BalanceRenderer.render(TransactionStore.getTotalBalance());
    ChartManager.update(TransactionStore.getCategoryTotals());
  },

  /**
   * Persist the current store to localStorage (if available).
   * Shows a toast on write failure.
   */
  _persist() {
    if (!this._storageAvailable) return;
    const result = LocalStorageAdapter.write(TransactionStore.getAll());
    if (!result.ok) {
      ErrorRenderer.showToast(
        'Could not save your transaction. Storage may be full.',
        'warning'
      );
    }
  },

  init() {
    // 1. Detect localStorage availability
    this._storageAvailable = this._detectStorage();
    if (!this._storageAvailable) {
      ErrorRenderer.showToast(
        'Data persistence is disabled. Your transactions will be lost when you close this page.',
        'info'
      );
    }

    // 2. Read persisted data
    let initialTransactions = [];
    if (this._storageAvailable) {
      const loaded = LocalStorageAdapter.read();

      if (loaded === null) {
        // Total failure — corrupt / unparseable JSON
        ErrorRenderer.showToast(
          'Saved data is corrupted and could not be loaded. Starting fresh.',
          'warning'
        );
      } else {
        if (loaded._hadCorruption) {
          ErrorRenderer.showToast(
            'Some saved transactions could not be read and were removed.',
            'warning'
          );
        }
        initialTransactions = loaded;
      }
    }

    // 3. Seed the store
    TransactionStore.load(initialTransactions);

    // 4. Initial render
    ChartManager.init('spending-chart');
    this._renderAll();

    // 5. Form submit handler
    const form = document.getElementById('transaction-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      ErrorRenderer.clearFieldErrors();

      const formData = {
        name:     document.getElementById('item-name').value,
        amount:   document.getElementById('amount').value,
        category: document.getElementById('category').value,
      };

      const validation = Validator.validateForm(formData);

      if (!validation.ok) {
        if (validation.errors.name)     ErrorRenderer.showFieldError('item-name', validation.errors.name);
        if (validation.errors.amount)   ErrorRenderer.showFieldError('amount', validation.errors.amount);
        if (validation.errors.category) ErrorRenderer.showFieldError('category', validation.errors.category);
        return;
      }

      // Build transaction object
      const transaction = {
        id:        crypto.randomUUID(),
        name:      formData.name.trim(),
        amount:    validation.parsedAmount,
        category:  formData.category,
        timestamp: Date.now(),
      };

      TransactionStore.add(transaction);
      this._persist();
      this._renderAll();

      // Reset form fields
      form.reset();
    });

    // 6. Delegated delete handler on the transaction list
    const list = document.getElementById('transaction-list');
    list.addEventListener('click', (e) => {
      const deleteId = e.target.dataset.deleteId;
      if (!deleteId) return;

      TransactionStore.delete(deleteId);
      this._persist();
      this._renderAll();
    });
  },
};

// Kick off the application once the DOM is ready.
document.addEventListener('DOMContentLoaded', () => App.init());
