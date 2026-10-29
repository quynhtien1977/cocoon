"use client";
import { useRef, useState } from "react";
import { ColorSelect } from "@/components/brand/color-select";
import { ApiError } from "@/lib/api/client";
import { changeProductStatus, productStatusLabels, type ManagerProduct } from "./products-service";
export const statusColors = { Active: "bg-status-sage-bg text-status-sage-fg", Upcoming: "bg-status-lotus-bg text-status-lotus-fg", Inactive: "bg-status-gray-bg text-status-gray-fg" };
export function ProductStatusDropdown({ item, preview, onSaved }: { item: ManagerProduct; preview: boolean; onSaved: (id: number, status: ManagerProduct["status"]) => void }) {
  const [draft, setDraft] = useState<ManagerProduct["status"] | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function save(status: ManagerProduct["status"]) {
    if (preview || busy.current || status === item.status) return;
    busy.current = true; setDraft(status); setError("");
    try {
      await changeProductStatus(item.id, status, AbortSignal.timeout(12000));
      onSaved(item.id, status);
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 501 ? "Chưa thể lưu: API chưa khả dụng." : "Chưa thể lưu. Vui lòng chọn lại để thử lại.");
    } finally { busy.current = false; setDraft(null); }
  }
  return <div className="min-w-[130px] max-w-[190px]">
    <ColorSelect badge label={`Trạng thái ${item.name}`} busy={draft !== null} title={preview ? "Dữ liệu mẫu không thay đổi sản phẩm thật" : "Chọn để lưu trạng thái"} value={draft ?? item.status} disabled={draft !== null || preview} onValueChange={value => void save(value as ManagerProduct["status"])} options={(["Active", "Upcoming", "Inactive"] as const).map(value => ({ value, label: productStatusLabels[value], colorClass: statusColors[value] }))} />
    {draft !== null && <p role="status" className="mt-1 text-xs text-muted-foreground">Đang lưu…</p>}
    {error && <p role="alert" className="mt-2 text-xs leading-5 text-red-800">{error}</p>}
  </div>;
}
