import type { Metadata } from "next";
import { PageHeader } from "@/components/brand/page-header";
import { screen, type ScreenCode } from "@/lib/screens";

export function screenMetadata(code: ScreenCode): Metadata {
  const s = screen(code);
  return { title: s.title, description: s.description };
}

/** Sprint 1 scaffold: replace with the real screen; keep the code so screenshots map to the report. */
export function ScreenPlaceholder({ code }: { code: ScreenCode }) {
  const s = screen(code);
  return (
    <>
      <PageHeader eyebrow={s.code} title={s.title} description={s.description} />
      <section className="rounded-lg border border-dashed border-input bg-card p-8 text-center">
        <p className="font-medium">Màn hình đang được xây dựng</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Đặc tả ở spec mục 8. Tìm task theo mã <span className="font-mono">{s.code}</span> trên Jira COC.
        </p>
      </section>
    </>
  );
}
