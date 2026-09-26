import React from 'react';
import { Button } from '@/components/ui/button';
import { X, HardHat, UserPlus } from 'lucide-react';
import { WORKFORCE_STAGES } from '@/lib/workforceStage';

const STAGE_ICONS = { 'Active on Site': HardHat, Onboarding: UserPlus };

/**
 * Shown in Edit in Grid mode when rows are ticked.
 * Assigns a Workforce Stage to the selected personnel in one action.
 */
export default function WorkforceStageBulkBar({ count, onApply, onClear, isLoading }) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
      <span className="text-amber-800 font-medium shrink-0">
        {count} selected — Change Workforce Stage to:
      </span>
      {WORKFORCE_STAGES.map(s => {
        const Icon = STAGE_ICONS[s.value];
        return (
          <Button
            key={s.value}
            size="sm"
            className="h-8 text-xs"
            disabled={isLoading}
            onClick={() => onApply(s.value)}
          >
            <Icon className="w-3.5 h-3.5 mr-1.5" /> {s.label}
          </Button>
        );
      })}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 text-xs ml-auto"
        onClick={onClear}
        disabled={isLoading}
      >
        <X className="w-3.5 h-3.5 mr-1" /> Clear selection
      </Button>
    </div>
  );
}