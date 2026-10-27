import { ApiError, apiRequest } from "../../lib/api/client";
import { preferenceGroups, resolvePreferenceIds } from "../auth/register-service";

export type CustomerProfile = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  consentPersonalData: boolean;
};
export type ProfileErrors = Partial<Record<keyof CustomerProfile, string>>;
export type PreferenceOption = { id: number; label: string; group: string; inactive: boolean };
export type CustomerPreferences = { selected: number[]; options: PreferenceOption[]; derived: { id: number; label: string }[] };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Dữ liệu hồ sơ chưa đầy đủ. Vui lòng thử lại sau.");
  return value as Record<string, unknown>;
}

export async function loadProfile(signal?: AbortSignal): Promise<CustomerProfile> {
  const data = record(await apiRequest<unknown>("/me", { signal }));
  if (typeof data.fullName !== "string" || typeof data.email !== "string" || typeof data.consentPersonalData !== "boolean")
    throw new Error("Dữ liệu hồ sơ chưa đầy đủ. Vui lòng thử lại sau.");
  const optional = (key: string) => {
    if (data[key] == null) return "";
    if (typeof data[key] !== "string") throw new Error("Dữ liệu hồ sơ không hợp lệ.");
    return data[key] as string;
  };
  return { fullName: data.fullName, email: data.email, consentPersonalData: data.consentPersonalData,
    phone: optional("phone"), dateOfBirth: optional("dateOfBirth"), gender: optional("gender"), address: optional("address") };
}

export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function validateProfile(values: CustomerProfile): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!values.fullName.trim() || values.fullName.trim().length > 150) errors.fullName = "Vui lòng nhập họ tên, tối đa 150 ký tự.";
  const phone = values.phone.trim();
  if (phone && (phone.length > 32 || !/^\+?[\d\s().-]+$/.test(phone) || phone.replace(/\D/g, "").length < 8 || phone.replace(/\D/g, "").length > 15)) errors.phone = "Vui lòng nhập số điện thoại hợp lệ (8–15 chữ số).";
  const birthday = values.dateOfBirth;
  if (birthday) {
    const date = new Date(`${birthday}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== birthday || birthday < "1900-01-01" || birthday > localToday()) errors.dateOfBirth = "Ngày sinh phải hợp lệ, từ năm 1900 đến hôm nay.";
  }
  if (values.gender.length > 32) errors.gender = "Giới tính tối đa 32 ký tự.";
  if (values.address.trim().length > 1000) errors.address = "Địa chỉ tối đa 1.000 ký tự.";
  return errors;
}

export async function saveProfile(values: CustomerProfile, signal?: AbortSignal): Promise<void> {
  const errors = validateProfile(values);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const nullable = (value: string) => value.trim() || null;
  await apiRequest<unknown>("/me", { method: "PUT", signal, json: {
    fullName: values.fullName.trim(), phone: nullable(values.phone), dateOfBirth: nullable(values.dateOfBirth),
    gender: nullable(values.gender), address: nullable(values.address), consentPersonalData: values.consentPersonalData,
  } });
}

function rows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const data = record(value);
  if (Array.isArray(data.items)) return data.items;
  throw new Error("Không thể đọc danh sách sở thích. Vui lòng thử lại.");
}

function validId(value: unknown): value is number { return Number.isInteger(value) && (value as number) > 0 && (value as number) <= 2147483647; }

export async function loadPreferences(signal?: AbortSignal): Promise<CustomerPreferences> {
  const [catalog, mine] = await Promise.all([
    apiRequest<unknown>("/preferences", { signal }), apiRequest<unknown>("/me/preferences", { signal }),
  ]);
  const catalogRows = rows(catalog).map(value => {
    const item = record(value);
    if (!validId(item.id) || typeof item.name !== "string" || !item.name.trim() || (item.isActive !== undefined && typeof item.isActive !== "boolean")) throw new Error("Danh sách sở thích không hợp lệ.");
    return { id: item.id, name: item.name, isActive: item.isActive !== false };
  });
  if (new Set(catalogRows.map(item => item.id)).size !== catalogRows.length) throw new Error("Danh sách sở thích bị trùng. Vui lòng thử lại.");
  const rawSelected = mine && typeof mine === "object" && "preferenceIds" in mine ? record(mine).preferenceIds : rows(mine);
  if (!Array.isArray(rawSelected)) throw new Error("Không thể đọc sở thích đã lưu.");
  const derived: CustomerPreferences["derived"] = [];
  const selected = [...new Set(rawSelected.flatMap(value => {
    const id = typeof value === "number" ? value : record(value).id;
    if (!validId(id)) throw new Error("Sở thích đã lưu không hợp lệ.");
    const item = typeof value === "number" ? {} : record(value);
    if (item.source === "Survey" || item.source === 1) {
      derived.push({ id, label: typeof item.name === "string" ? item.name : catalogRows.find(row => row.id === id)?.name ?? `Sở thích #${id}` });
      return [];
    }
    if (item.source !== undefined && item.source !== "Declared" && item.source !== 0) throw new Error("Nguồn sở thích chưa được hỗ trợ.");
    return [id];
  }))];
  const options: PreferenceOption[] = catalogRows.map(item => ({ id: item.id, label: item.name, group: "other", inactive: !item.isActive }));
  // Reuse registration's name matching: never invent IDs for the fixed labels.
  for (const group of preferenceGroups) for (const option of group.options) {
    try {
      const [id] = resolvePreferenceIds([option.key], catalogRows);
      const target = options.find(item => item.id === id)!;
      target.group = group.key;
      target.label = option.label;
    } catch { /* Unknown/inactive choices stay visible in the additional group. */ }
  }
  for (const id of selected) if (!options.some(item => item.id === id)) options.push({ id, label: `Sở thích đã lưu #${id}`, group: "other", inactive: true });
  return { selected, options: options.filter(item => (!item.inactive || selected.includes(item.id)) && !derived.some(source => source.id === item.id)), derived };
}

export async function savePreferences(ids: number[], signal?: AbortSignal): Promise<void> {
  if (!ids.every(validId)) throw new Error("Lựa chọn sở thích không hợp lệ.");
  await apiRequest<unknown>("/me/preferences", { method: "PUT", signal, json: { preferenceIds: [...new Set(ids)] } });
}

export function profileErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 501) return "Chức năng hồ sơ hiện chưa được kích hoạt. Vui lòng thử lại sau.";
    if (error.status === 400 || error.status === 422) return "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại trước khi lưu.";
    if (error.status === 401 || error.status === 403) return "Phiên truy cập không còn hợp lệ. Vui lòng đăng nhập lại.";
    return "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
  }
  if (error instanceof TypeError || (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))) return "Kết nối bị gián đoạn. Vui lòng thử lại.";
  return error instanceof Error ? error.message : "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
}
