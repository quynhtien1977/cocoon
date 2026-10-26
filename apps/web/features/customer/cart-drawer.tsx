"use client";

import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { X } from "lucide-react";
import styles from "./cart-drawer.module.css";

export function CartDrawer({ open, onOpenChange, onContinue }: { open: boolean; onOpenChange: (open: boolean) => void; onContinue: () => void }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Backdrop className={styles.backdrop} />
      <Dialog.Popup className={styles.drawer}>
        <div className={styles.header}><Dialog.Title className={styles.title}>Giỏ hàng</Dialog.Title><Dialog.Close className={styles.close} aria-label="Đóng giỏ hàng"><X size={24} strokeWidth={1.5} /></Dialog.Close></div>
        <div className={styles.empty}>
          <p className={styles.oops}>OOPSS..</p>
          <Dialog.Description className={styles.description}>Giỏ hàng hiện đang trống<br />Không có sản phẩm nào trong<br />giỏ của bạn</Dialog.Description>
          <Link href="/account/products" onClick={onContinue} className={styles.continue}>TIẾP TỤC MUA SẮM</Link>
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
