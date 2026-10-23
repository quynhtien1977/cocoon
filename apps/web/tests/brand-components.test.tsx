import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatTile } from "../components/brand/stat-tile";
import { StatusBadge } from "../components/brand/status-badge";
import { EmptyState } from "../components/brand/empty-state";
import { ConfirmDialog } from "../components/brand/confirm-dialog";
import { RatingInput } from "../components/brand/rating-input";
import { RatingStars } from "../components/brand/rating-stars";
import { ProductCard } from "../components/brand/product-card";
import { ReasonChip } from "../components/brand/reason-chip";

afterEach(cleanup);

test("stat tiles show zero values and distinguish a decrease from its business sentiment", () => {
  render(<StatTile label="Phản hồi tồn" value={0} change={{ value: -12, suffix: "%", label: "so với tháng trước", tone: "positive" }} />);
  assert.ok(screen.getByText("0"));
  assert.ok(screen.getByText(/-12%/));
  assert.ok(screen.getByText("so với tháng trước"));
});

test("status badges distinguish the same enum value across domains", () => {
  const { rerender } = render(<StatusBadge kind="feedback" status="Closed" />);
  assert.match(screen.getByText("Đã đóng").className, /bg-status-gray-bg/);
  rerender(<StatusBadge kind="survey" status="Closed" />);
  assert.match(screen.getByText("Đã đóng").className, /bg-status-beige-bg/);
  rerender(<StatusBadge kind="account" status="Locked" />);
  assert.match(screen.getByText("Đã khóa").className, /bg-status-danger-bg/);
  rerender(<StatusBadge kind="product" status="Upcoming" />);
  assert.ok(screen.getByText("Sắp ra mắt"));
});

test("empty state exposes its title, description and caller-owned action", async () => {
  let clicks = 0;
  render(<EmptyState title="Chưa có phản hồi" description="Đánh giá sản phẩm bạn đã dùng." action={<button onClick={() => clicks++}>Viết đánh giá</button>} />);
  assert.ok(screen.getByRole("heading", { name: "Chưa có phản hồi" }));
  await userEvent.setup().click(screen.getByRole("button", { name: "Viết đánh giá" }));
  assert.equal(clicks, 1);
});

test("rating input selects by mouse and arrow keys and submits its form value", async () => {
  function Example() {
    const [rating, setRating] = useState<number | null>(null);
    return <form aria-label="Đánh giá"><RatingInput name="rating" label="Điểm đánh giá" value={rating} onValueChange={setRating} required /></form>;
  }
  render(<Example />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "3 sao" }));
  assert.equal(screen.getByRole("radio", { name: "3 sao" }).getAttribute("aria-checked"), "true");
  await user.keyboard("{ArrowRight}");
  assert.equal(screen.getByRole("radio", { name: "4 sao" }).getAttribute("aria-checked"), "true");
  await user.keyboard("{ArrowLeft}");
  assert.equal(new window.FormData(screen.getByRole("form") as HTMLFormElement).get("rating"), "3");
});

test("disabled ratings cannot change; multiple inputs do not share radio names", async () => {
  let changes = 0;
  render(<><RatingInput label="Đã gửi" defaultValue={4} disabled onValueChange={() => changes++} /><RatingInput label="Sản phẩm khác" defaultValue={2} /></>);
  await userEvent.setup().click(within(screen.getByRole("radiogroup", { name: "Đã gửi" })).getByRole("radio", { name: "1 sao" }));
  assert.equal(changes, 0);
  const names = [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')].map((input) => input.name);
  assert.equal(new Set(names).size, 2);
});

test("read-only ratings expose fractional averages and an explicit unrated state", () => {
  const { rerender } = render(<RatingStars value={4.6} />);
  assert.ok(screen.getByRole("img", { name: "4,6 trên 5 sao" }));
  assert.equal(screen.queryByRole("radio"), null);
  rerender(<RatingStars value={null} />);
  assert.ok(screen.getByText("Chưa có đánh giá"));
});

test("product card formats minimum VND price, limits reasons and preserves action click", async () => {
  let clicks = 0;
  render(<ProductCard name="Nước sen Hậu Giang" href="/account/products/14" minPrice={185000} avgRating={4.6}
    reason={[<ReasonChip key="1">Hợp sở thích</ReasonChip>, <ReasonChip key="2">Được yêu thích</ReasonChip>, <ReasonChip key="3">Lý do thứ ba</ReasonChip>]}
    action={<button onClick={() => clicks++}>Đánh giá</button>} />);
  assert.ok(screen.getByRole("link", { name: "Nước sen Hậu Giang" }));
  assert.match(screen.getByText(/185\.000/).textContent!, /Từ/);
  assert.ok(screen.getByText("Hợp sở thích"));
  assert.ok(screen.getByText("Được yêu thích"));
  assert.equal(screen.queryByText("Lý do thứ ba"), null);
  const action = screen.getByRole("button", { name: "Đánh giá" });
  assert.equal(action.closest("a"), null);
  await userEvent.setup().click(action);
  assert.equal(clicks, 1);
});

test("product images fall back when missing or broken, and recover when the source changes", () => {
  const { rerender } = render(<ProductCard name="Sản phẩm" minPrice={0} imageUrl="https://example.com/first.jpg" avgRating={null} />);
  fireEvent.error(screen.getByRole("img", { name: "Sản phẩm" }));
  assert.ok(screen.getByRole("img", { name: "Chưa có ảnh sản phẩm" }));
  rerender(<ProductCard name="Sản phẩm" minPrice={0} imageUrl="https://example.com/second.jpg" avgRating={null} />);
  assert.ok(screen.getByRole("img", { name: "Sản phẩm" }));
});

test("confirmation focuses Cancel, never runs on cancel, and returns focus to its trigger", async () => {
  let calls = 0;
  render(<ConfirmDialog title="Khóa tài khoản?" description="Tài khoản sẽ ngừng truy cập." trigger={<button>Khóa</button>} confirmLabel="Khóa tài khoản" onConfirm={() => { calls++; }} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Khóa" }));
  await waitFor(() => assert.equal(document.activeElement, screen.getByRole("button", { name: "Hủy" })));
  await user.click(screen.getByRole("button", { name: "Hủy" }));
  await waitFor(() => assert.equal(screen.queryByRole("alertdialog"), null));
  assert.equal(calls, 0);
  await waitFor(() => assert.equal(document.activeElement, screen.getByRole("button", { name: "Khóa" })));
});

test("async confirmation prevents duplicate requests and dismissal until completion", async () => {
  let calls = 0;
  let finish!: () => void;
  const request = new Promise<void>((resolve) => { finish = resolve; });
  render(<ConfirmDialog title="Xác nhận thao tác?" description="Thao tác kiểm thử." trigger={<button>Mở</button>} onConfirm={() => { calls++; return request; }} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Mở" }));
  await user.dblClick(screen.getByRole("button", { name: "Xác nhận" }));
  assert.equal(calls, 1);
  assert.equal((screen.getByRole("button", { name: "Hủy" }) as HTMLButtonElement).disabled, true);
  await user.keyboard("{Escape}");
  assert.ok(screen.getByRole("alertdialog"));
  await act(async () => { finish(); await request; });
  await waitFor(() => assert.equal(screen.queryByRole("alertdialog"), null));
});

test("failed confirmation stays open, shows an error and permits retry", async () => {
  let calls = 0;
  render(<ConfirmDialog title="Xác nhận thao tác?" description="Thao tác kiểm thử." trigger={<button>Mở</button>} onConfirm={async () => { if (++calls === 1) throw new Error("Không thể lưu. Thử lại."); }} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Mở" }));
  await user.click(screen.getByRole("button", { name: "Xác nhận" }));
  assert.match((await screen.findByRole("alert")).textContent!, /Không thể lưu/);
  assert.ok(screen.getByRole("alertdialog"));
  await user.click(screen.getByRole("button", { name: "Xác nhận" }));
  await waitFor(() => assert.equal(screen.queryByRole("alertdialog"), null));
  assert.equal(calls, 2);
});
