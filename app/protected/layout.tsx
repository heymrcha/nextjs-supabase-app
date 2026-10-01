import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center">
      <div className="flex w-full flex-1 flex-col items-center gap-10 sm:gap-20">
        <nav className="flex h-16 w-full justify-center border-b border-b-foreground/10">
          <div className="flex w-full max-w-5xl items-center justify-between gap-3 p-3 px-4 text-sm sm:px-6">
            <div className="flex items-center gap-5 font-semibold">
              <Link href={"/"}>모임</Link>
            </div>
            {!hasEnvVars ? (
              <EnvVarWarning />
            ) : (
              <Suspense>
                <AuthButton />
              </Suspense>
            )}
          </div>
        </nav>
        <div className="flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-6 sm:gap-20 sm:px-6 sm:py-10">
          {children}
        </div>

        <footer className="mx-auto flex w-full items-center justify-center gap-6 border-t px-4 py-10 text-center text-xs sm:gap-8 sm:py-16">
          <p className="text-muted-foreground">모임</p>
          <ThemeSwitcher />
        </footer>
      </div>
    </main>
  );
}
