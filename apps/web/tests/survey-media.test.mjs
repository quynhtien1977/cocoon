import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { youtubeEmbedUrl, youtubeVideoId } from "../features/surveys/youtube.ts";
import { fromSurveyDetail, toSurveyUpsertRequest, validateSurveyDraft } from "../features/surveys/schemas.ts";
import { deleteSurveyImage, uploadSurveyImage } from "../features/surveys/api.ts";
import { parseCustomerSurvey } from "../features/customer/survey-response-service.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("YouTube links people paste give the video id, like the API", () => {
  for (const link of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "https://youtu.be/dQw4w9WgXcQ?si=abc", "https://m.youtube.com/shorts/dQw4w9WgXcQ", "http://youtube.com/embed/dQw4w9WgXcQ", " dQw4w9WgXcQ "])
    assert.equal(youtubeVideoId(link), "dQw4w9WgXcQ", link);
  for (const link of [null, "", "https://vimeo.com/1", "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", "https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "https://www.youtube.com/watch?v=short"])
    assert.equal(youtubeVideoId(link), null, String(link));
  assert.equal(youtubeEmbedUrl("dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
});

const draft = { title: "Trải nghiệm gel", description: "", purpose: "Satisfaction", productId: null, openAt: "", closeAt: "",
  questions: [{ key: "q1", text: "Bạn chấm mấy sao?", type: "Rating", isRequired: true, options: [] }] };

test("the survey form sends the video link, checks it early and refills it", () => {
  assert.equal("videoUrl" in toSurveyUpsertRequest(draft), false);
  assert.equal(toSurveyUpsertRequest({ ...draft, videoUrl: "  https://youtu.be/dQw4w9WgXcQ " }).videoUrl, "https://youtu.be/dQw4w9WgXcQ");
  assert.equal(toSurveyUpsertRequest({ ...draft, videoUrl: " " }).videoUrl, null);
  assert.deepEqual(validateSurveyDraft({ ...draft, videoUrl: "https://youtu.be/dQw4w9WgXcQ" }), {});
  assert.match(validateSurveyDraft({ ...draft, videoUrl: "https://vimeo.com/1" }).videoUrl, /YouTube/);
  const detail = { id: 4, title: "T", description: null, purpose: "Satisfaction", productId: null, status: "Draft", openAt: null, closeAt: null, createdAt: "2026-11-15T00:00:00Z", recipientCount: 0, responseCount: 0, questions: [], videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" };
  assert.equal(fromSurveyDetail(detail).videoUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(fromSurveyDetail({ ...detail, videoUrl: null }).videoUrl, "");
});

test("cover photo upload sends one multipart field and delete targets the survey", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return options.method === "DELETE" ? new Response(null, { status: 204 }) : Response.json({ imageUrl: "/api/v1/survey-images/4?v=abc" }); };
  const file = new File([new Uint8Array([0x89, 0x50])], "cover.png", { type: "image/png" });
  assert.deepEqual(await uploadSurveyImage(4, file), { imageUrl: "/api/v1/survey-images/4?v=abc" });
  assert.equal(calls[0].url, "/api/v1/surveys/4/image");
  assert.equal(calls[0].options.method, "POST");
  assert.ok(calls[0].options.body instanceof FormData);
  assert.equal(calls[0].options.body.get("image").name, "cover.png");
  await deleteSurveyImage(4);
  assert.equal(calls[1].url, "/api/v1/surveys/4/image");
  assert.equal(calls[1].options.method, "DELETE");
});

test("customers get the survey photo and video, and anything unexpected is dropped rather than embedded", () => {
  const base = { id: 9, title: "Khảo sát", description: "", status: "Open", openAt: null, closeAt: null, completedAt: null,
    questions: [{ id: 1, text: "Mấy sao?", type: "Rating", isRequired: true, options: [] }] };
  const survey = parseCustomerSurvey({ ...base, imageUrl: "/api/v1/survey-images/9?v=0f3a", youtubeVideoId: "dQw4w9WgXcQ" });
  assert.equal(survey.imageUrl, "/api/v1/survey-images/9?v=0f3a");
  assert.equal(survey.youtubeVideoId, "dQw4w9WgXcQ");
  const hostile = parseCustomerSurvey({ ...base, imageUrl: "https://evil.example/x.png", youtubeVideoId: "x\"><script>" });
  assert.equal(hostile.imageUrl, null);
  assert.equal(hostile.youtubeVideoId, null);
  assert.equal(parseCustomerSurvey(base).imageUrl, null);
});
