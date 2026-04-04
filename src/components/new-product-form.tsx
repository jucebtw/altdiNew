"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProductAction } from "@/app/actions/seller";
import { Button } from "@/components/ui/button";

type Cat = { id: string; name: string };

export function NewProductForm({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await createProductAction(fd);
    setPending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.push("/seller/dashboard");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Название</label>
        <input name="title" required className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium">Slug (латиница, уникально)</label>
        <input name="slug" required className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" placeholder="moi-tovar" />
      </div>
      <div>
        <label className="text-sm font-medium">Категория</label>
        <select name="categoryId" required className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Описание</label>
        <textarea name="description" required rows={4} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Цена, ₽</label>
          <input name="priceRub" type="number" min={1} required className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">Остаток</label>
          <input name="stock" type="number" min={0} required className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Ссылка на изображение</label>
        <input
          name="imageUrl"
          type="url"
          placeholder="https://images.unsplash.com/..."
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-charcoal/50">Можно оставить пустым, если загрузишь файл ниже.</p>
      </div>
      <div>
        <label className="text-sm font-medium">Загрузить фото с устройства</label>
        <input
          name="imageFile"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm file:mr-3 file:rounded-pill file:border-0 file:bg-terracotta file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
        />
        <p className="mt-1 text-xs text-charcoal/50">Поддерживаются JPG, PNG, WEBP, GIF до 5 МБ.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Материалы</label>
          <input name="materials" className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">Размеры</label>
          <input name="dimensions" className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Сохранение…" : "Отправить на модерацию"}
      </Button>
    </form>
  );
}
