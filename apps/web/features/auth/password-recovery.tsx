"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, LockKeyhole, Mail } from "lucide-react";
import { ApiError } from "../../lib/api/client";
import { requestPasswordCode, resetPassword, validateCode, validateEmail, validateNewPassword, verifyPasswordCode } from "./password-reset-service";
import styles from "./login.module.css";

type Step = "email" | "code" | "password";
type Field = "email" | "code" | "newPassword" | "confirmPassword";

const offline = "Mất kết nối. Kiểm tra mạng rồi thử lại.";
const failure = (error: unknown) => error instanceof ApiError ? error.message : offline;

/** A full page load, so /login opens over the landing page instead of stacking on this dialog. */
const loadPage = (url: string) => window.location.assign(url);

/** The login form shows "Đã đặt mật khẩu" and fills the email from these parameters. */
export const loginAfterReset = (email: string) => `/login?reset=1&email=${encodeURIComponent(email.trim())}`;

const titles: Record<Step, string> = { email: "Quên mật khẩu", code: "Nhập mã xác nhận", password: "Đặt mật khẩu mới" };
const actions: Record<Step, [idle: string, busy: string]> = {
  email: ["GỬI MÃ XÁC NHẬN", "ĐANG GỬI MÃ…"],
  code: ["XÁC NHẬN MÃ", "ĐANG KIỂM TRA…"],
  password: ["ĐẶT MẬT KHẨU MỚI", "ĐANG ĐẶT MẬT KHẨU…"],
};

export interface PasswordRecoveryProps {
  initialEmail?: string;
  /** The link in the email already names the account, so it opens on the code step. */
  startAtCode?: boolean;
  /** Back to the login form in the same panel; without it the link loads /login. */
  onBack?: () => void;
  navigate?: (url: string) => void;
}

/**
 * Three steps in one panel: email → 6-digit code, checked by the API before going on → new password twice.
 * The email step never says whether the address has an account.
 */
export function PasswordRecovery({ initialEmail = "", startAtCode = false, onBack, navigate = loadPage }: PasswordRecoveryProps) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const activeRef = useRef(true);
  const busyRef = useRef(false);
  const movedRef = useRef(false);
  const [step, setStep] = useState<Step>(startAtCode && !validateEmail(initialEmail) ? "code" : "email");
  const [email, setEmail] = useState(initialEmail.trim());
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState("");
  const [passwords, setPasswords] = useState({ newPassword: "", confirmPassword: "" });
  const [visible, setVisible] = useState({ newPassword: false, confirmPassword: false });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState<"" | "submit" | "resend">("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  // Each new step puts the cursor in its first field; the first render leaves focus to the dialog.
  useEffect(() => {
    if (!movedRef.current) { movedRef.current = true; return; }
    formRef.current?.querySelector<HTMLInputElement>("input:not([readonly])")?.focus();
  }, [step]);

  const goTo = (next: Step) => { setErrors({}); setProblem(""); setStep(next); };
  const focus = (field: Field) => (formRef.current?.elements.namedItem(field) as HTMLInputElement | null)?.focus();
  const invalid = (field: Field, message: string) => { setErrors({ [field]: message }); focus(field); };

  async function run(kind: "submit" | "resend", work: () => Promise<void>, onError: (error: unknown) => void) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(kind);
    setProblem("");
    try { await work(); }
    catch (error) { if (activeRef.current) onError(error); }
    finally {
      busyRef.current = false;
      if (activeRef.current) setBusy("");
    }
  }

  const sendCode = (kind: "submit" | "resend") => {
    const emailError = validateEmail(email);
    if (emailError) { goTo("email"); setErrors({ email: emailError }); return; }
    void run(kind, async () => {
      const message = await requestPasswordCode(email);
      if (!activeRef.current) return;
      setNotice(message);
      setCode("");
      goTo("code");
    }, (error) => setProblem(failure(error)));
  };

  const checkCode = () => {
    const codeError = validateCode(code);
    if (codeError) { invalid("code", codeError); return; }
    void run("submit", async () => {
      const result = await verifyPasswordCode(email, code);
      if (!activeRef.current) return;
      setTicket(result.ticket);
      setNotice("");
      goTo("password");
    }, (error) => {
      if (error instanceof ApiError && error.code === "INVALID_CODE") invalid("code", error.message);
      else setProblem(failure(error));
    });
  };

  const savePassword = () => {
    const found = validateNewPassword(passwords);
    setErrors(found);
    if (found.newPassword || found.confirmPassword) { focus(found.newPassword ? "newPassword" : "confirmPassword"); return; }
    void run("submit", async () => {
      await resetPassword(ticket, passwords.newPassword);
      if (!activeRef.current) return;
      setDone(true);
      navigate(loginAfterReset(email));
    }, (error) => {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") invalid("newPassword", error.errors.newPassword?.[0] ?? error.message);
      else if (error instanceof ApiError && error.code === "RESET_EXPIRED") {
        // The ticket died (too old, or a newer code was sent): ask for the code again, keep the typed passwords.
        setTicket("");
        setCode("");
        goTo("code");
        setProblem(error.message);
      } else setProblem(failure(error));
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === "email") sendCode("submit");
    else if (step === "code") checkCode();
    else savePassword();
  };

  const describedBy = (field: Field, hint?: boolean) => errors[field] ? `${id}-${field}-error` : hint ? `${id}-${field}-hint` : undefined;
  const fieldError = (field: Field) => errors[field] && <p id={`${id}-${field}-error`} className={styles.fieldError}>{errors[field]}</p>;
  const clear = (field: Field) => { setErrors((current) => ({ ...current, [field]: undefined })); setProblem(""); };

  const passwordField = (field: "newPassword" | "confirmPassword", label: string) => (
    <div className={styles.field} data-invalid={!!errors[field]}>
      <label htmlFor={`${id}-${field}`} className={styles.visuallyHidden}>{label}</label>
      <div className={styles.inputLine}>
        <LockKeyhole size={19} strokeWidth={1.5} aria-hidden="true" />
        <input id={`${id}-${field}`} name={field} type={visible[field] ? "text" : "password"} autoComplete="new-password" maxLength={128}
          placeholder={label} value={passwords[field]} required readOnly={busy !== "" || done} aria-invalid={!!errors[field]}
          aria-describedby={describedBy(field, field === "newPassword")}
          onChange={(event) => { setPasswords((current) => ({ ...current, [field]: event.target.value })); clear(field); }} />
        <button type="button" className={styles.visibility} aria-label={visible[field] ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}
          aria-pressed={visible[field]} onClick={() => setVisible((current) => ({ ...current, [field]: !current[field] }))}>
          {visible[field] ? <EyeOff size={22} strokeWidth={1.5} /> : <Eye size={22} strokeWidth={1.5} />}
        </button>
      </div>
      {fieldError(field) ?? (field === "newPassword" && <p id={`${id}-newPassword-hint`} className={styles.formHint}>8–128 ký tự, gồm cả chữ và số.</p>)}
    </div>
  );

  const [idle, working] = actions[step];

  return (
    <>
      <h1>{titles[step]}</h1>
      <p className={styles.intro}>
        {step === "email" && "Nhập email tài khoản, Cocoon sẽ gửi mã xác nhận 6 chữ số tới hộp thư của bạn."}
        {step === "code" && <>Nhập mã 6 chữ số trong email gửi tới <strong className="wrap-anywhere">{email}</strong>.</>}
        {step === "password" && <>Mã đã đúng. Chọn mật khẩu mới cho <strong className="wrap-anywhere">{email}</strong>.</>}
      </p>
      {notice && step === "code" && <p role="status" className={styles.formSuccess}>{notice}</p>}
      <form ref={formRef} onSubmit={submit} noValidate aria-label={titles[step]} aria-busy={busy !== ""}>
        {step === "email" && (
          <div className={styles.field} data-invalid={!!errors.email}>
            <label htmlFor={`${id}-email`} className={styles.visuallyHidden}>Email</label>
            <div className={styles.inputLine}>
              <Mail size={19} strokeWidth={1.5} aria-hidden="true" />
              <input id={`${id}-email`} name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
                placeholder="Nhập địa chỉ email" value={email} required readOnly={busy !== ""} aria-invalid={!!errors.email}
                aria-describedby={describedBy("email")} onChange={(event) => { setEmail(event.target.value); clear("email"); }} />
            </div>
            {fieldError("email")}
          </div>
        )}
        {step === "code" && <>
          <div className={styles.field} data-invalid={!!errors.code}>
            <label htmlFor={`${id}-code`} className={styles.visuallyHidden}>Mã xác nhận (6 chữ số)</label>
            <div className={styles.inputLine}>
              <KeyRound size={19} strokeWidth={1.5} aria-hidden="true" />
              <input id={`${id}-code`} name="code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                placeholder="Nhập mã 6 chữ số" value={code} required readOnly={busy !== ""} aria-invalid={!!errors.code}
                aria-describedby={describedBy("code")} onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); clear("code"); }} />
            </div>
            {fieldError("code")}
          </div>
          <div className={styles.resendRow}>
            <button type="button" disabled={busy !== ""} onClick={() => sendCode("resend")}>{busy === "resend" ? "Đang gửi lại mã…" : "Gửi lại mã"}</button>
          </div>
        </>}
        {step === "password" && <>
          {passwordField("newPassword", "Mật khẩu mới")}
          {passwordField("confirmPassword", "Nhập lại mật khẩu mới")}
        </>}
        {problem && <p role="alert" className={styles.formError}>{problem}</p>}
        {done
          ? <p role="status" className={styles.formSuccess}>Đã đặt mật khẩu, đang chuyển sang đăng nhập…</p>
          : <button className={styles.submit} type="submit" disabled={busy !== ""}>{busy === "submit" ? working : idle}</button>}
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {onBack
          ? <button type="button" onClick={onBack} className={styles.backButton}><ArrowLeft size={16} aria-hidden="true" /> Quay lại đăng nhập</button>
          // Full load: a soft visit to /login from the reset dialog would stack the login dialog on it.
          : <a href="/login" className={styles.backButton}><ArrowLeft size={16} aria-hidden="true" /> Quay lại đăng nhập</a>}
        {step === "code" && <button type="button" onClick={() => goTo("email")} disabled={busy !== ""} className={styles.backButton}>Đổi email</button>}
      </div>
    </>
  );
}
