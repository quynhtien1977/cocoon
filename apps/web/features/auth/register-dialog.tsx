"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import { RegisterForm } from "./register-form";
import styles from "./login.module.css";

export function RegisterDialog({ direct = false }: { direct?: boolean }) {
  const router = useRouter();
  const close = () => direct ? router.replace("/", { scroll: false }) : router.back();
  return <Dialog.Root open onOpenChange={(open) => { if (!open) close(); }}>
    <Dialog.Portal><Dialog.Backdrop className={styles.backdrop} /><Dialog.Popup className={styles.popup}>
      <Dialog.Title className={styles.visuallyHidden}>Đăng ký tài khoản khách hàng Cocoon</Dialog.Title>
      <Dialog.Description className={styles.visuallyHidden}>Hai bước: thông tin tài khoản bắt buộc và sở thích tùy chọn.</Dialog.Description>
      <RegisterForm onClose={close} />
    </Dialog.Popup></Dialog.Portal>
  </Dialog.Root>;
}
