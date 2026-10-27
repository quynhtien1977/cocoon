"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import styles from "./review-photos.module.css";

export type ReviewPhoto = { url: string; file: File };
const maxPhotos = 5;
const maxBytes = 5 * 1024 * 1024;

export function useReviewPhotos() {
  const [photos, setPhotos] = useState<ReviewPhoto[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const urls = useRef(new Set<string>());
  const active = useRef(true);
  const busy = useRef(false);
  useEffect(() => {
    active.current = true;
    const allocated = urls.current;
    return () => { active.current = false; allocated.forEach((url) => URL.revokeObjectURL(url)); allocated.clear(); };
  }, []);
  const discard = (url: string) => { URL.revokeObjectURL(url); urls.current.delete(url); };
  const clear = () => { urls.current.forEach(discard); setPhotos([]); setError(""); };
  const remove = (url: string) => { discard(url); setPhotos((previous) => previous.filter((photo) => photo.url !== url)); setError(""); };
  const add = async (files: File[]) => {
    if (busy.current || !files.length) return;
    busy.current = true; setLoading(true); setError("");
    const accepted: ReviewPhoto[] = [];
    const messages = new Set<string>();
    try {
      for (const file of files) {
        if (!active.current) break;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { messages.add("Chỉ chọn ảnh JPG, PNG hoặc WebP."); continue; }
        if (!file.size || file.size > maxBytes) { messages.add("Mỗi ảnh cần có dung lượng lớn hơn 0 và không quá 5 MB."); continue; }
        if ([...photos, ...accepted].some((photo) => photo.file.name === file.name && photo.file.size === file.size && photo.file.lastModified === file.lastModified)) continue;
        if (photos.length + accepted.length >= maxPhotos) { messages.add("Bạn có thể chọn tối đa 5 ảnh."); break; }
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        const valid = await new Promise<boolean>((resolve) => {
          const img = new window.Image();
          const timer = window.setTimeout(() => { img.src = ""; resolve(false); }, 10000);
          img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth > 0 && img.naturalHeight > 0); };
          img.onerror = () => { clearTimeout(timer); resolve(false); };
          img.src = url;
        });
        if (!active.current || !valid) { discard(url); if (!valid) messages.add("Có tệp không đọc được dưới dạng ảnh. Vui lòng chọn ảnh khác."); continue; }
        accepted.push({ url, file });
      }
      if (active.current) { setPhotos((previous) => [...previous, ...accepted]); setError([...messages].join(" ")); }
    } finally { busy.current = false; if (active.current) setLoading(false); }
  };
  return { photos, error, loading, add, remove, clear };
}

export function ReviewPhotoGallery({ photos, onRemove, disabled = false }: { photos: ReviewPhoto[]; onRemove?: (url: string) => void; disabled?: boolean }) {
  return <div className={styles.gallery} aria-label="Ảnh đính kèm đánh giá">{photos.map((photo, index) => <figure key={photo.url}>
    <Image src={photo.url} alt={`Ảnh đánh giá ${index + 1}: ${photo.file.name}`} width={160} height={160} unoptimized />
    {onRemove && <button type="button" disabled={disabled} onClick={() => onRemove(photo.url)} aria-label={`Bỏ ảnh ${photo.file.name}`}><X size={16} /></button>}
    <figcaption title={photo.file.name}>{photo.file.name}</figcaption>
  </figure>)}</div>;
}

export function ReviewPhotoPicker({ state, disabled }: { state: ReturnType<typeof useReviewPhotos>; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return <section className={styles.picker} aria-labelledby="review-photos-label">
    <h3 id="review-photos-label">Hình ảnh trải nghiệm <span>(không bắt buộc)</span></h3>
    <p id="review-photos-help">Tối đa 5 ảnh JPG, PNG hoặc WebP · Mỗi ảnh tối đa 5 MB.</p>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={disabled || state.loading} aria-label="Chọn ảnh đánh giá" aria-describedby="review-photos-help" onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void state.add(files); }} />
    <ReviewPhotoGallery photos={state.photos} onRemove={state.remove} disabled={disabled || state.loading} />
    <button type="button" className={styles.add} disabled={disabled || state.loading || state.photos.length >= maxPhotos} onClick={() => input.current?.click()}><ImagePlus size={22} />{state.loading ? "Đang đọc ảnh…" : `Thêm ảnh (${state.photos.length}/5)`}</button>
    {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
    <p className={styles.local}>Ảnh hiện chỉ được xem trên thiết bị này. Tính năng gửi ảnh kèm đánh giá chưa được hỗ trợ.</p>
  </section>;
}
