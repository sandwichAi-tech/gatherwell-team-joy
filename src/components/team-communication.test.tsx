import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), owner: false, user: 'member', rows: [] as unknown[] }));
vi.mock('@tanstack/react-router', () => ({ useSearch: () => ({}) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { resolvedLanguage: 'en' } }) }));
vi.mock('@/components/conversation', () => ({ DiscussionsPanel: () => null }));
vi.mock('@/components/responsive-sheet', () => ({ ResponsiveSheet: () => null }));
vi.mock('@/components/launch-states', () => ({ ListSkeleton: () => null, RetryState: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: mock.rpc,
  auth: { getUser: async () => ({ data: { user: { id: mock.user } }, error: null }) },
  from: () => { const q = { select: () => q, eq: () => Promise.resolve({ data: mock.rows, error: null }) }; return q; },
  channel: () => { const c = { on: () => c, subscribe: () => c }; return c; }, removeChannel: vi.fn(),
} }));
import { TeamCommunication } from './team-communication';
beforeEach(() => { mock.owner = false; mock.user = 'member'; mock.rows = []; mock.rpc.mockReset(); mock.rpc.mockImplementation(async name => ({ error: null, data: name === 'team_channel_state' ? { owner: mock.owner, muted: false, announcements_unread: 0, chat_unread: 3 } : null })); });
afterEach(cleanup);
function mount() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); render(<QueryClientProvider client={client}><TeamCommunication teamId="team-a" me="member" /></QueryClientProvider>); return client; }
describe('team-scoped communication actions', () => {
  it('marks only announcements read when announcements are opened', async () => {
    mount(); fireEvent.click(await screen.findByRole('button', { name: /teamCommunication.announcements/ }));
    await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith('set_team_channel_preference', { _team: 'team-a', _read_announcements: true }));
    expect(mock.rpc.mock.calls.some(([name]) => name === 'mark_topic_read')).toBe(false);
  });
  it('muting stays scoped to the team and does not mark either channel read', async () => {
    mount(); fireEvent.click(await screen.findByRole('switch', { name: 'teamCommunication.mute' }));
    await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith('set_team_channel_preference', { _team: 'team-a', _muted: true }));
    expect(mock.rpc.mock.calls.some(([, args]) => args?._read_announcements)).toBe(false);
  });
  it('does not offer announcement management to a member', async () => {
    mount(); await screen.findByRole('switch'); expect(screen.queryByRole('button', { name: 'teamCommunication.new' })).toBeNull();
  });
  it('hides retained private announcements while an authoritative access recheck is stalled', async () => {
    mock.rows = [{ id: 'private', title: 'ZZ-TEST private team', body: 'Private coach discussion', pinned: false, created_at: '2026-10-31', archived_at: null }];
    const client = mount(); await screen.findByText('ZZ-TEST private team');
    let finish: ((value: unknown) => void) | undefined;
    mock.rpc.mockImplementation(name => name === 'team_channel_state' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ data: null, error: null }));
    const checking = client.invalidateQueries({ queryKey: ['team-channel', 'team-a', 'member'] });
    await waitFor(() => expect(screen.queryByText('ZZ-TEST private team')).toBeNull());
    finish?.({ data: null, error: null }); await checking;
    await waitFor(() => expect(screen.queryByRole('switch')).toBeNull());
  });
  it('rejects a different signed-in account before reading private channel state', async () => {
    mock.user = 'outsider'; mount();
    await waitFor(() => expect(mock.rpc).not.toHaveBeenCalled());
    expect(screen.queryByRole('switch')).toBeNull();
  });
});