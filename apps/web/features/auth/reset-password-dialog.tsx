"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import { ResetPasswordForm } from "./reset-password-page";
import styles from "./login.module.css";

/** /reset-password (the link in the email) opens like /login: the same popup over the landing page. */
export function ResetPasswordDialog({ initialEmail = "" }: { initialEmail?: string }) {
  const router = useRouter();
  const close = () => router.replace("/", { scroll: false });

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) close(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.popup}>
          <Dialog.Title className={styles.visuallyHidden}>Đặt lại mật khẩu Cocoon</Dialog.Title>
          <Dialog.Description className={styles.visuallyHidden}>Nhập mã 6 chữ số trong email và mật khẩu mới.</Dialog.Description>
          <ResetPasswordForm initialEmail={initialEmail} onClose={close} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
