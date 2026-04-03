import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";

type Props = { searchParams: Promise<{ callbackUrl?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const session = await auth();
  const sp = await searchParams;
  if (session) {
    redirect(sp.callbackUrl ?? "/");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-serif text-3xl font-semibold text-charcoal">Вход</h1>
      <p className="mt-2 text-sm text-charcoal/60">
        Демо-аккаунты: <code className="rounded bg-sand px-1">buyer@atelier.local</code>,{" "}
        <code className="rounded bg-sand px-1">maria@atelier.local</code>,{" "}
        <code className="rounded bg-sand px-1">admin@atelier.local</code> — пароль{" "}
        <code className="rounded bg-sand px-1">Demo123!</code>
      </p>
      <div className="mt-8 rounded-card border border-black/5 bg-white p-6 shadow-soft">
        <LoginForm callbackUrl={sp.callbackUrl} />
      </div>
    </div>
  );
}
