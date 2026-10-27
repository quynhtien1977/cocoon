"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import { Bell, Check, LoaderCircle, MessageSquare, RefreshCw, X } from "lucide-react";
import { ApiError } from "../../lib/api/client";
import { loadNotifications, markNotificationRead, newFeedbackNotifications, notificationHref, type CustomerNotification } from "./notification-service";

const date = (value: string) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));

function ReplyToast({ item, onDismiss, onOpen }: { item: CustomerNotification; onDismiss: (id: number) => void; onOpen: (item: CustomerNotification) => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(item.id), 10000);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss, paused]);
  return <div data-feedback-toast className="pointer-events-auto relative rounded-lg border border-[#d8c7a7] bg-[#fffdf8] p-4 pr-10 text-[#302b23] shadow-xl" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div role="status" className="flex items-start gap-3"><MessageSquare size={22} className="mt-1 shrink-0 text-[#8a6a2b]" /><div><p className="font-semibold">Bạn có phản hồi mới từ Cocoon</p><p className="mt-1 break-words text-sm leading-6 text-[#756b5e]">{item.title}</p></div></div>
    <button type="button" className="mt-3 min-h-9 text-sm font-semibold text-[#806439] underline underline-offset-4" onClick={() => onOpen(item)}>Xem phản hồi</button>
    <button type="button" aria-label="Đóng thông báo mới" onClick={() => onDismiss(item.id)} className="absolute right-1 top-1 grid size-9 place-items-center rounded hover:bg-[#f3ecdf]"><X size={17} /></button>
  </div>;
}

export function CustomerNotifications() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<CustomerNotification[]>([]);
  const seen = useRef<Set<number> | null>(null);
  const confirmedRead = useRef(new Set<number>());
  const readBusy = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const refresh = useRef<() => void>(() => {});
  const dismiss = useCallback((id: number) => setToasts(current => current.filter(item => item.id !== id)), []);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    let fetching = false;
    const poll = async () => {
      if (fetching || controller.signal.aborted || document.visibilityState === "hidden") return;
      fetching = true; setLoading(true);
      try {
        const data = await loadNotifications(AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
        if (controller.signal.aborted) return;
        const latest = data.map(item => ({ ...item, isRead: item.isRead || confirmedRead.current.has(item.id) }));
        const fresh = newFeedbackNotifications(latest, seen.current);
        if (!seen.current) seen.current = new Set();
        latest.forEach(item => seen.current!.add(item.id));
        setItems(latest); setError("");
        if (fresh.length) setToasts(current => [...fresh, ...current].slice(0, 3));
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof ApiError && reason.status === 501 ? "Thông báo hiện chưa khả dụng. Vui lòng quay lại sau." : "Chưa thể cập nhật thông báo. Vui lòng thử lại.");
      } finally { fetching = false; if (!controller.signal.aborted) setLoading(false); }
    };
    refresh.current = () => { void poll(); };
    void poll();
    const interval = setInterval(() => { void poll(); }, 30000);
    const onVisible = () => { void poll(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { controller.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
  }, []);

  const openNotification = async (item: CustomerNotification) => {
    if (readBusy.current || !lifetime.current) return;
    readBusy.current = true; setPendingId(item.id); setReadError("");
    const controller = lifetime.current;
    try {
      if (!item.isRead) await markNotificationRead(item.id, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
      if (controller.signal.aborted) return;
      confirmedRead.current.add(item.id);
      setItems(current => current.map(row => row.id === item.id ? { ...row, isRead: true } : row));
      dismiss(item.id);
      const href = notificationHref(item);
      if (href) { setOpen(false); router.push(href); }
    } catch {
      if (!controller.signal.aborted) { setReadError("Chưa thể đánh dấu đã đọc. Vui lòng thử lại."); setOpen(true); }
    } finally { readBusy.current = false; if (!controller.signal.aborted) setPendingId(null); }
  };
  const unread = items.filter(item => !item.isRead).length;
  return <>
    <Popover.Root open={open} onOpenChange={value => { setOpen(value); if (value) refresh.current(); }}>
      <Popover.Trigger className="relative inline-grid size-11 shrink-0 place-items-center rounded focus-visible:outline-2 focus-visible:outline-[#8a6a2b]" aria-label={unread ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}><Bell size={20} />{unread > 0 && <span aria-hidden="true" className="absolute right-0 top-0 min-w-4 rounded-full bg-[#8a6a2b] px-1 text-[10px] leading-4 text-white">{unread > 99 ? "99+" : unread}</span>}</Popover.Trigger>
      <Popover.Portal><Popover.Positioner align="end" sideOffset={12} collisionPadding={12} className="z-[70] outline-none"><Popover.Popup className="max-h-[min(520px,var(--available-height))] w-[380px] max-w-[calc(100vw-40px)] overflow-y-auto overscroll-contain rounded-lg border border-[#dfd3bf] bg-[#fffdf8] text-[#302b23] shadow-xl outline-none">
        <div className="flex items-center justify-between gap-3 border-b border-[#e9e0cf] p-4"><div><Popover.Title className="font-heading text-2xl">Thông báo từ Cocoon</Popover.Title><Popover.Description className="mt-1 text-xs text-[#81745e]">{unread ? `${unread} thông báo chưa đọc` : "Cập nhật dành cho bạn"}</Popover.Description></div><button type="button" aria-label="Làm mới thông báo" disabled={loading} onClick={() => refresh.current()} className="grid size-10 shrink-0 place-items-center rounded hover:bg-[#f3ecdf] disabled:opacity-50"><RefreshCw size={17} className={loading ? "motion-safe:animate-spin" : ""} /></button></div>
        {error && <div className="border-b border-[#e9e0cf] p-4 text-sm text-[#806439]" role="alert">{error}</div>}
        {readError && <p role="alert" className="p-4 text-sm text-red-800">{readError}</p>}
        {loading && !items.length ? <p role="status" className="flex items-center justify-center gap-2 p-8 text-sm"><LoaderCircle size={18} className="motion-safe:animate-spin" />Đang tải thông báo…</p> : !items.length && !error ? <div className="grid justify-items-center gap-3 p-8 text-center text-sm text-[#81745e]"><Bell size={28} /><p>Bạn chưa có thông báo nào.</p></div> : <ul>{items.map(item => <li key={item.id} className="border-b border-[#eee6d7] last:border-0"><button type="button" disabled={pendingId !== null} onClick={() => void openNotification(item)} className={`flex w-full items-start gap-3 p-4 text-left hover:bg-[#f3ecdf] disabled:opacity-60 ${item.isRead ? "" : "bg-[#faf4e8]"}`}><MessageSquare size={18} className="mt-1 shrink-0 text-[#977c4d]" /><span className="min-w-0 flex-1"><span className={`block break-words text-sm leading-6 ${item.isRead ? "text-[#81745e]" : "font-semibold"}`}>{item.title}</span><time dateTime={item.createdAt} className="mt-1 block text-xs text-[#81745e]">{date(item.createdAt)}</time><span className="sr-only">{item.isRead ? "Đã đọc" : "Chưa đọc"}</span></span>{pendingId === item.id ? <LoaderCircle size={16} className="shrink-0 motion-safe:animate-spin" /> : item.isRead ? <Check size={14} className="mt-1 shrink-0 text-[#81745e]" /> : <span className="mt-2 size-2 shrink-0 rounded-full bg-[#977c4d]" />}</button></li>)}</ul>}
      </Popover.Popup></Popover.Positioner></Popover.Portal>
    </Popover.Root>
    {toasts.length > 0 && createPortal(<div className="pointer-events-none fixed right-4 top-4 z-[100] grid w-[360px] max-w-[calc(100vw-32px)] gap-3" aria-label="Phản hồi mới từ Cocoon">{toasts.map(item => <ReplyToast key={item.id} item={item} onDismiss={dismiss} onOpen={openNotification} />)}</div>, document.body)}
  </>;
}
