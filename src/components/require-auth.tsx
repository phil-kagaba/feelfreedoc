"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAuth, type SessionUser } from "./auth-provider";

export function RequireAuth({ children }: { children: (user: SessionUser) => React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [loading, user, router, path]);
  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted">
        <LoaderCircle className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  return <>{children(user)}</>;
}
