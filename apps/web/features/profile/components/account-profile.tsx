"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { CircleCheck, KeyRound, LoaderCircle, ShieldAlert, UserRound } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { roleLabels } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { changeMyPassword, loadMyProfile, saveMyProfile } from "../api";
import { validatePasswordDraft, validateProfileDraft } from "../schemas";
import type { PasswordDraft, ProfileDraft, StaffProfile } from "../types";

const fieldClass = "min-h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive read-only:bg-muted read-only:text-muted-foreground";
const labelClass = "font-label text-sm uppercase tracking-wider";
const card = "min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6";
const emptyPassword: PasswordDraft = { currentPassword: "", newPassword: "", confirmPassword: "" };

const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "?";
const failure = (reason: unknown) => reason instanceof ApiError ? reason.message : "Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={labelClass}>{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function ProfileForm({ profile, onSaved }: { profile: StaffProfile; onSaved: (draft: ProfileDraft) => void }) {
  const id = useId();
  const saved: ProfileDraft = { fullName: profile.fullName, phone: profile.phone ?? "" };
  const [draft, setDraft] = useState(saved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const dirty = draft.fullName !== saved.fullName || draft.phone !== saved.phone;
  const update = (patch: Partial<ProfileDraft>) => { setDraft((current) => ({ ...current, ...patch })); setStatus("idle"); setProblem(null); };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateProfileDraft(draft);
    setErrors(found);
    if (Object.keys(found).length || status === "saving") return;
    if (!dirty) { setProblem("Chưa có thay đổi nào để lưu."); return; }
    setStatus("saving");
    try {
      await saveMyProfile(draft);
      const trimmed = { fullName: draft.fullName.trim(), phone: draft.phone.trim() };
      setDraft(trimmed);
      onSaved(trimmed);
      setStatus("saved");
    } catch (reason) {
      setProblem(failure(reason));
      setStatus("idle");
    }
  }

  const describedBy = (name: string, hint = false) => errors[name] ? `${id}-${name}-error` : hint ? `${id}-${name}-hint` : undefined;

  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${id}-title`} className={cn(card, "space-y-5")}>
      <h2 id={`${id}-title`} className="flex items-center gap-2 border-b border-border pb-3 font-heading text-xl"><UserRound className="size-5 text-gold-strong" aria-hidden="true" />Thông tin cá nhân</h2>
      <Field id={`${id}-fullName`} label="Họ và tên" error={errors.fullName}>
        <input id={`${id}-fullName`} value={draft.fullName} maxLength={150} required autoComplete="name" onChange={(event) => update({ fullName: event.target.value })} aria-invalid={!!errors.fullName} aria-describedby={describedBy("fullName")} className={fieldClass} />
      </Field>
      <Field id={`${id}-phone`} label="Số điện thoại" error={errors.phone} hint="Không bắt buộc.">
        <input id={`${id}-phone`} type="tel" inputMode="tel" value={draft.phone} maxLength={32} autoComplete="tel" onChange={(event) => update({ phone: event.target.value })} aria-invalid={!!errors.phone} aria-describedby={describedBy("phone", true)} className={fieldClass} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${id}-email`} label="Email đăng nhập" hint="Liên hệ quản trị viên để đổi email.">
          <input id={`${id}-email`} value={profile.email} readOnly aria-describedby={`${id}-email-hint`} className={fieldClass} />
        </Field>
        <Field id={`${id}-role`} label="Vai trò" hint="Vai trò do quản trị viên phân quyền.">
          <input id={`${id}-role`} value={roleLabels[profile.role]} readOnly aria-describedby={`${id}-role-hint`} className={fieldClass} />
        </Field>
      </div>
      <div aria-live="polite" className="text-sm empty:hidden">
        {problem ? <p role="alert" className="text-destructive">{problem}</p> : status === "saved" ? <p className="flex items-center gap-2 text-status-sage-fg"><CircleCheck className="size-4" aria-hidden="true" />Đã lưu thông tin cá nhân.</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
        <Button type="button" variant="ghost" className="h-12 px-4" onClick={() => { setDraft(saved); setErrors({}); setProblem(null); setStatus("idle"); }}>Hoàn tác</Button>
        <Button type="submit" className="h-12 px-6" aria-busy={status === "saving"}>{status === "saving" ? <><LoaderCircle className="animate-spin" aria-hidden="true" />Đang lưu…</> : "Lưu thay đổi"}</Button>
      </div>
    </form>
  );
}

function PasswordForm({ loginHref, required }: { loginHref: string; required: boolean }) {
  const id = useId();
  const [draft, setDraft] = useState(emptyPassword);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const update = (patch: Partial<PasswordDraft>) => { setDraft((current) => ({ ...current, ...patch })); setProblem(null); };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validatePasswordDraft(draft);
    setErrors(found);
    if (Object.keys(found).length || pending) return;
    setPending(true);
    try {
      await changeMyPassword(draft);
      setDone(true);
      setDraft(emptyPassword);
    } catch (reason) {
      // Field errors (wrong current password, weak new password) come back keyed by field name.
      if (reason instanceof ApiError && Object.keys(reason.errors).length) setErrors(Object.fromEntries(Object.entries(reason.errors).map(([field, messages]) => [field, messages[0]])));
      else setProblem(failure(reason));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <section role="status" aria-labelledby={`${id}-done`} className={cn(card, "space-y-3")}>
        <h2 id={`${id}-done`} className="flex items-center gap-2 font-heading text-xl"><CircleCheck className="size-5 text-status-sage-fg" aria-hidden="true" />Đã đổi mật khẩu</h2>
        <p className="text-sm text-muted-foreground">Phiên đăng nhập đã kết thúc trên mọi thiết bị. Đăng nhập lại bằng mật khẩu mới để tiếp tục.</p>
        <a href={loginHref} className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-ring">Đăng nhập lại</a>
      </section>
    );
  }

  const describedBy = (name: string, hint = false) => errors[name] ? `${id}-${name}-error` : hint ? `${id}-${name}-hint` : undefined;
  const input = (name: keyof PasswordDraft, autoComplete: string, hint = false) => (
    <input id={`${id}-${name}`} type="password" value={draft[name]} autoComplete={autoComplete} maxLength={128} required onChange={(event) => update({ [name]: event.target.value })} aria-invalid={!!errors[name]} aria-describedby={describedBy(name, hint)} className={fieldClass} />
  );

  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${id}-title`} className={cn(card, "space-y-5", required && "border-status-danger-fg")}>
      <h2 id={`${id}-title`} className="flex items-center gap-2 border-b border-border pb-3 font-heading text-xl"><KeyRound className="size-5 text-gold-strong" aria-hidden="true" />Đổi mật khẩu</h2>
      <Field id={`${id}-currentPassword`} label="Mật khẩu hiện tại" error={errors.currentPassword}>{input("currentPassword", "current-password")}</Field>
      <Field id={`${id}-newPassword`} label="Mật khẩu mới" error={errors.newPassword} hint="8–128 ký tự, có cả chữ và số.">{input("newPassword", "new-password", true)}</Field>
      <Field id={`${id}-confirmPassword`} label="Nhập lại mật khẩu mới" error={errors.confirmPassword}>{input("confirmPassword", "new-password")}</Field>
      <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">Sau khi đổi, bạn sẽ được đăng xuất khỏi mọi thiết bị và cần đăng nhập lại.</p>
      {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" className="h-12 px-6" aria-busy={pending}>{pending ? <><LoaderCircle className="animate-spin" aria-hidden="true" />Đang đổi…</> : "Đổi mật khẩu"}</Button>
      </div>
    </form>
  );
}

export interface AccountProfileProps {
  /** Screen code shown as the page eyebrow. */
  code: string;
  /** Where to sign in again after a password change: /admin/login for admins, /login otherwise. */
  loginHref: string;
  /** Passed in by the route because features/profile must not import features/auth. */
  logout?: ReactNode;
}

/** Profile for internal accounts (Admin, Manager, Staff): edit name and phone, change password, sign out. */
export function AccountProfile({ code, loginHref, logout }: AccountProfileProps) {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    loadMyProfile(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setProfile(data); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(failure(reason)); });
    return () => controller.abort();
  }, [attempt]);

  if (!profile) {
    return (
      <>
        <PageHeader eyebrow={code} title="Hồ sơ cá nhân" />
        {error ? (
          <div role="alert" className={cn(card, "space-y-3")}>
            <p className="font-semibold">Chưa tải được hồ sơ.</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button type="button" variant="outline" className="h-12 px-4" onClick={() => { setError(null); setAttempt((value) => value + 1); }}>Thử lại</Button>
          </div>
        ) : <div role="status" className="space-y-4"><span className="sr-only">Đang tải hồ sơ</span><Skeleton className="h-28 w-full" /><Skeleton className="h-80 w-full" /></div>}
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow={code} title="Hồ sơ cá nhân" description="Cập nhật thông tin liên hệ và mật khẩu đăng nhập của bạn." actions={logout} />
      <section aria-label="Tài khoản" className={cn(card, "mb-6 flex flex-wrap items-center gap-4")}>
        <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-secondary font-heading text-2xl text-secondary-foreground">{initials(profile.fullName)}</span>
        {/* min-w-48 wraps the role badge onto its own line on phones instead of squeezing the email. */}
        <div className="min-w-48 flex-1">
          <p className="font-heading text-2xl break-words">{profile.fullName || "Chưa đặt tên"}</p>
          <p className="text-sm break-all text-muted-foreground">{profile.email}</p>
        </div>
        <span className="rounded-sm bg-status-beige-bg px-3 py-1 font-label text-sm uppercase tracking-wider text-status-beige-fg">{roleLabels[profile.role]}</span>
      </section>
      {profile.mustChangePassword && (
        <p role="alert" className="mb-6 flex gap-2 rounded-md border border-status-danger-fg bg-status-danger-bg p-4 text-sm text-status-danger-fg">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Bạn đang dùng mật khẩu tạm do quản trị viên cấp. Hãy đổi mật khẩu ngay bên dưới.
        </p>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ProfileForm profile={profile} onSaved={(draft) => setProfile((current) => current && { ...current, fullName: draft.fullName, phone: draft.phone || null })} />
        <PasswordForm loginHref={loginHref} required={profile.mustChangePassword} />
      </div>
    </>
  );
}
