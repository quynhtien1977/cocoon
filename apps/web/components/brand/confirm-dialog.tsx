"use client";

import { useRef, useState, type ReactElement, type ReactNode } from "react";
import { LoaderCircle, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export interface ConfirmDialogProps {
  title: string;
  description: string;
  /** An actual button element (e.g. Button), never a link. */
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  confirmLabel?: string;
  cancelLabel?: string;
  pendingLabel?: string;
  appearance?: "default" | "soft";
  eyebrow?: string;
  icon?: ReactNode;
  children?: ReactNode;
  onConfirm: () => void | Promise<void>;
  /** Preserve scoped portal tokens when the dialog renders outside its shell. */
  portal?: "public" | "customer" | "staff" | "manager" | "admin";
}

export function ConfirmDialog({ title, description, trigger, open, onOpenChange, confirmLabel = "Xác nhận", cancelLabel = "Hủy", pendingLabel = "Đang xử lý…", onConfirm, portal, appearance = "default", eyebrow, icon, children }: ConfirmDialogProps) {
  const soft = appearance === "soft";
  const [internalOpen, setInternalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  function changeOpen(next: boolean) {
    if (running.current) return;
    setError(null);
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }

  async function confirm() {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      running.current = false;
      changeOpen(false);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Không thể hoàn tất thao tác. Hãy thử lại.");
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open ?? internalOpen} onOpenChange={(next, details) => {
      if (running.current) { details.cancel(); return; }
      changeOpen(next);
    }}>
      {trigger && <AlertDialogTrigger render={trigger} />}
      <AlertDialogContent initialFocus={cancelRef} data-portal={portal} aria-busy={pending} className={soft ? "max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-xl border-t-2 border-[#c5af7c] bg-[#fffdf8] p-0 text-[#403b30] shadow-[0_24px_80px_#30281726] ring-[#ded5c4]/60 duration-200 data-[size=default]:max-w-[500px] data-[size=default]:sm:max-w-[500px] motion-reduce:animate-none" : "max-h-[calc(100dvh-3rem)] w-[calc(100%-2rem)] overflow-y-auto p-6"}>
        {soft ? <>
          <div className="relative flex items-center gap-3 border-b border-[#ebe5d8] bg-[#faf7f0] px-5 py-5 pr-14 sm:px-6 sm:pr-14">
            {icon && <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#eee6d3] text-[#9b8050]">{icon}</span>}
            <div className="min-w-0">{eyebrow && <p className="mb-1 font-label text-xs tracking-wider text-[#a18a60] uppercase">{eyebrow}</p>}<AlertDialogTitle className="text-xl leading-snug font-normal">{title}</AlertDialogTitle></div>
            <AlertDialogCancel variant="ghost" size="icon" aria-label="Đóng hộp thoại" disabled={pending} className="absolute right-3 top-4 size-9 rounded-full text-[#928a7b] hover:bg-[#eee7d9] hover:text-[#554d3d]"><X size={17} /></AlertDialogCancel>
          </div>
          <div className="space-y-5 px-5 py-6 sm:px-6"><AlertDialogDescription className="text-left text-sm leading-7 text-[#777061]">{description}</AlertDialogDescription>{children}{error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}</div>
        </> : <><AlertDialogHeader>
          <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>{children}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </>}
        <AlertDialogFooter className={soft ? "m-0 flex-row justify-end gap-3 rounded-b-xl border-[#ebe5d8] bg-[#f8f4ec] px-5 py-4 sm:px-6" : "-mx-6 -mb-6 p-6"}>
          <AlertDialogCancel ref={cancelRef} disabled={pending} variant={soft ? "ghost" : "outline"} className={soft ? "min-h-11 rounded-md px-5 text-[#847b6a] hover:bg-[#eee7da] hover:text-[#554d3d]" : "min-h-12 px-4"}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction type="button" variant={soft ? "default" : "destructive"} disabled={pending} onClick={confirm} className={soft ? "min-h-11 rounded-md bg-[#4d5543] px-5 text-[#fffdf7] transition-colors hover:bg-[#616d52] motion-reduce:transition-none" : "min-h-12 px-4"}>
            {pending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}
            {!pending && soft && icon && <span aria-hidden="true">{icon}</span>}
            {pending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
