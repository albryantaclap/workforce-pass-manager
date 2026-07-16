import React from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserX, LogOut, Clock, UserCog } from 'lucide-react';

function toDateValue(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().split('T')[0];
  return '';
}

function formatDateTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

const DateField = ({ field, label, form, onChange }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <Input
      type="date"
      value={toDateValue(form[field])}
      onChange={e => onChange(field, e.target.value)}
    />
  </div>
);

const TextField = ({ field, label, form, onChange }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <Input
      value={form[field] || ''}
      onChange={e => onChange(field, e.target.value)}
    />
  </div>
);

const TextAreaField = ({ field, label, form, onChange }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <Textarea
      value={form[field] || ''}
      onChange={e => onChange(field, e.target.value)}
      rows={2}
      className="resize-y"
    />
  </div>
);

const ReadOnlyField = ({ label, icon: Icon, value }) => (
  <div className="space-y-1.5">
    <Label className="text-xs flex items-center gap-1.5">
      <Icon className="w-3 h-3" />{label}
    </Label>
    <div className="px-3 py-2 rounded-md bg-muted/50 border border-border text-sm text-muted-foreground min-h-[2.5rem] flex items-center">
      {value || <span className="italic opacity-60">—</span>}
    </div>
  </div>
);

/**
 * Displays the Inactive or Demobilized status details inside the Edit Personnel form.
 * Visible only when the personnel record currently has a non-active status.
 * Editable: Effective Date, Last Working Date, Reason, Remarks.
 * Read-only: Status Changed By, Status Changed Date & Time.
 */
export default function StatusDetailsSection({ form, onChange }) {
  const status = form.personnel_status;
  if (status !== 'Inactive' && status !== 'Demobilized') return null;

  const isInactive = status === 'Inactive';
  const title = isInactive ? 'Inactive Status Details' : 'Demobilization Details';
  const Icon = isInactive ? UserX : LogOut;
  const accent = isInactive ? 'text-red-600' : 'text-orange-600';
  const dateLabel = isInactive
    ? 'Inactive Date / Status Effective Date'
    : 'Demobilization Date / Status Effective Date';
  const reasonLabel = isInactive ? 'Reason' : 'Demobilization Reason';
  const syncedDateField = isInactive ? 'inactive_date' : 'demobilization_date';
  const reasonField = isInactive ? 'status_reason' : 'demobilization_reason';

  // Keep status_effective_date and the status-specific date field in sync.
  const handleFieldChange = (field, value) => {
    if (field === 'status_effective_date') {
      onChange('status_effective_date', value);
      onChange(syncedDateField, value);
    } else {
      onChange(field, value);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`w-4 h-4 ${accent}`} />
        <h3 className={`text-sm font-semibold ${accent}`}>{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DateField
          field="status_effective_date"
          label={dateLabel}
          form={form}
          onChange={handleFieldChange}
        />
        <DateField
          field="last_working_date"
          label="Last Working Date"
          form={form}
          onChange={handleFieldChange}
        />
        <TextField
          field={reasonField}
          label={reasonLabel}
          form={form}
          onChange={handleFieldChange}
        />
        <div className="md:col-span-2 lg:col-span-3">
          <TextAreaField
            field="status_remarks"
            label="Remarks"
            form={form}
            onChange={handleFieldChange}
          />
        </div>
        <ReadOnlyField
          label="Status Changed By"
          icon={UserCog}
          value={form.status_changed_by}
        />
        <ReadOnlyField
          label="Status Changed Date & Time"
          icon={Clock}
          value={formatDateTime(form.status_changed_at)}
        />
      </div>
    </Card>
  );
}