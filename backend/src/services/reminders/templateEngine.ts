import type {
  ReminderChannel,
  ReminderStage,
  TemplateContext,
} from '../../types/reminders.js'

export const DEFAULT_TEMPLATES: Record<
  ReminderStage,
  Record<ReminderChannel, string>
> = {
  membership_expiry_7_days: {
    whatsapp:
      'Hi {{member_name}}, your {{membership_plan}} membership at {{gym_name}} will expire in 7 days on {{expiry_date}}. Renew early to keep your training streak going!',
    sms:
      '{{gym_name}}: Hi {{member_name}}, your {{membership_plan}} expires on {{expiry_date}} (7 days left). Please renew at reception.',
  },
  membership_expiry_1_day: {
    whatsapp:
      'Hi {{member_name}}, this is a reminder that your {{membership_plan}} membership at {{gym_name}} expires tomorrow on {{expiry_date}}. Please renew to continue workout uninterrupted.',
    sms:
      '{{gym_name}}: Hi {{member_name}}, your membership expires tomorrow ({{expiry_date}}). Renew today to stay active!',
  },
  membership_expired: {
    whatsapp:
      'Hi {{member_name}}, your {{membership_plan}} membership at {{gym_name}} expired on {{expiry_date}}. We miss seeing you on the gym floor! Visit the front desk to renew your plan.',
    sms:
      '{{gym_name}}: Hi {{member_name}}, your membership has expired. Renew at the desk to resume your workouts.',
  },
  payment_due: {
    whatsapp:
      'Hi {{member_name}}, a pending balance of ₹{{pending_amount}} for your {{membership_plan}} membership at {{gym_name}} is due on {{payment_due_date}}. Please settle your dues at the counter.',
    sms:
      '{{gym_name}}: Hi {{member_name}}, fee balance of ₹{{pending_amount}} is due on {{payment_due_date}}. Kindly pay at the desk.',
  },
  payment_overdue: {
    whatsapp:
      'URGENT: Hi {{member_name}}, your payment of ₹{{pending_amount}} for {{membership_plan}} at {{gym_name}} is overdue (due date was {{payment_due_date}}). Please visit the desk or contact management to settle your account.',
    sms:
      '{{gym_name}}: Hi {{member_name}}, your fee of ₹{{pending_amount}} is overdue. Please settle immediately at reception.',
  },
}

export function renderTemplate(body: string, context: TemplateContext): string {
  if (!body) return ''
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const val = (context as unknown as Record<string, unknown>)[key]
    return val !== undefined && val !== null ? String(val) : `{{${key}}}`
  })
}

export function getSampleTemplateContext(): TemplateContext {
  const future7 = new Date()
  future7.setDate(future7.getDate() + 7)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  return {
    member_name: 'Rahul Sharma',
    membership_plan: 'Yearly Pro',
    expiry_date: future7.toISOString().split('T')[0],
    pending_amount: '1,500',
    payment_due_date: tomorrow.toISOString().split('T')[0],
    gym_name: 'Iron Paradise Gym',
  }
}
