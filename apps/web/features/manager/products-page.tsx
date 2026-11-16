"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, CircleCheck, Download, Package, RefreshCw, Star, Tags } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { StatTile } from "@/components/brand/stat-tile";
import { DataTable, type DataColumn, type DataFilter } from "@/components/data/data-table";
import { updateTableParams } from "@/components/data/table-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { resolveProductImage } from "./product-media";
import { ProductPhoto } from "./product-photo";
import { ProductStatusDropdown } from "./product-status";
import { loadManagerProducts, previewProducts, productsCsv, productStatusLabels, type ManagerProduct } from "./products-service";

const PREFIX = "products.";
const statuses: ManagerProduct["status"][] = ["Active", "Upcoming", "Inactive"];
const ratingFmt = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 });

const chipClass = "rounded-sm bg-status-beige-bg px-2 py-0.5 font-label text-xs text-status-beige-fg";
const actionClass = "inline-flex min-h-12 items-center rounded-md border border-input px-3 font-label text-sm uppercase tracking-wider whitespace-nowrap hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

function Preferences({ values }: { values: string[] }) {
  return values.length ? (
    <span className="flex min-w-36 max-w-52 flex-wrap gap-1">
      {values.map((value) => (
        <span key={value} className={chipClass}>{value}</span>
      ))}
    </span>
  ) : (
    <span className="inline-block rounded-sm border border-dashed border-border px-2 py-0.5 text-xs whitespace-nowrap text-muted-foreground">
      Chưa gắn nhu cầu
    </span>
  );
}

function ProductLink({ item, preview }: { item: ManagerProduct; preview: boolean }) {
  const href = `/manager/products/${item.id}${preview ? "?preview=1" : ""}`;
  return (
    <Link
      href={href}
      aria-label={`Chi tiết ${item.name}`}
      className="flex min-w-52 max-w-72 items-center gap-3 rounded focus-visible:outline-2 focus-visible:outline-ring"
    >
      <ProductPhoto src={resolveProductImage(item.name, item.imageUrl)} name={item.name} className="size-14 shrink-0" />
      <span className="min-w-0">
        <span className="block font-semibold text-foreground hover:underline whitespace-normal">{item.name}</span>
        <span className="block font-mono text-xs text-muted-foreground">{item.sku || `SP-${item.id}`}</span>
      </span>
    </Link>
  );
}

/** Shortcut over the status filter: writes the same URL param as DataTable so both stay in sync. */
function ProductStatusTabs({ rows }: { rows: readonly ManagerProduct[] }) {
  const params = useSearchParams();
  const active = params.get(`${PREFIX}filter.status`) ?? "";
  const select = (status: string) => {
    const search = updateTableParams(window.location.search, PREFIX, { "filter.status": status, page: "1" });
    window.history.pushState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
  };
  const tabs = [
    { value: "", label: "Tất cả", count: rows.length },
    ...statuses.map((value) => ({
      value,
      label: productStatusLabels[value],
      count: rows.filter((row) => row.status === value).length,
    })),
  ];

  return (
    <nav aria-label="Lọc nhanh theo trạng thái sản phẩm" className="mb-4 flex overflow-x-auto border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          aria-pressed={active === tab.value}
          onClick={() => select(tab.value)}
          className={cn(
            "flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 font-label text-sm uppercase tracking-wider whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ring",
            active === tab.value
              ? "border-gold-strong font-bold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          <span className="rounded-sm bg-muted px-1.5 text-xs tabular-nums">{tab.count}</span>
        </button>
      ))}
    </nav>
  );
}

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
      .then((data) => { if (!controller.signal.aborted) setProducts(data); })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof ApiError && reason.status === 501
              ? "Danh sách sản phẩm hiện chưa khả dụng. Vui lòng quay lại sau."
              : "Chưa tải được sản phẩm. Kiểm tra kết nối rồi thử lại."
          );
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt, preview]);

  const data = preview ? previewProducts : products;
  const ready = preview || (!loading && !error);
  const activeCount = data.filter((item) => item.status === "Active").length;
  const upcomingCount = data.filter((item) => item.status === "Upcoming").length;
  const inactiveCount = data.filter((item) => item.status === "Inactive").length;
  const untaggedCount = data.filter((item) => !item.preferences.length).length;
  const rated = data.filter((item) => item.averageRating !== null);
  const avgRating = rated.length ? rated.reduce((sum, item) => sum + (item.averageRating ?? 0), 0) / rated.length : null;
  const knownFeedback = data.filter((item) => item.feedbackCount !== null);
  const totalFeedback = knownFeedback.length ? knownFeedback.reduce((sum, item) => sum + (item.feedbackCount ?? 0), 0) : null;
  const total = Math.max(data.length, 1);

  const columns: DataColumn<ManagerProduct>[] = [
    {
      id: "name",
      header: "Sản phẩm",
      value: (item) => `${item.name} ${item.sku}`,
      sortable: true,
      cell: (item) => <ProductLink item={item} preview={preview} />,
    },
    {
      id: "category",
      header: "Danh mục",
      value: (item) => item.categoryName,
      sortable: true,
      cell: (item) => <span className="text-muted-foreground whitespace-normal">{item.categoryName}</span>,
    },
    {
      id: "status",
      header: "Trạng thái",
      value: (item) => statuses.indexOf(item.status),
      sortable: true,
      searchable: false,
      cell: (item) => (
        <ProductStatusDropdown
          item={item}
          preview={preview}
          onSaved={(id, status) => {
            setProducts((current) => current.map((product) => (product.id === id ? { ...product, status } : product)));
            setNotice(`Đã đổi trạng thái ${item.name} thành ${productStatusLabels[status]}.`);
          }}
        />
      ),
    },
    {
      id: "preferences",
      header: "Nhu cầu phù hợp",
      value: (item) => item.preferences.join(" "),
      cell: (item) => <Preferences values={item.preferences} />,
    },
    {
      id: "rating",
      header: "Đánh giá",
      value: (item) => item.averageRating,
      sortable: true,
      searchable: false,
      cell: (item) =>
        item.averageRating === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="inline-flex items-center gap-1 font-semibold tabular-nums whitespace-nowrap">
            <Star className="size-4 fill-gold text-gold" aria-hidden="true" />
            {ratingFmt.format(item.averageRating)}/5
          </span>
        ),
    },
    {
      id: "feedback",
      header: "Phản hồi",
      value: (item) => item.feedbackCount,
      sortable: true,
      searchable: false,
      cell: (item) =>
        item.feedbackCount === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="tabular-nums">{item.feedbackCount}</span>
        ),
    },
    {
      id: "actions",
      header: "Thao tác",
      value: () => null,
      searchable: false,
      cell: (item) => (
        <Link href={`/manager/products/${item.id}${preview ? "?preview=1" : ""}`} aria-label={`Xem chi tiết ${item.name}`} className={actionClass}>
          Xem chi tiết
        </Link>
      ),
    },
  ];

  const categories = [...new Map(data.map((item) => [item.categoryId, item.categoryName])).entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  const filters: DataFilter<ManagerProduct>[] = [
    {
      id: "category",
      label: "Danh mục",
      options: categories.map(([id, name]) => ({ value: String(id), label: name })),
      matches: (item, value) => String(item.categoryId) === value,
    },
    {
      id: "status",
      label: "Trạng thái",
      options: statuses.map((value) => ({ value, label: productStatusLabels[value] })),
      matches: (item, value) => item.status === value,
    },
    {
      id: "tags",
      label: "Nhu cầu",
      options: [
        { value: "missing", label: "Chưa gắn nhu cầu" },
        { value: "tagged", label: "Đã gắn nhu cầu" },
      ],
      matches: (item, value) => (value === "missing" ? !item.preferences.length : !!item.preferences.length),
    },
  ];

  function retry() {
    setLoading(true);
    setError("");
    setNotice("");
    setAttempt((value) => value + 1);
  }

  function exportAll() {
    try {
      const url = URL.createObjectURL(new Blob([productsCsv(data)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = preview ? "cocoon-san-pham-MAU.csv" : "cocoon-danh-sach-san-pham.csv";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`Đã xuất toàn bộ ${data.length} sản phẩm${preview ? " mẫu" : ""}.`);
    } catch {
      setNotice("Chưa thể xuất tệp. Vui lòng thử lại.");
    }
  }

  return (
    <>
      <PageHeader
        title="Quản lý danh mục sản phẩm"
        description="Theo dõi sản phẩm, nhu cầu phù hợp, trạng thái kinh doanh và những chia sẻ từ khách hàng."
        actions={
          <>
            <Button type="button" variant="outline" className="h-12 px-4" disabled={loading && !preview} onClick={() => { retry(); setPreview(false); }}>
              <RefreshCw aria-hidden="true" />
              Làm mới
            </Button>
            <Button type="button" variant="outline" className="h-12 px-4" disabled={!ready || !data.length} onClick={exportAll}>
              <Download aria-hidden="true" />
              Xuất file CSV
            </Button>
          </>
        }
      />

      <div aria-live="polite">
        {notice && (
          <p role="status" className="mb-6 flex items-center gap-2 rounded-md border border-border bg-status-sage-bg p-3 text-sm text-status-sage-fg">
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        )}
      </div>

      {preview && (
        <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Giao diện mẫu</strong> · Số liệu minh họa, không phải danh mục thực tế.
          </p>
          <Button type="button" variant="outline" className="h-10 px-3" onClick={() => { retry(); setPreview(false); }}>
            Thoát xem mẫu
          </Button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          label="Tổng sản phẩm"
          value={ready ? data.length : "—"}
          icon={<Package />}
          hint={ready ? `${upcomingCount} sắp ra mắt · ${inactiveCount} ngừng bán` : undefined}
        />
        <StatTile
          label="Đang bán"
          value={ready ? activeCount : "—"}
          unit={ready ? `/${data.length}` : undefined}
          icon={<CircleCheck />}
          progress={ready && data.length ? activeCount / total : undefined}
          hint={ready && data.length ? `${percent.format(activeCount / total)} tổng danh mục` : undefined}
        />
        <StatTile
          label="Chưa gắn nhu cầu"
          value={ready ? untaggedCount : "—"}
          icon={<Tags />}
          hint={ready ? (untaggedCount > 0 ? "Cần gắn nhu cầu để gợi ý" : "Tất cả đã gắn nhu cầu") : undefined}
        />
        <StatTile
          label="Điểm trung bình"
          value={avgRating === null ? "—" : ratingFmt.format(avgRating)}
          unit={avgRating === null ? undefined : "/5"}
          icon={<Star />}
          progress={avgRating === null ? undefined : avgRating / 5}
          hint={ready ? (totalFeedback === null ? "Chưa có dữ liệu phản hồi" : `${totalFeedback} phản hồi đã ghi nhận`) : undefined}
        />
      </div>

      <Suspense fallback={null}>
        <ProductStatusTabs rows={ready ? data : []} />
      </Suspense>

      <DataTable
        data={ready ? data : []}
        columns={columns}
        getRowId={(item) => item.id}
        rowHref={(item) => `/manager/products/${item.id}${preview ? "?preview=1" : ""}`}
        caption="Danh sách sản phẩm"
        paramPrefix={PREFIX}
        filters={filters}
        loading={!preview && loading}
        error={preview ? null : error}
        onRetry={retry}
        cardsUntil="wide"
        renderCard={(item) => (
          <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <header className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ProductPhoto src={resolveProductImage(item.name, item.imageUrl)} name={item.name} className="size-14 shrink-0" />
                <div className="min-w-0">
                  <span className="block font-semibold text-foreground">{item.name}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{item.sku || `SP-${item.id}`} · {item.categoryName}</span>
                </div>
              </div>
              <ProductStatusDropdown
                item={item}
                preview={preview}
                onSaved={(id, status) => {
                  setProducts((current) => current.map((product) => (product.id === id ? { ...product, status } : product)));
                  setNotice(`Đã đổi trạng thái ${item.name} thành ${productStatusLabels[status]}.`);
                }}
              />
            </header>
            <Preferences values={item.preferences} />
            <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
              <span className="flex items-center gap-3 text-muted-foreground tabular-nums">
                <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                  <Star className="size-4 fill-gold text-gold" aria-hidden="true" />
                  {item.averageRating === null ? "—" : `${ratingFmt.format(item.averageRating)}/5`}
                </span>
                <span>{item.feedbackCount === null ? "—" : `${item.feedbackCount} phản hồi`}</span>
              </span>
              <Link href={`/manager/products/${item.id}${preview ? "?preview=1" : ""}`} aria-label={`Mở chi tiết ${item.name}`} className={actionClass}>
                Xem chi tiết
              </Link>
            </div>
          </article>
        )}
        emptyTitle="Không tìm thấy sản phẩm"
        emptyDescription="Thử đổi từ khóa hoặc đặt lại bộ lọc để xem các sản phẩm khác."
      />

      {!preview && error && (
        <div className="mt-4">
          <Button type="button" variant="outline" className="h-12 px-4" onClick={() => { setNotice(""); setPreview(true); }}>
            Xem giao diện mẫu
            <ArrowUpRight aria-hidden="true" />
          </Button>
        </div>
      )}
    </>
  );
}
