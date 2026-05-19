import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { LoginCard } from "@/components/auth/login-card";
import { firstParam, getLoginNoticeKey, normalizeNextPath } from "@/lib/auth/login-params";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const noticeKey = getLoginNoticeKey(firstParam(params?.reason));
  const nextPath = normalizeNextPath(firstParam(params?.next));
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_22rem),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_24rem)]" />
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>
      <LoginCard nextPath={nextPath} noticeKey={noticeKey} />
    </main>
  );
}
