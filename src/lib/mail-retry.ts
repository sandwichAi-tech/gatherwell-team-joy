/** Only failed messages without any delivery acknowledgement can be requeued. */
export function canRetryMessage(message: { status: string; provider_message_id: string | null; sent_at: string | null }) {
  return message.status === 'failed' && message.provider_message_id === null && message.sent_at === null;
}