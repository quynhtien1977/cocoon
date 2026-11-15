"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CircleCheck, ImagePlus, Info, Layers, Leaf, MessageSquare, Package, Plus, Save, Star, Tags, Wallet, X } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { StatTile } from "@/components/brand/stat-tile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api/client";
import { useReviewPhotos as useProductPhotos } from "../customer/review-photos";
import { ProductPhoto } from "./product-photo";
import { ProductStatusDropdown } from "./product-status";
import { loadManagerProduct, loadPreferenceCatalog, loadProductInsights, saveProductPreferences, type ManagerProductDetail, type ProductInsights, type ProductPreference } from "./product-detail-service";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const rating = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
// Shared with the other manager screens (customer detail, dashboard).
const panel = "min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6";
const tabTrigger = "min-h-12 flex-none rounded-none px-3 font-label text-sm uppercase tracking-wider sm:px-4";
const chip = "inline-flex items-center gap-1 rounded-sm bg-status-beige-bg py-0.5 pr-1 pl-2 font-label text-sm text-status-beige-fg";
const subtle = "mt-3 text-sm text-muted-foreground";
const errorText = "mt-3 text-sm text-destructive";
const successText = "mt-3 flex items-center gap-2 text-sm text-status-sage-fg";

function Panel({ title, description, icon, children, className }: { title: string; description?: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`${panel} ${className ?? ""}`}>
      <header className="mb-4 flex items-start gap-3 border-b border-border pb-3">
        <span aria-hidden="true" className="mt-1 text-gold-strong [&_svg]:size-5">{icon}</span>
        <div className="min-w-0"><h2 className="font-heading text-xl">{title}</h2>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>
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
      .then(data => { if (!controller.signal.aborted) setOptions(data); })
      .catch(() => { if (!controller.signal.aborted) setLoadError("Chưa tải được danh mục nhu cầu. Kiểm tra kết nối rồi thử lại."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [preview, attempt]);
  const editable = !preview && product.preferenceIds !== null && !loading && !loadError;
  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...(product.preferenceIds ?? [])].sort());
  const name = (id: number) => options.find(option => option.id === id)?.name ?? product.preferences[product.preferenceIds?.indexOf(id) ?? -1] ?? `Nhu cầu #${id}`;
  async function save() {
    if (!editable || pending || !dirty || busy.current) return;
    busy.current = true; setPending(true); setError(""); setSuccess(false);
    try {
      await saveProductPreferences(product.id, selected, AbortSignal.timeout(12000));
      onSaved(selected, selected.map(name)); setSuccess(true);
    } catch (reason) { setError(reason instanceof ApiError && reason.status === 501 ? "API chưa hỗ trợ lưu nhu cầu sản phẩm. Các lựa chọn của bạn vẫn được giữ để thử lại." : "Chưa thể lưu nhu cầu. Vui lòng thử lại."); }
    finally { busy.current = false; setPending(false); }
  }
  return (
    <Panel icon={<Tags />} title="Nhu cầu phù hợp" description="Giúp mỗi sản phẩm tìm đến đúng nhu cầu của khách hàng.">
      <div className="flex flex-wrap gap-2">
        {editable ? selected.map(id => (
          <span key={id} className={chip}>{name(id)}
            <button type="button" disabled={pending} aria-label={`Bỏ nhu cầu ${name(id)}`} onClick={() => { setSelected(current => current.filter(value => value !== id)); setSuccess(false); }}
              className="grid size-7 place-items-center rounded-sm hover:bg-background/60 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"><X className="size-3.5" aria-hidden="true" /></button>
          </span>
        )) : product.preferences.map(label => <span key={label} className={`${chip} pr-2`}>{label}</span>)}
        {!product.preferences.length && !selected.length && <p className="text-sm text-muted-foreground">Chưa gắn nhu cầu cho sản phẩm.</p>}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="add-product-preference">Thêm nhu cầu</label>
        <select id="add-product-preference" value={addition} disabled={!editable || pending} onChange={event => setAddition(event.target.value)}
          className="min-h-12 min-w-0 flex-[1_1_14rem] rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
          <option value="">Chọn nhu cầu có sẵn</option>
          {options.filter(option => !selected.includes(option.id)).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
        <Button type="button" variant="outline" className="h-12 px-4" disabled={!editable || pending || !addition} onClick={() => { setSelected(current => [...current, Number(addition)]); setAddition(""); setSuccess(false); }}><Plus aria-hidden="true" />Thêm</Button>
        <Button type="button" className="h-12 px-4 max-sm:w-full" disabled={!editable || pending || !dirty} onClick={() => void save()}><Save aria-hidden="true" />{pending ? "Đang lưu…" : "Lưu nhu cầu"}</Button>
      </div>
      {loading && <p role="status" className={subtle}>Đang tải danh mục nhu cầu…</p>}
      {loadError && <p role="alert" className={errorText}>{loadError} <button type="button" className="ml-2 underline underline-offset-4" onClick={() => { setLoading(true); setLoadError(""); setAttempt(value => value + 1); }}>Thử lại</button></p>}
      {!preview && product.preferenceIds === null && <p className={subtle}>Chưa có mã nhu cầu trong dữ liệu sản phẩm để chỉnh sửa.</p>}
      {error && <p role="alert" className={errorText}>{error}</p>}
      {success && <p role="status" className={successText}><CircleCheck className="size-4" aria-hidden="true" />Đã lưu nhu cầu sản phẩm.</p>}
    </Panel>
  );
}

function PhotoEditor({ product }: { product: ManagerProductDetail }) {
  const state = useProductPhotos();
  const fileInput = useRef<HTMLInputElement>(null);
  const existing = [...new Set([product.imageUrl, ...product.variants.map(variant => variant.imageUrl)].filter((url): url is string => !!url))];
  return (
    <Panel icon={<ImagePlus />} title="Hình ảnh sản phẩm" description="Ảnh rõ nét, nền sáng giúp khách hàng dễ nhận diện sản phẩm.">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]">
        {existing.map((src, index) => (
          <figure key={src} className="min-w-0">
            <ProductPhoto src={src} name={`${product.name} — ảnh ${index + 1}`} className="aspect-square w-full rounded-md" />
            <figcaption className="mt-2 truncate text-center text-xs text-muted-foreground">{index === 0 ? "Ảnh đại diện" : `Ảnh sản phẩm ${index + 1}`}</figcaption>
          </figure>
        ))}
        {state.photos.map(photo => (
          <figure key={photo.url} className="min-w-0">
            <div className="relative aspect-square">
              <Image src={photo.url} alt={`Ảnh mới: ${photo.file.name}`} fill unoptimized className="rounded-md object-contain" />
              <button type="button" aria-label={`Bỏ ảnh ${photo.file.name}`} onClick={() => state.remove(photo.url)}
                className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-card/90 text-muted-foreground shadow-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><X className="size-4" aria-hidden="true" /></button>
            </div>
            <figcaption title={photo.file.name} className="mt-2 truncate text-center text-xs text-muted-foreground">{photo.file.name}<small className="block text-gold-strong">Chưa lưu</small></figcaption>
          </figure>
        ))}
        <button type="button" disabled={state.loading || state.photos.length >= 5} onClick={() => fileInput.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/50 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
          <ImagePlus className="size-6" strokeWidth={1.3} aria-hidden="true" /><span>{state.loading ? "Đang đọc ảnh…" : "Thêm hình ảnh"}</span>
        </button>
      </div>
      <input ref={fileInput} aria-label="Chọn hình ảnh sản phẩm" type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={state.loading || state.photos.length >= 5} onChange={event => { void state.add(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; }} />
      <p className={subtle}>JPG, PNG, WebP · Tối đa 5 ảnh mới, mỗi ảnh không quá 5 MB.</p>
      <p className="mt-3 flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0 text-gold-strong" aria-hidden="true" /><span>Hiện chỉ hỗ trợ chọn và xem trước ảnh. Ảnh mới chưa được lưu lên hệ thống và sẽ mất khi rời trang.</span></p>
      {state.error && <p role="alert" className={errorText}>{state.error}</p>}
    </Panel>
  );
}

function Insights({ id, preview }: { id: number; preview: boolean }) {
  const [data, setData] = useState<ProductInsights | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    loadProductInsights(id, AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]))
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(() => { if (!controller.signal.aborted) setError("Chưa tải được phân tích phản hồi. Kiểm tra kết nối rồi thử lại."); });
    return () => controller.abort();
  }, [id, preview, attempt]);
  return (
    <Panel title="Phản hồi từ khách hàng" icon={<MessageSquare />} description="Tổng hợp đánh giá giúp bạn hiểu rõ hơn trải nghiệm sử dụng.">
      {preview ? <p className="text-sm text-muted-foreground">Chế độ mẫu chưa có dữ liệu phân tích phản hồi.</p>
        : error ? <div role="alert" className="rounded-lg border border-destructive p-4 text-sm"><p>{error}</p><Button type="button" variant="outline" className="mt-3" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Thử lại</Button></div>
        : !data ? <div role="status"><span className="sr-only">Đang tải phản hồi…</span><Skeleton className="h-40 w-full" /></div>
        : <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
            <StatTile label="Đánh giá trung bình" value={data.averageRating === null ? "—" : rating.format(data.averageRating)} unit={data.averageRating === null ? undefined : "/5"} icon={<Star />} progress={data.averageRating === null ? undefined : data.averageRating / 5} />
            <StatTile label="Phản hồi đã ghi nhận" value={data.totalFeedback} icon={<MessageSquare />} />
          </div>
          <ul aria-label="Phân bố số sao" className="space-y-3 self-center">
            {[5, 4, 3, 2, 1].map(stars => {
              const count = data.ratingDistribution.find(row => row.rating === stars)?.count ?? 0;
              return (
                <li key={stars} className="flex items-center gap-3 text-sm">
                  <span className="inline-flex w-10 shrink-0 items-center gap-1 tabular-nums">{stars}<Star className="size-3.5 text-gold-strong" fill="currentColor" aria-hidden="true" /><span className="sr-only">sao</span></span>
                  <span aria-hidden="true" className="h-2 flex-1 bg-muted"><span className="block h-full bg-gold-strong" style={{ width: `${(count / Math.max(1, data.totalFeedback)) * 100}%` }} /></span>
                  <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{count}<span className="sr-only"> phản hồi</span></span>
                </li>
              );
            })}
          </ul>
        </div>}
    </Panel>
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
      .then(data => { if (!controller.signal.aborted) setProduct(data); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof ApiError && reason.status === 501 ? "Chi tiết sản phẩm hiện chưa khả dụng." : "Chưa tải được sản phẩm. Kiểm tra kết nối rồi thử lại."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, preview, attempt]);

  const prices = product?.variants.map(variant => variant.price) ?? [];
  const priceRange = prices.length ? (Math.min(...prices) === Math.max(...prices) ? money.format(prices[0]) : `${money.format(Math.min(...prices))} – ${money.format(Math.max(...prices))}`) : "—";

  return (
    <>
      <Link href="/manager/products" className="mb-3 inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Danh mục sản phẩm</Link>
      <PageHeader eyebrow={product ? product.sku || `SP-${product.id}` : "Hồ sơ sản phẩm"} title={product?.name ?? "Chi tiết sản phẩm"} actions={product && (
        <div className="flex items-center gap-3">
          <span className="font-label text-xs uppercase tracking-wider text-muted-foreground">Trạng thái</span>
          <ProductStatusDropdown item={product} preview={preview} onSaved={(_, status) => { setProduct(current => current && { ...current, status }); setMessage("Đã cập nhật trạng thái sản phẩm."); }} />
        </div>
      )} />
      {preview && <p className="mb-6 rounded-md border border-dashed border-border bg-card p-3 text-sm text-muted-foreground">Giao diện mẫu · Nội dung, giá và số liệu minh họa; ảnh tham khảo từ Cocoon.</p>}
      <div aria-live="polite">{message && <p role="status" className="mb-6 flex items-center gap-2 rounded-md border border-border bg-status-sage-bg p-3 text-sm text-status-sage-fg"><CircleCheck className="size-4 shrink-0" aria-hidden="true" />{message}</p>}</div>

      {loading ? <div role="status"><span className="sr-only">Đang tải thông tin sản phẩm…</span><Skeleton className="h-64 w-full" /></div>
        : error ? <div role="alert" className="rounded-lg border border-destructive p-6"><p>{error}</p><Button type="button" variant="outline" className="mt-3" onClick={() => { setLoading(true); setError(""); setAttempt(value => value + 1); }}>Thử lại</Button></div>
        : product && <>
          <section aria-label="Tổng quan sản phẩm" className={`${panel} mb-6 grid gap-6 sm:grid-cols-[9rem_minmax(0,1fr)]`}>
            <ProductPhoto src={product.imageUrl ?? null} name={product.name} className="h-48 w-full rounded-md sm:h-44" />
            <div className="min-w-0 self-center">
              <span className="rounded-sm bg-muted px-2 py-0.5 font-label text-xs uppercase tracking-wider text-muted-foreground">{product.categoryName}</span>
              <p className="mt-3 max-w-prose text-sm leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">{product.description || "Chưa có mô tả sản phẩm."}</p>
            </div>
          </section>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatTile label="Giá bán" value={priceRange} icon={<Wallet />} className="[&_dd]:text-xl sm:[&_dd]:text-2xl" />
            <StatTile label="Biến thể" value={product.variants.length} icon={<Layers />} hint="Quy cách đang niêm yết" />
            <StatTile label="Đánh giá" value={product.averageRating === null ? "—" : rating.format(product.averageRating)} unit={product.averageRating === null ? undefined : "/5"} icon={<Star />} progress={product.averageRating === null ? undefined : product.averageRating / 5} />
            <StatTile label="Nhu cầu đã gắn" value={product.preferences.length} icon={<Tags />} hint={product.preferences.length ? product.preferences.slice(0, 2).join(", ") : "Chưa gắn nhu cầu"} />
          </div>

          <Tabs defaultValue="info" className="gap-6">
            <TabsList variant="line" aria-label="Nội dung sản phẩm" className="w-full flex-wrap justify-start border-b border-border group-data-horizontal/tabs:h-auto">
              <TabsTrigger value="info" className={tabTrigger}>Thông tin sản phẩm</TabsTrigger>
              <TabsTrigger value="feedback" className={tabTrigger}>Phản hồi & đánh giá</TabsTrigger>
            </TabsList>
            {/* keepMounted: unsaved preference picks and photo drafts survive a tab switch. */}
            <TabsContent value="info" keepMounted className="grid gap-6 data-hidden:hidden">
              <PreferenceEditor product={product} preview={preview} onSaved={(preferenceIds, preferences) => setProduct(current => current && { ...current, preferenceIds, preferences })} />
              <PhotoEditor product={product} />
              <Panel title="Biến thể & giá bán" description="Quy cách và thông tin niêm yết của từng sản phẩm." icon={<Package />}>
                {product.variants.length ? (
                  <Table>
                    <TableCaption className="sr-only">Các biến thể sản phẩm</TableCaption>
                    <TableHeader><TableRow><TableHead>Quy cách</TableHead><TableHead>Mã SKU</TableHead><TableHead className="text-right">Giá niêm yết</TableHead></TableRow></TableHeader>
                    <TableBody>{product.variants.map(variant => (
                      <TableRow key={variant.id}>
                        <TableCell><span className="flex min-w-44 items-center gap-3"><ProductPhoto src={variant.imageUrl} name={variant.name} className="h-14 w-12 rounded-md" /><span className="font-semibold">{variant.name}</span></span></TableCell>
                        <TableCell className="font-mono text-xs">{variant.sku || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{money.format(variant.price)}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                ) : <p className="text-sm text-muted-foreground">Chưa có dữ liệu biến thể.</p>}
              </Panel>
              <Panel title="Câu chuyện & thành phần" icon={<Leaf />} description="Những điều làm nên bản sắc của sản phẩm.">
                <div className="grid gap-4 md:grid-cols-3">
                  {[{ title: "Thành phần", value: product.ingredients }, { title: "Công dụng", value: product.benefits }, { title: "Hướng dẫn sử dụng", value: product.usage }].map(section => (
                    <section key={section.title} className="rounded-md bg-muted p-4">
                      <h3 className="font-label text-xs uppercase tracking-wider text-gold-strong">{section.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">{section.value || "Chưa có thông tin."}</p>
                    </section>
                  ))}
                </div>
              </Panel>
            </TabsContent>
            <TabsContent value="feedback"><Insights id={product.id} preview={preview} /></TabsContent>
          </Tabs>
        </>}
    </>
  );
}
