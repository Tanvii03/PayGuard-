# PayGuard — Revenue Recovery Hub

> **Autonomous AI-powered payment failure detection, diagnosis, and bounded revenue recovery engine with full compliance auditability.**

<div align="center">

![PayGuard Banner](https://img.shields.io/badge/PayGuard-Revenue%20Recovery%20Hub-0D9488?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkwyIDdsOCA1IDEwLTUtMTAtNXoiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+)
![Python](https://img.shields.io/badge/Python-3.14.4-3776AB?style=for-the-badge&logo=python&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Tests](https://img.shields.io/badge/Tests-9%2F9%20Passing-0D9488?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen?style=for-the-badge)

</div>

---

## 📑 Table of Contents

1. [What Is PayGuard?](#-what-is-payguard)
2. [Problem Statement](#-problem-statement)
3. [Solution](#-solution)
4. [Architecture](#-architecture)
5. [How It Works — Workflow](#-how-it-works--workflow)
6. [Diagnosis & Intervention Matrix](#-diagnosis--intervention-matrix)
7. [Operational Guardrails](#-operational-guardrails)
8. [Tech Stack](#-tech-stack)
9. [Project Structure](#-project-structure)
10. [Setup & Installation](#-setup--installation)
11. [Running the Agent](#-running-the-agent)
12. [Running Tests](#-running-tests)
13. [Audit Log Schema](#-audit-log-schema)
14. [Executive Report Sample](#-executive-report-sample)
15. [Dashboard Features](#-dashboard-features)

---

## 🛡️ What Is PayGuard?

**PayGuard** is an autonomous, rule-based revenue recovery engine built to solve the silent crisis in digital payments — **failed transactions that never get a second chance**.

It reads a batch of payment failures, classifies each one by its error code, applies strict compliance guardrails, executes the exact correct bounded recovery workflow, writes a tamper-evident audit log, and produces a measurable executive financial report — all without any human intervention for standard cases.

**In one line:**
> PayGuard detects revenue at risk, figures out why it failed, dispatches the right recovery action, and tells you exactly how much money it got back.

---

## 🔴 Problem Statement

Every digital payment business loses a significant portion of revenue to **silent payment failures** — transactions that fail not because the customer doesn't want to pay, but due to:

| Failure Type | Real-World Cause |
|---|---|
| `BANK_SERVER_DOWN` | Bank gateway outage during peak hours |
| `GATEWAY_TIMEOUT` | Network latency between payment processor and bank |
| `INSUFFICIENT_FUNDS` | Customer account temporarily low before salary credit |
| `EXPIRED_MANDATE` | UPI AutoPay mandate expired without renewal |
| `CARD_EXPIRED` | Subscription charged to a card that's been replaced |
| `CHECKOUT_ABANDONED` | User distracted mid-checkout and didn't return |
| `B2B_OVERDUE_INVOICE` | Corporate accounts payable delayed on enterprise invoices |

### The cost of doing nothing:
- ❌ Revenue is permanently lost if no recovery attempt is made
- ❌ Manual review teams are slow, inconsistent, and don't scale
- ❌ One-size-fits-all reminders annoy customers who had a temporary issue
- ❌ No audit trail means compliance teams are blind to what was done
- ❌ High-value failures get the same treatment as ₹500 ones — a major risk

---

## ✅ Solution

PayGuard solves this with **four layered capabilities**:

### 1. 🔍 Smart Diagnosis
Reads each transaction's `failure_reason` code and immediately classifies it — no ambiguity, no ML inference needed. Deterministic classification means zero surprises.

### 2. 🛡️ Strict Guardrails (Safety First)
Before any recovery action fires, four compliance guardrails are checked in strict priority order:
1. **Stopping Rules** — Opt-outs and cancellations halt all outreach immediately
2. **Attempt Limits** — Never retry more than 2 times (hard stop)
3. **Compliant Escalation** — High-value (> ₹50,000), VIP, or unknown errors go straight to humans
4. **Bounded Workflows** — Only pre-approved actions execute, nothing is invented on the fly

### 3. ⚡ Deterministic Intervention Dispatch
Each failure code maps to exactly one recovery action. WhatsApp links for funds issues. Voice calls for expired mandates. Auto-retries for outages. No guessing.

### 4. 📋 Full Auditability
Every decision — recovered, escalated, stopped, pending — is logged to `audit_log.json` with an ISO-8601 timestamp, intervention name, status, and a human-readable compliance note. An executive analytics report is generated on every run.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PAYGUARD ARCHITECTURE                         │
└──────────────────────────────────────────────────────────────────────┘

  INPUT LAYER
  ┌─────────────────────────┐
  │   data/mock_failures    │  ← JSON batch of transaction failures
  │       .json             │     (transaction_id, amount, failure_reason,
  └────────────┬────────────┘      retry_count, customer flags)
               │
               ▼
  CORE ENGINE  ─  recovery_agent.py
  ┌────────────────────────────────────────────────────────────────────┐
  │                                                                    │
  │   ┌─────────────────────────────────────────────────────────┐     │
  │   │               GUARDRAIL EVALUATION ENGINE                │     │
  │   │                                                          │     │
  │   │  G1: Stopping Rules    → opt-out / service cancellation  │     │
  │   │  G2: Attempt Limits    → retry_count >= 2 → HARD STOP    │     │
  │   │  G3: Compliant Escal.  → amount > ₹50K / VIP / unknown   │     │
  │   └─────────────────────────────┬───────────────────────────┘     │
  │                                 │ (eligible transactions only)     │
  │   ┌─────────────────────────────▼───────────────────────────┐     │
  │   │            DIAGNOSIS & INTERVENTION MATRIX               │     │
  │   │                                                          │     │
  │   │  BANK_SERVER_DOWN / GATEWAY_TIMEOUT                      │     │
  │   │    → SCHEDULE_AUTO_RETRY                                 │     │
  │   │  INSUFFICIENT_FUNDS                                      │     │
  │   │    → SEND_WHATSAPP_PAYMENT_LINK                          │     │
  │   │  EXPIRED_MANDATE / CARD_EXPIRED                          │     │
  │   │    → TRIGGER_HINGLISH_VOICE_CALL                         │     │
  │   │  CHECKOUT_ABANDONED                                      │     │
  │   │    → DISPATCH_SMS_REMINDER                               │     │
  │   │  B2B_OVERDUE_INVOICE                                     │     │
  │   │    → PROMISE_TO_PAY_TRACKER                              │     │
  │   │  UNKNOWN_ERROR                                           │     │
  │   │    → ESCALATE_TO_HUMAN                                   │     │
  │   └─────────────────────────────┬───────────────────────────┘     │
  │                                 │                                  │
  └─────────────────────────────────┼──────────────────────────────────┘
                                    │
               ┌────────────────────┼───────────────────────┐
               ▼                    ▼                       ▼
  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────────────┐
  │  audit_log.json │   │ Executive Report  │   │   Interactive UI     │
  │  (ISO-8601      │   │   (stdout / copy) │   │   index.html +       │
  │  schema, every  │   │                   │   │   app.js + styles.css│
  │  decision logged│   │  Recovery Rate,   │   │                      │
  │  with audit note│   │  Revenue Recovered│   │   - KPI Dashboard    │
  │                 │   │  Breakdown, etc.  │   │   - Live Simulator   │
  └─────────────────┘   └──────────────────┘   │   - Audit Explorer   │
                                                └──────────────────────┘
```

---

## 🔄 How It Works — Workflow

```
Transaction Failure Detected
           │
           ▼
  ┌─────────────────────────────┐
  │  Is customer opted-out OR   │──YES──▶ UNRECOVERABLE
  │  service cancelled?         │         (STOP_CUSTOMER_OPT_OUT)
  └─────────────────────────────┘
           │ NO
           ▼
  ┌─────────────────────────────┐
  │  retry_count >= 2?          │──YES──▶ UNRECOVERABLE
  │                             │         (HARD_STOP_MAX_RETRIES_EXCEEDED)
  └─────────────────────────────┘
           │ NO
           ▼
  ┌─────────────────────────────┐
  │  amount > ₹50,000           │
  │  OR is_sensitive = true     │──YES──▶ ESCALATED_HUMAN
  │  OR failure = UNKNOWN_ERROR │         (ESCALATE_TO_HUMAN)
  └─────────────────────────────┘
           │ NO
           ▼
  ┌─────────────────────────────┐
  │  Map failure_reason to      │
  │  intervention workflow      │
  └─────────────────────────────┘
           │
           ▼
  Execute bounded intervention
  Log result to audit_log.json
           │
           ▼
  Status: RECOVERED | PENDING_USER_RESPONSE
```

---

## 🎯 Diagnosis & Intervention Matrix

| Failure Code | Recovery Intervention | Expected Outcome |
|---|---|---|
| `BANK_SERVER_DOWN` | `SCHEDULE_AUTO_RETRY` | 6-hour cooldown → secondary gateway switch → auto-recover |
| `GATEWAY_TIMEOUT` | `SCHEDULE_AUTO_RETRY` | 6-hour cooldown → secondary gateway switch → auto-recover |
| `INSUFFICIENT_FUNDS` | `SEND_WHATSAPP_PAYMENT_LINK` | Dynamic 1-click link aligned to salary cycle date |
| `EXPIRED_MANDATE` | `TRIGGER_HINGLISH_VOICE_CALL` | AI Voice Agent guides mandate re-linking in Hinglish |
| `CARD_EXPIRED` | `TRIGGER_HINGLISH_VOICE_CALL` | AI Voice Agent guides card credential update |
| `CHECKOUT_ABANDONED` | `DISPATCH_SMS_REMINDER` | Interactive recovery SMS with 15-min cart reservation |
| `B2B_OVERDUE_INVOICE` | `PROMISE_TO_PAY_TRACKER` | Automated corporate ERP invoice follow-up & commitment logger |
| `UNKNOWN_ERROR` | `ESCALATE_TO_HUMAN` | Immediate routing to priority human review queue |

---

## 🛡️ Operational Guardrails

PayGuard enforces **4 non-negotiable guardrails** evaluated in strict priority order before any intervention fires:

```
PRIORITY 1 — STOPPING RULES
  If customer_opted_out = true OR service_cancelled = true
  → Status: UNRECOVERABLE
  → Action: STOP_CUSTOMER_OPT_OUT
  → All further outreach permanently ceased

PRIORITY 2 — ATTEMPT LIMITS
  If retry_count >= 2
  → Status: UNRECOVERABLE
  → Action: HARD_STOP_MAX_RETRIES_EXCEEDED
  → Processing permanently halted for this transaction

PRIORITY 3 — COMPLIANT ESCALATION
  If amount > ₹50,000  →  High-value threshold breach
  If is_sensitive = true  →  VIP / flagged merchant account
  If failure_reason = UNKNOWN_ERROR  →  Unhandled error code
  → Status: ESCALATED_HUMAN
  → Action: ESCALATE_TO_HUMAN

PRIORITY 4 — INTERVENTION MATRIX
  All remaining transactions
  → Execute exact mapped bounded workflow
```

---

## 🧰 Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Core Engine** | Python | 3.14.4 | Guardrail logic, intervention dispatch, audit logging |
| **Standard Library** | `json`, `datetime`, `os`, `sys`, `argparse` | Built-in | File I/O, timestamps, CLI |
| **Test Suite** | `unittest` | Built-in | 9-test guardrail and schema verification suite |
| **Web Server** | Python `http.server` | Built-in | Local development server for dashboard |
| **Frontend UI** | HTML5 + Vanilla CSS + Vanilla JavaScript | — | Interactive executive dashboard |
| **Typography** | Inter (Google Fonts) | — | Clean, human-crafted sans-serif |
| **Monospace Font** | JetBrains Mono (Google Fonts) | — | Audit log, code, transaction IDs |
| **Data Format** | JSON | — | Input failures & output audit log |
| **Optional** | Flask | 3.1.3 | Available if REST API layer needed |
| **Node.js** | Node.js | v24.14.1 | Available for tooling if needed |

> **Zero external Python dependencies required** for the core agent. Everything runs on Python's standard library.

---

## 📁 Project Structure

```
Recovery/
│
├── 📄 recovery_agent.py          # Core autonomous recovery engine
│   ├── RazorpayRecoveryAgent     # Main agent class
│   ├── RecoveryAgentGuardrails   # Constants (max retries, thresholds)
│   ├── RecoveryStatus            # Status constants
│   ├── Interventions             # Intervention name constants
│   └── main()                    # CLI entry point
│
├── 📄 test_recovery_agent.py     # Unit & integration test suite (9 tests)
│
├── 📄 audit_log.json             # Generated compliance audit log (auto-created)
│
├── 📄 index.html                 # Interactive dashboard UI
├── 📄 styles.css                 # Warm minimal design system
├── 📄 app.js                     # Dashboard logic + live simulator
│
└── 📁 data/
    └── mock_failures.json        # 20 realistic test transactions
```

---

## ⚙️ Setup & Installation

### Prerequisites

Make sure you have the following installed:

- **Python 3.8+** (tested on 3.14.4)
- A modern web browser (Chrome, Firefox, Edge)
- No pip packages required for the core agent

---

### Step 1 — Clone / Download the Project

```bash
# If using Git
git clone https://github.com/your-username/payguard.git
cd payguard

# Or simply download and extract the ZIP, then navigate into the folder
cd Recovery
```

---

### Step 2 — Verify Python is Available

```bash
python --version
# Expected: Python 3.8.x or higher
```

---

### Step 3 — (Optional) Install Flask

Flask is only needed if you want to build a REST API layer. The core agent and dashboard work without it.

```bash
pip install flask
```

---

### Step 4 — Confirm Project Structure

```bash
# Windows PowerShell
Get-ChildItem -Name

# Expected output:
# app.js
# audit_log.json
# data/
# index.html
# recovery_agent.py
# styles.css
# test_recovery_agent.py
```

---

## 🚀 Running the Agent

### Run the Recovery Pipeline (Batch Mode)

Processes all transactions in `data/mock_failures.json`, writes `audit_log.json`, and prints the Executive Analytics Report.

```bash
python recovery_agent.py
```

**With custom file paths:**
```bash
python recovery_agent.py --input data/mock_failures.json --output audit_log.json
```

**Expected output:**
```
==========================================================================
      RAZORPAY AI REVENUE RECOVERY AGENT - EXECUTIVE ANALYTICS REPORT
==========================================================================
Generated At (UTC): 2026-09-05 14:14:12 UTC
Operational Policy: Strict Bounded Workflows | Max Retries: 2 | High-Value Cap: ₹50,000.00
==========================================================================

1. EXECUTIVE FINANCIAL SUMMARY
--------------------------------------------------------------------------
* Total Transactions Evaluated          : 20
* Successfully Recovered Transactions   : 9
* Total Revenue Recovered (₹)           : ₹95,298.00
* Overall Recovery Rate (%)             : 45.00%  [Formula: (9 / 20) * 100]
...
```

---

### Launch the Interactive Dashboard

```bash
# Start a local web server from the project root
python -m http.server 8080
```

Then open your browser and go to:

```
http://localhost:8080
```

The dashboard will automatically load `audit_log.json` and display all metrics.

---

## 🧪 Running Tests

```bash
python test_recovery_agent.py
```

**Verbose mode (see each test name):**
```bash
python test_recovery_agent.py -v
```

**Expected output:**
```
test_audit_log_schema_conformance ... ok
test_batch_processing_and_metrics ... ok
test_diagnosis_matrix_mappings ... ok
test_guardrail_attempt_limits_hard_stop ... ok
test_guardrail_high_value_escalation ... ok
test_guardrail_sensitive_account_escalation ... ok
test_guardrail_stopping_rules_opt_out ... ok
test_guardrail_stopping_rules_service_cancelled ... ok
test_guardrail_unknown_error_escalation ... ok

----------------------------------------------------------------------
Ran 9 tests in 0.021s

OK
```

### What Each Test Verifies

| Test | Guardrail / Feature Tested |
|---|---|
| `test_guardrail_stopping_rules_opt_out` | Customer opt-out triggers immediate STOP |
| `test_guardrail_stopping_rules_service_cancelled` | Service cancellation triggers STOP |
| `test_guardrail_attempt_limits_hard_stop` | retry_count ≥ 2 → HARD_STOP_MAX_RETRIES_EXCEEDED |
| `test_guardrail_high_value_escalation` | Amount > ₹50,000 → ESCALATED_HUMAN |
| `test_guardrail_sensitive_account_escalation` | is_sensitive = true → ESCALATED_HUMAN |
| `test_guardrail_unknown_error_escalation` | UNKNOWN_ERROR → ESCALATED_HUMAN |
| `test_diagnosis_matrix_mappings` | All 7 failure codes → correct intervention |
| `test_audit_log_schema_conformance` | All 9 required JSON fields present + correct types |
| `test_batch_processing_and_metrics` | Formula: (Recovered / Total) × 100 is correct |

---

## 📋 Audit Log Schema

Every transaction evaluated produces one JSON entry in `audit_log.json`:

```json
{
  "timestamp": "2026-09-05T14:13:52Z",
  "transaction_id": "txn_rzp_001",
  "user_id": "usr_94812",
  "amount": 3200.0,
  "failure_reason": "BANK_SERVER_DOWN",
  "intervention_selected": "SCHEDULE_AUTO_RETRY",
  "retry_count": 0,
  "status": "RECOVERED",
  "audit_note": "SCHEDULE_AUTO_RETRY: Configured 6-hour cooldown timer. Re-routed transaction via secondary gateway API switch. Re-authorization confirmed."
}
```

### Field Reference

| Field | Type | Description |
|---|---|---|
| `timestamp` | `string` (ISO-8601 UTC) | Exact time the decision was made |
| `transaction_id` | `string` | Unique identifier for the transaction |
| `user_id` | `string` | Customer identifier |
| `amount` | `number` | Transaction value in Indian Rupees |
| `failure_reason` | `string` | Failure error code from payment gateway |
| `intervention_selected` | `string` | Bounded recovery action dispatched |
| `retry_count` | `integer` | Number of prior recovery attempts |
| `status` | `enum` | `RECOVERED` \| `PENDING_USER_RESPONSE` \| `UNRECOVERABLE` \| `ESCALATED_HUMAN` |
| `audit_note` | `string` | Human-readable explanation of decision |

---

## 📊 Executive Report Sample

```
──────────────────────────────────────────────────────────────────────────
  PAYGUARD — REVENUE RECOVERY HUB
  Executive Analytics Report
──────────────────────────────────────────────────────────────────────────

  1. EXECUTIVE FINANCIAL SUMMARY
  Total Transactions Evaluated         : 20
  Successfully Recovered               : 9
  Total Revenue Recovered              : ₹95,298
  Overall Recovery Rate                : 45.00%   [(9 / 20) × 100]

  2. UNRECOVERABLE vs. ESCALATED BREAKDOWN
  A. UNRECOVERABLE (4)                 Total value: ₹25,600
     ↳ Hard Stop — Max Retries         : 2 txns
     ↳ Stopping Rule — Opt-Out         : 2 txns

  B. ESCALATED TO HUMAN QUEUE (4)      Total value: ₹2,43,400
     ↳ High-Value (> ₹50,000)          : 2 txns
     ↳ Sensitive / VIP Accounts        : 1 txn
     ↳ Unknown Error Codes             : 1 txn

  C. PENDING USER RESPONSE (3)         Total value: ₹59,989
     ↳ Dynamic links / voice prompts awaiting customer action
```

---

## 🖥️ Dashboard Features

The interactive web dashboard (`http://localhost:8080`) includes:

| Page | Description |
|---|---|
| **Overview** | KPI cards (total, recovered revenue, escalated, unrecoverable, pending), guardrail breakdown, intervention dispatch summary, and recent activity table |
| **Transactions** | Full searchable and filterable audit log table with status pill filters and modal drill-down per transaction |
| **Simulator** | Live test sandbox — input any failure scenario, see the agent's guardrail decision and audit note in real time |
| **Workflows** | Visual intervention matrix showing all 6 bounded recovery paths |
| **Audit Log** | Plain-text formatted executive report with one-click copy |

Additional features:
- 🔍 **Global search** across all transactions
- 📥 **Export** audit log as JSON
- ➕ **Add simulated transactions** to the live audit log
- 🔄 **Re-run batch** pipeline from the browser

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## 🙏 Acknowledgements

Built as a demonstration of compliant, deterministic AI-assisted revenue recovery workflows. Inspired by real-world payment failure patterns in the Indian digital payments ecosystem.

---

<div align="center">

**PayGuard — Revenue Recovery Hub**  
*Detect → Diagnose → Recover → Audit*

</div>
