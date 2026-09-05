"""
Unit and Integration Tests for Razorpay AI Revenue Recovery Agent
"""

import json
import os
import unittest
from recovery_agent import RazorpayRecoveryAgent, RecoveryStatus, Interventions


class TestRazorpayRecoveryAgent(unittest.TestCase):

    def setUp(self):
        self.agent = RazorpayRecoveryAgent()

    def test_guardrail_stopping_rules_opt_out(self):
        """Verify immediate cessation if customer opted out."""
        txn = {
            "transaction_id": "txn_test_opt_out",
            "user_id": "usr_test_1",
            "amount": 2500,
            "failure_reason": "CARD_EXPIRED",
            "retry_count": 0,
            "customer_opted_out": True
        }
        entry = self.agent.evaluate_transaction(txn)
        self.assertEqual(entry["status"], RecoveryStatus.UNRECOVERABLE)
        self.assertEqual(entry["intervention_selected"], Interventions.STOP_CUSTOMER_OPT_OUT)
        self.assertIn("STOPPING_RULE_TRIGGERED", entry["audit_note"])

    def test_guardrail_stopping_rules_service_cancelled(self):
        """Verify immediate cessation if underlying service cancelled."""
        txn = {
            "transaction_id": "txn_test_cancel",
            "user_id": "usr_test_2",
            "amount": 1800,
            "failure_reason": "CHECKOUT_ABANDONED",
            "retry_count": 0,
            "service_cancelled": True
        }
        entry = self.agent.evaluate_transaction(txn)
        self.assertEqual(entry["status"], RecoveryStatus.UNRECOVERABLE)
        self.assertEqual(entry["intervention_selected"], Interventions.STOP_CUSTOMER_OPT_OUT)
        self.assertIn("service cancelled", entry["audit_note"])

    def test_guardrail_attempt_limits_hard_stop(self):
        """Verify strict limit of 2 outreach/retry attempts."""
        # retry_count = 2 -> must be UNRECOVERABLE
        txn_2 = {
            "transaction_id": "txn_test_limit_2",
            "user_id": "usr_test_3",
            "amount": 4000,
            "failure_reason": "BANK_SERVER_DOWN",
            "retry_count": 2
        }
        entry_2 = self.agent.evaluate_transaction(txn_2)
        self.assertEqual(entry_2["status"], RecoveryStatus.UNRECOVERABLE)
        self.assertEqual(entry_2["intervention_selected"], Interventions.HARD_STOP_MAX_RETRIES_EXCEEDED)
        self.assertIn("HARD_STOP_MAX_RETRIES_EXCEEDED", entry_2["audit_note"])

        # retry_count = 3 -> must also be UNRECOVERABLE
        txn_3 = {
            "transaction_id": "txn_test_limit_3",
            "user_id": "usr_test_4",
            "amount": 4000,
            "failure_reason": "INSUFFICIENT_FUNDS",
            "retry_count": 3
        }
        entry_3 = self.agent.evaluate_transaction(txn_3)
        self.assertEqual(entry_3["status"], RecoveryStatus.UNRECOVERABLE)
        self.assertEqual(entry_3["intervention_selected"], Interventions.HARD_STOP_MAX_RETRIES_EXCEEDED)

    def test_guardrail_high_value_escalation(self):
        """Verify failure > ₹50,000 routes instantly to ESCALATED_HUMAN_QUEUE."""
        txn = {
            "transaction_id": "txn_test_high_val",
            "user_id": "usr_test_5",
            "amount": 50001,
            "failure_reason": "GATEWAY_TIMEOUT",
            "retry_count": 0
        }
        entry = self.agent.evaluate_transaction(txn)
        self.assertEqual(entry["status"], RecoveryStatus.ESCALATED_HUMAN)
        self.assertEqual(entry["intervention_selected"], Interventions.ESCALATE_TO_HUMAN)
        self.assertIn("COMPLIANT_ESCALATION", entry["audit_note"])

    def test_guardrail_sensitive_account_escalation(self):
        """Verify sensitive accounts route to ESCALATED_HUMAN_QUEUE."""
        txn = {
            "transaction_id": "txn_test_sensitive",
            "user_id": "usr_test_6",
            "amount": 15000,
            "failure_reason": "EXPIRED_MANDATE",
            "retry_count": 0,
            "is_sensitive": True
        }
        entry = self.agent.evaluate_transaction(txn)
        self.assertEqual(entry["status"], RecoveryStatus.ESCALATED_HUMAN)
        self.assertEqual(entry["intervention_selected"], Interventions.ESCALATE_TO_HUMAN)
        self.assertIn("Sensitive/VIP", entry["audit_note"])

    def test_guardrail_unknown_error_escalation(self):
        """Verify unknown errors route to ESCALATED_HUMAN_QUEUE."""
        txn = {
            "transaction_id": "txn_test_unknown",
            "user_id": "usr_test_7",
            "amount": 1200,
            "failure_reason": "UNKNOWN_ERROR",
            "retry_count": 0
        }
        entry = self.agent.evaluate_transaction(txn)
        self.assertEqual(entry["status"], RecoveryStatus.ESCALATED_HUMAN)
        self.assertEqual(entry["intervention_selected"], Interventions.ESCALATE_TO_HUMAN)
        self.assertIn("Unrecognized error code", entry["audit_note"])

    def test_diagnosis_matrix_mappings(self):
        """Verify all intervention matrix mappings."""
        # BANK_SERVER_DOWN
        e1 = self.agent.evaluate_transaction({
            "transaction_id": "t1", "user_id": "u1", "amount": 1000,
            "failure_reason": "BANK_SERVER_DOWN", "retry_count": 0
        })
        self.assertEqual(e1["intervention_selected"], Interventions.SCHEDULE_AUTO_RETRY)

        # GATEWAY_TIMEOUT
        e2 = self.agent.evaluate_transaction({
            "transaction_id": "t2", "user_id": "u2", "amount": 2000,
            "failure_reason": "GATEWAY_TIMEOUT", "retry_count": 0
        })
        self.assertEqual(e2["intervention_selected"], Interventions.SCHEDULE_AUTO_RETRY)

        # INSUFFICIENT_FUNDS
        e3 = self.agent.evaluate_transaction({
            "transaction_id": "t3", "user_id": "u3", "amount": 3000,
            "failure_reason": "INSUFFICIENT_FUNDS", "retry_count": 0
        })
        self.assertEqual(e3["intervention_selected"], Interventions.SEND_WHATSAPP_PAYMENT_LINK)

        # EXPIRED_MANDATE
        e4 = self.agent.evaluate_transaction({
            "transaction_id": "t4", "user_id": "u4", "amount": 4000,
            "failure_reason": "EXPIRED_MANDATE", "retry_count": 0
        })
        self.assertEqual(e4["intervention_selected"], Interventions.TRIGGER_HINGLISH_VOICE_CALL)

        # CARD_EXPIRED
        e5 = self.agent.evaluate_transaction({
            "transaction_id": "t5", "user_id": "u5", "amount": 5000,
            "failure_reason": "CARD_EXPIRED", "retry_count": 0
        })
        self.assertEqual(e5["intervention_selected"], Interventions.TRIGGER_HINGLISH_VOICE_CALL)

        # CHECKOUT_ABANDONED
        e6 = self.agent.evaluate_transaction({
            "transaction_id": "t6", "user_id": "u6", "amount": 6000,
            "failure_reason": "CHECKOUT_ABANDONED", "retry_count": 0
        })
        self.assertEqual(e6["intervention_selected"], Interventions.DISPATCH_SMS_REMINDER)

        # B2B_OVERDUE_INVOICE
        e7 = self.agent.evaluate_transaction({
            "transaction_id": "t7", "user_id": "u7", "amount": 7000,
            "failure_reason": "B2B_OVERDUE_INVOICE", "retry_count": 0
        })
        self.assertEqual(e7["intervention_selected"], Interventions.PROMISE_TO_PAY_TRACKER)

    def test_audit_log_schema_conformance(self):
        """Ensure all required fields exist and match types."""
        txn = {
            "transaction_id": "txn_schema_test",
            "user_id": "usr_schema_test",
            "amount": 1500.50,
            "failure_reason": "BANK_SERVER_DOWN",
            "retry_count": 0
        }
        entry = self.agent.evaluate_transaction(txn)
        required_keys = [
            "timestamp", "transaction_id", "user_id", "amount",
            "failure_reason", "intervention_selected", "retry_count",
            "status", "audit_note"
        ]
        for key in required_keys:
            self.assertIn(key, entry)

        self.assertIsInstance(entry["timestamp"], str)
        self.assertIsInstance(entry["transaction_id"], str)
        self.assertIsInstance(entry["user_id"], str)
        self.assertIsInstance(entry["amount"], (int, float))
        self.assertIsInstance(entry["failure_reason"], str)
        self.assertIsInstance(entry["intervention_selected"], str)
        self.assertIsInstance(entry["retry_count"], int)
        self.assertIn(entry["status"], [
            RecoveryStatus.RECOVERED,
            RecoveryStatus.PENDING_USER_RESPONSE,
            RecoveryStatus.UNRECOVERABLE,
            RecoveryStatus.ESCALATED_HUMAN
        ])
        self.assertIsInstance(entry["audit_note"], str)

    def test_batch_processing_and_metrics(self):
        """Test processing of mock failures and verify formula: (Recovered / Total) * 100."""
        input_path = os.path.join("data", "mock_failures.json")
        output_path = "test_audit_log.json"

        metrics = self.agent.process_batch(input_path, output_path)
        self.assertEqual(metrics["total_transactions"], 20)
        self.assertTrue(os.path.exists(output_path))

        expected_rate = round((metrics["recovered_count"] / metrics["total_transactions"]) * 100.0, 2)
        self.assertEqual(metrics["recovery_rate"], expected_rate)

        # Cleanup test output
        if os.path.exists(output_path):
            os.remove(output_path)


if __name__ == "__main__":
    unittest.main()
