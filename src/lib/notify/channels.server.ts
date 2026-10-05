// Reads which sending services have their secrets. Missing secrets mean "simulated" sending.
export function channelStatus() {
  const env = process.env;
  return {
    email: !!env['RESEND_API_KEY'],
    announcements: !!(env['MAILGUN_API_KEY'] && env['MAILGUN_DOMAIN']),
    sms: !!(env['TWILIO_ACCOUNT_SID'] && env['TWILIO_AUTH_TOKEN'] && env['TWILIO_FROM']),
    push: !!(env['VAPID_PUBLIC_KEY'] && env['VAPID_PRIVATE_KEY']),
  };
}
