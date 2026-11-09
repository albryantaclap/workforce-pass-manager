import { cn } from '@/lib/utils';
import { employeeStatus } from '@/lib/inventoryEmployees';

/** Small Active / Inactive marker for a Master List employee. */
export default function EmployeeStatusBadge({ employee, className }) {
  const { inactive, label } = employeeStatus(employee);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        inactive
          ? 'border-slate-300 bg-slate-100 text-slate-600'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700',
        className
      )}
    >
      {label}
    </span>
  );
}