// frontend/components/PermissionGate.tsx
"use client";

import React, { useEffect, useState } from "react";
import { hasPermission, hasAnyPermission, hasAllPermissions, normalizeRole } from "@/lib/permissions";

interface PermissionGateProps {
  permission?: string;
  anyPermissions?: string[];
  allPermissions?: string[];
  allowedRoles?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export default function PermissionGate({
  permission,
  anyPermissions,
  allPermissions,
  allowedRoles,
  fallback = null,
  children,
}: PermissionGateProps) {
  const [authorized, setAuthorized] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const role = typeof window !== "undefined" ? localStorage.getItem("user_role") : null;
    const normalized = normalizeRole(role);

    if (!normalized) {
      setAuthorized(false);
      return;
    }

    // Role check if specified
    if (allowedRoles && allowedRoles.length > 0) {
      const roleAllowed = allowedRoles.map(normalizeRole).includes(normalized);
      if (!roleAllowed) {
        setAuthorized(false);
        return;
      }
    }

    // Single permission check
    if (permission && !hasPermission(normalized, permission)) {
      setAuthorized(false);
      return;
    }

    // Any permissions check
    if (anyPermissions && anyPermissions.length > 0 && !hasAnyPermission(normalized, anyPermissions)) {
      setAuthorized(false);
      return;
    }

    // All permissions check
    if (allPermissions && allPermissions.length > 0 && !hasAllPermissions(normalized, allPermissions)) {
      setAuthorized(false);
      return;
    }

    setAuthorized(true);
  }, [permission, anyPermissions, allPermissions, allowedRoles]);

  if (!mounted) return null;
  return authorized ? <>{children}</> : <>{fallback}</>;
}

