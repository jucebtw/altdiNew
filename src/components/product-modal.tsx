"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToCart } from "@/app/actions/cart";
import { Button } from "@/components/ui/button";

export type ProductModalData = {
  id: string;
  title: string;
  priceRub: number;
  description: string;
  materials: string | null;
  dimensions: string | null;
  stock: number;
  imageUrl: string;
  designer: { studioName: string; slug: string };
};

export function ProductModal({
  product,
  open,
  onClose,
}: {
  product: ProductModalData | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (!open || !product) return null;

  async function handleAdd() {
    const p = product;
    if (!p) return;
    setMsg(null);
    startTransition(async () => {
      const res = await addToCart(p.id, qty);
      if (res.error) setMsg(res.error);
      else {
        setMsg("Добавлено в корзину");
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="relative z-10 grid max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-card bg-white shadow-modal md:grid-cols-2">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full bg-white/90 px-2 py-1 text-sm text-charcoal shadow-soft hover:bg-sand"
        >
          ✕
        </button>
        <div className="relative aspect-square bg-sand md:aspect-auto md:min-h-[420px]">
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        </div>
        <div className="flex flex-col gap-4 p-6 md:p-8">
          <div>
            <p className="text-sm text-charcoal/60">{product.designer.studioName}</p>
            <h2 className="font-serif text-3xl font-semibold text-charcoal">{product.title}</h2>
            <p className="mt-2 text-2xl font-semibold text-terracotta">
              {product.priceRub.toLocaleString("ru-RU")} ₽
            </p>
          </div>
          <p className="text-sm leading-relaxed text-charcoal/80">{product.description}</p>
          <div className="grid gap-2 text-sm">
            {product.materials && (
              <p>
                <span className="text-charcoal/50">Материал:</span> {product.materials}
              </p>
            )}
            {product.dimensions && (
              <p>
                <span className="text-charcoal/50">Размеры:</span> {product.dimensions}
              </p>
            )}
            <p>
              <span className="text-charcoal/50">В наличии:</span> {product.stock} шт.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-pill bg-sand px-3 py-1 text-xs font-medium text-charcoal/80">
              Ручная работа
            </span>
            <span className="rounded-pill bg-sand px-3 py-1 text-xs font-medium text-charcoal/80">
              Местный бренд
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-pill border border-black/10">
              <button
                type="button"
                className="px-3 py-2 text-lg"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className="min-w-[2rem] text-center text-sm font-medium">{qty}</span>
              <button
                type="button"
                className="px-3 py-2 text-lg"
                onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
              >
                +
              </button>
            </div>
            <Button type="button" onClick={handleAdd} disabled={pending || product.stock < 1}>
              {pending ? "…" : "В корзину"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push(`/designers/${product.designer.slug}`)}>
              Профиль мастера
            </Button>
          </div>
          {msg && <p className="text-sm text-terracotta-dark">{msg}</p>}
          <p className="text-xs text-charcoal/50">Доставка по России 3–7 дней. Возврат 14 дней.</p>
        </div>
      </div>
    </div>
  );
}
