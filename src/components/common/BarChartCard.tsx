import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Table2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type BarDatum = { label: string; value: number; tooltip?: string };

/**
 * Single-series column chart (one hue, no legend needed — the title names the
 * series) with hover tooltips and a table view for accessibility.
 */
export function BarChartPanel({
  data,
  unit,
  ariaLabel,
  height = 220,
  formatValue = (v) => String(v),
}: {
  data: BarDatum[];
  unit: string;
  ariaLabel: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const [table, setTable] = useState(false);
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          {table ? <BarChart3 className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
          {table ? 'Biểu đồ' : 'Bảng số liệu'}
        </Button>
      </div>
      {table ? (
        <div className="max-h-72 overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">{ariaLabel}</caption>
            <thead className="bg-surface-2 text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Mục</th>
                <th className="px-3 py-2 text-right font-medium">{unit}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label} className="border-t border-border">
                  <td className="px-3 py-1.5">{d.tooltip ?? d.label}</td>
                  <td className="tabular px-3 py-1.5 text-right">{formatValue(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div role="img" aria-label={ariaLabel} style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} width={40} />
              <Tooltip
                cursor={{ fill: 'var(--surface-2)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as BarDatum;
                  return (
                    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-card">
                      <p className="text-muted">{d.tooltip ?? d.label}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-fg">
                        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: 'var(--chart-1)' }} aria-hidden />
                        {formatValue(d.value)} {unit}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
