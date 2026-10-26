"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Select } from "@base-ui/react/select";
import { ArrowLeft, Check, ChevronDown, Leaf, LoaderCircle, RotateCcw, UserRound, X } from "lucide-react";
import { preferenceGroups } from "../auth/register-service";
import { loadPreferences, loadProfile, localToday, profileErrorMessage, savePreferences, saveProfile, validateProfile, type CustomerPreferences, type CustomerProfile, type ProfileErrors } from "./profile-service";

const control = "w-full min-h-12 rounded border border-[#d8ccba] bg-[#fffdf8] px-3 py-3 text-base text-[#30291f] outline-none focus:border-[#8a6a2b] focus:ring-2 focus:ring-[#8a6a2b]/15 aria-invalid:border-red-700 disabled:opacity-60";
const primary = "inline-flex min-h-12 items-center justify-center gap-2 rounded bg-[#211e18] px-6 py-3 font-label text-lg font-semibold uppercase text-[#fefbf4] hover:bg-[#41382a] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8a6a2b] disabled:cursor-not-allowed disabled:opacity-40";
const secondary = "inline-flex min-h-12 items-center justify-center gap-2 rounded border border-[#d8ccba] px-4 py-3 text-sm text-[#65563e] hover:bg-[#f4eddf] focus-visible:outline-2 focus-visible:outline-[#8a6a2b] disabled:cursor-not-allowed disabled:opacity-40";

// Each section owns its request and baseline so a failed save cannot reset the other draft.
function useEditableSection<T>(load: (signal?: AbortSignal) => Promise<T>, persist: (value: T, signal?: AbortSignal) => Promise<void>) {
  const [saved, setSaved] = useState<T | null>(null);
  const [draft, setDraft] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]);
    load(signal).then(value => {
      if (!controller.signal.aborted) { setSaved(value); setDraft(value); }
    }).catch(reason => {
      if (!controller.signal.aborted) setError(profileErrorMessage(reason));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, attempt]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const update = (value: T) => { setDraft(value); setSuccess(false); setError(""); };
  const undo = () => { setDraft(saved); setSuccess(false); setError(""); };
  const retry = () => { setError(""); setLoading(true); setAttempt(value => value + 1); };
  const save = async () => {
    if (!draft || !dirty || busy.current || !lifetime.current) return;
    busy.current = true; setPending(true); setError(""); setSuccess(false);
    const controller = lifetime.current;
    try {
      await persist(draft, AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]));
      if (!controller.signal.aborted) { setSaved(draft); setSuccess(true); }
    } catch (reason) { if (!controller.signal.aborted) setError(profileErrorMessage(reason)); }
    finally { busy.current = false; if (!controller.signal.aborted) setPending(false); }
  };
  return { draft, loading, pending, error, success, dirty, update, undo, retry, save };
}

function Section({ id, title, description, icon, children }: { id: string; title: string; description: string; icon: ReactNode; children: ReactNode }) {
  return <section aria-labelledby={id} className="min-w-0 rounded-lg border border-[#e5daca] bg-[#fffdf8] shadow-[0_4px_24px_#30251504]">
    <header className="flex items-start gap-4 border-b border-[#eae0d1] p-6">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#f3ecdf] text-[#856936]" aria-hidden="true">{icon}</span>
      <div><h2 id={id} className="font-heading text-2xl text-[#30291f]">{title}</h2><p className="mt-1 text-sm leading-6 text-[#756b5e]">{description}</p></div>
    </header>
    <div className="p-4 sm:p-6">{children}</div>
  </section>;
}

function Loading() { return <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-[#756b5e]" role="status"><LoaderCircle size={20} className="motion-safe:animate-spin" />Đang tải thông tin…</div>; }
function ErrorMessage({ message }: { message: string }) { return <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">{message}</p>; }
function Unavailable({ error, retry }: { error: string; retry: () => void }) { return <div className="grid gap-4"><ErrorMessage message={error} /><button type="button" className={`${secondary} justify-self-start`} onClick={retry}><RotateCcw size={16} />Thử lại</button></div>; }
function Actions({ pending, dirty, undo, label, undoLabel }: { pending: boolean; dirty: boolean; undo: () => void; label: string; undoLabel: string }) {
  return <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-[#eae0d1] pt-6">
    <button type="button" className={secondary} disabled={pending || !dirty} onClick={undo} aria-label={undoLabel}><RotateCcw size={16} />Hoàn tác</button>
    <button type="submit" className={primary} disabled={pending || !dirty}>{pending && <LoaderCircle size={18} className="motion-safe:animate-spin" />}{pending ? "Đang lưu…" : label}</button>
  </div>;
}

function PersonalInformation() {
  const state = useEditableSection(loadProfile, saveProfile);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const values = state.draft;
  const fields = [
    { key: "fullName", label: "Họ và tên", type: "text", autoComplete: "name", max: 256 },
    { key: "phone", label: "Số điện thoại", type: "tel", autoComplete: "tel", max: 32 },
    { key: "dateOfBirth", label: "Ngày sinh", type: "date", autoComplete: "bday" },
  ] as const;
  const update = <K extends keyof CustomerProfile>(key: K, value: CustomerProfile[K]) => {
    if (!values) return;
    state.update({ ...values, [key]: value });
    setErrors(previous => ({ ...previous, [key]: undefined }));
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values || state.pending) return;
    const nextErrors = validateProfile(values);
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) { (event.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus(); return; }
    void state.save();
  };
  return <Section id="personal-information" title="Thông tin cá nhân" description="Thông tin tài khoản của bạn, luôn được cập nhật." icon={<UserRound size={22} strokeWidth={1.5} />}>
    {state.loading ? <Loading /> : !values ? <Unavailable error={state.error} retry={state.retry} /> : <form aria-label="Chỉnh sửa thông tin cá nhân" noValidate onSubmit={submit} aria-busy={state.pending}>
      <fieldset disabled={state.pending} className="m-0 grid min-w-0 gap-4 border-0 p-0 sm:grid-cols-2">
        <legend className="sr-only">Thông tin tài khoản</legend>
        <div className="grid gap-2 sm:col-span-2"><label htmlFor="profile-email" className="text-sm font-semibold">Email đăng ký</label><input id="profile-email" type="email" value={values.email} readOnly className={`${control} bg-[#f4f1ea] text-[#756b5e]`} aria-describedby="email-help" /><p id="email-help" className="text-xs leading-5 text-[#756b5e]">Email dùng để đăng nhập, hiện chưa hỗ trợ thay đổi.</p></div>
        {fields.map(field => <div key={field.key} className={`grid content-start gap-2 ${field.key === "fullName" ? "sm:col-span-2" : ""}`}>
          <label htmlFor={`profile-${field.key}`} className="text-sm font-semibold">{field.label}{field.key === "fullName" && <span className="text-[#977438]"> *</span>}</label>
          <input id={`profile-${field.key}`} name={field.key} type={field.type} autoComplete={field.autoComplete} maxLength={"max" in field ? field.max : undefined} min={field.key === "dateOfBirth" ? "1900-01-01" : undefined} max={field.key === "dateOfBirth" ? localToday() : undefined} value={values[field.key]} onChange={event => update(field.key, event.target.value)} required={field.key === "fullName"} aria-invalid={!!errors[field.key]} aria-describedby={errors[field.key] ? `${field.key}-error` : undefined} className={control} />
          {errors[field.key] && <p id={`${field.key}-error`} role="alert" className="text-sm text-red-800">{errors[field.key]}</p>}
        </div>)}
        <div className="grid gap-2 sm:col-span-2"><label htmlFor="profile-gender" className="text-sm font-semibold">Giới tính</label>
          <select id="profile-gender" name="gender" value={values.gender} className={control} onChange={event => update("gender", event.target.value)}>
            <option value="">Không muốn chia sẻ</option>{["Nữ", "Nam", "Khác"].map(value => <option key={value} value={value}>{value}</option>)}
            {values.gender && !["Nữ", "Nam", "Khác"].includes(values.gender) && <option value={values.gender}>{values.gender}</option>}
          </select>
        </div>
        <div className="grid gap-2 sm:col-span-2"><label htmlFor="profile-address" className="text-sm font-semibold">Địa chỉ</label><textarea id="profile-address" name="address" autoComplete="street-address" maxLength={1000} rows={2} value={values.address} onChange={event => update("address", event.target.value)} className={`${control} resize-y`} aria-invalid={!!errors.address} aria-describedby={errors.address ? "address-error" : undefined} />{errors.address && <p id="address-error" role="alert" className="text-sm text-red-800">{errors.address}</p>}</div>
        <label className="flex items-start gap-3 text-sm leading-6 text-[#756b5e] sm:col-span-2"><input type="checkbox" checked={values.consentPersonalData} onChange={event => update("consentPersonalData", event.target.checked)} className="mt-1 size-4 shrink-0 accent-[#846530]" />Tôi đồng ý cho Cocoon sử dụng thông tin cá nhân để chăm sóc và tư vấn sản phẩm phù hợp.</label>
      </fieldset>
      <div className="mt-4 space-y-3">{state.error && <ErrorMessage message={state.error} />}{state.success && <p role="status" className="flex items-center gap-2 text-sm text-[#4c623e]"><Check size={18} />Đã lưu thông tin cá nhân.</p>}</div>
      <Actions pending={state.pending} dirty={state.dirty} undo={() => { state.undo(); setErrors({}); }} label="Lưu thông tin" undoLabel="Hoàn tác thông tin" />
    </form>}
  </Section>;
}

const persistPreferences = (value: CustomerPreferences, signal?: AbortSignal) => savePreferences(value.selected, signal);

function Preferences() {
  const state = useEditableSection(loadPreferences, persistPreferences);
  const values = state.draft;
  const groups = [...preferenceGroups.map(group => ({ key: group.key as string, label: group.label as string })), { key: "other", label: "Sở thích khác đã lưu" }];
  return <Section id="customer-preferences" title="Sở thích của bạn" description="Để Cocoon hiểu làn da và những điều bạn yêu thích." icon={<Leaf size={22} strokeWidth={1.5} />}>
    {state.loading ? <Loading /> : !values ? <Unavailable error={state.error} retry={state.retry} /> : <form aria-label="Chỉnh sửa sở thích" onSubmit={event => { event.preventDefault(); void state.save(); }} aria-busy={state.pending}>
      <p className="mb-6 text-sm leading-6 text-[#756b5e]">Các lựa chọn từ khi đăng ký được hiển thị tại đây. Bạn có thể chọn nhiều mục hoặc để trống.</p>
      <div className="grid gap-6">{groups.map(group => {
        const options = values.options.filter(option => option.group === group.key);
        if (!options.length && group.key === "other") return null;
        const selected = values.selected.filter(id => options.some(option => option.id === id));
        return <div key={group.key} className="grid gap-3">
          <span id={`profile-preference-${group.key}`} className="text-sm font-semibold">{group.label}</span>
          <Select.Root multiple value={selected} disabled={state.pending || !options.length} onValueChange={ids => state.update({ ...values, selected: [...values.selected.filter(id => !options.some(option => option.id === id)), ...ids] })}>
            <Select.Trigger aria-labelledby={`profile-preference-${group.key}`} className={`${control} flex items-center justify-between gap-3 text-left`}><span className="text-sm">{!options.length ? "Chưa có lựa chọn khả dụng" : selected.length ? `Đã chọn ${selected.length} mục` : "Chọn sở thích của bạn"}</span><Select.Icon><ChevronDown size={18} /></Select.Icon></Select.Trigger>
            <Select.Portal><Select.Positioner sideOffset={6} align="start" alignItemWithTrigger={false} collisionPadding={12} className="z-50 outline-none"><Select.Popup className="max-h-[min(320px,var(--available-height))] w-[var(--anchor-width)] max-w-[calc(100vw-24px)] overflow-y-auto overscroll-contain rounded border border-[#d8ccba] bg-[#fffdf8] p-1 shadow-lg"><Select.List>
              {options.map(option => <Select.Item key={option.id} value={option.id} label={option.label} disabled={option.inactive && !selected.includes(option.id)} className="flex cursor-pointer items-start gap-3 rounded p-3 text-sm leading-6 text-[#40372a] outline-none data-highlighted:bg-[#f3ecdf] data-disabled:opacity-50"><span className="mt-1 grid size-4 shrink-0 place-items-center rounded-sm border border-[#ad956d]"><Select.ItemIndicator><Check size={14} /></Select.ItemIndicator></span><Select.ItemText>{option.label}{option.inactive && <small className="block text-[#756b5e]">Không còn trong danh mục · có thể bỏ chọn</small>}</Select.ItemText></Select.Item>)}
            </Select.List></Select.Popup></Select.Positioner></Select.Portal>
          </Select.Root>
          {selected.length > 0 && <ul className="flex flex-wrap gap-2" aria-label={`${group.label} đã chọn`}>{selected.map(id => <li key={id} className="flex max-w-full items-center gap-1 rounded bg-[#f3ecdf] py-1 pl-3 pr-1 text-sm text-[#6d542d]"><span className="min-w-0 break-words">{options.find(option => option.id === id)?.label}</span><button type="button" disabled={state.pending} aria-label={`Bỏ ${options.find(option => option.id === id)?.label}`} onClick={() => state.update({ ...values, selected: values.selected.filter(value => value !== id) })} className="grid size-8 shrink-0 cursor-pointer place-items-center rounded hover:bg-[#e6d8c1] focus-visible:outline-2"><X size={14} /></button></li>)}</ul>}
        </div>;
      })}</div>
      {values.selected.length > 0 && <button type="button" disabled={state.pending} onClick={() => state.update({ ...values, selected: [] })} className="mt-4 min-h-11 text-sm text-[#80602d] underline underline-offset-4 disabled:opacity-50">Bỏ tất cả sở thích</button>}
      <div className="mt-4 space-y-3">{state.error && <ErrorMessage message={state.error} />}{state.success && <p role="status" className="flex items-center gap-2 text-sm text-[#4c623e]"><Check size={18} />Đã lưu sở thích.</p>}</div>
      <Actions pending={state.pending} dirty={state.dirty} undo={state.undo} label="Lưu sở thích" undoLabel="Hoàn tác sở thích" />
    </form>}
  </Section>;
}

export function ProfilePage() {
  return <div className="pb-8 text-[#30291f]">
    <Link href="/account" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-[#756b5e] hover:text-[#846530]"><ArrowLeft size={16} />Trang chủ</Link>
    <header className="mb-8"><p className="mb-3 font-label text-sm font-semibold uppercase tracking-[0.15em] text-[#856936]">TÀI KHOẢN COCOON</p><h1 className="font-heading text-4xl sm:text-5xl">Hồ sơ của bạn</h1><p className="mt-3 max-w-xl text-base leading-7 text-[#756b5e]">Một chút về bạn, để mỗi trải nghiệm cùng Cocoon thêm trọn vẹn.</p></header>
    <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]"><PersonalInformation /><Preferences /></div>
  </div>;
}
