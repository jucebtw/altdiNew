import Image from "next/image";
import {
  publishProductForm,
  rejectProductForm,
  revisionProductForm,
} from "@/app/actions/admin";

type Row = {
  id: string;
  title: string;
  imageUrl: string;
  priceRub: number;
  designer: { studioName: string };
};

export function AdminProductModerationList({ products }: { products: Row[] }) {
  if (products.length === 0) {
    return <p className="text-sm text-charcoal/60">Нет товаров на проверке.</p>;
  }

  return (
    <ul className="space-y-4">
      {products.map((p) => (
        <li
          key={p.id}
          className="flex flex-col gap-3 rounded-lg border border-black/5 bg-white p-4 sm:flex-row sm:gap-4"
        >
          <div className="relative mx-auto h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-sand sm:mx-0">
            <Image src={p.imageUrl} alt={p.title} fill className="object-cover" sizes="96px" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-charcoal">{p.title}</p>
            <p className="text-sm text-charcoal/50">{p.designer.studioName}</p>
            <p className="mt-1 text-sm font-semibold text-terracotta">
              {p.priceRub.toLocaleString("ru-RU")} ₽
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={publishProductForm}>
                <input type="hidden" name="productId" value={p.id} />
                <button
                  type="submit"
                  className="rounded-pill bg-terracotta px-4 py-2 text-xs font-semibold text-white hover:bg-terracotta-dark"
                >
                  Опубликовать
                </button>
              </form>
              <form action={revisionProductForm}>
                <input type="hidden" name="productId" value={p.id} />
                <button
                  type="submit"
                  className="rounded-pill border border-black/15 px-4 py-2 text-xs font-semibold hover:bg-sand"
                >
                  На доработку
                </button>
              </form>
              <form action={rejectProductForm}>
                <input type="hidden" name="productId" value={p.id} />
                <button type="submit" className="text-xs text-red-700 underline">
                  Отклонить
                </button>
              </form>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
