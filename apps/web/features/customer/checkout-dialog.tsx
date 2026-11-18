"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShoppingBag, X } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { ApiError } from "@/lib/api/client";
import { loadProfile } from "./profile-service";
import { placeOrder } from "./shop-service";
import type { ApiProduct, ApiProductVariant } from "./product-service";

const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

export interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ApiProduct;
  variant: ApiProductVariant;
  quantity: number;
}

export function CheckoutDialog({ open, onOpenChange, product, variant, quantity }: CheckoutDialogProps) {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill address from profile
  useEffect(() => {
    if (!open) return;
    let active = true;
    loadProfile()
      .then((profile) => {
        if (active && profile.address) {
          setAddress(profile.address);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingProfile(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const totalAmount = variant.price * quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedAddress = address.trim();
    if (trimmedAddress.length < 5) {
      setError("Vui lòng nhập địa chỉ giao hàng cụ thể (từ 5 đến 1.000 ký tự).");
      return;
    }
    if (trimmedAddress.length > 1000) {
      setError("Địa chỉ giao hàng tối đa 1.000 ký tự.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await placeOrder({
        items: [{ variantId: variant.id, quantity }],
        shippingAddress: trimmedAddress,
      });
      onOpenChange(false);
      router.push("/account/orders");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.errors && Object.keys(err.errors).length > 0) {
          const firstField = Object.keys(err.errors)[0];
          setError(err.errors[firstField]?.[0] || err.message);
        } else if (err.status === 409 || err.code === "PRODUCT_UNAVAILABLE") {
          setError(err.message || "Sản phẩm hoặc biến thể này hiện không khả dụng để đặt mua.");
        } else {
          setError(err.message || "Không thể đặt hàng. Vui lòng kiểm tra lại thông tin và thử lại.");
        }
      } else {
        setError("Đã xảy ra lỗi khi đặt hàng. Vui lòng thử lại sau.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={submitting ? () => {} : onOpenChange}>
      <AlertDialogContent className="max-w-[540px] rounded-lg border border-[#dfd7c5] bg-[#fffdf8] p-6 text-[#302b23] shadow-2xl">
        <AlertDialogHeader className="border-b border-[#e9e0cf] pb-4">
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="font-heading text-2xl font-normal text-[#29251e]">
              Xác nhận đặt hàng
            </AlertDialogTitle>
            {!submitting && (
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded p-1 text-[#8b806d] hover:bg-[#f3ecdf] hover:text-[#302b23]"
                aria-label="Đóng hộp thoại"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <AlertDialogDescription className="text-sm text-[#81745e]">
            Vui lòng kiểm tra lại thông tin sản phẩm và địa chỉ nhận hàng trước khi đặt.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {error}
            </div>
          )}

          {/* Product Summary */}
          <div className="flex gap-4 rounded border border-[#e8dfcf] bg-[#faf5eb] p-3 text-sm">
            <div className="size-16 shrink-0 rounded bg-[#f0ebd9] overflow-hidden flex items-center justify-center">
              {variant.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={variant.imageUrl} alt={product.name} className="h-full w-full object-contain" />
              ) : (
                <ShoppingBag size={24} className="text-[#9c8e76]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[#29251e] line-clamp-1">{product.name}</p>
              <p className="text-xs text-[#81745e] mt-0.5">Phân loại: {variant.name}</p>
              <p className="text-xs text-[#81745e]">Số lượng: {quantity}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-[#29251e]">{money(variant.price)}</p>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="space-y-1.5">
            <label htmlFor="shipping-address" className="block text-sm font-semibold text-[#29251e]">
              Địa chỉ nhận hàng <span className="text-red-600">*</span>
            </label>
            <textarea
              id="shipping-address"
              rows={3}
              required
              disabled={submitting || loadingProfile}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố…"
              className="w-full rounded border border-[#dfd7c5] bg-white p-2.5 text-sm outline-none focus:border-[#8b6c38] focus:ring-1 focus:ring-[#8b6c38] disabled:bg-gray-100"
            />
            {loadingProfile && (
              <p className="text-xs text-[#81745e] flex items-center gap-1.5">
                <LoaderCircle size={12} className="motion-safe:animate-spin" />
                Đang nạp địa chỉ từ hồ sơ của bạn…
              </p>
            )}
          </div>

          {/* Payment Method Note */}
          <div className="rounded border border-[#e4dbc9] bg-[#fbf9f4] p-3 text-xs text-[#6e6350] space-y-1">
            <p className="font-semibold text-[#29251e]">Phương thức thanh toán</p>
            <p>Thanh toán khi nhận hàng (COD). Kiểm tra hàng trước khi thanh toán cho nhân viên giao hàng.</p>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between border-t border-[#e9e0cf] pt-3 text-sm">
            <span className="text-[#6e6350]">Tổng thanh toán:</span>
            <span className="text-xl font-bold text-[#8b6c38]">{money(totalAmount)}</span>
          </div>

          <AlertDialogFooter className="pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
              className="rounded border border-[#d4c8b2] px-4 py-2 text-sm text-[#6e6350] hover:bg-[#f3ecdf] disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded bg-[#29251e] px-5 py-2 text-sm font-semibold text-[#fffaf0] hover:bg-[#433b2e] disabled:opacity-50"
            >
              {submitting && <LoaderCircle size={16} className="motion-safe:animate-spin" />}
              {submitting ? "Đang đặt hàng…" : "Xác nhận đặt hàng"}
            </button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
