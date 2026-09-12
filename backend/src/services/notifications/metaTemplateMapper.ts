import type { ReminderStage, TemplateContext } from '../../types/reminders.js'

export interface MetaTemplateParameter {
  type: 'text'
  text: string
}

export interface MetaTemplatePayload {
  name: string
  language: { code: string }
  components: Array<{
    type: 'body'
    parameters: MetaTemplateParameter[]
  }>
}

export type MetaTemplateMappingResult =
  | { ok: true; template: MetaTemplatePayload }
  | { ok: false; error: string }

/**
 * Maps an internal application reminder stage and its interpolated context
 * into a Meta-approved WhatsApp Cloud API template structure.
 *
 * Clearly separates internal application templates (arbitrary markdown/text)
 * from pre-approved Meta WhatsApp templates with strictly ordered positional parameters.
 */
export function mapToMetaTemplate(
  stage: ReminderStage,
  context?: TemplateContext,
  languageCode = 'en_US',
): MetaTemplateMappingResult {
  if (!context) {
    return {
      ok: false,
      error: `Cannot construct Meta WhatsApp template: Missing TemplateContext for stage "${stage}".`,
    }
  }

  // Allow custom Meta-approved template names via env, defaulting to standard stage names
  const templateNameMap: Record<ReminderStage, string> = {
    membership_expiry_7_days:
      process.env.META_TEMPLATE_EXPIRY_7_DAYS || 'membership_expiry_7_days',
    membership_expiry_1_day:
      process.env.META_TEMPLATE_EXPIRY_1_DAY || 'membership_expiry_1_day',
    membership_expired:
      process.env.META_TEMPLATE_EXPIRED || 'membership_expired',
    payment_due:
      process.env.META_TEMPLATE_PAYMENT_DUE || 'payment_due',
    payment_overdue:
      process.env.META_TEMPLATE_PAYMENT_OVERDUE || 'payment_overdue',
  }

  const templateName = templateNameMap[stage]
  if (!templateName) {
    return {
      ok: false,
      error: `Meta WhatsApp template mapping not configured for reminder stage: "${stage}".`,
    }
  }

  let parameters: MetaTemplateParameter[] = []

  switch (stage) {
    case 'membership_expiry_7_days':
    case 'membership_expiry_1_day':
    case 'membership_expired':
      // Standard 4 parameters: {{1}}=Member Name, {{2}}=Plan Name, {{3}}=Gym Name, {{4}}=Expiry Date
      parameters = [
        { type: 'text', text: String(context.member_name || 'Member') },
        { type: 'text', text: String(context.membership_plan || 'Membership') },
        { type: 'text', text: String(context.gym_name || 'Iron Paradise Gym') },
        { type: 'text', text: String(context.expiry_date || '—') },
      ]
      break

    case 'payment_due':
    case 'payment_overdue':
      // Standard 5 parameters: {{1}}=Member Name, {{2}}=Pending Amount, {{3}}=Plan Name, {{4}}=Gym Name, {{5}}=Due Date
      parameters = [
        { type: 'text', text: String(context.member_name || 'Member') },
        { type: 'text', text: String(context.pending_amount || '0') },
        { type: 'text', text: String(context.membership_plan || 'Membership') },
        { type: 'text', text: String(context.gym_name || 'Iron Paradise Gym') },
        { type: 'text', text: String(context.payment_due_date || '—') },
      ]
      break

    default:
      return {
        ok: false,
        error: `Unsupported reminder stage for Meta WhatsApp template mapping: "${stage}".`,
      }
  }

  return {
    ok: true,
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters,
        },
      ],
    },
  }
}

/**
 * Constructs the standard Meta sandbox test template payload for jaspers_market_order_confirmation_v1.
 * Pre-approved in Meta WhatsApp Cloud API developer test accounts.
 *
 * Expected parameters by Meta:
 * {{1}} = Customer / Member Name
 * {{2}} = Order / Confirmation Reference
 * {{3}} = Estimated Delivery / Date
 */
export function buildJaspersMarketTestTemplate(
  context?: TemplateContext,
  languageCode = 'en_US',
): MetaTemplatePayload {
  return {
    name: 'jaspers_market_order_confirmation_v1',
    language: { code: languageCode },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: String(context?.member_name || 'Member') },
          { type: 'text', text: String(context?.membership_plan || 'IP-TEST-001') },
          { type: 'text', text: String(context?.expiry_date || new Date().toISOString().split('T')[0]) },
        ],
      },
    ],
  }
}

