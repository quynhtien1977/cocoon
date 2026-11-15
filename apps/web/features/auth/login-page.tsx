"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, X } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { loginErrorMessage, signIn, validateLogin, type LoginPortal } from "./login-service";
import { requestPasswordCode, validateResetDraft } from "./password-reset-service";
import styles from "./login.module.css";

const subscribeEmpty = () => () => {};
const readResetParam = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("reset") === "1";

const rememberedEmailKey = (portal: LoginPortal) => `cocoon:login-email:${portal}`;

/** Credential Management API (Chromium); not in TypeScript's DOM lib. */
type PasswordCredentialConstructor = new (data: { id: string; password: string; name?: string }) => Credential;

/**
 * Hands the credentials to the browser's password manager, which encrypts them and autofills both
 * fields next time. The app itself never stores the password. Chromium shows its "Save password?"
 * prompt from this call; Firefox and Safari detect the submitted password form on their own.
 */
async function offerToSavePassword(email: string, password: string) {
  const PasswordCredential = (window as unknown as { PasswordCredential?: PasswordCredentialConstructor }).PasswordCredential;
  if (!PasswordCredential || !navigator.credentials?.store) return;
  await navigator.credentials.store(new PasswordCredential({ id: email, password, name: email }));
}

export function LoginPage({ portal = "shared", modal = false, onClose }: { portal?: LoginPortal; modal?: boolean; onClose?: () => void }) {
  const isAdmin = portal === "admin";
  const Content = modal ? "div" : "main";
  const forgotId = useId();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const pendingRef = useRef(false);
  const forgotPendingRef = useRef(false);
  const activeRef = useRef(true);
  const resetSuccess = useSyncExternalStore(subscribeEmpty, readResetParam, () => false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotNotice, setForgotNotice] = useState("");
  const [forgotPending, setForgotPending] = useState(false);

  useEffect(() => {
    activeRef.current = true;
    try {
      const email = localStorage.getItem(rememberedEmailKey(portal));
      const form = formRef.current;
      if (email && form) {
        (form.elements.namedItem("email") as HTMLInputElement).value = email;
        (form.elements.namedItem("remember") as HTMLInputElement).checked = true;
      }
    } catch { /* Storage may be disabled; the form still works. */ }
    // After a reset (/login?reset=1&email=…) the address just used is the one to sign in with.
    const params = new URLSearchParams(window.location.search);
    const resetEmail = params.get("reset") === "1" ? params.get("email")?.trim() : "";
    const emailInput = formRef.current?.elements.namedItem("email") as HTMLInputElement | null;
    if (portal !== "admin" && resetEmail && emailInput) emailInput.value = resetEmail;
    return () => { activeRef.current = false; };
  }, [portal]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingRef.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const nextErrors = validateLogin(email, password);
    setErrors(nextErrors);
    setMessage("");
    if (nextErrors.email || nextErrors.password) {
      (form.elements.namedItem(nextErrors.email ? "email" : "password") as HTMLInputElement).focus();
      return;
    }
    pendingRef.current = true;
    setPending(true);
    try {
      const destination = await signIn(email, password, portal, new URLSearchParams(window.location.search).get("next"));
      if (!activeRef.current) return;
      try {
        if (data.get("remember")) localStorage.setItem(rememberedEmailKey(portal), email);
        else localStorage.removeItem(rememberedEmailKey(portal));
      } catch { /* Remembering email is optional and must not block sign-in. */ }
      // Not awaited: the browser prompt must never hold up the redirect.
      if (data.get("remember")) void offerToSavePassword(email, password).catch(() => { /* Saving is optional. */ });
      router.replace(destination);
      router.refresh();
    } catch (error) {
      if (activeRef.current) setMessage(loginErrorMessage(error));
    } finally {
      pendingRef.current = false;
      if (activeRef.current) setPending(false);
    }
  };

  const openForgot = () => {
    if (isAdmin || pending) return;
    const currentEmail = String((formRef.current?.elements.namedItem("email") as HTMLInputElement | null)?.value ?? "").trim();
    setForgotEmail(currentEmail);
    setForgotError("");
    setForgotMessage("");
    setForgotNotice("");
    setErrors({ email: "", password: "" });
    setMessage("");
    setMode("forgot");
  };

  const closeForgot = () => {
    setMode("login");
    setForgotError("");
    setForgotMessage("");
    setForgotNotice("");
  };

  const sendResetCode = async (emailInput: string, focusTarget?: HTMLInputElement | null) => {
    if (forgotPendingRef.current) return;
    const email = emailInput.trim();
    const emailError = validateResetDraft({ email, code: "000000", newPassword: "Password1", confirmPassword: "Password1" }).email ?? "";
    setForgotError(emailError);
    setForgotMessage("");
    if (emailError) {
      focusTarget?.focus();
      return;
    }
    forgotPendingRef.current = true;
    setForgotPending(true);
    try {
      const apiMessage = await requestPasswordCode(email);
      if (activeRef.current) {
        setForgotEmail(email);
        setForgotNotice(apiMessage);
      }
    } catch (error) {
      if (activeRef.current) {
        setForgotMessage(error instanceof ApiError ? error.message : "Mất kết nối. Kiểm tra mạng rồi thử lại.");
      }
    } finally {
      forgotPendingRef.current = false;
      if (activeRef.current) setForgotPending(false);
    }
  };

  const submitForgot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("email") as HTMLInputElement | null;
    await sendResetCode(forgotEmail, input);
  };

  const isForgot = !isAdmin && mode === "forgot";
  const trimmedForgotEmail = forgotEmail.trim();
  const resetHref = trimmedForgotEmail ? `/reset-password?email=${encodeURIComponent(trimmedForgotEmail)}` : "/reset-password";

  return (
    <div className={isAdmin ? styles.adminPage : modal ? styles.modalPage : styles.publicPage} data-portal={isAdmin ? "admin" : "public"}>
      {!modal && <a href="#main-content" className="skip-link">Đến biểu mẫu đăng nhập</a>}
      {isAdmin && <aside className={styles.adminIntro}>
        <Link href="/" className={styles.adminBrand}>cocoon<span>ADMIN CONSOLE</span></Link>
        <div className={styles.adminIntroContent}><span className={styles.adminMark}><ShieldCheck size={36} strokeWidth={1.3} /></span><p className={styles.eyebrow}>KHÔNG GIAN QUẢN TRỊ</p><h2>Quản lý hệ thống.<br />Kết nối mọi hoạt động.</h2><p>Truy cập công cụ quản lý tài khoản, phân quyền và theo dõi hoạt động của Cocoon CRM.</p></div>
        <Link href="/" className={styles.backLink}><ArrowLeft size={16} /> Đăng nhập khách hàng & nhân sự</Link>
      </aside>}
      <Content id={modal ? undefined : "main-content"} className={styles.main} tabIndex={-1}>
        <div className={styles.panel}>
          <div className={styles.topline}><span>{isAdmin ? "ADMIN CONSOLE" : isForgot ? "Quên mật khẩu" : "Đăng nhập"}</span>{modal ? <button type="button" onClick={onClose} aria-label="Đóng đăng nhập" className={styles.close}><X size={24} strokeWidth={1.5} /></button> : <Link href="/" aria-label="Đóng đăng nhập, về trang chủ" className={styles.close}><X size={24} strokeWidth={1.5} /></Link>}</div>
          {isAdmin && <span className={styles.formMark}><ShieldCheck size={28} /></span>}
          {isForgot ? <>
            <h1>Quên mật khẩu</h1>
            <p className={styles.intro}>Nhập email tài khoản để nhận mã xác nhận 6 số qua email.</p>
            <form onSubmit={submitForgot} noValidate aria-label="Quên mật khẩu" aria-busy={forgotPending}>
              <div className={styles.field} data-invalid={!!forgotError}>
                <label htmlFor={`${forgotId}-email`} className={styles.visuallyHidden}>Email</label>
                <div className={styles.inputLine}><Mail size={19} strokeWidth={1.5} aria-hidden="true" /><input id={`${forgotId}-email`} name="email" type="email" value={forgotEmail} onChange={(event) => { setForgotEmail(event.target.value); setForgotError(""); setForgotMessage(""); setForgotNotice(""); }} autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="Nhập địa chỉ email" required readOnly={forgotPending} aria-invalid={!!forgotError} aria-describedby={forgotError ? `${forgotId}-email-error` : undefined} /></div>
                {forgotError && <p id={`${forgotId}-email-error`} className={styles.fieldError}>{forgotError}</p>}
              </div>
              {forgotNotice && <p role="status" className={styles.formSuccess}>{forgotNotice}</p>}
              {forgotMessage && <p role="alert" className={styles.formError}>{forgotMessage}</p>}
              {!forgotNotice ? (
                <button className={styles.submit} type="submit" disabled={forgotPending}>{forgotPending ? "ĐANG GỬI MÃ…" : "GỬI MÃ XÁC NHẬN"}</button>
              ) : (
                <Link href={resetHref} className={styles.resetLink}>Nhập mã đặt lại mật khẩu <ArrowRight size={18} aria-hidden="true" /></Link>
              )}
            </form>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={closeForgot} className={styles.backButton}><ArrowLeft size={16} aria-hidden="true" /> Quay lại đăng nhập</button>
              {forgotNotice && <button type="button" onClick={() => void sendResetCode(forgotEmail)} disabled={forgotPending} className={styles.backButton}>{forgotPending ? "Đang gửi lại…" : "Gửi lại mã"}</button>}
            </div>
          </> : <>
            <h1>{isAdmin ? "Đăng nhập quản trị" : "Cocoon chào bạn trở lại."}</h1>
            {isAdmin ? <p className={styles.intro}>Sử dụng tài khoản quản trị viên được cấp để tiếp tục.</p> : <p className={styles.intro}>Bạn chưa có tài khoản? <Link href="/register" replace scroll={false}>Tạo tài khoản</Link></p>}
            {!isAdmin && resetSuccess && !message && <p role="status" className={styles.formSuccess}>Đã đặt mật khẩu, hãy đăng nhập.</p>}
            <form ref={formRef} onSubmit={submit} noValidate aria-label={isAdmin ? "Đăng nhập quản trị viên" : "Đăng nhập Cocoon"} aria-busy={pending}>
              <div className={styles.field} data-invalid={!!errors.email}>
                <label htmlFor="login-email" className={styles.visuallyHidden}>Email</label>
                <div className={styles.inputLine}><Mail size={19} strokeWidth={1.5} aria-hidden="true" /><input id="login-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={isAdmin ? "Email quản trị viên" : "Nhập địa chỉ email"} required readOnly={pending} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} onInput={() => { setErrors((value) => ({ ...value, email: "" })); setMessage(""); }} /></div>
                {errors.email && <p id="email-error" className={styles.fieldError}>{errors.email}</p>}
              </div>
              <div className={styles.field} data-invalid={!!errors.password}>
                <label htmlFor="login-password" className={styles.visuallyHidden}>Mật khẩu</label>
                <div className={styles.inputLine}><LockKeyhole size={19} strokeWidth={1.5} aria-hidden="true" /><input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Nhập mật khẩu" required readOnly={pending} aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} onInput={() => { setErrors((value) => ({ ...value, password: "" })); setMessage(""); }} /><button type="button" className={styles.visibility} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={22} strokeWidth={1.5} /> : <Eye size={22} strokeWidth={1.5} />}</button></div>
                {errors.password && <p id="password-error" className={styles.fieldError}>{errors.password}</p>}
              </div>
              {!isAdmin && <div className={styles.forgot}><button type="button" onClick={openForgot} disabled={pending}>Quên mật khẩu?</button></div>}
              <label className={styles.remember}><input type="checkbox" name="remember" disabled={pending} onChange={(event) => {
                if (!event.target.checked) { try { localStorage.removeItem(rememberedEmailKey(portal)); } catch {} }
              }} /><span>Ghi nhớ đăng nhập</span></label>
              {message && <p role="alert" className={styles.formError}>{message}</p>}
              <button className={styles.submit} type="submit" disabled={pending}>{pending ? "ĐANG ĐĂNG NHẬP…" : isAdmin ? "ĐĂNG NHẬP QUẢN TRỊ" : "ĐĂNG NHẬP"}{isAdmin && <ArrowRight size={19} />}</button>
            </form>
            {!isAdmin && <>
              <div className={styles.social}><span>Hoặc đăng nhập bằng</span><div className={styles.socialButtons}>
                <button type="button" disabled aria-label="Đăng nhập bằng Apple — chưa khả dụng"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.1 12.3c0-2 1.6-3 1.7-3.1-1-1.5-2.5-1.7-3-1.7-1.3-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.7 1.1 8.9.7 1.1 1.6 2.2 2.8 2.1 1.1 0 1.5-.7 2.9-.7s1.8.7 3 .7 2-1 2.7-2.1c.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.7-1-2.7-3.7ZM14.8 6c.6-.8 1.1-1.9 1-3-.9.1-2 .6-2.7 1.4-.6.7-1.2 1.8-1.1 2.9 1 .1 2.1-.5 2.8-1.3Z" /></svg></button>
                <button type="button" disabled aria-label="Đăng nhập bằng Google — chưa khả dụng"><span className={styles.google}>G</span></button>
                <button type="button" disabled aria-label="Đăng nhập bằng Facebook — chưa khả dụng"><span className={styles.facebook}>f</span></button>
              </div></div>
            </>}
            {isAdmin && <p className={styles.adminNote}><LockKeyhole size={14} /> Chỉ dành cho tài khoản quản trị viên.</p>}
          </>}
        </div>
        {!isAdmin && !modal && <Link href="/" className={styles.bottomBrand} aria-label="Cocoon — Trang chủ"><Image src="/images/landing/logo.svg" alt="Cocoon Original Vietnam" width={128} height={48} /></Link>}
      </Content>
    </div>
  );
}
