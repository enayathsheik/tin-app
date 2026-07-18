const INTENT_TYPES = [
  'sales_enquiry', 'procurement', 'approval', 'meeting', 'payment',
  'delivery', 'complaint', 'warranty', 'design_discussion',
  'technical_support', 'follow_up', 'other',
];

const SUGGESTED_ACTION_TYPES = [
  'tag_project', 'log_ledger_entry', 'flag_snag',
  'set_milestone', 'share_reference', 'log_approval',
];

module.exports = { INTENT_TYPES, SUGGESTED_ACTION_TYPES };
