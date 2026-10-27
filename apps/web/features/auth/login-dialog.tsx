"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import { LoginPage } from "./login-page";
import styles from "./login.module.css";

export function LoginDialog({ direct = false }: { direct?: boolean }) {
  const router = useRouter();
  const close = () => direct ? router.replace("/", { scroll: false }) : router.back();

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) close(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.popup}>
          <Dialog.Title className={styles.visuallyHidden}>Đăng nhập Cocoon</Dialog.Title>
          <Dialog.Description className={styles.visuallyHidden}>Đăng nhập bằng email và mật khẩu cho khách hàng, nhân viên và quản lý.</Dialog.Description>
          <LoginPage modal onClose={close} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
