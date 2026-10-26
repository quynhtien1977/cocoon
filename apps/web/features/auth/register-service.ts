import { ApiError, apiRequest } from "../../lib/api/client";

export const preferenceGroups = [
  { key: "skin", label: "Loại da", options: [
    { key: "dry", label: "Da khô / Mất nước", english: "Dry Skin" },
    { key: "oily", label: "Da dầu / Lỗ chân lông to", english: "Oily & Pores" },
    { key: "acne", label: "Da mụn / Dễ nổi mụn", english: "Acne-prone Skin" },
    { key: "sensitive", label: "Da nhạy cảm / Dễ kích ứng", english: "Sensitive Skin" },
    { key: "uneven", label: "Da không đều màu / Thâm nám", english: "Uneven Tone / Pigmentation" },
    { key: "aging", label: "Lão hóa / Nếp nhăn", english: "Anti-aging" },
  ] },
  { key: "products", label: "Dòng sản phẩm yêu thích", options: [
    { key: "face", label: "Chăm sóc da mặt", detail: "Tẩy da chết, Toner, Serum, Kem dưỡng", english: "Facial Care" },
    { key: "body", label: "Chăm sóc cơ thể", detail: "Tẩy tế bào chết cơ thể, Sữa tắm, Dưỡng thể", english: "Body Care" },
    { key: "hair", label: "Chăm sóc tóc", detail: "Dầu gội bưởi, Dầu xả, Xịt tóc", english: "Hair Care" },
    { key: "lip", label: "Son dưỡng / Chăm sóc môi", english: "Lip Care" },
    { key: "gifts", label: "Bộ quà tặng & Combo thuần chay", english: "Vegan Gift Sets" },
  ] },
  { key: "criteria", label: "Tiêu chí lựa chọn mỹ phẩm", options: [
    { key: "vegan", label: "100% Thuần chay & Không thử nghiệm trên động vật", english: "100% Vegan & Cruelty-free" },
    { key: "local", label: "Thành phần thuần Việt / Chiết xuất thiên nhiên", english: "Local & Natural Ingredients" },
    { key: "free", label: "Không chứa cồn, paraben, hạt vi nhựa", english: "Free from Alcohol, Parabens" },
    { key: "eco", label: "Sản phẩm thân thiện với môi trường / Tái chế", english: "Eco-friendly / Sustainable" },
  ] },
] as const;

export type Registration = { fullName: string; email: string; password: string; confirmation: string };
export type RegistrationErrors = Partial<Record<keyof Registration, string>>;

export function validateRegistration(values: Registration): RegistrationErrors {
  const errors: RegistrationErrors = {};
  if (!values.fullName.trim()) errors.fullName = "Vui lòng nhập tên của bạn.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Vui lòng nhập địa chỉ email hợp lệ.";
  if (values.password.length < 8 || !/\p{Lu}/u.test(values.password) || !/\p{Ll}/u.test(values.password) || !/\d/.test(values.password)) errors.password = "Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.";
  if (!values.confirmation || values.confirmation !== values.password) errors.confirmation = "Mật khẩu xác nhận chưa khớp.";
  return errors;
}

const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replaceAll("đ", "d").replace(/[^a-z0-9]/g, "");

export function resolvePreferenceIds(keys: string[], response: unknown): number[] {
  const rows = Array.isArray(response) ? response : response && typeof response === "object" && "items" in response && Array.isArray(response.items) ? response.items : [];
  const options = preferenceGroups.flatMap((group) => [...group.options]);
  return [...new Set(keys.map((key) => {
    const option = options.find((item) => item.key === key);
    if (!option) throw new Error("Lựa chọn sở thích không hợp lệ. Vui lòng chọn lại.");
    const aliases = [option.label, option.english, `${option.label} (${option.english})`].map(normalize);
    const matches = rows.filter((row) => row && typeof row === "object" && Number.isInteger(row.id) && row.id > 0 && row.isActive !== false && typeof row.name === "string" && aliases.includes(normalize(row.name)));
    if (matches.length !== 1) throw new Error("Sở thích đã chọn hiện chưa thể lưu. Bạn có thể thử lại sau hoặc bỏ các lựa chọn để tiếp tục.");
    return matches[0].id as number;
  }))];
}

export async function registerCustomer(values: Registration, preferences: string[]): Promise<void> {
  const errors = validateRegistration(values);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  let preferenceIds: number[] = [];
  if (preferences.length) {
    let catalog: unknown;
    try { catalog = await apiRequest<unknown>("/preferences", { refresh: false }); }
    catch { throw new Error("Sở thích hiện chưa thể lưu. Vui lòng thử lại sau hoặc bỏ các lựa chọn để đăng ký không kèm sở thích."); }
    preferenceIds = resolvePreferenceIds(preferences, catalog);
  }
  // This public endpoint creates customers; never send a caller-selected role.
  await apiRequest<unknown>("/auth/register", {
    method: "POST", refresh: false,
    json: { fullName: values.fullName.trim(), email: values.email.trim(), password: values.password, phone: null, dateOfBirth: null, gender: null, preferenceIds },
  });
}

export function registrationErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 501) return "Đăng ký hiện chưa được kích hoạt. Vui lòng quay lại sau.";
    if (error.status === 409) return "Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.";
    if (error.status === 429) return "Bạn thao tác quá nhanh. Vui lòng đợi một lúc rồi thử lại.";
    if (error.status === 400 || error.status === 422) return "Thông tin đăng ký chưa hợp lệ. Vui lòng kiểm tra lại.";
    return "Dịch vụ đăng ký tạm thời không khả dụng. Vui lòng thử lại sau.";
  }
  if (error instanceof TypeError) return "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.";
  return error instanceof Error ? error.message : "Không thể đăng ký. Vui lòng thử lại.";
}
