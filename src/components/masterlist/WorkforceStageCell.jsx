import React from 'react';
import InlineEditCell from '@/components/common/InlineEditCell';
import { WORKFORCE_STAGES, getWorkforceStage } from '@/lib/workforceStage';

// Literal class strings so Tailwind generates them.
const BADGE_CLASS = {
  'Active on Site': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Onboarding: 'bg-amber-50 text-amber-700 border-amber-200',
  Unassigned: 'bg-slate-100 text-slate-500 border-slate-200',
};

/**
 * Workforce Stage cell.
 * Shows a badge normally, and an inline dropdown while Edit in Grid is on.
 */
export default function WorkforceStageCell({ emp, editMode, onSave }) {
  if (editMode) {
    return (
      <InlineEditCell
        value={emp.workforce_stage || ''}
        field="workforce_stage"
        empId={emp.id}
        type="select"
        options={WORKFORCE_STAGES}
        onSave={onSave}
        editMode={editMode}
      />
    );
  }

  const stage = getWorkforceStage(emp);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${
        BADGE_CLASS[stage] || BADGE_CLASS.Unassigned
      }`}
    >
      {stage}
    </span>
  );
}