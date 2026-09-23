import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceExecutionPolicy, requiresUserConfirmation } from '../api/lib/executionPolicy.js';

test('protected external writes fail closed without confirmation', () => {
  for (const name of ['send_email','reply_email','forward_email','create_google_doc','append_google_doc','create_spreadsheet','update_sheet','create_calendar_event','bulk_archive_gmail']) {
    assert.equal(requiresUserConfirmation(name, {}), true);
    const result = enforceExecutionPolicy(name, {});
    assert.equal(result?.code, 'HUMAN_CONFIRMATION_REQUIRED');
  }
});

test('gmail trash requires confirmation, non-destructive label changes do not', () => {
  assert.equal(requiresUserConfirmation('modify_gmail', { action: 'trash' }), true);
  assert.equal(enforceExecutionPolicy('modify_gmail', { action: 'trash' })?.code, 'HUMAN_CONFIRMATION_REQUIRED');
  assert.equal(requiresUserConfirmation('modify_gmail', { action: 'archive' }), false);
  assert.equal(enforceExecutionPolicy('modify_gmail', { action: 'archive' }), null);
});

test('explicit confirmation opens the execution gate', () => {
  assert.equal(enforceExecutionPolicy('send_email', { user_confirmed: true }), null);
  assert.equal(enforceExecutionPolicy('create_google_doc', { user_confirmed: true }), null);
});
