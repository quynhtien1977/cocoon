"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Select } from "@base-ui/react/select";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, EyeOff, LockKeyhole, Mail, UserRound, X } from "lucide-react";
import { preferenceGroups, registerCustomer, registrationErrorMessage, validateRegistration, type Registration, type RegistrationErrors } from "./register-service";
import styles from "./login.module.css";
import registration from "./register.module.css";

const emptyValues: Registration = { fullName: "", email: "", password: "", confirmation: "" };
const fields = [
  { key: "fullName", label: "Tên của bạn", placeholder: "Nhập tên của bạn", icon: UserRound, autoComplete: "name" },
  { key: "email", label: "Email", placeholder: "Nhập địa chỉ email", icon: Mail, autoComplete: "email" },
  { key: "password", label: "Mật khẩu", placeholder: "Nhập mật khẩu", icon: LockKeyhole, autoComplete: "new-password" },
  { key: "confirmation", label: "Xác nhận mật khẩu", placeholder: "Nhập xác nhận mật khẩu", icon: LockKeyhole, autoComplete: "new-password" },
] as const;

export function RegisterForm({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<Registration>(emptyValues);
  const [selections, setSelections] = useState<Record<string, string[]>>({ skin: [], products: [], criteria: [] });
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const busy = useRef(false);
  const active = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (focusHeading.current) { heading.current?.focus(); focusHeading.current = false; }
  }, [step]);

  const move = (next: 1 | 2) => {
    focusHeading.current = true;
    setStep(next);
    setMessage("");
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current) return;
    const nextErrors = validateRegistration(values);
    setErrors(nextErrors);
    const first = fields.find((field) => nextErrors[field.key]);
    if (first) {
      setStep(1);
      requestAnimationFrame(() => (form.current?.elements.namedItem(first.key) as HTMLInputElement | null)?.focus());
      return;
    }
    if (step === 1) { move(2); return; }
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      await registerCustomer(values, Object.values(selections).flat());
      if (!active.current) return;
      setValues(emptyValues);
      setSuccess(true);
    } catch (error) { if (active.current) setMessage(registrationErrorMessage(error)); }
    finally { busy.current = false; if (active.current) setPending(false); }
  };

  return (
    <div className={styles.modalPage} data-portal="public">
      <div className={`${styles.panel} ${registration.panel}`}>
        <div className={styles.topline}><span>Xin chào thành viên mới</span><button type="button" className={styles.close} onClick={onClose} aria-label="Đóng đăng ký"><X size={24} strokeWidth={1.5} /></button></div>
        {success ? <div className={registration.success} role="status"><Check size={40} /><h1>Chào mừng bạn đến với Cocoon!</h1><p>Tài khoản khách hàng đã được tạo. Bạn có thể đăng nhập để tiếp tục.</p><Link href="/login" replace scroll={false} className={styles.submit}>ĐĂNG NHẬP <ArrowRight size={18} /></Link></div> : <>
          <h1 ref={heading} tabIndex={-1} className={registration.heading}>{step === 1 ? "Tạo tài khoản cùng Cocoon." : "Cocoon hiểu bạn hơn."}</h1>
          <p className={registration.step} aria-live="polite"><span>Bước {step}/2</span> · {step === 1 ? "Thông tin tài khoản — bắt buộc" : "Sở thích của bạn — không bắt buộc"}</p>
          <form ref={form} onSubmit={submit} onKeyDown={(event) => {
            if (step === 1 && event.key === "Enter" && !event.nativeEvent.isComposing && event.target instanceof HTMLInputElement) {
              event.preventDefault();
              event.currentTarget.requestSubmit();
            }
          }} noValidate aria-label="Đăng ký tài khoản khách hàng" aria-busy={pending} className={registration.form}>
            {step === 1 ? <div>
              {fields.map(({ key, label, placeholder, icon: Icon, autoComplete }) => {
                const password = key === "password" || key === "confirmation";
                return <div key={key} className={styles.field} data-invalid={!!errors[key]}>
                  <label className={styles.visuallyHidden} htmlFor={`register-${key}`}>{label}</label>
                  <div className={styles.inputLine}><Icon size={18} strokeWidth={1.5} aria-hidden="true" /><input id={`register-${key}`} name={key} type={password ? showPassword ? "text" : "password" : key === "email" ? "email" : "text"} value={values[key]} onChange={(event) => { setValues((previous) => ({ ...previous, [key]: event.target.value })); setErrors((previous) => ({ ...previous, [key]: undefined })); }} autoComplete={autoComplete} placeholder={placeholder} required aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${key}-error` : password ? "register-password-help" : undefined} />
                    {key === "password" && <button type="button" className={styles.visibility} aria-label={showPassword ? "Ẩn mật khẩu đăng ký" : "Hiện mật khẩu đăng ký"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>}
                  </div>
                  {errors[key] && <span id={`${key}-error`} className={styles.visuallyHidden}>{errors[key]}</span>}
                </div>;
              })}
              <p id="register-password-help" className={registration.help}>Mật khẩu từ 8 ký tự, gồm chữ hoa, chữ thường và số.</p>
              {Object.values(errors).find(Boolean) && <p role="alert" className={styles.fieldError}>{Object.values(errors).find(Boolean)}</p>}
            </div> : <div className={registration.preferences}>
              <p className={registration.help}>Chọn một hoặc nhiều mục ở mỗi nhóm, hoặc để trống để tiếp tục.</p>
              {preferenceGroups.map((group) => <div key={group.key} className={registration.preference}>
                <span id={`preference-${group.key}`} className={registration.label}>{group.label}</span>
                <Select.Root multiple value={selections[group.key]} onValueChange={(value) => { setSelections((previous) => ({ ...previous, [group.key]: value })); setMessage(""); }} disabled={pending}>
                  <Select.Trigger className={registration.trigger} aria-labelledby={`preference-${group.key}`}><span>{selections[group.key].length ? `Đã chọn ${selections[group.key].length} mục` : "Chọn sở thích của bạn"}</span><Select.Icon><ChevronDown size={18} /></Select.Icon></Select.Trigger>
                  <Select.Portal><Select.Positioner className={registration.positioner} sideOffset={6} align="start" alignItemWithTrigger={false} collisionPadding={12}>
                    <Select.Popup className={registration.dropdown}><Select.List>
                      {group.options.map((option) => <Select.Item key={option.key} value={option.key} label={option.label} className={registration.option}><span className={registration.check}><Select.ItemIndicator><Check size={14} /></Select.ItemIndicator></span><Select.ItemText><span>{option.label}</span>{"detail" in option && <small>{option.detail}</small>}<small>{option.english}</small></Select.ItemText></Select.Item>)}
                    </Select.List></Select.Popup>
                  </Select.Positioner></Select.Portal>
                </Select.Root>
              </div>)}
              {Object.values(selections).some((items) => items.length) && <button type="button" className={registration.clear} disabled={pending} onClick={() => { setSelections({ skin: [], products: [], criteria: [] }); setMessage(""); }}>Bỏ tất cả lựa chọn</button>}
            </div>}
            {message && <p className={styles.formError} role="alert">{message}</p>}
            <div className={registration.actions}>
              {step === 1 ? <><span className={registration.help}>Tiếp theo: sở thích của bạn</span><button type="submit" className={registration.arrow} aria-label="Sang bước 2: Sở thích"><ArrowRight size={22} /></button></> : <><button type="button" className={registration.arrow} disabled={pending} onClick={() => move(1)} aria-label="Quay lại bước 1: Thông tin tài khoản"><ArrowLeft size={22} /></button><button type="submit" className={styles.submit} disabled={pending}>{pending ? "ĐANG ĐĂNG KÝ…" : "ĐĂNG KÝ TÀI KHOẢN"}</button></>}
            </div>
          </form>
          <p className={registration.login}>Bạn đã có tài khoản? <Link href="/login" replace scroll={false}>Đăng nhập</Link></p>
        </>}
      </div>
    </div>
  );
}
