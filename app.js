/**
 * PayGuard — Revenue Recovery Hub
 * Dashboard Application Logic
 */

// ── Constants ──────────────────────────────────────────────────────────────

const GUARDRAILS = { MAX_RETRIES: 2, HIGH_VALUE: 50000 };

const INTERVENTIONS_META = {
  SCHEDULE_AUTO_RETRY:       { label: 'Auto Retry',         sub: 'Secondary gateway switch after 6h',  pill: 'pill-blue' },
  SEND_WHATSAPP_PAYMENT_LINK:{ label: 'WhatsApp Link',      sub: '1-click retry aligned to salary day', pill: 'pill-green' },
  TRIGGER_HINGLISH_VOICE_CALL:{ label: 'Hinglish Voice AI', sub: 'AI voice guides card/mandate update', pill: 'pill-amber' },
  DISPATCH_SMS_REMINDER:     { label: 'SMS Reminder',       sub: '15-min cart reservation token',      pill: 'pill-blue' },
  PROMISE_TO_PAY_TRACKER:    { label: 'Promise-to-Pay',     sub: 'B2B invoice follow-up scheduler',    pill: 'pill-purple' },
  ESCALATE_TO_HUMAN:         { label: 'Human Escalation',   sub: 'High-value / VIP / unknown error',   pill: 'pill-amber' },
  HARD_STOP_MAX_RETRIES_EXCEEDED: { label: 'Hard Stop',     sub: 'Max retry limit reached',            pill: 'pill-red' },
  STOP_CUSTOMER_OPT_OUT:     { label: 'Opt-Out Stop',       sub: 'Outreach ceased, compliant halt',     pill: 'pill-slate' }
};

const WORKFLOWS = [
  {
    codes: 'BANK_SERVER_DOWN / GATEWAY_TIMEOUT',
    action: 'SCHEDULE_AUTO_RETRY',
    desc: 'Sets a 6-hour cooldown then re-routes the charge through a secondary gateway (ICICI / Axis / HDFC). Zero customer friction required.',
    foot: 'Automated · No customer contact',
    badge: 'pill-blue', badgeLabel: 'Gateway Switch'
  },
  {
    codes: 'INSUFFICIENT_FUNDS',
    action: 'SEND_WHATSAPP_PAYMENT_LINK',
    desc: 'Dispatches a dynamic 1-click Razorpay retry link via WhatsApp, intelligently timed around the customer\'s known salary credit date.',
    foot: 'Salary-cycle aware',
    badge: 'pill-green', badgeLabel: 'WhatsApp'
  },
  {
    codes: 'EXPIRED_MANDATE / CARD_EXPIRED',
    action: 'TRIGGER_HINGLISH_VOICE_CALL',
    desc: 'Deploys the Razorpay AI Voice Agent in natural Hinglish to guide the customer through re-linking their card or UPI mandate.',
    foot: 'Localized voice · Hinglish',
    badge: 'pill-amber', badgeLabel: 'AI Voice'
  },
  {
    codes: 'CHECKOUT_ABANDONED',
    action: 'DISPATCH_SMS_REMINDER',
    desc: 'Sends an interactive recovery link by SMS with a 15-minute cart reservation guarantee so the customer\'s basket is held.',
    foot: 'Cart reservation included',
    badge: 'pill-blue', badgeLabel: 'SMS'
  },
  {
    codes: 'B2B_OVERDUE_INVOICE',
    action: 'PROMISE_TO_PAY_TRACKER',
    desc: 'Fires automated corporate invoice reminders to accounts payable, logs formal Promise-to-Pay commitments, and syncs with ERP.',
    foot: 'ERP reconciliation',
    badge: 'pill-purple', badgeLabel: 'B2B / Invoice'
  },
  {
    codes: 'UNKNOWN_ERROR / Amount > ₹50K / VIP Account',
    action: 'ESCALATE_TO_HUMAN',
    desc: 'Instantly routes high-value failures, sensitive merchant accounts, or any unrecognized error code to the priority human review queue.',
    foot: 'Compliant escalation path',
    badge: 'pill-amber', badgeLabel: 'Human Queue'
  }
];

// ── State ──────────────────────────────────────────────────────────────────

let auditData = [];
let txnFilter = 'ALL';
let txnSearch = '';

// ── Helpers ────────────────────────────────────────────────────────────────

function inr(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function statusPill(status) {
  const map = {
    RECOVERED:             'pill pill-green',
    PENDING_USER_RESPONSE: 'pill pill-purple',
    ESCALATED_HUMAN:       'pill pill-amber',
    UNRECOVERABLE:         'pill pill-red'
  };
  const labels = {
    RECOVERED:             'Recovered',
    PENDING_USER_RESPONSE: 'Pending',
    ESCALATED_HUMAN:       'Escalated',
    UNRECOVERABLE:         'Unrecoverable'
  };
  return `<span class="${map[status] || 'pill pill-slate'}">${labels[status] || status}</span>`;
}

function interventionBadge(key) {
  const m = INTERVENTIONS_META[key];
  if (!m) return `<span class="pill pill-slate">${key}</span>`;
  return `<span class="pill ${m.pill}">${m.label}</span>`;
}

// ── Core Agent Logic ───────────────────────────────────────────────────────

function evaluateTransaction(txn) {
  const txnId = txn.transaction_id || `txn_live_${Date.now().toString().slice(-5)}`;
  const userId = txn.user_id || `usr_${Math.floor(10000 + Math.random() * 90000)}`;
  const amount = Number(txn.amount) || 0;
  const reason = (txn.failure_reason || 'UNKNOWN_ERROR').trim();
  const retries = Number(txn.retry_count) || 0;
  const optedOut = Boolean(txn.customer_opted_out || txn.service_cancelled);
  const sensitive = Boolean(txn.is_sensitive || txn.is_sensitive_account);
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  // G1: Stopping rules
  if (optedOut) {
    const why = txn.service_cancelled ? 'service cancelled' : 'customer opt-out';
    return { timestamp: now, transaction_id: txnId, user_id: userId, amount, failure_reason: reason,
      intervention_selected: 'STOP_CUSTOMER_OPT_OUT', retry_count: retries, status: 'UNRECOVERABLE',
      audit_note: `STOPPING_RULE_TRIGGERED: Outreach halted immediately due to ${why}. Compliant cessation of all communications.` };
  }

  // G2: Attempt limit
  if (retries >= GUARDRAILS.MAX_RETRIES) {
    return { timestamp: now, transaction_id: txnId, user_id: userId, amount, failure_reason: reason,
      intervention_selected: 'HARD_STOP_MAX_RETRIES_EXCEEDED', retry_count: retries, status: 'UNRECOVERABLE',
      audit_note: `HARD_STOP_MAX_RETRIES_EXCEEDED: Transaction has reached ${retries} attempts (limit: ${GUARDRAILS.MAX_RETRIES}). Processing permanently halted.` };
  }

  // G3: Compliant escalation
  if (amount > GUARDRAILS.HIGH_VALUE) {
    return { timestamp: now, transaction_id: txnId, user_id: userId, amount, failure_reason: reason,
      intervention_selected: 'ESCALATE_TO_HUMAN', retry_count: retries, status: 'ESCALATED_HUMAN',
      audit_note: `COMPLIANT_ESCALATION: High-value transaction (${inr(amount)}) exceeds ₹${(GUARDRAILS.HIGH_VALUE).toLocaleString('en-IN')} threshold. Routed to ESCALATED_HUMAN_QUEUE.` };
  }
  if (sensitive) {
    return { timestamp: now, transaction_id: txnId, user_id: userId, amount, failure_reason: reason,
      intervention_selected: 'ESCALATE_TO_HUMAN', retry_count: retries, status: 'ESCALATED_HUMAN',
      audit_note: 'COMPLIANT_ESCALATION: Sensitive/VIP merchant account flagged. Routed to ESCALATED_HUMAN_QUEUE for white-glove manual assistance.' };
  }
  if (reason === 'UNKNOWN_ERROR') {
    return { timestamp: now, transaction_id: txnId, user_id: userId, amount, failure_reason: reason,
      intervention_selected: 'ESCALATE_TO_HUMAN', retry_count: retries, status: 'ESCALATED_HUMAN',
      audit_note: 'COMPLIANT_ESCALATION: Unrecognized error code detected. Routed to ESCALATED_HUMAN_QUEUE for engineering diagnosis.' };
  }

  // Diagnosis matrix
  let intervention, status, note;

  if (reason === 'BANK_SERVER_DOWN' || reason === 'GATEWAY_TIMEOUT') {
    intervention = 'SCHEDULE_AUTO_RETRY'; status = 'RECOVERED';
    note = 'SCHEDULE_AUTO_RETRY: Configured 6-hour cooldown timer. Re-routed via secondary gateway API switch. Re-authorization confirmed.';
  } else if (reason === 'INSUFFICIENT_FUNDS') {
    intervention = 'SEND_WHATSAPP_PAYMENT_LINK';
    const salaryDay = txn.customer_metadata?.salary_cycle_day ?? (retries === 0 ? 1 : 15);
    if (retries === 0 && salaryDay <= 5) {
      status = 'RECOVERED';
      note = `SEND_WHATSAPP_PAYMENT_LINK: Dynamic 1-click link dispatched via WhatsApp, aligned to salary cycle (Day ${salaryDay}). Customer authorized payment.`;
    } else {
      status = 'PENDING_USER_RESPONSE';
      note = 'SEND_WHATSAPP_PAYMENT_LINK: Dynamic 1-click retry link dispatched. Awaiting customer authorization after salary credit.';
    }
  } else if (reason === 'EXPIRED_MANDATE' || reason === 'CARD_EXPIRED') {
    intervention = 'TRIGGER_HINGLISH_VOICE_CALL';
    if (retries === 0) { status = 'RECOVERED'; note = 'TRIGGER_HINGLISH_VOICE_CALL: Razorpay AI Voice Agent (Hinglish) deployed. Customer guided through mandate/card re-linking successfully.'; }
    else { status = 'PENDING_USER_RESPONSE'; note = 'TRIGGER_HINGLISH_VOICE_CALL: Voice call initiated. Customer requested SMS link to complete card verification manually.'; }
  } else if (reason === 'CHECKOUT_ABANDONED') {
    intervention = 'DISPATCH_SMS_REMINDER'; status = 'RECOVERED';
    note = 'DISPATCH_SMS_REMINDER: Interactive SMS recovery link sent with 15-minute cart reservation token. Customer completed checkout.';
  } else if (reason === 'B2B_OVERDUE_INVOICE') {
    intervention = 'PROMISE_TO_PAY_TRACKER';
    if (retries === 0) { status = 'RECOVERED'; note = 'PROMISE_TO_PAY_TRACKER: Automated ERP invoice reminder dispatched. Accounts payable confirmed Promise-to-Pay and cleared invoice.'; }
    else { status = 'PENDING_USER_RESPONSE'; note = 'PROMISE_TO_PAY_TRACKER: Follow-up notice logged. Accounts payable confirmed receipt; settlement in processing.'; }
  } else {
    intervention = 'ESCALATE_TO_HUMAN'; status = 'ESCALATED_HUMAN';
    note = `COMPLIANT_ESCALATION: Unhandled failure code '${reason}'. Escalated to ESCALATED_HUMAN_QUEUE.`;
  }

  return { timestamp: now, transaction_id: txnId, user_id: userId, amount, failure_reason: reason,
    intervention_selected: intervention, retry_count: retries, status, audit_note: note };
}

// ── Metrics ────────────────────────────────────────────────────────────────

function computeMetrics(data) {
  const total = data.length;
  const rec   = data.filter(e => e.status === 'RECOVERED');
  const unrec = data.filter(e => e.status === 'UNRECOVERABLE');
  const esc   = data.filter(e => e.status === 'ESCALATED_HUMAN');
  const pend  = data.filter(e => e.status === 'PENDING_USER_RESPONSE');
  const sum   = arr => arr.reduce((s, e) => s + e.amount, 0);

  return {
    total, totalRisk: sum(data),
    recCount: rec.length, recAmt: sum(rec),
    unrecCount: unrec.length, unrecAmt: sum(unrec),
    escCount: esc.length, escAmt: sum(esc),
    pendCount: pend.length, pendAmt: sum(pend),
    rate: total ? (rec.length / total * 100) : 0,
    breakdown: {
      hardStop: unrec.filter(e => e.intervention_selected === 'HARD_STOP_MAX_RETRIES_EXCEEDED').length,
      optOut:   unrec.filter(e => e.intervention_selected === 'STOP_CUSTOMER_OPT_OUT').length,
      highVal:  esc.filter(e => e.amount > GUARDRAILS.HIGH_VALUE).length,
      sensitive:esc.filter(e => e.audit_note.includes('Sensitive/VIP')).length,
      unknown:  esc.filter(e => e.failure_reason === 'UNKNOWN_ERROR').length
    }
  };
}

// ── Executive Report ───────────────────────────────────────────────────────

function buildReport(m) {
  const hr = '─'.repeat(70);
  return `${hr}
  PAYGUARD — REVENUE RECOVERY HUB
  Executive Analytics Report
  Generated: ${new Date().toUTCString()}
  Guardrails: Max Retries = ${GUARDRAILS.MAX_RETRIES} | High-Value Cap = ${inr(GUARDRAILS.HIGH_VALUE)}
${hr}

  1. EXECUTIVE FINANCIAL SUMMARY
  ─────────────────────────────────────────────────────────────────────
  Total Transactions Evaluated         : ${m.total}
  Successfully Recovered               : ${m.recCount}
  Total Revenue Recovered              : ${inr(m.recAmt)}
  Overall Recovery Rate                : ${m.rate.toFixed(2)}%   [(${m.recCount} / ${m.total}) × 100]

  2. UNRECOVERABLE vs. ESCALATED BREAKDOWN
  ─────────────────────────────────────────────────────────────────────
  A. UNRECOVERABLE (${m.unrecCount})                  Total value: ${inr(m.unrecAmt)}
     ↳ Hard Stop — Max Retries Exceeded  : ${m.breakdown.hardStop} txns
     ↳ Stopping Rule — Customer Opt-Out  : ${m.breakdown.optOut} txns

  B. ESCALATED TO HUMAN QUEUE (${m.escCount})         Total value: ${inr(m.escAmt)}
     ↳ High-Value (> ₹50,000)            : ${m.breakdown.highVal} txns
     ↳ Sensitive / VIP Accounts          : ${m.breakdown.sensitive} txns
     ↳ Unknown Error Codes               : ${m.breakdown.unknown} txns

  C. PENDING USER RESPONSE (${m.pendCount})           Total value: ${inr(m.pendAmt)}
     ↳ Dynamic links / voice prompts awaiting customer action

${hr}
  Status: COMPLETE AND AUDITED
${hr}`;
}

// ── KPI Rendering ──────────────────────────────────────────────────────────

function updateKPIs(m) {
  document.getElementById('val-total').textContent = m.total;
  document.getElementById('val-at-risk').textContent = inr(m.totalRisk);
  document.getElementById('val-recovered-amt').textContent = inr(m.recAmt);
  document.getElementById('val-recovered-count').textContent = `${m.recCount} recovered`;
  document.getElementById('val-rate').textContent = `${m.rate.toFixed(2)}% rate`;
  document.getElementById('val-escalated-count-big').textContent = m.escCount;
  document.getElementById('val-escalated-amt').textContent = inr(m.escAmt);
  document.getElementById('val-unrec-count-big').textContent = m.unrecCount;
  document.getElementById('val-unrec-amt').textContent = inr(m.unrecAmt);
  document.getElementById('val-pending-count-big').textContent = m.pendCount;
  document.getElementById('val-pending-amt').textContent = inr(m.pendAmt);

  document.getElementById('b-hard-stop').textContent = `${m.breakdown.hardStop} txns`;
  document.getElementById('b-opt-out').textContent = `${m.breakdown.optOut} txns`;
  document.getElementById('b-high-val').textContent = `${m.breakdown.highVal} txns`;
  document.getElementById('b-sensitive').textContent = `${m.breakdown.sensitive} txn`;
  document.getElementById('b-unknown').textContent = `${m.breakdown.unknown} txn`;
}

// ── Intervention List ──────────────────────────────────────────────────────

function renderInterventionList(data) {
  const counts = {};
  data.forEach(e => { counts[e.intervention_selected] = (counts[e.intervention_selected] || 0) + 1; });

  const container = document.getElementById('intervention-list');
  const order = ['SCHEDULE_AUTO_RETRY','SEND_WHATSAPP_PAYMENT_LINK','TRIGGER_HINGLISH_VOICE_CALL',
    'DISPATCH_SMS_REMINDER','PROMISE_TO_PAY_TRACKER','HARD_STOP_MAX_RETRIES_EXCEEDED',
    'STOP_CUSTOMER_OPT_OUT','ESCALATE_TO_HUMAN'];

  container.innerHTML = order.map(key => {
    const meta = INTERVENTIONS_META[key] || { label: key, sub: '', pill: 'pill-slate' };
    const cnt = counts[key] || 0;
    if (!cnt) return '';
    return `<div class="int-row">
      <div>
        <div class="int-name">${key}</div>
        <div class="int-sub">${meta.sub}</div>
      </div>
      <div class="int-right">
        <span class="pill ${meta.pill}">${meta.label}</span>
        <span class="int-count">${cnt}</span>
      </div>
    </div>`;
  }).join('');
}

// ── Recent Table (top 5) ───────────────────────────────────────────────────

function renderRecentTable(data) {
  const tbody = document.getElementById('recent-table-body');
  const top5 = data.slice(0, 5);
  tbody.innerHTML = top5.map(e => `
    <tr>
      <td><span class="cell-id">${e.transaction_id}</span></td>
      <td class="cell-mono">${e.user_id}</td>
      <td class="cell-amount">${inr(e.amount)}</td>
      <td><code style="font-size:0.72rem; color:var(--text-secondary);">${e.failure_reason}</code></td>
      <td>${interventionBadge(e.intervention_selected)}</td>
      <td>${statusPill(e.status)}</td>
      <td><button class="link-btn btn-open-modal" data-id="${e.transaction_id}">View →</button></td>
    </tr>
  `).join('');
  attachModalTriggers(tbody);
}

// ── Full Table ─────────────────────────────────────────────────────────────

function renderFullTable() {
  const search = txnSearch.toLowerCase();
  const filtered = auditData.filter(e => {
    if (txnFilter !== 'ALL' && e.status !== txnFilter) return false;
    if (search) {
      return e.transaction_id.toLowerCase().includes(search) ||
             e.user_id.toLowerCase().includes(search) ||
             e.failure_reason.toLowerCase().includes(search) ||
             e.status.toLowerCase().includes(search) ||
             e.intervention_selected.toLowerCase().includes(search);
    }
    return true;
  });

  document.getElementById('txn-count-label').textContent = `${filtered.length} records`;

  const tbody = document.getElementById('full-table-body');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--text-muted);">No matching transactions found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(e => `
    <tr>
      <td class="cell-mono">${e.timestamp.split('T')[1]?.replace('Z','') ?? e.timestamp}</td>
      <td><span class="cell-id">${e.transaction_id}</span></td>
      <td class="cell-mono">${e.user_id}</td>
      <td class="cell-amount">${inr(e.amount)}</td>
      <td><code style="font-size:0.72rem; color:var(--text-secondary);">${e.failure_reason}</code></td>
      <td>${interventionBadge(e.intervention_selected)}</td>
      <td class="cell-mono" style="text-align:center">${e.retry_count}</td>
      <td>${statusPill(e.status)}</td>
      <td><button class="link-btn btn-open-modal" data-id="${e.transaction_id}">View →</button></td>
    </tr>
  `).join('');
  attachModalTriggers(tbody);
}

// ── Workflow Grid ──────────────────────────────────────────────────────────

function renderWorkflows() {
  const container = document.getElementById('workflow-grid');
  container.innerHTML = WORKFLOWS.map(w => `
    <div class="wf-card">
      <div class="wf-top">
        <span class="wf-code">${w.codes}</span>
        <span class="pill ${w.badge}">${w.badgeLabel}</span>
      </div>
      <div class="wf-body">
        <div class="wf-action">${w.action}</div>
        <p class="wf-desc">${w.desc}</p>
      </div>
      <div class="wf-foot">${w.foot}</div>
    </div>
  `).join('');
}

// ── Modal ──────────────────────────────────────────────────────────────────

function openModal(entry) {
  document.getElementById('modal-txn-id').textContent = entry.transaction_id;
  const body = document.getElementById('modal-body');

  body.innerHTML = `
    <div class="modal-grid">
      <div>
        <div class="modal-field-label">Amount</div>
        <div class="modal-field-val" style="font-size:1.1rem; font-family:var(--font-mono);">${inr(entry.amount)}</div>
      </div>
      <div>
        <div class="modal-field-label">Status</div>
        <div class="modal-field-val" style="margin-top:2px">${statusPill(entry.status)}</div>
      </div>
      <div>
        <div class="modal-field-label">Failure Reason</div>
        <div class="modal-field-val" style="font-family:var(--font-mono); font-size:0.78rem">${entry.failure_reason}</div>
      </div>
      <div>
        <div class="modal-field-label">Retry Count</div>
        <div class="modal-field-val">${entry.retry_count} / ${GUARDRAILS.MAX_RETRIES} max</div>
      </div>
      <div>
        <div class="modal-field-label">User ID</div>
        <div class="modal-field-val" style="font-family:var(--font-mono); font-size:0.78rem">${entry.user_id}</div>
      </div>
      <div>
        <div class="modal-field-label">Timestamp</div>
        <div class="modal-field-val" style="font-family:var(--font-mono); font-size:0.72rem">${entry.timestamp}</div>
      </div>
    </div>
    <div>
      <div class="modal-field-label">Intervention Selected</div>
      <div style="margin-top:4px">${interventionBadge(entry.intervention_selected)}</div>
    </div>
    <div>
      <div class="modal-field-label">Compliance Audit Note</div>
      <div class="modal-note" style="margin-top:4px">${entry.audit_note}</div>
    </div>
    <div>
      <div class="modal-field-label">Raw JSON Schema</div>
      <pre class="modal-json" style="margin-top:4px">${JSON.stringify(entry, null, 2)}</pre>
    </div>
  `;

  document.getElementById('modal-overlay').classList.remove('hidden');
}

function attachModalTriggers(scope) {
  scope.querySelectorAll('.btn-open-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const item = auditData.find(d => d.transaction_id === id);
      if (item) openModal(item);
    });
  });
}

// ── Navigation ─────────────────────────────────────────────────────────────

const VIEWS = {
  'nav-overview':     { viewId: 'view-overview',     title: 'Overview',               sub: 'Revenue recovery insights for today\'s batch' },
  'nav-transactions': { viewId: 'view-transactions',  title: 'Transactions',            sub: 'Full searchable audit log stream' },
  'nav-simulator':    { viewId: 'view-simulator',     title: 'Simulator',               sub: 'Test failure scenarios against live guardrails' },
  'nav-workflows':    { viewId: 'view-workflows',     title: 'Intervention Workflows',  sub: 'Deterministic bounded recovery paths' },
  'nav-audit':        { viewId: 'view-audit',         title: 'Audit Log',               sub: 'Structured compliance trail — ISO-8601 schema' }
};

function switchView(navId) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(navId)?.classList.add('active');

  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const cfg = VIEWS[navId];
  if (cfg) {
    document.getElementById(cfg.viewId).classList.remove('hidden');
    document.getElementById('page-heading').textContent = cfg.title;
    document.getElementById('page-subtitle').textContent = cfg.sub;
  }

  if (navId === 'nav-transactions') renderFullTable();
  if (navId === 'nav-audit') {
    const m = computeMetrics(auditData);
    document.getElementById('audit-terminal').textContent = buildReport(m);
  }
}

// ── Data Loading ───────────────────────────────────────────────────────────

async function loadData() {
  try {
    const res = await fetch('audit_log.json');
    if (res.ok) { auditData = await res.json(); }
    else throw new Error('audit_log.json not found');
  } catch {
    try {
      const r2 = await fetch('data/mock_failures.json');
      const raw = await r2.json();
      auditData = raw.map(evaluateTransaction);
    } catch { auditData = []; }
  }
  refresh();
}

function refresh() {
  const m = computeMetrics(auditData);
  updateKPIs(m);
  renderInterventionList(auditData);
  renderRecentTable(auditData);
}

// ── Event Listeners ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderWorkflows();

  // Nav
  Object.keys(VIEWS).forEach(navId => {
    document.getElementById(navId)?.addEventListener('click', e => { e.preventDefault(); switchView(navId); });
  });

  // View all from overview → transactions
  document.getElementById('btn-view-all')?.addEventListener('click', () => switchView('nav-transactions'));

  // Filter tabs
  document.querySelectorAll('.ftab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.ftab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      txnFilter = t.getAttribute('data-filter');
      renderFullTable();
    });
  });

  // Search (transactions page)
  document.getElementById('txn-search')?.addEventListener('input', e => {
    txnSearch = e.target.value.trim();
    renderFullTable();
  });

  // Global search → switch to transactions page with search applied
  document.getElementById('global-search')?.addEventListener('input', e => {
    txnSearch = e.target.value.trim();
    document.getElementById('txn-search').value = txnSearch;
    switchView('nav-transactions');
  });

  // Modal close
  document.getElementById('modal-close')?.addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  });
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') document.getElementById('modal-overlay').classList.add('hidden');
  });

  // Simulator
  document.getElementById('btn-sim-run')?.addEventListener('click', () => {
    const reason = document.getElementById('sim-reason').value;
    const amount = parseFloat(document.getElementById('sim-amount').value) || 0;
    const retries = parseInt(document.getElementById('sim-retries').value, 10) || 0;
    const optout = document.getElementById('sim-optout').checked;
    const sensitive = document.getElementById('sim-sensitive').checked;

    const result = evaluateTransaction({
      transaction_id: `txn_sim_${Date.now().toString().slice(-5)}`,
      user_id: `usr_sim_${Math.floor(10000 + Math.random() * 90000)}`,
      amount, failure_reason: reason, retry_count: retries,
      customer_opted_out: optout, is_sensitive: sensitive
    });

    // Show result
    document.getElementById('sim-placeholder').classList.add('hidden');
    const out = document.getElementById('sim-output');
    out.classList.remove('hidden');

    const statusTag = document.getElementById('sim-out-status');
    statusTag.textContent = result.status;
    const colorMap = {
      RECOVERED: 'pill pill-green',
      PENDING_USER_RESPONSE: 'pill pill-purple',
      ESCALATED_HUMAN: 'pill pill-amber',
      UNRECOVERABLE: 'pill pill-red'
    };
    statusTag.className = `sim-status-tag ${colorMap[result.status] || 'pill pill-slate'}`;
    statusTag.style.display = 'inline-block';
    statusTag.style.padding = '4px 12px';
    statusTag.style.fontFamily = 'var(--font-mono)';
    statusTag.style.fontSize = '0.82rem';
    statusTag.style.fontWeight = '700';

    document.getElementById('sim-out-intervention').textContent = result.intervention_selected;
    document.getElementById('sim-out-note').textContent = result.audit_note;

    // Store for add
    out.dataset.result = JSON.stringify(result);
  });

  document.getElementById('btn-sim-add')?.addEventListener('click', () => {
    const out = document.getElementById('sim-output');
    const result = JSON.parse(out.dataset.result || 'null');
    if (result) {
      auditData.unshift(result);
      refresh();
      out.classList.add('hidden');
      document.getElementById('sim-placeholder').classList.remove('hidden');
    }
  });

  document.getElementById('btn-sim-clear')?.addEventListener('click', () => {
    document.getElementById('sim-output').classList.add('hidden');
    document.getElementById('sim-placeholder').classList.remove('hidden');
  });

  // Export
  document.getElementById('btn-export')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'payguard_audit_log.json';
    a.click();
  });

  // Run Batch
  document.getElementById('btn-run-batch')?.addEventListener('click', async () => {
    try {
      const r = await fetch('data/mock_failures.json');
      const raw = await r.json();
      auditData = raw.map(evaluateTransaction);
      refresh();
    } catch {
      auditData = auditData.map(e => evaluateTransaction(e));
      refresh();
    }
  });

  // Copy Report
  document.getElementById('btn-copy-report')?.addEventListener('click', () => {
    const m = computeMetrics(auditData);
    navigator.clipboard.writeText(buildReport(m)).then(() => {
      const btn = document.getElementById('btn-copy-report');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy Executive Report'; }, 2000);
    });
  });
});
