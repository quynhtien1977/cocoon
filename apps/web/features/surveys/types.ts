// Form-side shapes for M8. Enum names match Cocoon.Domain.Enums; schemas.ts maps them to the API ordinals.

export type QuestionType = "SingleChoice" | "MultiChoice" | "Rating" | "ShortText";
export type SurveyPurpose = "Satisfaction" | "NewProduct" | "Other";

export interface OptionDraft {
  /** Client-only React key; the API assigns real ids. */
  key: string;
  text: string;
  preferenceId: number | null;
}

export interface QuestionDraft {
  key: string;
  text: string;
  type: QuestionType;
  isRequired: boolean;
  options: OptionDraft[];
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

/** Row shape for GET surveys (spec 6.2). Replace with lib/api/schema.d.ts types once P3 publishes the DTO. */
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

/** Customer fields M9 filters on; stands in for POST segments/preview until it is wired up. */
export interface SurveyCandidate {
  id: number;
  code: string;
  fullName: string;
  email: string;
  age: number | null;
  gender: string | null;
  preferenceIds: number[];
  purchasedCategoryIds: number[];
  lowRatedCategoryIds: number[];
  daysSinceLastOrder: number | null;
}

/** GET surveys/{id}/results has no published DTO yet; shapes follow spec 6.2 and the Stitch M10 mock. */
export interface ChoiceResult { kind: "SingleChoice" | "MultiChoice"; text: string; answerCount: number; options: { text: string; count: number }[] }
export interface RatingResult { kind: "Rating"; text: string; answerCount: number; average: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> }
export interface TextResult { kind: "ShortText"; text: string; answerCount: number; answers: { customerName: string; content: string }[] }
export type QuestionResult = ChoiceResult | RatingResult | TextResult;
