import { describe, expect, it } from 'vitest';
import { detectChatPlatform } from './chat-links';

describe('detectChatPlatform', () => {
  it('detects each supported platform', () => {
    expect(detectChatPlatform('https://chat.whatsapp.com/AbCdEfGhIjKl')).toBe('whatsapp');
    expect(detectChatPlatform('https://t.me/+AbCdEf123')).toBe('telegram');
    expect(detectChatPlatform('https://signal.group/#CjQKIabcdefghij')).toBe('signal');
    expect(detectChatPlatform('https://groupme.com/join_group/12345/AbCd')).toBe('groupme');
    expect(detectChatPlatform('https://m.me/j/AbCdEf12')).toBe('messenger');
    expect(detectChatPlatform('https://discord.gg/abc123')).toBe('discord');
  });
  it('rejects other links', () => {
    expect(detectChatPlatform('https://example.com/chat')).toBeNull();
    expect(detectChatPlatform('http://t.me/+AbCdEf123')).toBeNull();
  });
});
