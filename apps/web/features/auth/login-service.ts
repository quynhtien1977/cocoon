import { ApiError, apiRequest } from "../../lib/api/client";
import { getAccountRole, type AccountRole } from "../../lib/auth/roles";
export { getAccountRole } from "../../lib/auth/roles";

export type LoginPortal = "shared" | "admin" | "customer";

const destinations: Record<AccountRole, string> = {
  Admin: "/admin", Manager: "/manager", Staff: "/staff/feedback", Customer: "/account",
};

export function validateLogin(email: string, password: string) {
  return {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "" : "Vui lòng nhập địa chỉ email hợp lệ.",
    // Sign-in must accept existing passwords; password-strength rules belong to registration.
    password: password.length ? "" : "Vui lòng nhập mật khẩu.",
  };
}

export async function signIn(email: string, password: string, portal: LoginPortal): Promise<string> {
  await apiRequest<unknown>("/auth/login", { method: "POST", json: { email: email.trim(), password }, refresh: false });
  try {
    const profile = await apiRequest<unknown>("/me", { refresh: false });
    const role = getAccountRole(profile);
    if (!role) throw new Error("Không xác định được quyền truy cập của tài khoản. Vui lòng thử lại sau.");
    if (portal === "admin" && role !== "Admin") throw new Error("Tài khoản này không thuộc quản trị viên. Vui lòng dùng trang đăng nhập chung.");
    if (portal === "shared" && role === "Admin") throw new Error("Tài khoản quản trị viên cần đăng nhập tại trang dành riêng cho Admin.");
    if (portal === "customer" && role !== "Customer") throw new Error("Không thể mở phiên khách hàng. Vui lòng đăng nhập lại.");
    return destinations[role];
  } catch (error) {
    // Clear a partially established session on profile failure or wrong entry point.
    await apiRequest<void>("/auth/logout", { method: "POST", refresh: false }).catch(() => undefined);
    throw error;
  }
}

export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 501) return "Đăng nhập hiện chưa được kích hoạt. Vui lòng quay lại sau.";
    if (error.status === 401) return "Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.";
    if (error.status === 403) return "Tài khoản hiện không thể truy cập. Vui lòng liên hệ người quản trị.";
    if (error.status === 429) return "Bạn đã thử đăng nhập nhiều lần. Vui lòng đợi một lúc rồi thử lại.";
    if (error.status >= 500 || error.status === 404) return "Dịch vụ đăng nhập tạm thời không khả dụng. Vui lòng thử lại sau.";
    return "Không thể đăng nhập. Vui lòng kiểm tra thông tin và thử lại.";
  }
  if (error instanceof TypeError) return "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.";
  return error instanceof Error ? error.message : "Không thể đăng nhập. Vui lòng thử lại.";
}
