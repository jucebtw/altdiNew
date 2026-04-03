import type { ProductStatus } from "@prisma/client";

const labels: Record<ProductStatus, string> = {
  DRAFT: "Черновик",
  PENDING: "На модерации",
  PUBLISHED: "Опубликован",
  REJECTED: "Отклонён",
};

const styles: Record<ProductStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING: "bg-amber-100 text-amber-900",
  PUBLISHED: "bg-emerald-100 text-emerald-900",
  REJECTED: "bg-red-100 text-red-900",
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span className={`inline-flex rounded-pill px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
