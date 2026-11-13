"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { CircleCheck, Save } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { createCustomer, type CustomerCreated } from "../api";
import { genderOptions, toCreateCustomerRequest, validateCustomerDraft } from "../schemas";
import type { CustomerDraft } from "../types";

const fieldClass = "min-h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive";
const labelClass = "font-label text-sm uppercase tracking-wider text-muted-foreground";
const sectionTitle = "flex items-center gap-2 rounded-md bg-muted px-3 py-2 font-label text-sm uppercase tracking-wider";
const emptyDraft: CustomerDraft = { fullName: "", email: "", phone: "", dateOfBirth: "", gender: "", address: "", preferences: [] };
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });

export function CustomerCreateForm() {
  const id = useId();
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<(CustomerCreated & { fullName: string }) | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const update = (patch: Partial<CustomerDraft>) => { setDraft((current) => ({ ...current, ...patch })); setCreated(null); setSubmitError(null); };
  
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const found = validateCustomerDraft(draft, today());
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length) { setCreated(null); return; }
    setSubmitting(true);
    try {
      const request = toCreateCustomerRequest(draft);
      setCreated({ ...(await createCustomer(request)), fullName: request.fullName });
      setDraft(emptyDraft);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Không kết nối được máy chủ. Thử lại sau.";
      if (error instanceof ApiError && error.status === 409) setErrors({ email: message });
      else setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = (name: string) => errors[name] && <p id={`${id}-${name}-error`} className="text-sm text-destructive">{errors[name]}</p>;
  const invalid = (name: string) => ({ "aria-invalid": !!errors[name], "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined });
  const required = <span aria-hidden="true" className="text-destructive"> *</span>;

  return (
    <>
      <PageHeader title="Thêm hồ sơ khách hàng mới" description="Tạo hồ sơ với thông tin định danh cơ bản của khách hàng." />
      <form onSubmit={submit} noValidate className="max-w-[1020px] space-y-8 rounded-lg border border-border border-t-4 border-t-gold bg-card p-4 sm:p-8">
        <section aria-labelledby={`${id}-identity`} className="space-y-5">
          <h2 id={`${id}-identity`} className={sectionTitle}><span className="font-bold text-gold-strong">01</span><span aria-hidden="true">/</span>Thông tin định danh cơ bản</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor={`${id}-fullName`} className={labelClass}>Họ và tên{required}</label>
              <input id={`${id}-fullName`} value={draft.fullName} onChange={(event) => update({ fullName: event.target.value })} maxLength={200} required autoComplete="off" placeholder="Nguyễn Thị Thu Hà" {...invalid("fullName")} className={fieldClass} />
              {fieldError("fullName")}
            </div>
            <div className="space-y-2">
              <label htmlFor={`${id}-email`} className={labelClass}>Email{required}</label>
              <input id={`${id}-email`} type="email" value={draft.email} onChange={(event) => update({ email: event.target.value })} maxLength={256} required autoComplete="off" placeholder="thuha.nguyen@example.com" {...invalid("email")} className={fieldClass} />
              {fieldError("email")}
            </div>
            <div className="space-y-2">
              <label htmlFor={`${id}-phone`} className={labelClass}>Số điện thoại{required}</label>
              <input id={`${id}-phone`} type="tel" inputMode="tel" value={draft.phone} onChange={(event) => update({ phone: event.target.value })} required autoComplete="off" placeholder="0912 345 678" {...invalid("phone")} className={fieldClass} />
              {fieldError("phone")}
            </div>
            <div className="space-y-2">
              <label htmlFor={`${id}-dateOfBirth`} className={labelClass}>Ngày sinh</label>
              <input id={`${id}-dateOfBirth`} type="date" value={draft.dateOfBirth} onChange={(event) => update({ dateOfBirth: event.target.value })} {...invalid("dateOfBirth")} className={fieldClass} />
              {fieldError("dateOfBirth")}
            </div>
            <fieldset className="space-y-2">
              <legend className={labelClass}>Giới tính</legend>
              <div className="flex min-h-12 flex-wrap items-center gap-x-6">
                {genderOptions.map((gender) => (
                  <label key={gender} className="inline-flex min-h-12 items-center gap-2 text-sm"><input type="radio" name={`${id}-gender`} value={gender} checked={draft.gender === gender} onChange={() => update({ gender })} className="size-4 accent-gold-strong" />{gender}</label>
                ))}
              </div>
            </fieldset>
            <div className="space-y-2 md:col-span-2">
              <label htmlFor={`${id}-address`} className={labelClass}>Địa chỉ nhận hàng và liên hệ</label>
              <input id={`${id}-address`} value={draft.address} onChange={(event) => update({ address: event.target.value })} maxLength={500} autoComplete="off" placeholder="123 Hai Bà Trưng, Phường Bến Nghé, TP. HCM" {...invalid("address")} className={fieldClass} />
              {fieldError("address")}
            </div>
          </div>
        </section>
        
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <div aria-live="polite" className="min-w-0 text-sm">
            {Object.keys(errors).length > 0 ? <p className="text-destructive">Chưa lưu được: còn {Object.keys(errors).length} lỗi. Sửa các ô được đánh dấu rồi lưu lại.</p>
              : submitError ? <p role="alert" className="text-destructive">Chưa lưu được: {submitError}</p>
              : created ? <p className="flex items-start gap-2 text-status-sage-fg"><CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>Đã lưu hồ sơ {created.fullName}. Mật khẩu tạm để khách đăng nhập lần đầu: <code className="font-mono font-semibold text-foreground">{created.temporaryPassword}</code>. <Link href={`/manager/customers/${created.id}`} className="font-semibold underline">Xem hồ sơ</Link></span></p> : null}
          </div>
          <div className="flex w-full gap-3 sm:ml-auto sm:w-auto">
            <Link href="/manager/customers" className={cn(buttonVariants({ variant: "outline" }), "h-12 flex-1 px-6 sm:flex-none")}>Hủy</Link>
            <Button type="submit" disabled={submitting} className="h-12 flex-1 px-6 sm:flex-none"><Save aria-hidden="true" />{submitting ? "Đang lưu…" : "Lưu hồ sơ"}</Button>
          </div>
        </footer>
      </form>
    </>
  );
}
