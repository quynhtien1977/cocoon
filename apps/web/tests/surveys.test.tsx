import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SurveysPage } from "../features/customer/surveys-page";
import { googleFormHref, loadSurveys, parseSurveys, previewSurveys } from "../features/customer/surveys-service";

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

test("only Google Form respondent links are actionable", () => {
  for (const url of ["https://forms.gle/abc123", "https://docs.google.com/forms/d/e/abc/viewform?usp=sf_link"])
    assert.equal(googleFormHref(url), url);
  for (const url of ["javascript:alert(1)", "http://forms.gle/abc", "https://forms.gle.evil.com/abc", "https://evil.com", "https://docs.google.com/forms/d/abc/edit", "https://a:b@forms.gle/abc", "https://forms.gle/"])
    assert.equal(googleFormHref(url), null);
});

test("surveys paginate the existing API and reject missing completion data", async () => {
  const calls: string[] = [];
  globalThis.fetch = async url => {
    calls.push(String(url));
    return Response.json({ items: [previewSurveys[calls.length - 1]], totalCount: 2 });
  };
  assert.equal((await loadSurveys()).length, 2);
  assert.deepEqual(calls, ["/api/v1/me/surveys?page=1&pageSize=20", "/api/v1/me/surveys?page=2&pageSize=20"]);
  assert.throws(() => parseSurveys([{ ...previewSurveys[0], completedAt: undefined }]));
  assert.throws(() => parseSurveys([previewSurveys[0], previewSurveys[0]]));
});

test("pending survey opens Google Forms without writing completion; completed tab is server-owned", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    assert.equal(options?.method, "GET");
    return Response.json([{ ...previewSurveys[0], googleFormUrl: "https://forms.gle/abc123" }, previewSurveys[2]]);
  };
  render(<SurveysPage />);
  const link = await screen.findByRole("link", { name: /Làm khảo sát:/ });
  assert.equal(link.getAttribute("href"), "https://forms.gle/abc123");
  assert.equal(link.getAttribute("target"), "_blank");
  link.addEventListener("click", event => event.preventDefault());
  fireEvent.click(link);
  assert.equal(calls.length, 1);
  fireEvent.click(screen.getByRole("button", { name: /^Đã làm/ }));
  assert.ok(screen.getByRole("heading", { name: previewSurveys[2].title }));
  assert.equal(screen.queryByRole("link", { name: /Làm khảo sát:/ }), null);
});

test("501 shows explicit preview, never fake real surveys; sample links remain disabled", async () => {
  globalThis.fetch = async () => Response.json({}, { status: 501 });
  render(<SurveysPage />);
  await screen.findByRole("alert");
  assert.equal(screen.queryByText(previewSurveys[0].title), null);
  fireEvent.click(screen.getByRole("button", { name: "Xem giao diện mẫu" }));
  assert.ok(screen.getByText("Giao diện mẫu"));
  assert.equal(screen.getAllByRole("button", { name: "Chưa có liên kết khảo sát" }).length, 2);
  assert.equal(screen.queryByRole("link", { name: /Làm khảo sát:/ }), null);
});

test("empty and expired surveys cannot offer an active form", async () => {
  globalThis.fetch = async () => Response.json([{ ...previewSurveys[0], closeAt: "2020-01-01T00:00:00Z", googleFormUrl: "https://forms.gle/abc123" }]);
  render(<SurveysPage />);
  const button = await screen.findByRole("button", { name: "Khảo sát đã kết thúc" });
  assert.equal((button as HTMLButtonElement).disabled, true);
  fireEvent.click(screen.getByRole("button", { name: /^Đã làm/ }));
  assert.ok(screen.getByText("Chưa có khảo sát đã hoàn thành"));
});
