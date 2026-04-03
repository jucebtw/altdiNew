"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductModalData } from "@/components/product-modal";
import { ProductModal } from "@/components/product-modal";

type Card = ProductModalData;

export function ProductGridClient({ products }: { products: Card[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Card | null>(null);

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setActive(p);
              setOpen(true);
            }}
            className="group text-left"
          >
            <div className="relative aspect-square overflow-hidden rounded-card bg-sand shadow-soft transition group-hover:shadow-modal">
              <Image
                src={p.imageUrl}
                alt={p.title}
                fill
                className="object-cover transition group-hover:scale-[1.02]"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
            <p className="mt-3 text-xs text-charcoal/50">{p.designer.studioName}</p>
            <h3 className="font-serif text-lg font-semibold text-charcoal">{p.title}</h3>
            <p className="mt-1 font-semibold text-terracotta">{p.priceRub.toLocaleString("ru-RU")} ₽</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="rounded-pill bg-sand px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-charcoal/70">
                Handmade
              </span>
              <span className="rounded-pill bg-sand px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-charcoal/70">
                Local
              </span>
            </div>
          </button>
        ))}
      </div>
      <ProductModal product={active} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
