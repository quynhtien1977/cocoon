// Screen registry: codes match spec 8.1 and the Jira backlog, so nav, placeholders and docs stay in sync.
export type Portal = "public" | "customer" | "staff" | "manager" | "admin";

export interface Screen {
  code: string;
  title: string;
  description: string;
  portal: Portal;
  href: string;
  /** Shown in the portal navigation. Detail and form screens are reached from lists. */
  nav?: boolean;
}

export const screens = {
  U1: { portal: "public", href: "/", title: "Giới thiệu", description: "Giới thiệu Cocoon CRM, dẫn tới đăng nhập và đăng ký." },
  U2: { portal: "public", href: "/login", title: "Đăng nhập", description: "Đăng nhập cho mọi vai trò, chuyển hướng theo role." },
  U3: { portal: "public", href: "/register", title: "Đăng ký", description: "Tạo tài khoản khách hàng, bước 2 chọn sở thích." },

  C0: { portal: "customer", href: "/account", nav: true, title: "Trang chủ", description: "Khảo sát đang chờ, sản phẩm chờ đánh giá và gợi ý cho bạn." },
  C2: { portal: "customer", href: "/account/orders", nav: true, title: "Đơn hàng", description: "Đơn hàng của bạn; đánh giá từng sản phẩm đã mua." },
  C8: { portal: "customer", href: "/account/recommendations", nav: true, title: "Gợi ý", description: "Sản phẩm hợp sở thích, kèm lý do gợi ý." },
  C6: { portal: "customer", href: "/account/surveys", nav: true, title: "Khảo sát", description: "Khảo sát chờ làm và đã làm." },
  C3: { portal: "customer", href: "/account/feedback", nav: true, title: "Phản hồi", description: "Phản hồi bạn đã gửi và trả lời của Cocoon." },
  C1: { portal: "customer", href: "/account/profile", nav: true, title: "Hồ sơ", description: "Thông tin cá nhân và sở thích." },
  C4: { portal: "customer", href: "/account/feedback/new", title: "Gửi phản hồi", description: "Chấm sao và viết đánh giá cho sản phẩm đã mua." },
  C5: { portal: "customer", href: "/account/feedback/[id]", title: "Chi tiết phản hồi", description: "Trạng thái xử lý và trả lời của Cocoon." },
  C7: { portal: "customer", href: "/account/surveys/[id]", title: "Làm khảo sát", description: "Trả lời từng câu, xem lại rồi gửi." },
  C9: { portal: "customer", href: "/account/products/[id]", title: "Chi tiết sản phẩm", description: "Biến thể, đánh giá trung bình, công dụng và thành phần." },

  S1: { portal: "staff", href: "/staff/feedback", nav: true, title: "Phản hồi được giao", description: "Phản hồi Manager giao cho bạn xử lý." },
  S2: { portal: "staff", href: "/staff/feedback/[id]", title: "Trả lời phản hồi", description: "Đọc phản hồi và gửi trả lời cho khách." },

  M1: { portal: "manager", href: "/manager", nav: true, title: "Tổng quan", description: "KPI, báo cáo khách hàng và phân tích." },
  M2: { portal: "manager", href: "/manager/customers", nav: true, title: "Khách hàng", description: "Tìm, lọc, sắp xếp khách hàng." },
  M5: { portal: "manager", href: "/manager/feedback", nav: true, title: "Phản hồi", description: "Hộp phản hồi, lọc theo trạng thái và điểm." },
  M7: { portal: "manager", href: "/manager/surveys", nav: true, title: "Khảo sát", description: "Danh sách khảo sát và trạng thái." },
  M11: { portal: "manager", href: "/manager/products", nav: true, title: "Sản phẩm", description: "Sản phẩm, trạng thái và tag sở thích." },
  M13: { portal: "manager", href: "/manager/recommendations", nav: true, title: "Gợi ý", description: "Hiệu quả gợi ý và kế hoạch gợi ý." },
  M3: { portal: "manager", href: "/manager/customers/new", title: "Thêm khách hàng", description: "Tạo hồ sơ và tài khoản khách hàng." },
  M4: { portal: "manager", href: "/manager/customers/[id]", title: "Chi tiết khách hàng", description: "Hồ sơ, đơn hàng, phản hồi, khảo sát, gợi ý; khóa hoặc xóa." },
  M6: { portal: "manager", href: "/manager/feedback/[id]", title: "Xử lý phản hồi", description: "Tiếp nhận, giao cho staff, đóng phản hồi." },
  M8: { portal: "manager", href: "/manager/surveys/new", title: "Soạn khảo sát", description: "Câu hỏi 4 loại, gắn sở thích cho lựa chọn." },
  M9: { portal: "manager", href: "/manager/surveys/[id]/send", title: "Gửi khảo sát", description: "Chọn phân khúc khách nhận khảo sát." },
  M10: { portal: "manager", href: "/manager/surveys/[id]/results", title: "Kết quả khảo sát", description: "Tỷ lệ hoàn thành và thống kê từng câu." },
  M12: { portal: "manager", href: "/manager/products/[id]", title: "Chi tiết sản phẩm", description: "Tag sở thích, trạng thái và insights." },
  M14: { portal: "manager", href: "/manager/recommendations/plans/new", title: "Soạn kế hoạch gợi ý", description: "Phân khúc, sản phẩm và thời gian chạy." },

  A1: { portal: "admin", href: "/admin", nav: true, title: "Tài khoản", description: "Danh sách tài khoản, phân quyền, khóa, xóa." },
  A2: { portal: "admin", href: "/admin/accounts/new", title: "Tạo tài khoản", description: "Tạo tài khoản nội bộ và gán role." },
} satisfies Record<string, Omit<Screen, "code">>;

export type ScreenCode = keyof typeof screens;

export function screen(code: ScreenCode): Screen {
  return { code, ...screens[code] };
}

export function navFor(portal: Portal): Screen[] {
  return (Object.keys(screens) as ScreenCode[]).map(screen).filter((s) => s.portal === portal && s.nav);
}
