import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: any) => <div>{children}</div>, useNavigate: vi.fn() }));
vi.mock('@/components/gathering-cover', () => ({ GatheringCover: () => null }));
vi.mock('@/components/gatherwell-shell', () => ({ useGatherwell: vi.fn() }));
vi.mock('@/components/map-page', () => ({ MapPlaceholder: () => null, RealMap: () => null }));
vi.mock('@/lib/maps-client', () => ({ useMapsKey: vi.fn() }));
vi.mock('@/components/my-tickets', () => ({ MyTickets: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
import { GatheringCard } from './events-page';
import type { Gathering } from '@/lib/gatherings';
it('Upcoming uses the event calendar day and time rather than browser UTC', () => {
  const event = { id: 'ZZ-TEST', title: 'ZZ-TEST Midnight', starts_at: '2026-11-01T00:30:00Z', timezone: 'America/Los_Angeles', status: 'published', capacity: null } as Gathering;
  render(<GatheringCard e={event} lang="en-US" />);
  expect(screen.getByText('31')).toBeInTheDocument(); expect(screen.getByText('Oct')).toBeInTheDocument(); expect(screen.getByText(/5:30 PM/)).toBeInTheDocument();
});