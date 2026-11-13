import type { Metadata } from "next";
import { PageHeader } from "@/components/brand/page-header";
import { screen, type ScreenCode } from "@/lib/screens";

export function screenMetadata(code: ScreenCode): Metadata {
  const s = screen(code);
  return { title: s.title, description: s.description };
}

/** Shown for routes whose screen is not built yet. */
export function ScreenPlaceholder({ code }: { code: ScreenCode }) {
  const s = screen(code);
  return (
    <>
      <PageHeader title={s.title} description={s.description} />
      <section className="rounded-lg border border-dashed border-input bg-card p-8 text-center">
        <p className="font-medium">Trang này sắp ra mắt.</p>
      </section>
    </>
  );
}
