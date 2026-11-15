"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CircleCheck, Download, Leaf, Package, RefreshCw, ShoppingBag, Star, Tags } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { StatTile } from "@/components/brand/stat-tile";
import { DataTable, type DataColumn, type DataFilter } from "@/components/data/data-table";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { ProductPhoto } from "./product-photo";
import { resolveProductImage } from "./product-media";
import { ProductStatusDropdown, statusColors } from "./product-status";
import { loadManagerProducts, previewProducts, productsCsv, productStatusLabels, type ManagerProduct } from "./products-service";

const categoryColors = ["bg-[#eaf1e4] text-[#61774d]", "bg-[#e8eef5] text-[#627e98]", "bg-[#f8ebdf] text-[#a17d51]", "bg-[#f4e8ee] text-[#a16c83]", "bg-[#eee9f6] text-[#85739d]"];
const categoryColor = (id: number) => categoryColors[(id - 1) % categoryColors.length];
const rating = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Same chip as customer preferences (M2/M4). */
const chip = "rounded-sm bg-status-beige-bg px-2 py-0.5 font-label text-xs text-status-beige-fg";

function Preferences({ values }: { values: string[] }) {
  return values.length
    ? <span className="flex min-w-32 max-w-56 flex-wrap gap-1">{values.map(value => <span key={value} className={chip}>{value}</span>)}</span>
    : <span className="inline-block rounded-sm border border-dashed border-border px-2 py-0.5 font-label text-xs whitespace-nowrap text-muted-foreground">Chưa gắn nhu cầu</span>;
}

const columns: DataColumn<ManagerProduct>[] = [
  { id: "name", header: "Sản phẩm", value: item => `${item.name} ${item.sku}`, sortable: true },
  { id: "category", header: "Danh mục", value: item => item.categoryName, sortable: true, cell: item => <span className="block min-w-24 max-w-36 text-sm">{item.categoryName}</span> },
  { id: "status", header: "Trạng thái", value: item => productStatusLabels[item.status] },
  { id: "preferences", header: "Nhu cầu phù hợp", value: item => item.preferences.join(" "), cell: item => <Preferences values={item.preferences} /> },
  { id: "rating", header: "Đánh giá", value: item => item.averageRating, sortable: true, searchable: false, cell: item => item.averageRating === null ? <span className="text-muted-foreground">—</span> : <span className="inline-flex items-center gap-1 font-semibold tabular-nums whitespace-nowrap text-gold-strong"><Star className="size-3.5" fill="currentColor" aria-hidden="true" />{rating.format(item.averageRating)}</span> },
  { id: "feedback", header: "Phản hồi", value: item => item.feedbackCount, sortable: true, searchable: false, cell: item => <span className="tabular-nums">{item.feedbackCount ?? "—"}</span> },
];

export function ManagerProductsPage() {
  const [products, setProducts] = useState<ManagerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    loadManagerProducts(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
      .then(data => { if (!controller.signal.aborted) setProducts(data); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof ApiError && reason.status === 501 ? "Danh sách sản phẩm hiện chưa khả dụng. Vui lòng quay lại sau." : "Chưa tải được sản phẩm. Kiểm tra kết nối rồi thử lại."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt, preview]);

  const data = preview ? previewProducts : products;
  const ready = preview || !loading && !error;
  const tableColumns: DataColumn<ManagerProduct>[] = columns.map(column => column.id === "name" ? {
    ...column,
    cell: item => (
      <Link href={`/manager/products/${item.id}${preview ? "?preview=1" : ""}`} aria-label={`Chi tiết ${item.name}`}
        className="group flex min-w-52 max-w-72 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring">
        <ProductPhoto src={resolveProductImage(item.name, item.imageUrl)} name={item.name} className="h-16 w-14 rounded-md" />
        <span className="min-w-0">
          <span className="block font-semibold group-hover:underline">{item.name}</span>
          <span className="block font-mono text-xs text-muted-foreground">{item.sku || `SP-${item.id}`}</span>
        </span>
      </Link>
    ),
  } : column.id !== "status" ? column : {
    ...column,
    cell: item => <ProductStatusDropdown item={item} preview={preview} onSaved={(id, status) => {
      setProducts(current => current.map(product => product.id === id ? { ...product, status } : product));
      setNotice(`Đã đổi trạng thái ${item.name} thành ${productStatusLabels[status]}.`);
    }} />,
  });
  const categories = [...new Map(data.map(item => [item.categoryId, item.categoryName])).entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  const filters: DataFilter<ManagerProduct>[] = [
    { id: "category", label: "Danh mục", colored: true, options: categories.map(([id, name]) => ({ value: String(id), label: name, colorClass: categoryColor(id) })), matches: (item, value) => String(item.categoryId) === value },
    { id: "status", label: "Trạng thái", colored: true, options: Object.entries(productStatusLabels).map(([value, label]) => ({ value, label, colorClass: statusColors[value as ManagerProduct["status"]] })), matches: (item, value) => item.status === value },
    { id: "tags", label: "Nhu cầu", colored: true, options: [{ value: "missing", label: "Chưa gắn nhu cầu", colorClass: "bg-status-beige-bg text-status-beige-fg" }, { value: "tagged", label: "Đã gắn nhu cầu", colorClass: "bg-status-sage-bg text-status-sage-fg" }], matches: (item, value) => value === "missing" ? !item.preferences.length : !!item.preferences.length },
  ];

  const active = data.filter(item => item.status === "Active").length;
  const untagged = data.filter(item => !item.preferences.length).length;
  const rated = data.filter(item => item.averageRating !== null);
  const avgRating = rated.length ? rated.reduce((sum, item) => sum + item.averageRating!, 0) / rated.length : null;
  const total = Math.max(data.length, 1);

  function retry() { setLoading(true); setError(""); setNotice(""); setAttempt(value => value + 1); }
  function exportAll() {
    try {
      const url = URL.createObjectURL(new Blob([productsCsv(data)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = preview ? "cocoon-san-pham-MAU.csv" : "cocoon-danh-sach-san-pham.csv";
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`Đã xuất toàn bộ ${data.length} sản phẩm${preview ? " mẫu" : ""}.`);
    } catch { setNotice("Chưa thể xuất tệp. Vui lòng thử lại."); }
  }

  return (
    <>
      <PageHeader title="Danh mục sản phẩm" description="Theo dõi sản phẩm, nhu cầu phù hợp và những chia sẻ từ khách hàng." actions={<>
        <Button type="button" variant="outline" size="icon" className="size-12" disabled={loading && !preview} onClick={() => { retry(); setPreview(false); }} aria-label="Làm mới sản phẩm"><RefreshCw aria-hidden="true" /></Button>
        <Button type="button" variant="outline" className="h-12 px-4" disabled={!ready || !data.length} onClick={exportAll}><Download aria-hidden="true" />Xuất file CSV</Button>
      </>} />
      <div aria-live="polite">{notice && <p role="status" className="mb-6 flex items-center gap-2 rounded-md border border-border bg-status-sage-bg p-3 text-sm text-status-sage-fg"><CircleCheck className="size-4 shrink-0" aria-hidden="true" />{notice}</p>}</div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Tổng sản phẩm" value={ready ? data.length : "—"} icon={<Package />} hint={ready ? `${categories.length} danh mục` : undefined} />
        <StatTile label="Đang bán" value={ready ? active : "—"} unit={ready ? `/${data.length}` : undefined} icon={<ShoppingBag />} progress={ready ? active / total : undefined} hint={ready ? `${data.length - active} sản phẩm sắp bán hoặc ngừng bán` : undefined} />
        <StatTile label="Chưa gắn nhu cầu" value={ready ? untagged : "—"} icon={<Tags />} hint="Cần gắn để gợi ý đúng khách" />
        <StatTile label="Đánh giá trung bình" value={ready && avgRating !== null ? rating.format(avgRating) : "—"} unit={ready && avgRating !== null ? "/5" : undefined} icon={<Star />} progress={ready && avgRating !== null ? avgRating / 5 : undefined} hint={ready ? `${rated.length} sản phẩm có đánh giá` : undefined} />
      </div>

      {preview && (
        <div role="status" className="mb-6 flex flex-col gap-2 rounded-md border border-dashed border-border bg-card p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p><strong className="text-foreground">Giao diện mẫu</strong> · Số liệu minh họa, không phải danh mục thực tế.</p>
          <Button type="button" variant="ghost" className="h-10 self-start px-3 underline underline-offset-4 sm:self-auto" onClick={() => { retry(); setPreview(false); }}>Thoát xem mẫu</Button>
        </div>
      )}

      <DataTable data={ready ? data : []} columns={tableColumns} getRowId={item => item.id} caption="Danh sách sản phẩm" paramPrefix="products." filters={filters} loading={!preview && loading} error={preview ? null : error} onRetry={retry}
        emptyTitle="Không tìm thấy sản phẩm" emptyDescription="Thử đổi từ khóa hoặc đặt lại bộ lọc để xem các sản phẩm khác." />
      {!preview && error && <Button type="button" variant="outline" className="mt-4 h-12 px-4" onClick={() => { setNotice(""); setPreview(true); }}>Xem giao diện mẫu <ArrowUpRight aria-hidden="true" /></Button>}

      <aside aria-labelledby="products-note-title" className="mt-8 flex gap-4 rounded-lg border border-border bg-card p-4 sm:p-6">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-gold-strong"><Leaf className="size-6" /></span>
        <div>
          <p className="font-label text-xs uppercase tracking-wider text-gold-strong">Gợi ý cá nhân hóa</p>
          <h2 id="products-note-title" className="mt-1 font-heading text-xl">Từ nguyên liệu Việt, đến những trải nghiệm riêng</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">Gắn nhu cầu cho từng sản phẩm để mỗi gợi ý đến đúng khách hàng hơn.</p>
        </div>
      </aside>
    </>
  );
}
