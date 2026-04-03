"use client";

import { useTransition } from "react";
import { removeCartItem, updateCartItem } from "@/app/actions/cart";

export function CartControls({
  itemId,
  quantity,
  max,
}: {
  itemId: string;
  quantity: number;
  max: number;
}) {
  const [pending, startTransition] = useTransition();

  function setQty(next: number) {
    startTransition(async () => {
      await updateCartItem(itemId, next);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <div className="inline-flex items-center rounded-pill border border-black/10">
        <button
          type="button"
          className="px-3 py-1.5 disabled:opacity-40"
          disabled={pending || quantity <= 1}
          onClick={() => setQty(quantity - 1)}
        >
          −
        </button>
        <span className="min-w-[2rem] text-center font-medium">{quantity}</span>
        <button
          type="button"
          className="px-3 py-1.5 disabled:opacity-40"
          disabled={pending || quantity >= max}
          onClick={() => setQty(quantity + 1)}
        >
          +
        </button>
      </div>
      <button
        type="button"
        className="text-terracotta hover:underline disabled:opacity-40"
        disabled={pending}
        onClick={() => startTransition(async () => removeCartItem(itemId))}
      >
        Удалить
      </button>
    </div>
  );
}
