"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { CircleCheck, KeyRound, LoaderCircle, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { roleLabels } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { changeMyPassword, loadLastLogin, loadManagerStats, loadMyProfile, loadStaffStats, saveMyProfile } from "../api";
import { validatePasswordDraft, validateProfileDraft } from "../schemas";
import type { PasswordDraft, ProfileDraft, StaffProfile } from "../types";

export type ProfileVariant = "staff" | "manager" | "admin";

const fieldClass = "min-h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive read-only:cursor-not-allowed read-only:bg-muted read-only:text-muted-foreground";
const labelClass = "font-label text-sm uppercase tracking-wider";
const card = "min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6";
const emptyPassword: PasswordDraft = { currentPassword: "", newPassword: "", confirmPassword: "" };
const dateTime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });

/** Copy from the Stitch S3, M15 and A4 screens. */
const variants = {
  staff: {
    loginHref: "/login", prefix: "STF",
    title: "Hồ sơ Nhân viên Chăm sóc khách hàng", description: "Thông tin cá nhân và liên hệ công vụ của nhân viên Cocoon.",
    section: "Thông tin định danh nhân sự", note: "Cập nhật họ tên và số điện thoại liên lạc",
    codeLabel: "Mã nhân viên", emailLabel: "Email nội bộ", phoneLabel: "Số điện thoại liên lạc", reset: "Hủy thay đổi", save: "Lưu thông tin hồ sơ",
  },
  manager: {
    loginHref: "/login", prefix: "MGR",
    title: "Hồ sơ Quản lý CRM", description: "Thông tin trưởng nhóm điều phối chăm sóc khách hàng và giám sát chất lượng.",
    section: "Thông tin cá nhân & Liên hệ công vụ", note: "Cập nhật thông tin phối hợp liên bộ phận",
    codeLabel: "Mã quản lý", emailLabel: "Email công tác", phoneLabel: "Số điện thoại trực", reset: "Hủy chỉnh sửa", save: "Cập nhật hồ sơ",
  },
  admin: {
    loginHref: "/admin/login", prefix: "ADM",
    title: "Hồ sơ quản trị viên", description: "Thông tin tài khoản công vụ của quản trị viên hệ thống Cocoon CRM.",
    section: "Thông tin công vụ", note: "Chỉ cập nhật thông tin liên hệ hành chính",
    codeLabel: "Mã cán bộ quản trị", emailLabel: "Email công vụ", phoneLabel: "Số điện thoại nội bộ", reset: "Khôi phục mặc định", save: "Lưu cập nhật thông tin",
  },
} satisfies Record<ProfileVariant, Record<string, string>>;

type Copy = (typeof variants)[ProfileVariant];
type Stat = { label: string; value: number | null };

const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "?";
const failure = (reason: unknown) => reason instanceof ApiError ? reason.message : "Mất kết nối. Kiểm tra mạng rồi thử lại.";
/** Display code derived from the account id, like the API's KH-0001 for customers; accounts have no stored staff code. */
export const staffCode = (prefix: string, id: number) => `${prefix}-${String(id).padStart(4, "0")}`;

function Field({ id, label, error, hint, className, children }: { id: string; label: string; error?: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <label htmlFor={id} className={labelClass}>{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function SummaryCard({ profile, code, rows, stats }: { profile: StaffProfile; code: string; rows: [string, string][]; stats: Stat[] }) {
  return (
    <section aria-label="Tóm tắt tài khoản" className={cn(card, "flex flex-col items-center text-center")}>
      <span aria-hidden="true" className="mb-4 flex size-20 items-center justify-center rounded-full border-2 border-border bg-primary font-heading text-3xl text-primary-foreground">{initials(profile.fullName)}</span>
      <p className="font-heading text-xl break-words">{profile.fullName || "Chưa đặt tên"}</p>
      <span className="mt-1 rounded-sm bg-status-beige-bg px-3 py-0.5 font-label text-sm uppercase tracking-wider text-status-beige-fg">{roleLabels[profile.role]}</span>
      <dl className="mt-4 w-full space-y-2 border-t border-border pt-4 text-left text-sm">
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Mã:</dt><dd className="font-semibold">#{code}</dd></div>
        {rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="shrink-0 text-muted-foreground">{label}:</dt><dd className="min-w-0 text-right font-semibold wrap-anywhere">{value}</dd></div>)}
      </dl>
      {stats.length > 0 && (
        <dl className="mt-4 grid w-full grid-cols-2 gap-3 border-t border-dashed border-border pt-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-md border border-border bg-muted p-3">
              <dd className="font-heading text-xl lining-nums tabular-nums">{stat.value ?? "—"}</dd>
              <dt className="mt-0.5 font-label text-xs uppercase tracking-wider text-muted-foreground">{stat.label}</dt>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function ProfileForm({ profile, code, copy, onSaved }: { profile: StaffProfile; code: string; copy: Copy; onSaved: (draft: ProfileDraft) => void }) {
  const id = useId();
  const saved: ProfileDraft = { fullName: profile.fullName, phone: profile.phone ?? "" };
  const [draft, setDraft] = useState(saved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const phoneRequired = profile.role === "Manager";
  const dirty = draft.fullName !== saved.fullName || draft.phone !== saved.phone;
  const update = (patch: Partial<ProfileDraft>) => { setDraft((current) => ({ ...current, ...patch })); setStatus("idle"); setProblem(null); };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateProfileDraft(draft, phoneRequired);
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
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-3">
        <h2 id={`${id}-title`} className="font-heading text-xl">{copy.section}</h2>
        <p className="text-xs text-muted-foreground">* {copy.note}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${id}-fullName`} label="Họ và tên" error={errors.fullName}>
          <input id={`${id}-fullName`} value={draft.fullName} maxLength={150} required autoComplete="name" onChange={(event) => update({ fullName: event.target.value })} aria-invalid={!!errors.fullName} aria-describedby={describedBy("fullName")} className={fieldClass} />
        </Field>
        <Field id={`${id}-code`} label={copy.codeLabel}>
          <input id={`${id}-code`} value={code} readOnly className={fieldClass} />
        </Field>
        <Field id={`${id}-email`} label={copy.emailLabel} hint="Liên hệ quản trị viên để đổi email.">
          <input id={`${id}-email`} value={profile.email} readOnly aria-describedby={`${id}-email-hint`} className={fieldClass} />
        </Field>
        <Field id={`${id}-phone`} label={copy.phoneLabel} error={errors.phone} hint={phoneRequired ? "Bắt buộc với tài khoản quản lý." : "Không bắt buộc."}>
          <input id={`${id}-phone`} type="tel" inputMode="tel" value={draft.phone} maxLength={32} required={phoneRequired} autoComplete="tel" onChange={(event) => update({ phone: event.target.value })} aria-invalid={!!errors.phone} aria-describedby={describedBy("phone", true)} className={fieldClass} />
        </Field>
      </div>
      <div aria-live="polite" className="text-sm empty:hidden">
        {problem ? <p role="alert" className="text-destructive">{problem}</p> : status === "saved" ? <p className="flex items-center gap-2 text-status-sage-fg"><CircleCheck className="size-4" aria-hidden="true" />Đã lưu thông tin hồ sơ.</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
        <Button type="button" variant="outline" className="h-12 px-4" onClick={() => { setDraft(saved); setErrors({}); setProblem(null); setStatus("idle"); }}>{copy.reset}</Button>
        <Button type="submit" className="h-12 px-6" aria-busy={status === "saving"}>{status === "saving" ? <><LoaderCircle className="animate-spin" aria-hidden="true" />Đang lưu…</> : copy.save}</Button>
      </div>
    </form>
  );
}

/** forced: the account still has the temporary password an admin issued. */
function PasswordForm({ loginHref, forced }: { loginHref: string; forced: boolean }) {
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
    <form onSubmit={submit} noValidate aria-labelledby={`${id}-title`} className={cn(card, "space-y-5", forced && "border-status-danger-fg")}>
      <h2 id={`${id}-title`} className="flex items-center gap-2 border-b border-border pb-3 font-heading text-xl"><KeyRound className="size-5 text-gold-strong" aria-hidden="true" />{forced ? "Đổi mật khẩu tạm" : "Đổi mật khẩu"}</h2>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field id={`${id}-currentPassword`} label="Mật khẩu hiện tại" error={errors.currentPassword}>{input("currentPassword", "current-password")}</Field>
        <Field id={`${id}-newPassword`} label="Mật khẩu mới" error={errors.newPassword} hint="8–128 ký tự, có cả chữ và số.">{input("newPassword", "new-password", true)}</Field>
        <Field id={`${id}-confirmPassword`} label="Nhập lại mật khẩu mới" error={errors.confirmPassword}>{input("confirmPassword", "new-password")}</Field>
      </div>
      <p className="text-sm text-muted-foreground">Sau khi đổi, bạn sẽ được đăng xuất khỏi mọi thiết bị và cần đăng nhập lại.</p>
      {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" className="h-12 px-6" aria-busy={pending}>{pending ? <><LoaderCircle className="animate-spin" aria-hidden="true" />Đang đổi…</> : "Đổi mật khẩu"}</Button>
      </div>
    </form>
  );
}

/** Password card for pages outside this module (the customer profile); the route composes it so features stay separate. */
export function MyPasswordSection({ loginHref }: { loginHref: string }) {
  const [forced, setForced] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    loadMyProfile(controller.signal).then((me) => setForced(me.mustChangePassword === true)).catch(() => undefined);
    return () => controller.abort();
  }, []);
  return (
    <div className="space-y-4">
      {forced && (
        <p role="alert" className="flex gap-2 rounded-md border border-status-danger-fg bg-status-danger-bg p-4 text-sm text-status-danger-fg">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Bạn đang dùng mật khẩu tạm. Hãy đổi mật khẩu để dùng đầy đủ tài khoản.
        </p>
      )}
      <PasswordForm loginHref={loginHref} forced={forced} />
    </div>
  );
}

/** Extra figures for the summary card; each fails on its own and shows "—" rather than blocking the page. */
const statLabels: Record<ProfileVariant, string[]> = {
  staff: ["Đã giải quyết", "Đang xử lý"],
  manager: ["Phản hồi đã đóng", "Khảo sát đang mở"],
  admin: [],
};

function useSummary(variant: ProfileVariant, profile: StaffProfile | null) {
  const [values, setValues] = useState<(number | null)[]>([null, null]);
  const [lastLogin, setLastLogin] = useState<string | null | undefined>(undefined);
  const accountId = profile?.id;
  const email = profile?.email;
  useEffect(() => {
    if (accountId === undefined || email === undefined) return;
    const controller = new AbortController();
    const live = () => !controller.signal.aborted;
    if (variant === "staff") loadStaffStats(controller.signal).then((data) => live() && setValues([data.resolved, data.inProgress])).catch(() => {});
    else if (variant === "manager") loadManagerStats(controller.signal).then((data) => live() && setValues([data.closedFeedback, data.openSurveys])).catch(() => {});
    else loadLastLogin({ id: accountId, email }, controller.signal).then((value) => live() && setLastLogin(value)).catch(() => live() && setLastLogin(null));
    return () => controller.abort();
  }, [variant, accountId, email]);
  const stats: Stat[] = statLabels[variant].map((label, index) => ({ label, value: values[index] ?? null }));
  return { stats, lastLogin };
}

export interface AccountProfileProps {
  variant: ProfileVariant;
  /** Passed in by the route because features/profile must not import features/auth. */
  logout?: ReactNode;
}

/** Profile for internal accounts (Stitch S3, M15, A4): summary card, contact form, and a temporary-password form when required. */
export function AccountProfile({ variant, logout }: AccountProfileProps) {
  const copy = variants[variant];
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { stats, lastLogin } = useSummary(variant, profile);

  useEffect(() => {
    const controller = new AbortController();
    loadMyProfile(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setProfile(data); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(failure(reason)); });
    return () => controller.abort();
  }, [attempt]);

  const header = <PageHeader title={copy.title} description={copy.description} actions={profile ? logout : undefined} />;

  if (!profile) {
    return (
      <>
        {header}
        {error ? (
          <div role="alert" className={cn(card, "space-y-3")}>
            <p className="font-semibold">Chưa tải được hồ sơ.</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button type="button" variant="outline" className="h-12 px-4" onClick={() => { setError(null); setAttempt((value) => value + 1); }}>Thử lại</Button>
          </div>
        ) : <div role="status" className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]"><span className="sr-only">Đang tải hồ sơ</span><Skeleton className="h-80 w-full" /><Skeleton className="h-80 w-full" /></div>}
      </>
    );
  }

  const code = staffCode(copy.prefix, profile.id);
  const rows: [string, string][] = variant === "admin"
    ? [["Đăng nhập gần nhất", lastLogin === undefined ? "Đang tải…" : lastLogin ? dateTime.format(new Date(lastLogin)) : "—"]]
    : [["Email", profile.email]];

  return (
    <>
      {header}
      {profile.mustChangePassword && (
        <p role="alert" className="mb-6 flex gap-2 rounded-md border border-status-danger-fg bg-status-danger-bg p-4 text-sm text-status-danger-fg">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Bạn đang dùng mật khẩu tạm do quản trị viên cấp. Hãy đổi mật khẩu ở cuối trang trước khi tiếp tục làm việc.
        </p>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SummaryCard profile={profile} code={code} rows={rows} stats={stats} />
        <div className="min-w-0 space-y-6">
          <ProfileForm profile={profile} code={code} copy={copy} onSaved={(draft) => setProfile((current) => current && { ...current, fullName: draft.fullName, phone: draft.phone || null })} />
          <PasswordForm loginHref={copy.loginHref} forced={profile.mustChangePassword} />
        </div>
      </div>
    </>
  );
}
