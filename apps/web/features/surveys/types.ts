
// Form-side shapes for M8. Enum names match Cocoon.Domain.Enums; schemas.ts maps them to the API ordinals.

export type QuestionType = "SingleChoice" | "MultiChoice" | "Rating" | "ShortText";
export type SurveyPurpose = "Satisfaction" | "NewProduct" | "Other";

export interface OptionDraft {
  /** Client-only React key; the API assigns real ids. */
  key: string;
  text: string;
  preferenceId: number | null;
}

/** Optional photo (uploaded with uploadQuestionImage) or YouTube link shown with a question, in order. */
export type QuestionMediaDraft =
  | { key: string; type: "Image"; imageId: number; url: string }
  | { key: string; type: "Video"; videoUrl: string };

export interface QuestionDraft {
  key: string;
  text: string;
  type: QuestionType;
  isRequired: boolean;
  options: OptionDraft[];
  /** Optional; missing or empty for a text-only question. At most 6 items. */
  media?: QuestionMediaDraft[];
}

export interface SurveyDraft {
  title: string;
  description: string;
  purpose: SurveyPurpose;
  productId: number | null;
  /** yyyy-mm-dd from <input type="date">; empty means not scheduled. */
  openAt: string;
  closeAt: string;
  questions: QuestionDraft[];
}

export interface PreferenceOption { id: number; name: string }
export interface UpcomingProduct { id: number; name: string }

/** Mirrors Cocoon.Domain.Enums.SurveyStatus. */
export type SurveyStatus = "Draft" | "Open" | "Closed";

/** Row of GET surveys (SurveysController.SurveyListItem). */
export interface SurveyListItem {
  id: number;
  title: string;
  purpose: SurveyPurpose;
  status: SurveyStatus;
  /** ISO dates; null while a draft is unscheduled. */
  openAt: string | null;
  closeAt: string | null;
  questionCount: number;
  recipientCount: number;
  responseCount: number;
}

/** What M9 and M10 show about the survey itself. */
export type SurveyInfo = Omit<SurveyListItem, "questionCount">;

/** GET surveys/{id}. */
export interface SurveyDetail extends SurveyInfo {
  description: string | null;
  productId: number | null;
  createdAt: string;
  questions: { id: number; text: string; type: QuestionType; isRequired: boolean; options: { id: number; text: string; preferenceId: number | null }[]; media?: QuestionMediaView[] }[];
}

/** GET surveys/{id} question media: imageId/url for an Image, youtubeVideoId/videoUrl for a Video. */
export interface QuestionMediaView {
  type: "Image" | "Video";
  imageId: number | null;
  url: string | null;
  youtubeVideoId: string | null;
  videoUrl: string | null;
}

/** Customer row from POST segments/preview sample or GET customers, enough to show and pick a recipient. */
export interface RecipientCustomer { id: number; code: string; fullName: string; email: string; age: number | null; gender: string | null }
export interface SegmentPreview { count: number; sample: RecipientCustomer[] }
export interface RecipientsAdded { added: number; total: number }

/** GET surveys/{id}/results; each question carries only the fields of its kind. */
export interface ChoiceResult { questionId: number; kind: "SingleChoice" | "MultiChoice"; text: string; answerCount: number; options: { id: number; text: string; count: number }[] }
/** `average` is omitted by the API while nobody has rated. */
export interface RatingResult { questionId: number; kind: "Rating"; text: string; answerCount: number; average?: number | null; distribution: Record<1 | 2 | 3 | 4 | 5, number> }
export interface TextResult { questionId: number; kind: "ShortText"; text: string; answerCount: number; answers: { customerName: string; content: string }[] }
export type QuestionResult = ChoiceResult | RatingResult | TextResult;
export interface SurveyResultsData { recipientCount: number; responseCount: number; completionRate: number; questions: QuestionResult[] }
