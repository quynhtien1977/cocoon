"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Check, ImagePlus, Info, Leaf, MessageSquare, Package, Plus, Save, Star, Tags, X } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { useReviewPhotos as useProductPhotos } from "../customer/review-photos";
import { ProductPhoto } from "./product-photo";
import { ProductStatusDropdown } from "./product-status";
import { loadManagerProduct, loadPreferenceCatalog, loadProductInsights, saveProductPreferences, type ManagerProductDetail, type ProductInsights, type ProductPreference } from "./product-detail-service";
import styles from "./product-detail.module.css";

const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
function Panel({ title, description, icon, children }: { title: string; description?: string; icon: ReactNode; children: ReactNode }) {
  return <section className={styles.panel}><header className={styles.panelHeader}><span aria-hidden="true">{icon}</span><div><h2>{title}</h2>{description && <p>{description}</p>}</div></header>{children}</section>;
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
      .catch(() => { if (!controller.signal.aborted) setLoadError("Chưa thể tải danh mục sở thích."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [preview, attempt]);
  const editable = !preview && product.preferenceIds !== null && !loading && !loadError;
  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...(product.preferenceIds ?? [])].sort());
  const name = (id: number) => options.find(option => option.id === id)?.name ?? product.preferences[product.preferenceIds?.indexOf(id) ?? -1] ?? `Sở thích #${id}`;
  async function save() {
    if (!editable || pending || !dirty || busy.current) return;
    busy.current = true; setPending(true); setError(""); setSuccess(false);
    try {
      await saveProductPreferences(product.id, selected, AbortSignal.timeout(12000));
      onSaved(selected, selected.map(name)); setSuccess(true);
    } catch (reason) { setError(reason instanceof ApiError && reason.status === 501 ? "API chưa hỗ trợ lưu sở thích sản phẩm. Các lựa chọn của bạn vẫn được giữ để thử lại." : "Chưa thể lưu sở thích. Vui lòng thử lại."); }
    finally { busy.current = false; setPending(false); }
  }
  return <Panel icon={<Tags size={19} />} title="Sở thích phù hợp" description="Giúp mỗi sản phẩm tìm đến đúng nhu cầu của khách hàng.">
    <div className={styles.chips}>{editable ? selected.map(id => <span key={id}>{name(id)}<button disabled={pending} type="button" aria-label={`Bỏ sở thích ${name(id)}`} onClick={() => { setSelected(current => current.filter(value => value !== id)); setSuccess(false); }}><X size={13} /></button></span>) : product.preferences.map(label => <span key={label}>{label}</span>)}{!product.preferences.length && !selected.length && <p className={styles.subtle}>Chưa gắn sở thích cho sản phẩm.</p>}</div>
    <div className={styles.preferenceActions}><label className="sr-only" htmlFor="add-product-preference">Thêm sở thích</label><select id="add-product-preference" value={addition} disabled={!editable || pending} onChange={event => setAddition(event.target.value)}><option value="">Chọn sở thích có sẵn</option>{options.filter(option => !selected.includes(option.id)).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select><button type="button" className={styles.outline} disabled={!editable || pending || !addition} onClick={() => { setSelected(current => [...current, Number(addition)]); setAddition(""); setSuccess(false); }}><Plus size={15} />Thêm</button><button type="button" className={styles.primary} disabled={!editable || pending || !dirty} onClick={() => void save()}><Save size={15} />{pending ? "Đang lưu…" : "Lưu sở thích"}</button></div>
    {loading && <p role="status" className={styles.subtle}>Đang tải danh mục sở thích…</p>}
    {loadError && <p role="alert" className={styles.error}>{loadError} <button type="button" onClick={() => { setLoading(true); setLoadError(""); setAttempt(value => value + 1); }}>Thử lại</button></p>}
    {!preview && product.preferenceIds === null && <p className={styles.subtle}>Chưa có mã sở thích trong dữ liệu sản phẩm để chỉnh sửa.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}{success && <p role="status" className={styles.success}><Check size={15} />Đã lưu sở thích sản phẩm.</p>}
  </Panel>;
}

function PhotoEditor({ product }: { product: ManagerProductDetail }) {
  const state = useProductPhotos();
  const fileInput = useRef<HTMLInputElement>(null);
  const existing = [...new Set([product.imageUrl, ...product.variants.map(variant => variant.imageUrl)].filter((url): url is string => !!url))];
  return <Panel icon={<ImagePlus size={19} />} title="Hình ảnh sản phẩm" description="Ảnh rõ nét, nền sáng giúp khách hàng dễ nhận diện sản phẩm.">
    <div className={styles.photos}>{existing.map((src, index) => <figure key={src}><ProductPhoto src={src} name={`${product.name} — ảnh ${index + 1}`} className="aspect-square w-full" /><figcaption>{index === 0 ? "Ảnh đại diện" : `Ảnh sản phẩm ${index + 1}`}</figcaption></figure>)}{state.photos.map(photo => <figure key={photo.url} className={styles.draftPhoto}><div className="relative aspect-square"><Image src={photo.url} alt={`Ảnh mới: ${photo.file.name}`} fill unoptimized className="rounded-lg object-contain" /><button type="button" aria-label={`Bỏ ảnh ${photo.file.name}`} onClick={() => state.remove(photo.url)}><X size={15} /></button></div><figcaption title={photo.file.name}>{photo.file.name}<small>Chưa lưu</small></figcaption></figure>)}<button type="button" className={styles.addPhoto} disabled={state.loading || state.photos.length >= 5} onClick={() => fileInput.current?.click()}><ImagePlus size={24} strokeWidth={1.3} /><span>{state.loading ? "Đang đọc ảnh…" : "Thêm hình ảnh"}</span></button></div>
    <input ref={fileInput} aria-label="Chọn hình ảnh sản phẩm" type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={state.loading || state.photos.length >= 5} onChange={event => { void state.add(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; }} />
    <p className={styles.subtle}>JPG, PNG, WebP · Tối đa 5 ảnh mới, mỗi ảnh không quá 5 MB.</p>
    <p className={styles.notice}><Info size={16} /><span>Hiện chỉ hỗ trợ chọn và xem trước ảnh. Ảnh mới chưa được lưu lên hệ thống và sẽ mất khi rời trang.</span></p>
    {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
  </Panel>;
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
      .catch(() => { if (!controller.signal.aborted) setError("Chưa thể tải phân tích phản hồi của sản phẩm."); });
    return () => controller.abort();
  }, [id, preview, attempt]);
  return <Panel title="Phản hồi từ khách hàng" icon={<MessageSquare size={19} />} description="Tổng hợp đánh giá giúp bạn hiểu rõ hơn trải nghiệm sử dụng.">{preview ? <p className={styles.subtle}>Chế độ mẫu chưa có dữ liệu phân tích phản hồi.</p> : error ? <div role="alert" className={styles.error}>{error}<button type="button" className={styles.outline} onClick={() => { setError(""); setAttempt(value => value + 1); }}>Thử lại</button></div> : !data ? <p role="status">Đang tải phản hồi…</p> : <><div className={styles.metrics}><div><strong>{data.averageRating?.toFixed(1) ?? "—"}</strong><span>Đánh giá trung bình / 5</span></div><div><strong>{data.totalFeedback}</strong><span>Phản hồi đã ghi nhận</span></div></div><div className={styles.ratings}>{[5, 4, 3, 2, 1].map(rating => { const count = data.ratingDistribution.find(row => row.rating === rating)?.count ?? 0; return <div key={rating}><span>{rating} <Star size={12} /></span><meter min={0} max={Math.max(1, data.totalFeedback)} value={count} aria-label={`${rating} sao: ${count} phản hồi`} /><span>{count}</span></div>; })}</div></>}</Panel>;
}

export function ManagerProductDetailPage({ id, preview = false }: { id: string; preview?: boolean }) {
  const [product, setProduct] = useState<ManagerProductDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<"info" | "feedback">("info");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    loadManagerProduct(id, preview, AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]))
      .then(data => { if (!controller.signal.aborted) setProduct(data); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof ApiError && reason.status === 501 ? "Chi tiết sản phẩm hiện chưa khả dụng." : "Không thể tải thông tin sản phẩm. Vui lòng kiểm tra lại hoặc thử lại."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, preview, attempt]);
  return <div className={styles.page}><Link className={styles.back} href="/manager/products"><ArrowLeft size={16} />Danh mục sản phẩm</Link>
    <header className={styles.heading}><p>HỒ SƠ SẢN PHẨM</p><h1>{product?.name ?? "Chi tiết sản phẩm"}</h1><span>Chăm chút từng thông tin, kết nối đúng nhu cầu.</span></header>
    {preview && <p className={styles.preview}>Giao diện mẫu · Nội dung, giá và số liệu minh họa; ảnh tham khảo từ Cocoon.</p>}
    {loading ? <div role="status" className={styles.panel}>Đang tải thông tin sản phẩm…</div> : error ? <div className={styles.panel}><p role="alert" className={styles.error}>{error}</p><button type="button" className={styles.outline} onClick={() => { setLoading(true); setError(""); setAttempt(value => value + 1); }}>Thử lại</button></div> : product && <>
      <section className={styles.hero}><ProductPhoto src={product.imageUrl ?? null} name={product.name} className={styles.heroPhoto} /><div className={styles.heroInfo}><span className={styles.category}>{product.categoryName}</span><h2>{product.name}</h2><p>{product.description || "Chưa có mô tả sản phẩm."}</p><div className={styles.meta}><span>{product.sku || `SP-${product.id}`}</span><span>{product.variants.length} biến thể</span>{product.averageRating !== null && <span><Star size={14} />{product.averageRating.toFixed(1)} / 5</span>}</div><div className={styles.status}><span>Trạng thái</span><ProductStatusDropdown item={product} preview={preview} onSaved={(_, status) => { setProduct(current => current && { ...current, status }); setMessage("Đã cập nhật trạng thái sản phẩm."); }} /></div></div></section>
      {message && <p role="status" className={styles.success}><Check size={15} />{message}</p>}
      <div className={styles.tabs} aria-label="Nội dung sản phẩm"><button type="button" aria-pressed={tab === "info"} onClick={() => setTab("info")}><Leaf size={16} />Thông tin sản phẩm</button><button type="button" aria-pressed={tab === "feedback"} onClick={() => setTab("feedback")}><MessageSquare size={16} />Phản hồi & đánh giá</button></div>
      <div hidden={tab !== "info"} className={styles.sections}>
        <PreferenceEditor product={product} preview={preview} onSaved={(preferenceIds, preferences) => setProduct(current => current && { ...current, preferenceIds, preferences })} />
        <PhotoEditor product={product} />
        <Panel title="Biến thể & giá bán" description="Quy cách và thông tin niêm yết của từng sản phẩm." icon={<Package size={19} />}>
          {product.variants.length ? <div className={styles.tableWrap}><table><caption className="sr-only">Các biến thể sản phẩm</caption><thead><tr><th>Quy cách</th><th>Mã SKU</th><th>Giá niêm yết</th></tr></thead><tbody>{product.variants.map(variant => <tr key={variant.id}><td><div className={styles.variant}><ProductPhoto src={variant.imageUrl} name={variant.name} className="h-14 w-12" /><span>{variant.name}</span></div></td><td>{variant.sku || "—"}</td><td>{money(variant.price)}</td></tr>)}</tbody></table></div> : <p className={styles.subtle}>Chưa có dữ liệu biến thể.</p>}
        </Panel>
        <Panel title="Câu chuyện & thành phần" icon={<Leaf size={19} />} description="Những điều làm nên bản sắc của sản phẩm."><div className={styles.information}>{[{ title: "Thành phần", value: product.ingredients }, { title: "Công dụng", value: product.benefits }, { title: "Hướng dẫn sử dụng", value: product.usage }].map(section => <section key={section.title}><h3>{section.title}</h3><p>{section.value || "Chưa có thông tin."}</p></section>)}</div></Panel>
      </div>
      {tab === "feedback" && <Insights id={product.id} preview={preview} />}
    </>}
  </div>;
}
