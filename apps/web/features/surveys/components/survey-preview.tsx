"use client";

import { Eye, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { purposeLabels } from "../schemas";
import type { SurveyDraft, UpcomingProduct } from "../types";

const day = (value: string) => value.split("-").reverse().join("/");

/** Read-only rendering of the draft as a customer would see it on C7; controls are inert. */
export function SurveyPreview({ draft, products }: { draft: SurveyDraft; products: readonly UpcomingProduct[] }) {
  const product = products.find((item) => item.id === draft.productId);
  return (
    <Sheet>
      <SheetTrigger render={<Button type="button" className="h-12 flex-1 px-4 sm:flex-none" />}><Eye aria-hidden="true" />Xem trước khảo sát</SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:sm:max-w-lg">
        <SheetHeader className="gap-2 border-b border-border p-6">
          <p className="font-label text-xs uppercase tracking-wider text-gold-strong">Bản xem trước · {purposeLabels[draft.purpose]}</p>
          <SheetTitle className="font-heading text-2xl">{draft.title.trim() || "Khảo sát chưa đặt tên"}</SheetTitle>
          <SheetDescription>{draft.description.trim() || "Khách hàng sẽ thấy khảo sát như bên dưới. Các ô chỉ để xem, không gửi được."}</SheetDescription>
          {(product || draft.openAt || draft.closeAt) && (
            <p className="text-sm text-muted-foreground">
              {product && <>Sản phẩm: <span className="text-foreground">{product.name}</span><br /></>}
              {(draft.openAt || draft.closeAt) && <>Thời gian: {draft.openAt ? day(draft.openAt) : "…"} – {draft.closeAt ? day(draft.closeAt) : "…"}</>}
            </p>
          )}
        </SheetHeader>
        <ol className="space-y-6 px-6 pb-6">
          {draft.questions.map((question, index) => (
            <li key={question.key}>
              <fieldset disabled className="space-y-3">
                <legend className="font-semibold">
                  <span className="mr-1 font-label text-sm text-gold-strong">{index + 1}.</span>
                  {question.text.trim() || <span className="text-muted-foreground">Chưa nhập nội dung</span>}
                  {question.isRequired && <span className="text-destructive"> *</span>}
                </legend>
                {(question.type === "SingleChoice" || question.type === "MultiChoice") && (
                  <ul className="space-y-2">
                    {question.options.map((option, position) => (
                      <li key={option.key}>
                        <label className="flex min-h-10 items-center gap-3 rounded-md border border-border px-3 text-sm">
                          <input type={question.type === "SingleChoice" ? "radio" : "checkbox"} name={question.key} disabled className="size-4" />
                          {option.text.trim() || `Lựa chọn ${position + 1}`}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {question.type === "Rating" && (
                  <p aria-label="Thang 1 đến 5 sao" className="flex gap-2 text-gold-strong">
                    {[1, 2, 3, 4, 5].map((value) => <Star key={value} className="size-7" strokeWidth={1.5} aria-hidden="true" />)}
                  </p>
                )}
                {question.type === "ShortText" && <textarea aria-label="Câu trả lời" rows={2} disabled placeholder="Khách nhập câu trả lời ngắn…" className="w-full rounded-md border border-border bg-muted p-3 text-sm" />}
              </fieldset>
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  );
}
