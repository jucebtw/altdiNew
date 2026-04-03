import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="font-serif text-4xl font-semibold text-charcoal">404</h1>
      <p className="mt-2 text-charcoal/60">Страница не найдена.</p>
      <Link href="/" className="mt-6 text-terracotta font-medium hover:underline">
        На главную
      </Link>
    </div>
  );
}
