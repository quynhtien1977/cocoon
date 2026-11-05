import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagerDashboard } from "../features/reports/components/manager-dashboard";

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(cleanup);

test("M1 shows the five overview tiles and switches to customer report tab", async () => {
  render(<ManagerDashboard />);
  for (const label of ["Tổng khách hàng", "Khách mới 30 ngày", "Phản hồi mới", "Điểm trung bình", "Khảo sát đang mở"]) assert.ok(screen.getByText(label));
  assert.ok(screen.getByRole("table", { name: "Phản hồi theo tuần" }));
  await userEvent.setup().click(screen.getByRole("tab", { name: "Báo cáo khách hàng" }));
  assert.ok(screen.getByRole("table", { name: "Cơ cấu giới tính" }));
  assert.ok(screen.getByRole("table", { name: "Sở thích phổ biến" }));
});

test("M1 overview previews open the matching report tab", async () => {
  const user = userEvent.setup();
  render(<ManagerDashboard />);
  assert.ok(screen.getByText("Hạt cà phê thuần chay"));
  assert.equal(screen.getByRole("link", { name: "Xem tất cả (9)" }).getAttribute("href"), "/manager/feedback");
  await user.click(screen.getByRole("button", { name: "Xem phân tích" }));
  assert.equal(screen.getByRole("tab", { name: "Phân tích" }).getAttribute("aria-selected"), "true");
  assert.ok(screen.getByRole("table", { name: "Cặp sản phẩm hay mua cùng" }));
});
