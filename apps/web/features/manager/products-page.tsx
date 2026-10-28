"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Download, Leaf, Package, RefreshCw, Star, Tags } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { ColorSelect } from "@/components/brand/color-select";
import { StatTile } from "@/components/brand/stat-tile";

import { DataTable, type DataColumn, type DataFilter } from "@/components/data/data-table";

import { ApiError } from "@/lib/api/client";
import { changeProductStatus, loadManagerProducts, previewProducts, productsCsv, productStatusLabels, type ManagerProduct } from "./products-service";
import styles from "./products.module.css";

const statusColors = { Active: "bg-status-sage-bg text-status-sage-fg", Upcoming: "bg-status-lotus-bg text-status-lotus-fg", Inactive: "bg-status-gray-bg text-status-gray-fg" };
const categoryColors = ["bg-[#eaf1e4] text-[#61774d]", "bg-[#e8eef5] text-[#627e98]", "bg-[#f8ebdf] text-[#a17d51]", "bg-[#f4e8ee] text-[#a16c83]", "bg-[#eee9f6] text-[#85739d]"];
const categoryColor = (id: number) => categoryColors[(id - 1) % categoryColors.length];

function Preferences({ values }: { values: string[] }) {
  return values.length ? <div className={styles.tags}>{values.map(value => <span key={value}>{value}</span>)}</div> : <span className={styles.untagged}>Chưa gắn sở thích</span>;
}

function ProductStatusDropdown({ item, preview, onSaved }: { item: ManagerProduct; preview: boolean; onSaved: (id: number, status: ManagerProduct["status"]) => void }) {
  const [draft, setDraft] = useState<ManagerProduct["status"] | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function save(status: ManagerProduct["status"]) {
    if (preview || busy.current || status === item.status) return;
    busy.current = true; setDraft(status); setError("");
    try {
      await changeProductStatus(item.id, status, AbortSignal.timeout(12000));
      onSaved(item.id, status);
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 501 ? "Chưa thể lưu: API chưa khả dụng." : "Chưa thể lưu. Vui lòng chọn lại để thử lại.");
    } finally { busy.current = false; setDraft(null); }
  }
  return <div className="min-w-[130px] max-w-[190px]">
    <ColorSelect badge label={`Trạng thái ${item.name}`} busy={draft !== null} title={preview ? "Dữ liệu mẫu không thay đổi sản phẩm thật" : "Chọn để lưu trạng thái"} value={draft ?? item.status} disabled={draft !== null || preview} onValueChange={value => void save(value as ManagerProduct["status"])} options={(["Active", "Upcoming", "Inactive"] as const).map(value => ({ value, label: productStatusLabels[value], colorClass: statusColors[value] }))} />
    {draft !== null && <p role="status" className="mt-1 text-xs text-muted-foreground">Đang lưu…</p>}
    {error && <p role="alert" className="mt-2 text-xs leading-5 text-red-800">{error}</p>}
  </div>;
}
const columns: DataColumn<ManagerProduct>[] = [
  { id: "name", header: "Sản phẩm", value: item => `${item.name} ${item.sku}`, sortable: true, cell: item => <div className={styles.product}><span className={styles.productIcon} aria-hidden="true"><Package size={22} strokeWidth={1.25} /></span><div><p>{item.name}</p><small>{item.sku || `SP-${item.id}`}</small></div></div> },
  { id: "category", header: "Danh mục", value: item => item.categoryName, sortable: true, cell: item => <span className={styles.category}>{item.categoryName}</span> },
  { id: "status", header: "Trạng thái", value: item => productStatusLabels[item.status] },
  { id: "preferences", header: "Sở thích phù hợp", value: item => item.preferences.join(" "), cell: item => <Preferences values={item.preferences} /> },
  { id: "rating", header: "Đánh giá", value: item => item.averageRating, sortable: true, searchable: false, cell: item => item.averageRating === null ? <span className={styles.muted}>—</span> : <span className={styles.rating}><Star size={13} fill="currentColor" />{item.averageRating.toFixed(1)}</span> },
  { id: "feedback", header: "Phản hồi", value: item => item.feedbackCount, sortable: true, searchable: false },
];

export function ManagerProductsPage() {
  const [products, setProducts] = useState<ManagerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [exportMessage, setExportMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    loadManagerProducts(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
      .then(data => { if (!controller.signal.aborted) setProducts(data); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof ApiError && reason.status === 501 ? "Danh sách sản phẩm hiện chưa khả dụng. Vui lòng quay lại sau." : "Chưa thể tải sản phẩm. Vui lòng thử lại."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt, preview]);
  const data = preview ? previewProducts : products;
  const ready = preview || !loading && !error;
  const tableColumns: DataColumn<ManagerProduct>[] = columns.map(column => column.id !== "status" ? column : { ...column, cell: item => <ProductStatusDropdown item={item} preview={preview} onSaved={(id, status) => {
    setProducts(current => current.map(product => product.id === id ? { ...product, status } : product));
    setStatusMessage(`Đã đổi trạng thái ${item.name} thành ${status} · ${productStatusLabels[status]}.`);
  }} /> });
  const categories = [...new Map(data.map(item => [item.categoryId, item.categoryName])).entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  const filters: DataFilter<ManagerProduct>[] = [
    { id: "category", label: "Danh mục", colored: true, options: categories.map(([id, name]) => ({ value: String(id), label: name, colorClass: categoryColor(id) })), matches: (item, value) => String(item.categoryId) === value },
    { id: "status", label: "Trạng thái", colored: true, options: Object.entries(productStatusLabels).map(([value, label]) => ({ value, label, colorClass: statusColors[value as ManagerProduct["status"]] })), matches: (item, value) => item.status === value },
    { id: "tags", label: "Sở thích", colored: true, options: [{ value: "missing", label: "Chưa gắn sở thích", colorClass: "bg-[#f8eddb] text-[#a08048]" }, { value: "tagged", label: "Đã gắn sở thích", colorClass: "bg-[#eaf1e4] text-[#61774d]" }], matches: (item, value) => value === "missing" ? !item.preferences.length : !!item.preferences.length },
  ];
  function retry() { setLoading(true); setError(""); setExportMessage(""); setAttempt(value => value + 1); }
  function exportAll() {
    try {
      const url = URL.createObjectURL(new Blob([productsCsv(data)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = preview ? "cocoon-san-pham-MAU.csv" : "cocoon-danh-sach-san-pham.csv";
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportMessage(`Đã xuất toàn bộ ${data.length} sản phẩm${preview ? " mẫu" : ""}.`);
    } catch { setExportMessage("Chưa thể xuất tệp. Vui lòng thử lại."); }
  }
  return <div className={styles.page}>
    <PageHeader eyebrow="Sản phẩm / Danh mục" title="Quản lý danh mục sản phẩm" description="Theo dõi sản phẩm, sở thích phù hợp và những chia sẻ từ khách hàng." actions={<button type="button" className={styles.export} disabled={!ready || !data.length} onClick={exportAll}><Download size={16} />Xuất toàn bộ CSV</button>} />
    {exportMessage && <p role="status" className={styles.exportMessage}>{exportMessage}</p>}
    {statusMessage && <p role="status" className={styles.exportMessage}>{statusMessage}</p>}
    <div className={styles.stats}><StatTile label="Tổng sản phẩm" value={ready ? data.length : "—"} /><StatTile label="Đang bán" value={ready ? data.filter(item => item.status === "Active").length : "—"} /><StatTile label="Chưa gắn sở thích" value={ready ? data.filter(item => !item.preferences.length).length : "—"} /></div>
    <section className={styles.note}><span className={styles.noteIcon}><Leaf size={27} strokeWidth={1.25} /></span><div><h2>Từ nguyên liệu Việt, đến những trải nghiệm riêng</h2><p>Phân loại sản phẩm theo sở thích để mỗi gợi ý trở nên gần gũi và phù hợp hơn.</p></div><Tags className={styles.noteDecoration} size={35} strokeWidth={1} aria-hidden="true" /></section>
    {preview && <div className={styles.preview} role="status"><p><strong>Giao diện mẫu</strong> · Số liệu minh họa, không phải danh mục thực tế.</p><button type="button" onClick={() => { retry(); setPreview(false); }}>Thoát xem mẫu</button></div>}
    <section className={styles.tablePanel}>
      <div className={styles.tableHeading}><div><h2>Danh sách sản phẩm</h2><p>Tìm theo tên hoặc SKU, lọc theo danh mục và trạng thái.</p></div><button type="button" className={styles.refresh} disabled={loading && !preview} onClick={() => { retry(); setPreview(false); }} aria-label="Làm mới sản phẩm"><RefreshCw size={16} /></button></div>
      <DataTable data={ready ? data : []} columns={tableColumns} getRowId={item => item.id} caption="Danh sách sản phẩm" paramPrefix="products." filters={filters} loading={!preview && loading} error={preview ? null : error} onRetry={retry} emptyTitle="Không tìm thấy sản phẩm" emptyDescription="Thử đổi từ khóa hoặc đặt lại bộ lọc để xem các sản phẩm khác." />
      {!preview && error && <button type="button" className={styles.previewButton} onClick={() => { setExportMessage(""); setPreview(true); }}>Xem giao diện mẫu <ArrowUpRight size={16} /></button>}
    </section>
    <p className={styles.footer}><Leaf size={14} />Cocoon · Chăm chút từng sản phẩm, lắng nghe từng trải nghiệm.</p>
  </div>;
}
