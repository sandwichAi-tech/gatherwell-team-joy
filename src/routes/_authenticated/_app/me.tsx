import { createFileRoute } from '@tanstack/react-router';
import { MePage } from '@/components/me-page';
import { gatherwellHead } from '@/lib/gatherwell-head';
import { mePanelFromSearch } from '@/lib/profile-ia';
export const Route = createFileRoute('/_authenticated/_app/me')({ validateSearch: (s: Record<string, unknown>) => { const p = mePanelFromSearch(s['panel']); return p ? { panel: p } : {} as { panel?: 'edit' | 'hostProfile' | 'invite' | 'teams' }; }, head: () => gatherwellHead('me'), component: () => <MePage /> });
