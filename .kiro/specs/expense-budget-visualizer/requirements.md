# Requirements Document

## Introduction

The Expense and Budget Visualizer is a mobile-friendly, client-side web application that helps users track their daily spending. It provides a running total balance, a scrollable transaction history, and a pie chart visualizing spending distribution by category. The app is built with HTML, CSS, and vanilla JavaScript, persists data in the browser's Local Storage, and requires no backend server or build tooling.

---

## Glossary

- **App**: The Expense and Budget Visualizer web application running in the user's browser.
- **Transaction**: A single spending record consisting of an item name, a monetary amount, and a category.
- **Category**: One of three predefined spending groups — Food, Transport, or Fun.
- **Transaction List**: The scrollable UI region that displays all recorded transactions.
- **Balance Display**: The UI element at the top of the App that shows the sum of all transaction amounts.
- **Chart**: The pie chart rendered by Chart.js that visualizes spending distribution by Category.
- **Form**: The input form through which the user creates a new Transaction.
- **Local Storage**: The browser's `localStorage` API used to persist transactions between sessions.
- **Validator**: The client-side logic that checks all Form fields before a Transaction is saved.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to enter a transaction's name, amount, and category through a form, so that I can record my spending quickly.

#### Acceptance Criteria

1. THE App SHALL render a Form containing an item-name text field (maximum 100 characters), a numeric amount field accepting values in the range 0.01–999,999,999.99, and a category selector with the options Food, Transport, and Fun.
2. WHEN the user submits the Form, THE Validator SHALL check that the item-name field is non-empty, the amount field contains a positive number within the accepted range, and a category has been selected.
3. IF the item-name field is empty on submission, THEN THE App SHALL display an inline error message adjacent to the item-name field and SHALL NOT save the Transaction.
4. IF the amount field does not contain a number in the range 0.01–999,999,999.99 on submission, THEN THE App SHALL display an inline error message adjacent to the amount field and SHALL NOT save the Transaction.
5. IF no category has been selected on submission, THEN THE App SHALL display an inline error message adjacent to the category selector and SHALL NOT save the Transaction.
6. WHEN all Form fields pass validation and the user submits the Form, THE App SHALL save the Transaction and reset the item-name field to empty, the amount field to empty, and the category selector to its default unselected state.

---

### Requirement 2: Transaction List Display

**User Story:** As a user, I want to see a scrollable list of all my recorded transactions, so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction List SHALL display all stored Transactions in reverse-chronological order (most recent first).
2. WHEN a Transaction is displayed in the Transaction List, THE App SHALL show the item name truncated to a maximum of 100 characters, the amount prefixed with a currency symbol (e.g., $) and formatted as a two-decimal-place value, and the Category for that Transaction.
3. WHILE the Transaction List contains more entries than fit the visible viewport, THE App SHALL allow the user to scroll through the full list without affecting the rest of the page layout.
4. WHEN the user deletes a Transaction from the Transaction List, THE App SHALL remove that Transaction from Local Storage and re-render the Transaction List and Balance Display within 100ms.
5. IF no Transactions are stored, THE App SHALL display an empty-state message (e.g., "No transactions yet.") in the Transaction List.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending balance at the top of the page, so that I always know how much I have spent in total.

#### Acceptance Criteria

1. THE Balance Display SHALL show the sum of the amounts of all stored Transactions, prefixed with a currency symbol (e.g., $) and formatted as a two-decimal-place value.
2. WHEN a new Transaction is saved, THE App SHALL update the Balance Display to reflect the new total within 100ms.
3. WHEN a Transaction is deleted, THE App SHALL update the Balance Display to reflect the new total within 100ms.
4. WHEN no Transactions are stored, THE Balance Display SHALL show a value of $0.00.
5. THE Balance Display SHALL be positioned at the top of the visible viewport on all screen sizes.
6. WHEN the total balance exceeds 999,999,999.99, THE App SHALL display the full value without truncation or overflow clipping.

---

### Requirement 4: Spending Category Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand where my money is going at a glance.

#### Acceptance Criteria

1. THE Chart SHALL render as a pie chart using Chart.js, with one segment per Category that has at least one Transaction, where each segment arc size is proportional to that Category's share of total spending.
2. WHEN a new Transaction is saved, THE App SHALL update the Chart to reflect the new category totals within 100ms.
3. WHEN a Transaction is deleted, THE App SHALL update the Chart to reflect the revised category totals within 100ms.
4. WHEN no Transactions are stored, THE Chart SHALL display a text message (e.g., "No spending data yet.") in place of the chart canvas.
5. THE Chart SHALL label each segment with its Category name and display the percentage share of that Category relative to total spending, expressed to one decimal place (e.g., 33.3%).
6. WHEN only one Category has Transactions, THE Chart SHALL render a single full-circle segment with the Category label and a percentage of 100.0%.
7. IF Chart.js fails to render the Chart, THEN THE App SHALL display an inline error message in the Chart area and the Transaction List SHALL remain fully functional.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions, so that I do not lose my spending history when I close or refresh the page.

#### Acceptance Criteria

1. WHEN a Transaction is saved, THE App SHALL write the full list of Transactions to Local Storage as a JSON-serialized array, completing the write within 500ms of the Transaction being saved.
2. WHEN the App initializes, THE App SHALL read the Transactions array from Local Storage and complete initial rendering of the Transaction List, Balance Display, and Chart within 1000ms of page load.
3. IF Local Storage does not contain a Transactions entry on initialization, THEN THE App SHALL initialize with an empty Transactions array and render the empty state for all UI components.
4. IF a Local Storage read or write operation fails, THEN THE App SHALL display a non-blocking error notification to the user and continue operating with the in-memory Transactions array for the current session.
5. IF Local Storage contains data that cannot be parsed as a valid JSON array of Transactions, THEN THE App SHALL discard the corrupted data, initialize with an empty Transactions array, and display a non-blocking warning notification.

---

### Requirement 6: Mobile-Friendly Layout

**User Story:** As a user on a mobile device, I want the app to display correctly on a small screen, so that I can track expenses on the go.

#### Acceptance Criteria

1. THE App SHALL use a responsive CSS layout that adapts to viewport widths from 320px to 1280px without horizontal scrolling or content overflow.
2. THE Form, Balance Display, Transaction List, and Chart SHALL each remain fully visible and interactive at a viewport width of 375px (iPhone SE reference size), meaning no content is clipped, no horizontal scrollbar appears, and all controls are reachable.
3. THE App SHALL set the HTML viewport meta tag to `width=device-width, initial-scale=1.0` to prevent default browser zoom on mobile devices.
4. WHEN the viewport width is less than 768px, THE App SHALL display all major UI sections (Form, Balance Display, Transaction List, Chart) stacked in a single column.
5. All interactive controls (buttons, inputs, selectors) SHALL have a minimum tap target size of 44×44 CSS pixels on mobile viewports.

---

### Requirement 7: Performance

**User Story:** As a user, I want the app to feel fast and responsive, so that adding and deleting transactions does not feel slow or laggy.

#### Acceptance Criteria

1. THE App SHALL complete initial page load within 2 seconds, measured from navigation start to the last Transaction item being visible in the Transaction List, on a mid-range mobile device on a 4G connection.
2. WHEN the user submits the Form or deletes a Transaction, THE App SHALL update the Transaction List, Balance Display, and Chart within 100ms of the triggering user action, with no intermediate loading state shown.
3. THE App SHALL consist of a single HTML file, one CSS file in a `css/` directory, and one JavaScript file in a `js/` directory, with no build step, bundler (webpack, Vite, Rollup, or equivalent), or package manager required.
4. WHEN more than 500 Transactions are stored, THE App SHALL still update the Transaction List, Balance Display, and Chart within 500ms.

---

### Requirement 8: Browser Compatibility

**User Story:** As a user, I want the app to work in any modern browser, so that I am not restricted to a specific browser.

#### Acceptance Criteria

1. THE App SHALL function correctly in the latest stable release of Chrome, Firefox, Edge, and Safari without polyfills or browser-specific workarounds.
2. THE App SHALL use only Web APIs available in all four target browsers, including `localStorage`, `JSON.parse`, `JSON.stringify`, and the DOM manipulation API.
3. IF the user's browser does not support a required Web API (e.g., localStorage), THE App SHALL display a clear notification informing the user that the app requires a modern browser.
4. IF localStorage is unavailable or blocked by browser settings, THE App SHALL notify the user that data persistence is disabled and operate in a session-only mode with an in-memory Transactions array.
