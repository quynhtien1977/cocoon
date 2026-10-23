import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tones = {
  lotus: "bg-status-lotus-bg text-status-lotus-fg",
  turmeric: "bg-status-turmeric-bg text-status-turmeric-fg",
  sage: "bg-status-sage-bg text-status-sage-fg",
  beige: "bg-status-beige-bg text-status-beige-fg",
  gray: "bg-status-gray-bg text-status-gray-fg",
  danger: "bg-status-danger-bg text-status-danger-fg",
  ink: "bg-sidebar text-sidebar-foreground",
} as const;

/** Spec 4.6: a status must be resolved within its domain (Closed has two colors). */
export const statusMap = {
  feedback: { New: ["Mới", "lotus"], Accepted: ["Đã tiếp nhận", "beige"], Assigned: ["Đã phân công", "turmeric"], Replied: ["Đã trả lời", "sage"], Closed: ["Đã đóng", "gray"] },
  survey: { Draft: ["Bản nháp", "gray"], Open: ["Đang mở", "sage"], Closed: ["Đã đóng", "beige"] },
  recipient: { NotDone: ["Chưa làm", "turmeric"], Done: ["Đã làm", "sage"] },
  order: { Completed: ["Hoàn thành", "sage"], Cancelled: ["Đã hủy", "gray"], Returned: ["Đã trả hàng", "turmeric"] },
  product: { Active: ["Đang bán", "sage"], Upcoming: ["Sắp ra mắt", "lotus"], Inactive: ["Ngừng bán", "gray"] },
  recommendationPlan: { Draft: ["Bản nháp", "gray"], Active: ["Đang hoạt động", "sage"], Ended: ["Đã kết thúc", "beige"] },
  account: { Active: ["Hoạt động", "sage"], Locked: ["Đã khóa", "danger"] },
  role: { Admin: ["Quản trị viên", "ink"], Manager: ["Quản lý", "beige"], Staff: ["Nhân viên", "gray"], Customer: ["Khách hàng", "lotus"] },
} as const satisfies Record<string, Record<string, readonly [string, keyof typeof tones]>>;

export type StatusKind = keyof typeof statusMap;
export type StatusBadgeProps = {
  [Kind in StatusKind]: { kind: Kind; status: keyof (typeof statusMap)[Kind]; className?: string };
}[StatusKind];

export function StatusBadge({ kind, status, className }: StatusBadgeProps) {
  const group: Record<string, readonly [string, keyof typeof tones]> | undefined = Object.hasOwn(statusMap, kind) ? statusMap[kind] : undefined;
  const [label, tone] = group && Object.hasOwn(group, status) ? group[status] : ["Không xác định", "gray"] as const;
  return <Badge className={cn("h-auto max-w-full whitespace-normal break-words px-2 py-1", tones[tone], className)}>{label}</Badge>;
}
