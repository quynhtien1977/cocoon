"use client";

import { X } from "lucide-react";
import { PasswordRecovery } from "./password-recovery";
import styles from "./login.module.css";

export { loginAfterReset } from "./password-recovery";

/**
 * Panel for /reset-password, the link in the email: it starts on the code step for the email in the link
 * (or on the email step without one). ResetPasswordDialog shows it in the login popup over the landing page.
 */
export function ResetPasswordForm({ initialEmail = "", navigate, onClose }: { initialEmail?: string; navigate?: (url: string) => void; onClose: () => void }) {
  return (
    <div className={styles.panel}>
      <div className={styles.topline}>
        <span>Đặt lại mật khẩu</span>
        <button type="button" onClick={onClose} aria-label="Đóng, về trang chủ" className={styles.close}><X size={24} strokeWidth={1.5} /></button>
      </div>
      <PasswordRecovery initialEmail={initialEmail} startAtCode navigate={navigate} />
    </div>
  );
}
