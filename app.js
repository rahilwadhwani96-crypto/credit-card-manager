/**
 * app.js
 * ---------------------------------------------------------------------------
 * Main application logic for the Credit Card Manager PWA.
 * Handles navigation, rendering, and every user interaction. All backend
 * communication goes through the `api` object defined in api.js.
 * ---------------------------------------------------------------------------
 */

// -----------------------------------------------------------------------
// DOM REFERENCES
// -----------------------------------------------------------------------

const skeletonOverlay = document.getElementById('skeleton-overlay');

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

// Dashboard
const progressRingFill = document.getElementById('progress-ring-fill');
const ringSubLabel = document.getElementById('ring-sub-label');
const statOutstanding = document.getElementById('stat-outstanding');
const statEmiDue = document.getElementById('stat-emi-due');
const statCardsPaid = document.getElementById('stat-cards-paid');
const statUpcomingDue = document.getElementById('stat-upcoming-due');
const dashboardCardsList = document.getElementById('dashboard-cards-list');

// EMI
const emiCardsList = document.getElementById('emi-cards-list');
const btnResetMonth = document.getElementById('btn-reset-month');

// Transactions
const btnOpenExpense = document.getElementById('btn-open-expense');
const btnOpenPayment = document.getElementById('btn-open-payment');
const historyList = document.getElementById('history-list');

// Bottom sheet modal
const modalBackdrop = document.getElementById('modal-backdrop');
const txModal = document.getElementById('tx-modal');
const txModalTitle = document.getElementById('tx-modal-title');
const txForm = document.getElementById('tx-form');
const txCardSelect = document.getElementById('tx-card');
const txAmountInput = document.getElementById('tx-amount');
const txCommentInput = document.getElementById('tx-comment');

// Confirm dialog
const confirmBackdrop = document.getElementById('confirm-backdrop');
const confirmDialog = document.getElementById('confirm-dialog');
const confirmMessage = document.getElementById('confirm-message');
const confirmCancelBtn = document.getElementById('confirm-cancel');
const confirmOkBtn = document.getElementById('confirm-ok');

// Toast
const toastEl = document.getElementById('toast');

// -----------------------------------------------------------------------
// APPLICATION STATE
// -----------------------------------------------------------------------

const state = {
  currentPage: 'dashboard',
  dashboard: null,
  emi: null,
  transactions: null,
  pendingTxType: null // 'Expense' | 'Payment' - which modal is currently open
};

const RING_CIRCUMFERENCE = 377; // 2 * PI * 60, matches the SVG r=60 circle

// -----------------------------------------------------------------------
// INIT
// -----------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', init);

async function init() {
  attachNavHandlers();
  attachRippleTo(document.querySelectorAll('.nav-item, .tx-action-btn, .btn-primary'));
  attachEmiPageHandlers();
  attachTransactionsPageHandlers();
  attachModalHandlers();
  attachConfirmDialogHandlers();

  await loadDashboard();
  hideSkeleton();
}

// -----------------------------------------------------------------------
// NAVIGATION
// -----------------------------------------------------------------------

function attachNavHandlers() {
  navItems.forEach(function (item) {
    item.addEventListener('click', function () {
      navigateTo(item.dataset.target);
    });
  });
}

/**
 * Switches the active page and lazy-loads its data on first visit.
 * @param {string} target - 'dashboard' | 'emi' | 'transactions'
 */
async function navigateTo(target) {
  if (target === state.currentPage) return;

  state.currentPage = target;

  pages.forEach(function (page) {
    page.classList.toggle('page-active', page.dataset.page === target);
  });
  navItems.forEach(function (item) {
    item.classList.toggle('nav-item-active', item.dataset.target === target);
  });

  if (target === 'emi' && !state.emi) {
    await loadEmi();
  } else if (target === 'transactions' && !state.transactions) {
    await loadTransactions();
  }
}

// -----------------------------------------------------------------------
// DATA LOADING
// -----------------------------------------------------------------------

async function loadDashboard() {
  try {
    state.dashboard = await api.getDashboard();
    renderDashboard(state.dashboard);
  } catch (err) {
    showToast('Could not load dashboard.');
  }
}

async function loadEmi() {
  try {
    state.emi = await api.getEmi();
    renderEmiPage(state.emi);
  } catch (err) {
    showToast('Could not load EMI cards.');
  }
}

async function loadTransactions() {
  try {
    state.transactions = await api.getTransactions();
    renderTransactionsPage(state.transactions);
  } catch (err) {
    showToast('Could not load transactions.');
  }
}

/**
 * Invalidates cached data affected by a write, then refreshes whichever
 * pages are either currently visible or already cached.
 * @param {Array<string>} keys - Subset of 'dashboard' | 'emi' | 'transactions'
 */
async function refreshAfterWrite(keys) {
  const tasks = [];
  if (keys.includes('dashboard')) tasks.push(loadDashboard());
  if (keys.includes('emi') && state.emi) tasks.push(loadEmi());
  if (keys.includes('transactions') && state.transactions) tasks.push(loadTransactions());
  await Promise.all(tasks);
}

// -----------------------------------------------------------------------
// RENDER: DASHBOARD
// -----------------------------------------------------------------------

function renderDashboard(data) {
  const summary = data.summary;
  const totalCards = data.cards.length;
  const fraction = totalCards > 0 ? summary.cardsPaid / totalCards : 0;

  progressRingFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - fraction));

  animateNumber(statOutstanding, summary.outstanding, true);
  animateNumber(statEmiDue, summary.emiDue, true);
  animateNumber(statCardsPaid, summary.cardsPaid, false);
  animateNumber(statUpcomingDue, summary.upcomingDue, false);

  ringSubLabel.textContent = `${summary.cardsPaid} of ${totalCards} cards paid this month`;

  dashboardCardsList.innerHTML = data.cards.map(buildDashboardCardHtml).join('');
}

function buildDashboardCardHtml(card) {
  const badge = card.completed
    ? '<span class="card-badge badge-completed">Completed</span>'
    : card.paid
      ? '<span class="card-badge badge-paid">Paid</span>'
      : '<span class="card-badge badge-due">Due</span>';

  return `
    <div class="card-item glass-card">
      <div class="card-item-top">
        <span class="card-name">${escapeHtml(card.card)}</span>
        ${badge}
      </div>
      <div class="card-item-meta">
        <div class="meta-pair">
          <span class="meta-label">Current Due</span>
          <span class="meta-value">${formatCurrency(card.currentDue)}</span>
        </div>
        <div class="meta-pair">
          <span class="meta-label">EMI</span>
          <span class="meta-value">${formatCurrency(card.emi)}</span>
        </div>
        <div class="meta-pair">
          <span class="meta-label">Months Left</span>
          <span class="meta-value">${card.monthsRemaining}</span>
        </div>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------
// RENDER: EMI PAGE
// -----------------------------------------------------------------------

function renderEmiPage(data) {
  emiCardsList.innerHTML = data.cards.map(buildEmiCardHtml).join('');
  attachRippleTo(emiCardsList.querySelectorAll('.btn-mark-paid:not(:disabled)'));
}

function buildEmiCardHtml(card) {
  const badge = card.completed
    ? '<span class="card-badge badge-completed">Completed</span>'
    : card.paid
      ? '<span class="card-badge badge-paid">Paid</span>'
      : '<span class="card-badge badge-due">Due</span>';

  const disabled = card.completed || card.paid;
  const buttonLabel = card.completed ? 'Completed' : card.paid ? 'Paid' : 'Mark Paid';

  return `
    <div class="card-item glass-card">
      <div class="card-item-top">
        <span class="card-name">${escapeHtml(card.card)}</span>
        ${badge}
      </div>
      <div class="card-item-meta">
        <div class="meta-pair">
          <span class="meta-label">EMI</span>
          <span class="meta-value">${formatCurrency(card.emi)}</span>
        </div>
        <div class="meta-pair">
          <span class="meta-label">For Now</span>
          <span class="meta-value">${formatCurrency(card.forNow)}</span>
        </div>
        <div class="meta-pair">
          <span class="meta-label">Bill Date</span>
          <span class="meta-value">${escapeHtml(card.billDate)}</span>
        </div>
        <div class="meta-pair">
          <span class="meta-label">Due Date</span>
          <span class="meta-value">${escapeHtml(card.dueDate)}</span>
        </div>
        <div class="meta-pair">
          <span class="meta-label">Months Left</span>
          <span class="meta-value">${card.monthsRemaining}</span>
        </div>
      </div>
      ${card.comment ? `<p class="card-comment">${escapeHtml(card.comment)}</p>` : ''}
      <div class="card-item-actions">
        <button
          class="btn-mark-paid ripple-container"
          type="button"
          data-row="${card.rowNumber}"
          ${disabled ? 'disabled' : ''}
        >${buttonLabel}</button>
      </div>
    </div>
  `;
}

function attachEmiPageHandlers() {
  // Event delegation: the card list is re-rendered often, so we attach
  // one listener to the container instead of re-binding per button.
  emiCardsList.addEventListener('click', async function (e) {
    const button = e.target.closest('.btn-mark-paid');
    if (!button || button.disabled) return;

    const rowNumber = Number(button.dataset.row);
    button.disabled = true;

    try {
      await api.markPaid(rowNumber);
      showToast('Card marked as paid');
      await refreshAfterWrite(['dashboard', 'emi']);
    } catch (err) {
      showToast('Could not mark card as paid.');
      button.disabled = false;
    }
  });

  btnResetMonth.addEventListener('click', function () {
    showConfirm('Reset Paid status for every card this month?', async function () {
      try {
        await api.resetMonth();
        showToast('Month reset');
        await refreshAfterWrite(['dashboard', 'emi']);
      } catch (err) {
        showToast('Could not reset month.');
      }
    });
  });
}

// -----------------------------------------------------------------------
// RENDER: TRANSACTIONS PAGE
// -----------------------------------------------------------------------

function renderTransactionsPage(data) {
  populateCardDropdown(data.cards);

  historyList.innerHTML = data.history.length
    ? data.history.map(buildHistoryItemHtml).join('')
    : '<p class="history-empty">No transactions yet.</p>';
}

function populateCardDropdown(cards) {
  txCardSelect.innerHTML = cards
    .map(function (card) { return `<option value="${escapeHtml(card)}">${escapeHtml(card)}</option>`; })
    .join('');
}

function buildHistoryItemHtml(tx) {
  const isExpense = tx.type === 'Expense';
  const icon = isExpense ? '↑' : '↓';
  const iconClass = isExpense ? 'history-icon-expense' : 'history-icon-payment';
  const amountClass = isExpense ? 'amount-expense' : 'amount-payment';
  const sign = isExpense ? '+' : '−';

  return `
    <div class="history-item">
      <div class="history-icon ${iconClass}">${icon}</div>
      <div class="history-body">
        <div class="history-top-row">
          <span class="history-card-name">${escapeHtml(tx.card)}</span>
          <span class="history-amount ${amountClass}">${sign}${formatCurrency(tx.amount)}</span>
        </div>
        <div class="history-sub-row">
          <span class="history-comment">${escapeHtml(tx.comment || '')}</span>
          <span class="history-time">${escapeHtml(tx.relativeTime)}</span>
        </div>
      </div>
    </div>
  `;
}

function attachTransactionsPageHandlers() {
  btnOpenExpense.addEventListener('click', function () { openTxModal('Expense'); });
  btnOpenPayment.addEventListener('click', function () { openTxModal('Payment'); });
}

// -----------------------------------------------------------------------
// BOTTOM SHEET MODAL (Add Expense / Payment)
// -----------------------------------------------------------------------

async function openTxModal(type) {
  state.pendingTxType = type;
  txModalTitle.textContent = type === 'Expense' ? 'Add Expense' : 'Add Payment';
  txForm.reset();

  // Card dropdown needs the transactions data even if that page was
  // never visited yet (user can add a transaction straight from anywhere
  // once we wire buttons elsewhere - kept lazy-safe here too).
  if (!state.transactions) {
    await loadTransactions();
  }

  modalBackdrop.classList.add('visible');
  txModal.classList.add('visible');
}

function closeTxModal() {
  modalBackdrop.classList.remove('visible');
  txModal.classList.remove('visible');
}

function attachModalHandlers() {
  modalBackdrop.addEventListener('click', closeTxModal);

  txForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const card = txCardSelect.value;
    const amount = Number(txAmountInput.value);
    const comment = txCommentInput.value.trim();
    const type = state.pendingTxType;

    if (!card || !amount || amount <= 0) {
      showToast('Enter a valid amount.');
      return;
    }

    try {
      if (type === 'Expense') {
        await api.addExpense(card, amount, comment);
        showToast('Expense Added');
      } else {
        await api.addPayment(card, amount, comment);
        showToast('Payment Added');
      }
      closeTxModal();
      await refreshAfterWrite(['dashboard', 'transactions']);
    } catch (err) {
      showToast('Could not save transaction.');
    }
  });
}

// -----------------------------------------------------------------------
// CONFIRM DIALOG (generic - currently used by Reset Month)
// -----------------------------------------------------------------------

let pendingConfirmAction = null;

function showConfirm(message, onConfirm) {
  confirmMessage.textContent = message;
  pendingConfirmAction = onConfirm;
  confirmBackdrop.classList.add('visible');
  confirmDialog.classList.add('visible');
}

function hideConfirm() {
  confirmBackdrop.classList.remove('visible');
  confirmDialog.classList.remove('visible');
  pendingConfirmAction = null;
}

function attachConfirmDialogHandlers() {
  confirmBackdrop.addEventListener('click', hideConfirm);
  confirmCancelBtn.addEventListener('click', hideConfirm);
  confirmOkBtn.addEventListener('click', async function () {
    const action = pendingConfirmAction;
    hideConfirm();
    if (action) await action();
  });
}

// -----------------------------------------------------------------------
// TOAST
// -----------------------------------------------------------------------

let toastTimer = null;

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('visible');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toastEl.classList.remove('visible');
  }, 2200);
}

// -----------------------------------------------------------------------
// SKELETON LOADER
// -----------------------------------------------------------------------

function hideSkeleton() {
  skeletonOverlay.classList.add('hidden');
}

// -----------------------------------------------------------------------
// RIPPLE EFFECT
// -----------------------------------------------------------------------

/**
 * Attaches a native-feeling ripple animation to one or more elements.
 * Safe to call repeatedly on re-rendered elements (e.g. after each
 * EMI list render) since it only adds a listener to each element once.
 * @param {NodeList|Array<Element>} elements
 */
function attachRippleTo(elements) {
  elements.forEach(function (el) {
    if (el.dataset.rippleBound) return;
    el.dataset.rippleBound = 'true';
    el.classList.add('ripple-container');

    el.addEventListener('click', function (e) {
      const rect = el.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height);

      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

      el.appendChild(ripple);
      ripple.addEventListener('animationend', function () { ripple.remove(); });
    });
  });
}

// -----------------------------------------------------------------------
// UTILITIES
// -----------------------------------------------------------------------

/**
 * Formats a number as Indian Rupee currency, e.g. 107169 -> "₹1,07,169".
 * @param {number} amount
 * @return {string}
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
}

/**
 * Animates a number counting upward from its current displayed value to
 * a new target value, per the spec's "numbers count upward" requirement.
 * @param {HTMLElement} el
 * @param {number} target
 * @param {boolean} isCurrency - Whether to format as currency or a plain int.
 */
function animateNumber(el, target, isCurrency) {
  const start = Number(el.dataset.rawValue) || 0;
  const duration = 600;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.round(start + (target - start) * eased);

    el.textContent = isCurrency ? formatCurrency(current) : String(current);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.dataset.rawValue = String(target);
    }
  }

  requestAnimationFrame(tick);
}

/**
 * Escapes HTML special characters to prevent markup injection when
 * rendering user-entered comments/card names into innerHTML.
 * @param {*} value
 * @return {string}
 */
function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value == null ? '' : value);
  return div.innerHTML;
}
