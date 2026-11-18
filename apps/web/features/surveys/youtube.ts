/**
 * Mirrors Cocoon.Domain.YoutubeLink: the video id from a pasted YouTube link, or null. The API re-checks it; the UI
 * uses this to validate the field early and to embed a preview only from youtube-nocookie.com.
 */
const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

export function youtubeVideoId(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  if (!text || text.length > 500) return null;
  if (ID.test(text)) return text;
  let url: URL;
  try { url = new URL(text); } catch { return null; }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (host === "youtu.be") id = segments.length === 1 ? segments[0] : null;
  else if (HOSTS.has(host)) {
    if (segments.length === 1 && segments[0] === "watch") id = url.searchParams.get("v");
    else if (segments.length === 2 && ["shorts", "embed", "live"].includes(segments[0])) id = segments[1];
  }
  return id && ID.test(id) ? id : null;
}

/** Privacy-enhanced embed: no YouTube cookies until the viewer presses play. */
export const youtubeEmbedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
