export interface ScoreComponent {
  label: string;
  /** Spec 5.7 weight, 0–1. */
  weight: number;
  /** Normalized signal, 0–1; contribution = weight × value. */
  value: number;
  note: string;
}

const decimal = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 0 });

/** The six weighted signals behind a recommendation score; numbers are text, the bar only reinforces them. */
export function ScoreBreakdown({ components, productName }: { components: readonly ScoreComponent[]; productName: string }) {
  const total = components.reduce((sum, item) => sum + item.weight * item.value, 0);
  return (
    <section aria-labelledby="score-title" className="min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted px-3 py-2">
        <div className="min-w-0">
          <p className="font-label text-xs uppercase tracking-wider text-gold-strong">Điểm gợi ý cao nhất</p>
          <h2 id="score-title" className="font-heading text-xl">{productName}</h2>
        </div>
        <p className="text-sm"><span className="font-heading text-2xl font-bold tabular-nums text-gold-strong">{decimal.format(total)}</span><span className="text-muted-foreground"> / 1,00</span></p>
      </header>
      <ol className="mt-4 space-y-4">
        {components.map((item, index) => {
          const contribution = item.weight * item.value;
          return (
            <li key={item.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-semibold">{index + 1}. {item.label} <span className="font-normal text-muted-foreground">(trọng số {percent.format(item.weight)})</span></span>
                <span className="font-mono tabular-nums">{decimal.format(contribution)} / {decimal.format(item.weight)}</span>
              </div>
              <div aria-hidden="true" className="mt-1 h-2 bg-muted"><div className="h-full bg-gold-strong" style={{ width: `${item.value * 100}%` }} /></div>
              <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
