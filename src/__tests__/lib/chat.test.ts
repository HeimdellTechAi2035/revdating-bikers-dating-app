/**
 * src/__tests__/lib/chat.test.ts
 *
 * Tests:
 *   ✓ only matched users can send messages
 *   ✓ blocked users cannot message each other
 *   ✓ banned users cannot send messages
 *   ✓ inactive match blocks messaging
 *   ✓ empty content is rejected
 *   ✓ content over 2000 characters is rejected
 *   ✓ successful message is returned
 */

import { describe, it, expect } from 'vitest';
import { sendMessage } from '@/lib/chat';
import { queueMockResults } from '../setup';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const UID_SENDER    = '00000000-0000-0000-0000-000000000001';
const UID_RECIPIENT = '00000000-0000-0000-0000-000000000002';
const MATCH_ID      = 'match-0000-0000-0000-000000000001';

const activeMatch = {
  id:        MATCH_ID,
  user1_id:  UID_SENDER,
  user2_id:  UID_RECIPIENT,
  is_active: true,
};

const senderProfile = {
  is_banned:    false,
  display_name: 'TestRider',
};

// ─── Content validation (no DB calls) ────────────────────────────────────────
describe('sendMessage — content validation', () => {
  it('throws when content is empty', async () => {
    await expect(sendMessage(MATCH_ID, UID_SENDER, '')).rejects.toThrow(
      'Message content cannot be empty.',
    );
  });

  it('throws when content is whitespace only', async () => {
    await expect(sendMessage(MATCH_ID, UID_SENDER, '   ')).rejects.toThrow(
      'Message content cannot be empty.',
    );
  });

  it('throws when content exceeds 2000 characters', async () => {
    const longContent = 'a'.repeat(2001);
    await expect(sendMessage(MATCH_ID, UID_SENDER, longContent)).rejects.toThrow(
      'Message content exceeds the 2000-character limit.',
    );
  });
});

// ─── Match participant check ──────────────────────────────────────────────────
describe('sendMessage — only matched users can message', () => {
  it('throws when match is not found', async () => {
    queueMockResults([
      { data: null, error: { message: 'No rows found' } }, // match query
    ]);
    await expect(sendMessage(MATCH_ID, UID_SENDER, 'hello')).rejects.toThrow(
      'Match not found.',
    );
  });

  it('throws when sender is not a participant in the match', async () => {
    const outsiderId = '00000000-0000-0000-0000-000000000099';
    queueMockResults([
      {
        data: { ...activeMatch, user1_id: 'other-1', user2_id: 'other-2' },
        error: null,
      },
    ]);
    await expect(sendMessage(MATCH_ID, outsiderId, 'hello')).rejects.toThrow(
      'You are not a participant in this match.',
    );
  });
});

// ─── Active match required ────────────────────────────────────────────────────
describe('sendMessage — active match required', () => {
  it('throws when the match has been deactivated', async () => {
    queueMockResults([
      { data: { ...activeMatch, is_active: false }, error: null }, // match
    ]);
    await expect(sendMessage(MATCH_ID, UID_SENDER, 'hello')).rejects.toThrow(
      'This match is no longer active.',
    );
  });
});

// ─── Banned sender ────────────────────────────────────────────────────────────
describe('sendMessage — banned user cannot message', () => {
  it('throws when the sender is banned', async () => {
    queueMockResults([
      { data: activeMatch, error: null },                          // match
      { data: { is_banned: true, display_name: 'BadRider' }, error: null }, // sender profile
    ]);
    await expect(sendMessage(MATCH_ID, UID_SENDER, 'hello')).rejects.toThrow(
      'Your account has been suspended and cannot send messages.',
    );
  });
});

// ─── Block check ─────────────────────────────────────────────────────────────
describe('sendMessage — blocked users cannot message', () => {
  it('throws when either user has blocked the other', async () => {
    queueMockResults([
      { data: activeMatch, error: null },           // match
      { data: senderProfile, error: null },          // sender profile
      { count: 1, data: null, error: null },         // block check → blocked
    ]);
    await expect(sendMessage(MATCH_ID, UID_SENDER, 'hello')).rejects.toThrow(
      'You cannot message this user.',
    );
  });
});

// ─── Successful message ───────────────────────────────────────────────────────
describe('sendMessage — happy path', () => {
  it('returns the inserted message row on success', async () => {
    const mockMessage = {
      id:         'msg-001',
      match_id:   MATCH_ID,
      sender_id:  UID_SENDER,
      content:    'Hey! Nice bike.',
      is_read:    false,
      created_at: '2026-04-30T10:00:00Z',
    };

    queueMockResults([
      { data: activeMatch, error: null },   // match
      { data: senderProfile, error: null }, // sender profile
      { count: 0, data: null, error: null }, // no block
      { data: mockMessage, error: null },   // insert message
      // Side-effect: update matches.last_message_at (fire-and-forget — not awaited)
    ]);

    const result = await sendMessage(MATCH_ID, UID_SENDER, 'Hey! Nice bike.');
    expect(result.id).toBe('msg-001');
    expect(result.content).toBe('Hey! Nice bike.');
    expect(result.sender_id).toBe(UID_SENDER);
  });
});
