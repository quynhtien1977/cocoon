import { youtubeEmbedUrl } from "../youtube";

export type RenderableQuestionMedia =
  | { type: "Image"; url: string }
  | { type: "Video"; youtubeVideoId: string };

type MediaSegment =
  | { kind: "images"; items: { url: string; index: number }[] }
  | { kind: "video"; youtubeVideoId: string; index: number };

function groupMedia(items: readonly RenderableQuestionMedia[]): MediaSegment[] {
  const segments: MediaSegment[] = [];
  items.forEach((item, index) => {
    if (item.type === "Image") {
      const last = segments.at(-1);
      if (last?.kind === "images") last.items.push({ url: item.url, index });
      else segments.push({ kind: "images", items: [{ url: item.url, index }] });
    } else {
      segments.push({ kind: "video", youtubeVideoId: item.youtubeVideoId, index });
    }
  });
  return segments;
}

/** Renders optional question photos (2-column grid when multiple) and 16:9 YouTube embeds in order. */
export function QuestionMediaGallery({
  items,
  questionText,
  className = "mt-5 space-y-4",
}: {
  items?: readonly RenderableQuestionMedia[];
  questionText: string;
  className?: string;
}) {
  if (!items?.length) return null;
  const segments = groupMedia(items);
  const label = questionText.trim() || "câu hỏi khảo sát";

  return (
    <div className={className}>
      {segments.map((segment, segIdx) =>
        segment.kind === "images" ? (
          <div
            key={`img-group-${segIdx}`}
            className={segment.items.length === 1 ? "grid grid-cols-1" : "grid grid-cols-2 gap-3"}
          >
            {segment.items.map((img) => (
              <div
                key={`${img.url}-${img.index}`}
                className="overflow-hidden rounded-md border border-[#e6e1d5] bg-[#faf7f0]"
              >
                {/* Survey question photos are served via same-origin proxy with session cookies. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={`Ảnh minh họa ${img.index + 1} cho câu hỏi: ${label}`}
                  className={
                    segment.items.length === 1
                      ? "max-h-80 w-full object-contain"
                      : "aspect-square w-full object-cover"
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            key={`vid-${segment.youtubeVideoId}-${segment.index}`}
            className="aspect-video w-full overflow-hidden rounded-md border border-[#e6e1d5] bg-black"
          >
            <iframe
              src={youtubeEmbedUrl(segment.youtubeVideoId)}
              title={`Video minh họa cho câu hỏi: ${label}`}
              className="h-full w-full border-0"
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        )
      )}
    </div>
  );
}
