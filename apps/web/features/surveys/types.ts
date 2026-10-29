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
