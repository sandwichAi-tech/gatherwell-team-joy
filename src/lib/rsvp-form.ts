/** Guest reminders need a supplied destination and the guest's explicit consent. */
export function rsvpReminderConsent(form: { phone: string; email: string; sms: boolean; mail: boolean }) {
  return { sms: !!form.phone.trim() && form.sms, mail: !!form.email.trim() && form.mail };
}