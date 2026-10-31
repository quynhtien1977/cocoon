import { z } from "zod";
import type { components } from "@/lib/api/schema";

type ReplyFeedbackRequest = components["schemas"]["ReplyFeedbackRequest"];

export const REPLY_MIN = 10;
export const REPLY_MAX = 500;

const reply = z.string().trim().min(REPLY_MIN, `Nhập câu trả lời từ ${REPLY_MIN} ký tự.`).max(REPLY_MAX, `Câu trả lời tối đa ${REPLY_MAX} ký tự.`);

export function validateReply(content: string): string | null {
  const result = reply.safeParse(content);
  return result.success ? null : result.error.issues[0].message;
}

export const toReplyRequest = (content: string): ReplyFeedbackRequest => ({ content: content.trim() });
