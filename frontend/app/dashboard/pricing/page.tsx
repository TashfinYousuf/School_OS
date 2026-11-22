import { redirect } from "next/navigation";

/**
 * Architectural UX Boundary Enforcement:
 * Pricing is strictly a standalone public page housed in the Public Website Shell (/pricing).
 * Any attempt to access /dashboard/pricing is immediately redirected to canonical /pricing.
 */
export default function DashboardPricingPage() {
  redirect("/pricing");
}
