import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AttendancePage } from '@/components/attendance-page';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/attendance')({
  validateSearch: z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() }),
  head: () => gatherwellHead('insights'),
  component: Attendance,
});
function Attendance() {
  const { month } = Route.useSearch(); const navigate = Route.useNavigate();
  return <AttendancePage month={month ?? new Date().toISOString().slice(0, 7)} onMonth={month => void navigate({ search: { month }, replace: true })} />;
}