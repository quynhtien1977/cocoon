"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Check, CircleCheck, ImagePlus, Info, Leaf, MessageSquare, Package, Plus, Save, Star, Tags, X } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { PageHeader } from "@/components/brand/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useReviewPhotos as useProductPhotos } from "../customer/review-photos";
import { ProductPhoto } from "./product-photo";
import { ProductStatusDropdown } from "./product-status";
import { loadManagerProduct, loadPreferenceCatalog, loadProductFeedback, loadProductInsights, saveProductPreferences, type ManagerProductDetail, type ProductFeedbackItem, type ProductInsights, type ProductPreference } from "./product-detail-service";

const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
const ratingFmt = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 });
const ratio = (part: number, total: number) => (total ? part / total : 0);
const panelClass = "min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6";
const tabTrigger = "min-h-12 flex-none rounded-none px-4 font-label text-sm uppercase tracking-wider";
const selectClass = "min-h-12 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";

function Panel({ title, description, icon, children }: { title: string; description?: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className={panelClass}>
      <header className="mb-5 flex items-start gap-3 border-b border-border pb-4">
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-gold-strong">{icon}</span>
        <div className="min-w-0">
          <h2 className="font-heading text-xl text-foreground">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function PreferenceEditor({ product, preview, onSaved }: { product: ManagerProductDetail; preview: boolean; onSaved: (ids: number[], names: string[]) => void }) {
  const [options, setOptions] = useState<ProductPreference[]>([]);
  const [selected, setSelected] = useState(product.preferenceIds ?? []);
  const [addition, setAddition] = useState("");
  const [loading, setLoading] = useState(!preview);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    loadPreferenceCatalog(AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]))
      .then((data) => { if (!controller.signal.aborted) setOptions(data); })
      .catch(() => { if (!controller.signal.aborted) setLoadError("Chưa tải được danh mục nhu cầu. Kiểm tra kết nối rồi thử lại."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [preview, attempt]);

  const editable = !preview && product.preferenceIds !== null && !loading && !loadError;
  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...(product.preferenceIds ?? [])].sort());
  const name = (id: number) => options.find((option) => option.id === id)?.name ?? product.preferences[product.preferenceIds?.indexOf(id) ?? -1] ?? `Nhu cầu #${id}`;

  async function save() {
    if (!editable || pending || !dirty || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setSuccess(false);
    try {
      await saveProductPreferences(product.id, selected, AbortSignal.timeout(12000));
      onSaved(selected, selected.map(name));
      setSuccess(true);
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.status === 501
          ? "API chưa hỗ trợ lưu nhu cầu sản phẩm. Các lựa chọn của bạn vẫn được giữ để thử lại."
          : "Chưa thể lưu nhu cầu. Vui lòng thử lại."
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <Panel icon={<Tags className="size-5" />} title="Nhu cầu phù hợp" description="Giúp mỗi sản phẩm tìm đến đúng nhu cầu của khách hàng.">
      <div className="mb-4 flex flex-wrap gap-2">
        {editable
          ? selected.map((id) => (
            <span key={id} className="inline-flex items-center gap-1.5 rounded-sm bg-status-beige-bg py-1 pl-2.5 pr-1 font-label text-xs text-status-beige-fg">
              {name(id)}
              <button
                disabled={pending}
                type="button"
                aria-label={`Bỏ nhu cầu ${name(id)}`}
                onClick={() => { setSelected((current) => current.filter((value) => value !== id)); setSuccess(false); }}
                className="grid size-6 place-items-center rounded-sm hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          ))
          : product.preferences.map((label) => (
            <span key={label} className="rounded-sm bg-status-beige-bg px-2.5 py-1 font-label text-xs text-status-beige-fg">{label}</span>
          ))}
        {!product.preferences.length && !selected.length && (
          <p className="text-sm text-muted-foreground">Chưa gắn nhu cầu cho sản phẩm.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="add-product-preference">Thêm nhu cầu</label>
        <select
          id="add-product-preference"
          value={addition}
          disabled={!editable || pending}
          onChange={(event) => setAddition(event.target.value)}
          className={selectClass}
        >
          <option value="">Chọn nhu cầu có sẵn</option>
          {options
            .filter((option) => !selected.includes(option.id))
            .map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
        </select>
        <Button
          type="button"
          variant="outline"
          className="h-12 px-4"
          disabled={!editable || pending || !addition}
          onClick={() => { setSelected((current) => [...current, Number(addition)]); setAddition(""); setSuccess(false); }}
        >
          <Plus aria-hidden="true" />
          Thêm
        </Button>
        <Button type="button" className="h-12 px-5" disabled={!editable || pending || !dirty} onClick={() => void save()}>
          <Save aria-hidden="true" />
          {pending ? "Đang lưu…" : "Lưu nhu cầu"}
        </Button>
      </div>

      {loading && <p role="status" className="mt-3 text-xs text-muted-foreground">Đang tải danh mục nhu cầu…</p>}
      {loadError && (
        <p role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-destructive">
          {loadError}
          <Button type="button" variant="outline" size="sm" onClick={() => { setLoading(true); setLoadError(""); setAttempt((value) => value + 1); }}>
            Thử lại
          </Button>
        </p>
      )}
      {!preview && product.preferenceIds === null && (
        <p className="mt-3 text-xs text-muted-foreground">Chưa có mã nhu cầu trong dữ liệu sản phẩm để chỉnh sửa.</p>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {success && (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-md border border-border bg-status-sage-bg p-3 text-sm text-status-sage-fg">
          <Check className="size-4 shrink-0" aria-hidden="true" />
          Đã lưu nhu cầu sản phẩm.
        </p>
      )}
    </Panel>
  );
}

function PhotoEditor({ product }: { product: ManagerProductDetail }) {
  const state = useProductPhotos();
  const fileInput = useRef<HTMLInputElement>(null);
  const existing = [...new Set([product.imageUrl, ...product.variants.map((variant) => variant.imageUrl)].filter((url): url is string => !!url))];

  return (
    <Panel icon={<ImagePlus className="size-5" />} title="Hình ảnh sản phẩm" description="Ảnh rõ nét, nền sáng giúp khách hàng dễ nhận diện sản phẩm.">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
        {existing.map((src, index) => (
          <figure key={src} className="min-w-0 max-w-44">
            <ProductPhoto src={src} name={`${product.name} — ảnh ${index + 1}`} className="aspect-square w-full" />
            <figcaption className="mt-2 truncate text-center text-xs text-muted-foreground">
              {index === 0 ? "Ảnh đại diện" : `Ảnh sản phẩm ${index + 1}`}
            </figcaption>
          </figure>
        ))}
        {state.photos.map((photo) => (
          <figure key={photo.url} className="min-w-0 max-w-44">
            <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
              <Image src={photo.url} alt={`Ảnh mới: ${photo.file.name}`} fill unoptimized className="object-contain" />
              <button
                type="button"
                aria-label={`Bỏ ảnh ${photo.file.name}`}
                onClick={() => state.remove(photo.url)}
                className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <figcaption title={photo.file.name} className="mt-2 truncate text-center text-xs text-muted-foreground">
              {photo.file.name}
              <small className="block text-gold-strong">Chưa lưu</small>
            </figcaption>
          </figure>
        ))}
        <button
          type="button"
          className="flex aspect-square max-w-44 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/40 p-3 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={state.loading || state.photos.length >= 5}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus className="size-6 text-gold-strong" strokeWidth={1.5} aria-hidden="true" />
          <span>{state.loading ? "Đang đọc ảnh…" : "Thêm hình ảnh"}</span>
        </button>
      </div>
      <input
        ref={fileInput}
        aria-label="Chọn hình ảnh sản phẩm"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={state.loading || state.photos.length >= 5}
        onChange={(event) => { void state.add(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; }}
      />
      <p className="mt-4 text-xs text-muted-foreground">JPG, PNG, WebP · Tối đa 5 ảnh mới, mỗi ảnh không quá 5 MB.</p>
      <p className="mt-3 flex items-start gap-2 rounded-md border border-border bg-status-turmeric-bg/60 p-3 text-xs leading-relaxed text-status-turmeric-fg">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>Hiện chỉ hỗ trợ chọn và xem trước ảnh. Ảnh mới chưa được lưu lên hệ thống và sẽ mất khi rời trang.</span>
      </p>
      {state.error && <p role="alert" className="mt-3 text-sm text-destructive">{state.error}</p>}
    </Panel>
  );
}

function Insights({ id, preview }: { id: number; preview: boolean }) {
  const [data, setData] = useState<ProductInsights | null>(null);
  const [feedbacks, setFeedbacks] = useState<ProductFeedbackItem[]>([]);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]);
    Promise.all([
      loadProductInsights(id, signal),
      loadProductFeedback(id, signal).catch(() => [] as ProductFeedbackItem[]),
    ])
      .then(([insights, items]) => {
        if (!controller.signal.aborted) {
          setData(insights);
          setFeedbacks(items);
        }
      })
      .catch(() => { if (!controller.signal.aborted) setError("Chưa tải được phân tích phản hồi. Kiểm tra kết nối rồi thử lại."); });
    return () => controller.abort();
  }, [id, preview, attempt]);

  if (preview) {
    return (
      <section className={panelClass}>
        <p className="text-sm text-muted-foreground">Chế độ mẫu chưa có dữ liệu phân tích phản hồi.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section role="alert" className={cn(panelClass, "flex flex-wrap items-center gap-3 text-sm text-destructive")}>
        <span>{error}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>
          Thử lại
        </Button>
      </section>
    );
  }

  if (!data) {
    return (
      <div role="status" className="grid gap-6 lg:grid-cols-2">
        <span className="sr-only">Đang tải phản hồi</span>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const countOf = (star: number) => data.ratingDistribution.find((row) => row.rating === star)?.count ?? 0;
  const highCount = countOf(5) + countOf(4);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <article className={panelClass}>
        <header className="mb-4">
          <p className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <span className="font-label text-xs uppercase tracking-wider text-gold-strong">Đánh giá 1–5 sao</span>
            <span className="text-sm text-muted-foreground tabular-nums">{data.totalFeedback} đánh giá</span>
          </p>
          <h3 className="mt-2 font-heading text-lg">Mức độ hài lòng với sản phẩm</h3>
        </header>
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-md bg-muted p-4">
          <span className="font-heading text-4xl lining-nums tabular-nums">
            {data.averageRating === null ? "—" : ratingFmt.format(data.averageRating)}
            <span className="text-base text-muted-foreground">/5</span>
          </span>
          <span className="text-sm text-muted-foreground">
            {percent.format(ratio(highCount, data.totalFeedback))} khách chấm 4–5 sao
          </span>
        </div>
        <ul className="space-y-2">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = countOf(star);
            return (
              <li key={star} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                <span className="flex items-center gap-1 font-semibold">
                  {star}
                  <Star className="size-3.5 fill-gold text-gold" aria-label="sao" />
                </span>
                <span aria-hidden="true" className="block h-3 w-full bg-muted">
                  <span className="block h-full bg-gold" style={{ width: `${ratio(count, data.totalFeedback) * 100}%` }} />
                </span>
                <meter className="sr-only" min={0} max={Math.max(1, data.totalFeedback)} value={count} aria-label={`${star} sao: ${count} phản hồi`} />
                <span className="text-right tabular-nums">
                  {count} lượt ({percent.format(ratio(count, data.totalFeedback))})
                </span>
              </li>
            );
          })}
        </ul>
      </article>

      <article className={panelClass}>
        <header className="mb-4">
          <p className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <span className="font-label text-xs uppercase tracking-wider text-gold-strong">Phản hồi khách hàng</span>
            <span className="text-sm text-muted-foreground tabular-nums">{feedbacks.length} phản hồi</span>
          </p>
          <h3 className="mt-2 font-heading text-lg">Chia sẻ từ khách hàng về sản phẩm</h3>
        </header>
        {feedbacks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có phản hồi nào cho sản phẩm này.</p>
        ) : (
          <ul
            tabIndex={0}
            aria-label={`${feedbacks.length} phản hồi`}
            className="max-h-80 space-y-3 overflow-y-auto pr-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {feedbacks.map((item) => (
              <li key={item.id} className="rounded-md border-l-2 border-gold bg-muted p-3">
                <p className="text-sm italic">“{item.content}”</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-label text-xs uppercase tracking-wider text-muted-foreground">{item.customerName}</p>
                  <Link href={`/manager/feedback/${item.id}`} className="text-xs text-gold-strong hover:underline">
                    Xem phản hồi & trả lời →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}

export function ManagerProductDetailPage({ id, preview = false }: { id: string; preview?: boolean }) {
  const [product, setProduct] = useState<ManagerProductDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    loadManagerProduct(id, preview, AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]))
      .then((data) => { if (!controller.signal.aborted) setProduct(data); })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof ApiError && reason.status === 501
              ? "Chi tiết sản phẩm hiện chưa khả dụng."
              : "Chưa tải được sản phẩm. Kiểm tra kết nối rồi thử lại."
          );
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, preview, attempt]);

  return (
    <>
      <Link href="/manager/products" className="mb-3 inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Danh mục sản phẩm
      </Link>

      <PageHeader
        eyebrow={product ? product.sku || `SP-${product.id}` : "HỒ SƠ SẢN PHẨM"}
        title={product?.name ?? "Chi tiết sản phẩm"}
        description="Chăm chút từng thông tin, kết nối đúng nhu cầu khách hàng."
        actions={
          product ? (
            <ProductStatusDropdown
              item={product}
              preview={preview}
              onSaved={(_, status) => {
                setProduct((current) => current && { ...current, status });
                setMessage("Đã cập nhật trạng thái sản phẩm.");
              }}
            />
          ) : undefined
        }
      />

      {preview && (
        <p role="status" className="mb-6 rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Giao diện mẫu</strong> · Nội dung, giá và số liệu minh họa; ảnh tham khảo từ Cocoon.
        </p>
      )}

      <div aria-live="polite">
        {message && (
          <p role="status" className="mb-6 flex items-center gap-2 rounded-md border border-border bg-status-sage-bg p-3 text-sm text-status-sage-fg">
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            {message}
          </p>
        )}
      </div>

      {loading ? (
        <div role="status" className="space-y-4">
          <span className="sr-only">Đang tải thông tin sản phẩm</span>
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <div role="alert">
          <EmptyState
            title="Chưa tải được sản phẩm"
            description={error}
            action={
              <Button type="button" className="h-12 px-4" onClick={() => { setLoading(true); setError(""); setAttempt((value) => value + 1); }}>
                Thử lại
              </Button>
            }
          />
        </div>
      ) : (
        product && (
          <div className="space-y-6">
            <section className={cn(panelClass, "grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]")}>
              <ProductPhoto src={product.imageUrl ?? null} name={product.name} className="h-60 w-full" />
              <div className="flex flex-col justify-center gap-3 min-w-0">
                <span className="w-fit rounded-sm bg-status-beige-bg px-2.5 py-0.5 font-label text-xs uppercase tracking-wider text-status-beige-fg">
                  {product.categoryName}
                </span>
                <h2 className="font-heading text-2xl text-foreground">{product.name}</h2>
                <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground break-words">
                  {product.description || "Chưa có mô tả sản phẩm."}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground tabular-nums">
                  <span className="font-mono">{product.sku || `SP-${product.id}`}</span>
                  <span>{product.variants.length} biến thể</span>
                  {product.averageRating !== null && (
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      <Star className="size-3.5 fill-gold text-gold" aria-hidden="true" />
                      {ratingFmt.format(product.averageRating)}/5
                    </span>
                  )}
                </div>
              </div>
            </section>

            <Tabs defaultValue="info" className="gap-6">
              <TabsList variant="line" className="w-full flex-wrap justify-start overflow-visible border-b border-border p-0 group-data-horizontal/tabs:h-auto">
                <TabsTrigger value="info" className={tabTrigger}>
                  <Leaf className="size-4" aria-hidden="true" />
                  Thông tin sản phẩm
                </TabsTrigger>
                <TabsTrigger value="feedback" className={tabTrigger}>
                  <MessageSquare className="size-4" aria-hidden="true" />
                  Phản hồi & đánh giá
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-6">
                <PreferenceEditor
                  product={product}
                  preview={preview}
                  onSaved={(preferenceIds, preferences) =>
                    setProduct((current) => current && { ...current, preferenceIds, preferences })
                  }
                />
                <PhotoEditor product={product} />
                <Panel title="Biến thể & giá bán" description="Quy cách và thông tin niêm yết của từng sản phẩm." icon={<Package className="size-5" />}>
                  {product.variants.length ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableCaption className="sr-only">Các biến thể sản phẩm</TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Quy cách</TableHead>
                            <TableHead>Mã SKU</TableHead>
                            <TableHead className="text-right">Giá niêm yết</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {product.variants.map((variant) => (
                            <TableRow key={variant.id}>
                              <TableCell>
                                <div className="flex min-w-44 items-center gap-3">
                                  <ProductPhoto src={variant.imageUrl} name={variant.name} className="size-12 shrink-0" />
                                  <span className="font-semibold text-foreground">{variant.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{variant.sku || "—"}</TableCell>
                              <TableCell className="text-right font-semibold tabular-nums">{money(variant.price)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Chưa có dữ liệu biến thể.</p>
                  )}
                </Panel>
                <Panel title="Câu chuyện & thành phần" icon={<Leaf className="size-5" />} description="Những điều làm nên bản sắc của sản phẩm.">
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      { title: "Thành phần", value: product.ingredients },
                      { title: "Công dụng", value: product.benefits },
                      { title: "Hướng dẫn sử dụng", value: product.usage },
                    ].map((section) => (
                      <section key={section.title} className="rounded-md border border-border bg-muted/40 p-4">
                        <h3 className="font-heading text-lg text-foreground">{section.title}</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground break-words">
                          {section.value || "Chưa có thông tin."}
                        </p>
                      </section>
                    ))}
                  </div>
                </Panel>
              </TabsContent>

              <TabsContent value="feedback">
                <Insights id={product.id} preview={preview} />
              </TabsContent>
            </Tabs>
          </div>
        )
      )}

      {error && !preview && (
        <div className="mt-4">
          <Link href="/manager/products" className={cn(buttonVariants({ variant: "outline" }), "h-12 px-4")}>
            Quay lại danh mục
          </Link>
        </div>
      )}
    </>
  );
}
