import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { youtubeEmbedUrl, youtubeVideoId } from "../features/surveys/youtube.ts";
import { fromSurveyDetail, toSurveyUpsertRequest, validateSurveyDraft } from "../features/surveys/schemas.ts";
import { uploadQuestionImage } from "../features/surveys/api.ts";
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

const question = (media) => ({ key: "q1", text: "Bạn thích mẫu bao bì nào?", type: "SingleChoice", isRequired: true,
  options: [{ key: "o1", text: "Mẫu A", preferenceId: null }, { key: "o2", text: "Mẫu B", preferenceId: null }], ...(media && { media }) });
const draft = (q) => ({ title: "Bao bì mới", description: "", purpose: "Satisfaction", productId: null, openAt: "", closeAt: "", questions: [q] });
const photo = (id) => ({ key: `m${id}`, type: "Image", imageId: id, url: `/api/v1/survey-media/${id}` });

test("questions stay text-only unless the manager adds photos or videos", () => {
  assert.equal("media" in toSurveyUpsertRequest(draft(question())).questions[0], false);
  assert.deepEqual(validateSurveyDraft(draft(question())), {});
  const withMedia = toSurveyUpsertRequest(draft(question([photo(7), photo(8), { key: "v", type: "Video", videoUrl: " https://youtu.be/dQw4w9WgXcQ " }])));
  assert.deepEqual(withMedia.questions[0].media, [{ type: "Image", imageId: 7 }, { type: "Image", imageId: 8 }, { type: "Video", videoUrl: "https://youtu.be/dQw4w9WgXcQ" }]);
  assert.deepEqual(toSurveyUpsertRequest(draft(question([]))).questions[0].media, []);
});

test("the form flags a bad video link and more than six items on the question", () => {
  assert.match(validateSurveyDraft(draft(question([{ key: "v", type: "Video", videoUrl: "https://vimeo.com/1" }])))["questions.0.media.0.videoUrl"], /YouTube/);
  const seven = Array.from({ length: 7 }, (_, i) => photo(i + 1));
  assert.match(validateSurveyDraft(draft(question(seven)))["questions.0.media"], /tối đa 6/);
});

test("editing a draft refills each question's media so the next save keeps it", () => {
  const detail = { id: 4, title: "T", description: null, purpose: "Satisfaction", productId: null, status: "Draft", openAt: null, closeAt: null,
    createdAt: "2026-11-15T00:00:00Z", recipientCount: 0, responseCount: 0, questions: [
      { id: 31, text: "Mẫu nào?", type: "Rating", isRequired: true, options: [], media: [
        { type: "Image", imageId: 7, url: "/api/v1/survey-media/7", youtubeVideoId: null, videoUrl: null },
        { type: "Video", imageId: null, url: null, youtubeVideoId: "dQw4w9WgXcQ", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }] },
      { id: 32, text: "Chỉ có chữ", type: "ShortText", isRequired: false, options: [], media: [] }] };
  const form = fromSurveyDetail(detail);
  assert.deepEqual(form.questions[0].media, [
    { key: "m31-0", type: "Image", imageId: 7, url: "/api/v1/survey-media/7" },
    { key: "m31-1", type: "Video", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }]);
  assert.deepEqual(form.questions[1].media, []);
  assert.deepEqual(toSurveyUpsertRequest(form).questions[0].media, [{ type: "Image", imageId: 7 }, { type: "Video", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }]);
});

test("a question photo uploads as one multipart field to the saved draft", async () => {
  let call;
  globalThis.fetch = async (url, options) => { call = { url, options }; return Response.json({ id: 12, url: "/api/v1/survey-media/12" }, { status: 201 }); };
  const file = new File([new Uint8Array([0x89, 0x50])], "mau-a.png", { type: "image/png" });
  assert.deepEqual(await uploadQuestionImage(4, file), { id: 12, url: "/api/v1/survey-media/12" });
  assert.equal(call.url, "/api/v1/surveys/4/images");
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.body.get("image").name, "mau-a.png");
});

test("customers get each question's photos and videos, and anything unexpected is dropped", () => {
  const survey = parseCustomerSurvey({ id: 9, title: "Khảo sát", description: "", status: "Open", openAt: null, closeAt: null, completedAt: null,
    questions: [
      { id: 1, text: "Mấy sao?", type: "Rating", isRequired: true, options: [], media: [
        { type: "Image", url: "/api/v1/survey-media/5", youtubeVideoId: null },
        { type: "Video", url: null, youtubeVideoId: "dQw4w9WgXcQ" },
        { type: "Image", url: "https://evil.example/x.png", youtubeVideoId: null },
        { type: "Video", url: null, youtubeVideoId: "x\"><script>" }] },
      { id: 2, text: "Chỉ có chữ", type: "ShortText", isRequired: false, options: [] }] });
  assert.deepEqual(survey.questions[0].media, [{ type: "Image", url: "/api/v1/survey-media/5" }, { type: "Video", youtubeVideoId: "dQw4w9WgXcQ" }]);
  assert.deepEqual(survey.questions[1].media, []);
  assert.equal("imageUrl" in survey, false);
});
