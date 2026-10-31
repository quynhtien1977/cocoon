import { notFound } from "next/navigation";
import { screenMetadata } from "@/components/brand/screen-placeholder";
import { PlanDetail } from "@/features/recommendations/components/plan-detail";
import { PlanEditor } from "@/features/recommendations/components/plan-editor";
import { planProductsFixture, plansFixture } from "@/features/recommendations/recommendations.fixture";
import { toPlanDraft } from "@/features/recommendations/schemas";
import { preferencesFixture, segmentCategoriesFixture, surveyCandidatesFixture } from "@/features/surveys/surveys.fixture";

export const metadata = screenMetadata("M14");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = plansFixture.find((item) => item.id === Number(id));
  if (!plan) notFound();
  if (plan.status !== "Draft") return <PlanDetail key={id} initial={plan} products={planProductsFixture} preferences={preferencesFixture} categories={segmentCategoriesFixture} />;
  return <PlanEditor key={id} initial={toPlanDraft(plan)} planId={plan.id} products={planProductsFixture} customers={surveyCandidatesFixture} preferences={preferencesFixture} categories={segmentCategoriesFixture} />;
}
