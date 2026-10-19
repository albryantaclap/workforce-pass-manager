import React, { useMemo, useRef, useState } from 'react';
import { ORG_TEMPLATES } from '@/lib/orgChartConstants';
import { Button } from '@/components/ui/button';
import { Copy, Trash2, Upload, Download, Plus } from 'lucide-react';

export default function TemplatesPanel({ ctx }) {
  const categories = useMemo(
    () => ['All', ...new Set(ORG_TEMPLATES.map(t => t.category))],
    []
  );
  const [category, setCategory] = useState('All');
  const fileRef = useRef(null);
  const shown = ORG_TEMPLATES.filter(t => category === 'All' || t.category === category);

  return (
    <div className="p-3 space-y-4">
      <div className="flex flex-wrap gap-1">
        {categories.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`px-2 py-0.5 rounded-full border text-[10px] ${category === cat ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        {shown.map(template => (
          <div key={template.key} className="rounded-md border p-2">
            <p className="text-xs font-medium">{template.name}</p>
            <p className="text-[10px] text-muted-foreground">{template.description}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{template.nodes.length} cards · {template.edges.length} connectors</p>
            <div className="flex gap-1.5 mt-1.5">
              <Button size="sm" className="h-6 px-2 text-[10px]" disabled={!ctx.canEdit} onClick={() => ctx.applyTemplate(template)}>
                <Plus className="w-3 h-3 mr-1" /> Use
              </Button>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => ctx.exportTemplateJson(template)}>
                <Download className="w-3 h-3 mr-1" /> JSON
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-3 space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground">My templates</p>
        {ctx.customTemplates.map(template => (
          <div key={template.id} className="rounded-md border p-2">
            <p className="text-xs font-medium">{template.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {template.category || 'Custom'} · {(template.nodes || []).length} cards
              {template.is_shared ? ' · shared' : ''}
            </p>
            <div className="flex gap-1.5 mt-1.5">
              <Button size="sm" className="h-6 px-2 text-[10px]" disabled={!ctx.canEdit} onClick={() => ctx.applyTemplate(template)}>Use</Button>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => ctx.duplicateTemplate(template)}>
                <Copy className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => ctx.exportTemplateJson(template)}>
                <Download className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-red-600" onClick={() => ctx.deleteTemplate(template)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
        {!ctx.customTemplates.length && (
          <p className="text-[10px] text-muted-foreground">No saved templates yet.</p>
        )}
      </div>

      <div className="border-t pt-3 space-y-2">
        <Button size="sm" variant="outline" className="w-full h-7 text-[11px]" disabled={!ctx.canEdit || !ctx.nodes.length} onClick={ctx.saveAsTemplate}>
          Save this chart as a template
        </Button>
        <Button size="sm" variant="outline" className="w-full h-7 text-[11px]" onClick={() => fileRef.current?.click()}>
          <Upload className="w-3 h-3 mr-1" /> Import template JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) ctx.importTemplateJson(file); e.target.value = ''; }}
        />
        <Button size="sm" variant="outline" className="w-full h-7 text-[11px]" onClick={ctx.exportChartJson}>
          Export current chart (editable JSON)
        </Button>
      </div>
    </div>
  );
}