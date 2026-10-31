import { notFound } from "next/navigation";
import { screenMetadata } from "@/components/brand/screen-placeholder";
import { CustomerDetail } from "@/features/customers/components/customer-detail";
import { customerDetailFixture, scoreComponentsFixture } from "@/features/customers/customers.fixture";
import { ScoreBreakdown } from "@/features/recommendations/score-breakdown";

export const metadata = screenMetadata("M4");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = customerDetailFixture(Number(id));
  if (!customer) notFound();
  return <CustomerDetail key={id} initial={customer} scoreBreakdown={<ScoreBreakdown components={scoreComponentsFixture} productName={customer.recommendations[0].productName} />} />;
}
