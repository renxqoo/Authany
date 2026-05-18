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
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="absolute right-6 top-6">
        <LanguageSwitcher />
      </div>
      <LoginCard nextPath={nextPath} noticeKey={noticeKey} />
    </main>
  );
}
