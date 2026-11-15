"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, KeyRound, LockKeyhole, Mail, X } from "lucide-react";
import { ApiError } from "../../lib/api/client";
import { requestPasswordCode, resetPassword, validateResetDraft, type ResetDraft } from "./password-reset-service";
import styles from "./login.module.css";

const emptyDraft: ResetDraft = { email: "", code: "", newPassword: "", confirmPassword: "" };

/** A full page load, so /login opens over the landing page instead of this form (a soft visit would intercept it as a dialog here). */
const loadPage = (url: string) => window.location.assign(url);

/** The login form fills the email from ?email= after a reset. */
export const loginAfterReset = (email: string) => `/login?reset=1&email=${encodeURIComponent(email.trim())}`;

export function ResetPasswordPage({ initialEmail = "", navigate = loadPage }: { initialEmail?: string; navigate?: (url: string) => void }) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const pendingRef = useRef(false);
  const activeRef = useRef(true);
  const [draft, setDraft] = useState<ResetDraft>({ ...emptyDraft, email: initialEmail });
  const [errors, setErrors] = useState<Partial<Record<keyof ResetDraft, string>>>({});
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  const update = (patch: Partial<ResetDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    const keys = Object.keys(patch) as (keyof ResetDraft)[];
    if (keys.length) {
      setErrors((current) => {
        const next = { ...current };
        for (const key of keys) delete next[key];
        return next;
      });
    }
    setFormError("");
  };

  async function handleResend() {
    if (resending || pending) return;
    const check = validateResetDraft({ ...draft, code: "000000", newPassword: "Password1", confirmPassword: "Password1" });
    if (check.email) {
      setErrors((current) => ({ ...current, email: check.email }));
      (formRef.current?.elements.namedItem("email") as HTMLInputElement | null)?.focus();
      return;
    }
    setResending(true);
    setNotice("");
    setFormError("");
    try {
      const apiMessage = await requestPasswordCode(draft.email);
      if (activeRef.current) setNotice(apiMessage);
    } catch (error) {
      if (activeRef.current) {
        setFormError(error instanceof ApiError ? error.message : "Mất kết nối. Kiểm tra mạng rồi thử lại.");
      }
    } finally {
      if (activeRef.current) setResending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const nextErrors = validateResetDraft(draft);
    setErrors(nextErrors);
    setFormError("");
    setNotice("");
    const firstInvalid = (["email", "code", "newPassword", "confirmPassword"] as const).find((key) => nextErrors[key]);
    if (firstInvalid) {
      (event.currentTarget.elements.namedItem(firstInvalid) as HTMLInputElement | null)?.focus();
      return;
    }

    pendingRef.current = true;
    setPending(true);
    try {
      await resetPassword(draft);
      if (!activeRef.current) return;
      setDone(true);
      navigate(loginAfterReset(draft.email));
    } catch (error) {
      if (!activeRef.current) return;
      if (error instanceof ApiError) {
        if (error.code === "INVALID_CODE") {
          setErrors({ code: error.message });
          (formRef.current?.elements.namedItem("code") as HTMLInputElement | null)?.focus();
        } else if (error.code === "VALIDATION_ERROR") {
          setErrors({ newPassword: error.errors.newPassword?.[0] ?? error.message });
          (formRef.current?.elements.namedItem("newPassword") as HTMLInputElement | null)?.focus();
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError("Mất kết nối. Kiểm tra mạng rồi thử lại.");
      }
    } finally {
      pendingRef.current = false;
      if (activeRef.current) setPending(false);
    }
  }

  return (
    <div className={styles.publicPage} data-portal="public">
      <a href="#main-content" className="skip-link">Đến biểu mẫu đặt lại mật khẩu</a>
      <main id="main-content" className={styles.main} tabIndex={-1}>
        <div className={styles.panel}>
          <div className={styles.topline}>
            <span>Đặt lại mật khẩu</span>
            <Link href="/login" aria-label="Đóng, về đăng nhập" className={styles.close}><X size={24} strokeWidth={1.5} /></Link>
          </div>
          <h1>Đặt lại mật khẩu mới.</h1>
          <p className={styles.intro}>
            Nhập mã xác nhận 6 chữ số từ email để đặt mật khẩu mới hoặc kích hoạt tài khoản.{" "}
            <Link href="/login">Quay lại đăng nhập</Link>
          </p>

          {done ? (
            <div role="status" className={styles.formSuccess}>
              <p>Đã đặt mật khẩu, hãy đăng nhập.</p>
              <a href={loginAfterReset(draft.email)} className={styles.resetLink}>ĐĂNG NHẬP</a>
            </div>
          ) : (
            <form ref={formRef} onSubmit={submit} noValidate aria-label="Đặt lại mật khẩu" aria-busy={pending}>
              <div className={styles.field} data-invalid={!!errors.email}>
                <label htmlFor={`${id}-email`} className={styles.visuallyHidden}>Email</label>
                <div className={styles.inputLine}>
                  <Mail size={19} strokeWidth={1.5} aria-hidden="true" />
                  <input
                    id={`${id}-email`}
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Nhập địa chỉ email"
                    value={draft.email}
                    required
                    readOnly={pending}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? `${id}-email-error` : undefined}
                    onChange={(event) => update({ email: event.target.value })}
                  />
                </div>
                {errors.email && <p id={`${id}-email-error`} className={styles.fieldError}>{errors.email}</p>}
              </div>

              <div className={styles.field} data-invalid={!!errors.code}>
                <label htmlFor={`${id}-code`} className={styles.visuallyHidden}>Mã xác nhận (6 chữ số)</label>
                <div className={styles.inputLine}>
                  <KeyRound size={19} strokeWidth={1.5} aria-hidden="true" />
                  <input
                    id={`${id}-code`}
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="Nhập mã xác nhận 6 chữ số"
                    value={draft.code}
                    required
                    readOnly={pending}
                    aria-invalid={!!errors.code}
                    aria-describedby={errors.code ? `${id}-code-error` : undefined}
                    onChange={(event) => update({ code: event.target.value.replace(/\D/g, "").slice(0, 6) })}
                  />
                </div>
                {errors.code && <p id={`${id}-code-error`} className={styles.fieldError}>{errors.code}</p>}
              </div>

              <div className={styles.resendRow}>
                <button type="button" disabled={resending || pending} onClick={handleResend}>
                  {resending ? "Đang gửi lại mã…" : "Gửi lại mã"}
                </button>
              </div>

              <div className={styles.field} data-invalid={!!errors.newPassword}>
                <label htmlFor={`${id}-newPassword`} className={styles.visuallyHidden}>Mật khẩu mới</label>
                <div className={styles.inputLine}>
                  <LockKeyhole size={19} strokeWidth={1.5} aria-hidden="true" />
                  <input
                    id={`${id}-newPassword`}
                    name="newPassword"
                    type={showNew ? "text" : "password"}
                    autoComplete="new-password"
                    maxLength={128}
                    placeholder="Nhập mật khẩu mới"
                    value={draft.newPassword}
                    required
                    readOnly={pending}
                    aria-invalid={!!errors.newPassword}
                    aria-describedby={errors.newPassword ? `${id}-newPassword-error` : `${id}-newPassword-hint`}
                    onChange={(event) => update({ newPassword: event.target.value })}
                  />
                  <button
                    type="button"
                    className={styles.visibility}
                    aria-label={showNew ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}
                    aria-pressed={showNew}
                    onClick={() => setShowNew((value) => !value)}
                  >
                    {showNew ? <EyeOff size={22} strokeWidth={1.5} /> : <Eye size={22} strokeWidth={1.5} />}
                  </button>
                </div>
                {errors.newPassword
                  ? <p id={`${id}-newPassword-error`} className={styles.fieldError}>{errors.newPassword}</p>
                  : <p id={`${id}-newPassword-hint`} className={styles.formHint}>8–128 ký tự, gồm cả chữ và số.</p>}
              </div>

              <div className={styles.field} data-invalid={!!errors.confirmPassword}>
                <label htmlFor={`${id}-confirmPassword`} className={styles.visuallyHidden}>Nhập lại mật khẩu mới</label>
                <div className={styles.inputLine}>
                  <LockKeyhole size={19} strokeWidth={1.5} aria-hidden="true" />
                  <input
                    id={`${id}-confirmPassword`}
                    name="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    maxLength={128}
                    placeholder="Nhập lại mật khẩu mới"
                    value={draft.confirmPassword}
                    required
                    readOnly={pending}
                    aria-invalid={!!errors.confirmPassword}
                    aria-describedby={errors.confirmPassword ? `${id}-confirmPassword-error` : undefined}
                    onChange={(event) => update({ confirmPassword: event.target.value })}
                  />
                  <button
                    type="button"
                    className={styles.visibility}
                    aria-label={showConfirm ? "Ẩn mật khẩu nhập lại" : "Hiện mật khẩu nhập lại"}
                    aria-pressed={showConfirm}
                    onClick={() => setShowConfirm((value) => !value)}
                  >
                    {showConfirm ? <EyeOff size={22} strokeWidth={1.5} /> : <Eye size={22} strokeWidth={1.5} />}
                  </button>
                </div>
                {errors.confirmPassword && <p id={`${id}-confirmPassword-error`} className={styles.fieldError}>{errors.confirmPassword}</p>}
              </div>

              {notice && <p role="status" className={styles.formSuccess}>{notice}</p>}
              {formError && <p role="alert" className={styles.formError}>{formError}</p>}

              <button className={styles.submit} type="submit" disabled={pending}>
                {pending ? "ĐANG ĐẶT MẬT KHẨU…" : "ĐẶT MẬT KHẨU MỚI"}
              </button>
            </form>
          )}
        </div>
        <Link href="/" className={styles.bottomBrand} aria-label="Cocoon — Trang chủ">
          <Image src="/images/landing/logo.svg" alt="Cocoon Original Vietnam" width={128} height={48} />
        </Link>
      </main>
    </div>
  );
}
