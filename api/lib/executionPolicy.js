const CONFIRMATION_REQUIRED = new Set([
  'send_email',
  'reply_email',
  'forward_email',
  'create_google_doc',
  'append_google_doc',
  'create_spreadsheet',
  'update_sheet',
  'create_calendar_event',
  'save_memory',
  'save_note',
  'update_note',
  'delete_note',
  'bulk_archive_gmail',
]);

export function requiresUserConfirmation(name, input = {}) {
  if (name === 'modify_gmail') return String(input.action || '').toLowerCase() === 'trash';
  return CONFIRMATION_REQUIRED.has(name);
}

export function enforceExecutionPolicy(name, input = {}) {
  if (!requiresUserConfirmation(name, input)) return null;
  if (input.user_confirmed !== true) {
    return {
      type: 'policy_block',
      code: 'HUMAN_CONFIRMATION_REQUIRED',
      message: `Execution blocked by policy: ${name} requires explicit user_confirmed=true.`,
    };
  }
  return null;
}
