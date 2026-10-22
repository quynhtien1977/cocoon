"use client";

import { useRef, useState, type ReactElement } from "react";
import { LoaderCircle } from "lucide-react";
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
  onConfirm: () => void | Promise<void>;
  /** Preserve scoped portal tokens when the dialog renders outside its shell. */
  portal?: "public" | "customer" | "staff" | "manager" | "admin";
}

export function ConfirmDialog({ title, description, trigger, open, onOpenChange, confirmLabel = "Xác nhận", cancelLabel = "Hủy", pendingLabel = "Đang xử lý…", onConfirm, portal }: ConfirmDialogProps) {
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
      <AlertDialogContent initialFocus={cancelRef} data-portal={portal} aria-busy={pending} className="max-h-[calc(100dvh-3rem)] w-[calc(100%-2rem)] overflow-y-auto p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter className="-mx-6 -mb-6 p-6">
          <AlertDialogCancel ref={cancelRef} disabled={pending} className="min-h-12 px-4">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction type="button" variant="destructive" disabled={pending} onClick={confirm} className="min-h-12 px-4">
            {pending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}
            {pending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
