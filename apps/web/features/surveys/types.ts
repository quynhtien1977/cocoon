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
