"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { CircleCheck, Info, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import type { AccountRole } from "@/lib/auth/roles";
import { screen } from "@/lib/screens";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { createAccount, type AccountCreated } from "../api";
import { assignableRoles, roleLabels, roleSummaries, validateAccountDraft } from "../schemas";
import type { AccountDraft } from "../types";

const fieldClass = "min-h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive";
const labelClass = "font-label text-sm uppercase tracking-wider";
const emptyDraft: AccountDraft = { fullName: "", email: "", role: "Staff" };
const draftFields = new Set(["fullName", "email", "role"]);

export function AccountCreateForm() {
  const s = screen("A2");
  const id = useId();
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<AccountCreated | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const update = (patch: Partial<AccountDraft>) => { setDraft((current) => ({ ...current, ...patch })); setCreated(null); setSubmitError(null); };
  const summary = roleSummaries[draft.role];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const found = validateAccountDraft(draft);
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length) { setCreated(null); return; }
    setSubmitting(true);
    try {
      setCreated(await createAccount(draft));
      setDraft(emptyDraft);
    } catch (error) {
      if (!(error instanceof ApiError)) { setSubmitError("Không kết nối được máy chủ. Thử lại sau."); return; }
      // 409 EMAIL_TAKEN and 400 VALIDATION_ERROR name the field; show them next to it.
      const fields = Object.fromEntries(Object.entries(error.errors).filter(([field]) => draftFields.has(field)).map(([field, messages]) => [field, messages[0]]));
      if (Object.keys(fields).length) setErrors(fields);
      else if (error.status === 409) setErrors({ email: error.message });
      else setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = (name: string) => errors[name] && <p id={`${id}-${name}-error`} className="text-sm text-destructive">{errors[name]}</p>;
  const describedBy = (name: string) => errors[name] ? `${id}-${name}-error` : undefined;

  return (
    <>
      <PageHeader eyebrow={s.code} title="Tạo tài khoản người dùng mới" description="Khởi tạo thông tin người dùng và gán vai trò trên Cocoon CRM." />
      <form onSubmit={submit} noValidate className="grid max-w-[880px] gap-5 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 sm:gap-x-6 sm:p-8">
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor={`${id}-fullName`} className={labelClass}>Họ và tên <span aria-hidden="true" className="text-destructive">*</span></label>
          <input id={`${id}-fullName`} value={draft.fullName} onChange={(event) => update({ fullName: event.target.value })} maxLength={200} required autoComplete="off" placeholder="Ví dụ: Nguyễn Văn An"
            aria-invalid={!!errors.fullName} aria-describedby={describedBy("fullName")} className={fieldClass} />
          {fieldError("fullName")}
        </div>
        <div className="space-y-2">
          <label htmlFor={`${id}-email`} className={labelClass}>Email đăng nhập <span aria-hidden="true" className="text-destructive">*</span></label>
          <input id={`${id}-email`} type="email" value={draft.email} onChange={(event) => update({ email: event.target.value })} maxLength={256} required autoComplete="off" placeholder="ten@cocoon.demo"
            aria-invalid={!!errors.email} aria-describedby={describedBy("email")} className={fieldClass} />
          {fieldError("email")}
        </div>
        <div className="space-y-2">
          <label htmlFor={`${id}-role`} className={labelClass}>Phân quyền vai trò <span aria-hidden="true" className="text-destructive">*</span></label>
          <select id={`${id}-role`} value={draft.role} onChange={(event) => update({ role: event.target.value as AccountRole })} className={fieldClass}>
            {assignableRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
          </select>
        </div>

        <section aria-live="polite" aria-label="Quyền của vai trò đang chọn" className="space-y-2 rounded-md border border-border bg-muted p-4 sm:col-span-2">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-label text-sm uppercase tracking-wider text-gold-strong"><ShieldCheck className="size-4" aria-hidden="true" />Đặc quyền vai trò: {roleLabels[draft.role]}</h2>
            <span className="rounded-sm bg-status-sage-bg px-2 py-0.5 font-label text-xs uppercase tracking-wider text-status-sage-fg">{summary.tag}</span>
          </header>
          <p className="text-sm">{summary.description}</p>
          <p className="border-t border-dashed border-border pt-2 text-sm text-muted-foreground">Phạm vi: {summary.scope}</p>
        </section>

        <p className="flex gap-2 text-sm text-muted-foreground sm:col-span-2"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Mật khẩu ban đầu do hệ thống cấp, không nhập tại đây.</p>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5 sm:col-span-2">
          <div aria-live="polite" className="min-w-0 text-sm">
            {submitError ? <p role="alert" className="text-destructive">Chưa tạo được tài khoản: {submitError}</p>
              : created ? <p className="flex items-start gap-2 text-status-sage-fg"><CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 break-all">Đã tạo tài khoản {created.email} ({roleLabels[created.role]}). Mật khẩu tạm để đăng nhập lần đầu: <code className="font-mono font-semibold text-foreground">{created.temporaryPassword}</code>. Người dùng phải đổi mật khẩu khi đăng nhập.</span></p> : null}
          </div>
          <div className="flex w-full gap-3 sm:ml-auto sm:w-auto">
            <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }), "h-12 flex-1 px-6 sm:flex-none")}>Hủy</Link>
            <Button type="submit" disabled={submitting} className="h-12 flex-1 px-6 sm:flex-none">{submitting ? "Đang tạo…" : "Tạo tài khoản"}</Button>
          </div>
        </footer>
      </form>
    </>
  );
}
