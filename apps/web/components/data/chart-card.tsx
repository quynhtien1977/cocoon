"use client";

import { useId, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/brand/empty-state";
import { cn } from "@/lib/utils";

export type ChartType = "bar" | "horizontal-bar" | "line" | "pie";

export interface ChartSeries<T> {
  /** Numeric field of each row. */
  key: keyof T & string;
  label: string;
}

export interface ChartCardProps<T> {
  title: string;
  description?: string;
  type: ChartType;
  data: readonly T[];
  /** Field used as axis label (bar, line) or slice name (pie). */
  categoryKey: keyof T & string;
  categoryLabel: string;
  /** Up to five series, colored --chart-1…5 in order. Pie uses only the first series. */
  series: ChartSeries<T>[];
  formatValue?: (value: number) => string;
  height?: number;
  action?: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const defaultFormat = (value: number) => numberFormat.format(value);
/** Fixed series order from spec 4.1; colors repeat after five. */
export const chartColor = (index: number) => `var(--chart-${(index % 5) + 1})`;

const tick = { fill: "var(--muted-foreground)", fontSize: 12 };
const tooltipStyle = { background: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13 };

function ChartBody<T>({ type, data, categoryKey, series, formatValue, height }: Required<Pick<ChartCardProps<T>, "type" | "data" | "categoryKey" | "series" | "formatValue" | "height">>) {
  // Recharts infers dataKey from row type; keys are already checked by ChartCardProps<T>.
  const rows = data as unknown as Record<string, unknown>[];
  const category = categoryKey as string;
  const chartProps = { responsive: true, style: { width: "100%", height }, accessibilityLayer: false };
  const formatter = (value: unknown) => typeof value === "number" ? formatValue(value) : String(value ?? "");
  const legend = series.length > 1 && <Legend wrapperStyle={{ fontSize: 13 }} />;
  const tooltip = <Tooltip formatter={formatter} contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />;

  if (type === "pie") {
    const [first] = series;
    const slices = rows.map((row, index) => ({ name: String(row[categoryKey] ?? ""), value: Number(row[first.key] ?? 0), fill: chartColor(index) }));
    return (
      <PieChart {...chartProps}>
        <Pie data={slices} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="80%" stroke="var(--card)" isAnimationActive={false} />
        {tooltip}
        <Legend wrapperStyle={{ fontSize: 13 }} />
      </PieChart>
    );
  }
  if (type === "line") {
    return (
      <LineChart {...chartProps} data={rows}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey={category} tick={tick} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
        <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={formatValue} width={48} />
        {tooltip}
        {legend}
        {series.map((item, index) => <Line key={item.key} type="monotone" dataKey={item.key as string} name={item.label} stroke={chartColor(index)} strokeWidth={2} dot={{ r: 3, fill: chartColor(index) }} isAnimationActive={false} />)}
      </LineChart>
    );
  }
  const horizontal = type === "horizontal-bar";
  return (
    <BarChart {...chartProps} data={rows} layout={horizontal ? "vertical" : "horizontal"}>
      <CartesianGrid stroke="var(--border)" vertical={horizontal} horizontal={!horizontal} />
      {horizontal ? <>
        <XAxis type="number" tick={tick} tickLine={false} axisLine={false} tickFormatter={formatValue} />
        <YAxis type="category" dataKey={category} tick={tick} tickLine={false} axisLine={{ stroke: "var(--border)" }} width={112} />
      </> : <>
        <XAxis dataKey={category} tick={tick} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
        <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={formatValue} width={48} />
      </>}
      {tooltip}
      {legend}
      {series.map((item, index) => <Bar key={item.key} dataKey={item.key as string} name={item.label} fill={chartColor(index)} radius={horizontal ? [0, 2, 2, 0] : [2, 2, 0, 0]} maxBarSize={48} isAnimationActive={false} />)}
    </BarChart>
  );
}

export function ChartCard<T>({ title, description, type, data, categoryKey, categoryLabel, series, formatValue = defaultFormat, height = 280, action, loading = false, error, onRetry, emptyTitle = "Chưa có dữ liệu", emptyDescription = "Biểu đồ sẽ hiển thị khi có số liệu.", className }: ChartCardProps<T>) {
  const id = useId();
  const tableSeries = type === "pie" ? series.slice(0, 1) : series;
  return (
    <section aria-labelledby={`${id}-title`} className={cn("min-w-0 rounded-lg border border-border bg-card p-6 text-card-foreground", className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="font-heading text-xl">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      {loading ? <div role="status"><span className="sr-only">Đang tải biểu đồ</span><Skeleton className="w-full" style={{ height }} /></div>
        : error ? <div role="alert" className="rounded-lg border border-destructive p-6"><p>{error}</p>{onRetry && <Button type="button" variant="outline" className="mt-3" onClick={onRetry}>Thử lại</Button>}</div>
        : data.length === 0 ? <EmptyState title={emptyTitle} description={emptyDescription} className="border-0 py-8" />
        : <>
          <div aria-hidden="true"><ChartBody type={type} data={data} categoryKey={categoryKey} series={series} formatValue={formatValue} height={height} /></div>
          <table className="sr-only">
            <caption>{title}</caption>
            <thead><tr><th scope="col">{categoryLabel}</th>{tableSeries.map((item) => <th key={item.key} scope="col">{item.label}</th>)}</tr></thead>
            <tbody>{data.map((row, index) => <tr key={index}><th scope="row">{String(row[categoryKey] ?? "")}</th>{tableSeries.map((item) => <td key={item.key}>{typeof row[item.key] === "number" ? formatValue(row[item.key] as number) : String(row[item.key] ?? "")}</td>)}</tr>)}</tbody>
          </table>
        </>}
    </section>
  );
}
