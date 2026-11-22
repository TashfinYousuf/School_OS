// frontend/components/RoleRouteGuard.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { normalizeRole, RoleEnum } from "@/lib/permissions";

// Role-to-Route Authorized Prefixes Matrix
const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  [RoleEnum.SUPERADMIN]: [
    "/dashboard",
  ],
  [RoleEnum.ADMIN]: [
    "/dashboard",
    "/dashboard/admissions",
    "/dashboard/students",
    "/dashboard/attendance",
    "/dashboard/results",
    "/dashboard/exams",
    "/dashboard/live-exams",
    "/dashboard/notices",
    "/dashboard/finance",
    "/dashboard/teachers",
    "/dashboard/pricing",
    "/dashboard/settings",
    "/dashboard/approvals",
    "/dashboard/communication",
    "/dashboard/voice-diary",
    "/dashboard/doubt-solver",
    "/dashboard/academic",
    "/dashboard/guardians",
    "/dashboard/ipemis",
    "/dashboard/batches",
  ],
  [RoleEnum.FINANCE_OFFICER]: [
    "/dashboard",
    "/dashboard/admissions",
    "/dashboard/finance",
    "/dashboard/notices",
  ],
  [RoleEnum.ACCOUNTANT]: [
    "/dashboard",
    "/dashboard/admissions",
    "/dashboard/finance",
    "/dashboard/notices",
  ],
  [RoleEnum.TEACHER]: [
    "/dashboard",
    "/dashboard/admissions",
    "/dashboard/attendance",
    "/dashboard/results",
    "/dashboard/exams",
    "/dashboard/live-exams",
    "/dashboard/batches",
    "/dashboard/doubt-solver",
    "/dashboard/notices",
    "/dashboard/academic",
    "/dashboard/guardians",
    "/dashboard/voice-diary",
  ],
  [RoleEnum.GUARDIAN]: [
    "/dashboard",
    "/dashboard/results",
    "/dashboard/attendance",
    "/dashboard/finance",
    "/dashboard/academic",
    "/dashboard/notices",
    "/dashboard/communication",
    "/dashboard/helpdesk",
    "/dashboard/profile",
  ],
  [RoleEnum.STUDENT]: [
    "/dashboard",
    "/dashboard/learning",
    "/dashboard/attendance",
    "/dashboard/results",
    "/dashboard/live-exams",
    "/dashboard/doubt-solver",
    "/dashboard/academic",
    "/dashboard/finance",
    "/dashboard/notices",
    "/dashboard/profile",
  ],
};

export default function RoleRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token") || localStorage.getItem("token");
    const rawRole = localStorage.getItem("user_role") || "";
    const role = normalizeRole(rawRole);

    // 1. Not logged in -> Redirect to login with safe return path
    if (!token || !role) {
      const returnPath = pathname && pathname !== "/" && pathname !== "/login"
        ? `?return_to=${encodeURIComponent(pathname)}`
        : "";
      router.replace(`/login${returnPath}`);
      return;
    }

    // Superadmin / Admin / Allowed routes: update state asynchronously cleanly
    if (role === RoleEnum.SUPERADMIN || role === RoleEnum.ADMIN) {
      queueMicrotask(() => setAuthorized(true));
      return;
    }

    // 2. Exact or Prefix Route Validation
    const allowedRoutes = ROLE_ALLOWED_ROUTES[role] || ["/dashboard"];
    const isAllowed = allowedRoutes.some((route) => 
      pathname === route || (route !== "/dashboard" && pathname.startsWith(`${route}/`))
    );

    if (!isAllowed) {
      console.warn(`[Security Alert] Role '${role}' blocked from unauthorized route: ${pathname}`);
      router.replace("/dashboard");
      return;
    }

    queueMicrotask(() => setAuthorized(true));
  }, [pathname, router]);

  if (!authorized) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-400 text-xs gap-2">
        <Loader2 className="animate-spin text-blue-600" size={20} />
        <span>Authorizing workspace security...</span>
      </div>
    );
  }

  return <>{children}</>;
}
