import React from 'react';
import { Users, Shapes, LayoutGrid, Eye, Palette, Layers, Settings } from 'lucide-react';
import OrgDataPanel from '@/components/orgchart/panels/OrgDataPanel';
import InsertPanel from '@/components/orgchart/panels/InsertPanel';
import TemplatesPanel from '@/components/orgchart/panels/TemplatesPanel';
import LensPanel from '@/components/orgchart/panels/LensPanel';
import StylesPanel from '@/components/orgchart/panels/StylesPanel';
import LayersPanel from '@/components/orgchart/panels/LayersPanel';
import ChartSettingsPanel from '@/components/orgchart/panels/ChartSettingsPanel';

const SECTIONS = [
  { key: 'data', label: 'Organization Data', icon: Users, Panel: OrgDataPanel },
  { key: 'insert', label: 'Shapes & Cards', icon: Shapes, Panel: InsertPanel },
  { key: 'templates', label: 'Templates', icon: LayoutGrid, Panel: TemplatesPanel },
  { key: 'lens', label: 'Lens & Display', icon: Eye, Panel: LensPanel },
  { key: 'styles', label: 'Styles', icon: Palette, Panel: StylesPanel },
  { key: 'layers', label: 'Layers', icon: Layers, Panel: LayersPanel },
  { key: 'settings', label: 'Chart Settings', icon: Settings, Panel: ChartSettingsPanel },
];

export default function LeftSidebar({ active, onChange, ctx }) {
  const section = SECTIONS.find(s => s.key === active) || SECTIONS[0];
  const Panel = section.Panel;
  return (
    <div className="flex h-full shrink-0">
      <div className="w-12 border-r bg-card flex flex-col items-center py-2 gap-1">
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            title={label}
            onClick={() => onChange(key)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${active === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>
      <div className="w-72 border-r bg-card overflow-y-auto">
        <div className="px-3 py-2.5 border-b">
          <p className="text-xs font-semibold">{section.label}</p>
        </div>
        <Panel ctx={ctx} />
      </div>
    </div>
  );
}