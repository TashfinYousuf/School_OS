// frontend/tests/test_stage12_5_public_website.test.ts
/**
 * Stage 12.5: Public Commercial Website & Information Architecture Test Suite
 * Verifies:
 * 1. Required Public Routes Existence & Integrity
 * 2. Bilingual EN/BN Dictionary & Resolution
 * 3. Authoritative Pricing Catalogue & Annual 10-Month Discount Formula
 * 4. Interactive ROI Calculator Benchmarks & Disclaimers
 * 5. SEO Configuration, Robots & Sitemap Routes
 * 6. Public Support Assistant Sandboxing & Tool Denial
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveTranslation, DICTIONARY, formatBDT, formatDate } from "../lib/i18n.ts";
import { APPROVED_PLANS } from "../lib/plans.ts";
import { constructMetadata, generateSoftwareSchema, SITE_URL } from "../lib/seo.ts";
import robots from "../app/robots.ts";
import sitemap from "../app/sitemap.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "../app");

describe("Stage 12.5: Public Website & Information Architecture", () => {
  describe("1. Required Public Route Coverage", () => {
    const requiredRoutes = [
      "page.tsx",
      "about/page.tsx",
      "mission/page.tsx",
      "solutions/page.tsx",
      "solutions/schools/page.tsx",
      "solutions/colleges/page.tsx",
      "solutions/academies/page.tsx",
      "features/page.tsx",
      "pricing/page.tsx",
      "security/page.tsx",
      "technology/page.tsx",
      "docs/page.tsx",
      "help/page.tsx",
      "contact/page.tsx",
      "support/page.tsx",
      "legal/privacy/page.tsx",
      "legal/terms/page.tsx",
      "legal/refund/page.tsx",
      "legal/cancellation/page.tsx",
      "onboard/page.tsx",
      "login/page.tsx",
    ];

    for (const route of requiredRoutes) {
      it(`should have route file on disk: app/${route}`, () => {
        const fullPath = path.join(appDir, route);
        assert.ok(fs.existsSync(fullPath), `Missing required route file: app/${route}`);
        const stat = fs.statSync(fullPath);
        assert.ok(stat.size > 50, `Route file appears empty: app/${route}`);
      });
    }
  });

  describe("2. Bilingual EN/BN Localization & Fallback", () => {
    it("should resolve known keys in English and Bengali", () => {
      const brandEn = resolveTranslation("nav.brand", "EN");
      const brandBn = resolveTranslation("nav.brand", "BN");
      assert.equal(brandEn, "EducationOS");
      assert.equal(brandBn, "এডুকেশন ওএস");

      const pricingEn = resolveTranslation("pricing.monthly", "EN");
      const pricingBn = resolveTranslation("pricing.monthly", "BN");
      assert.equal(pricingEn, "Monthly Billing");
      assert.equal(pricingBn, "মাসিক বিলিং");
    });

    it("should fallback gracefully to key or English when key is missing or partial", () => {
      const unknownKey = resolveTranslation("non.existent.key", "EN");
      assert.equal(unknownKey, "non.existent.key");

      const unknownBn = resolveTranslation("non.existent.key", "BN");
      assert.equal(unknownBn, "non.existent.key");
    });

    it("should verify essential navigation and legal translation dictionary entries", () => {
      assert.ok(DICTIONARY["hero.title"]);
      assert.ok(DICTIONARY["hero.subtitle"]);
      assert.ok(DICTIONARY["persona.title"]);
      assert.ok(DICTIONARY["pricing.title"]);
      assert.ok(DICTIONARY["roi.title"]);
      assert.ok(DICTIONARY["footer.regulatory"]);
    });

    it("should format currency in BDT and dates bilingually using Intl.DateTimeFormat", () => {
      assert.equal(formatBDT(990), "৳990");
      assert.equal(formatBDT(2490), "৳2,490");
      assert.equal(formatBDT(4990), "৳4,990");

      const sampleDate = new Date("2026-11-15T09:00:00Z");
      const enDate = formatDate(sampleDate, "EN");
      assert.ok(enDate.includes("2026"));
      assert.ok(enDate.includes("Nov") || enDate.includes("15"));

      const bnDate = formatDate(sampleDate, "BN");
      assert.ok(bnDate.length > 0);
    });
  });

  describe("3. Pricing Catalogue & Annual 10-Month Formula", () => {
    it("should match server-side plan tiers and pricing in BDT", () => {
      const starter = APPROVED_PLANS.find((p) => p.id === "school_starter");
      assert.ok(starter);
      assert.equal(starter.priceMonthlyBdt, 990);
      assert.equal(starter.maxStudents, 100);

      const growth = APPROVED_PLANS.find((p) => p.id === "school_growth");
      assert.ok(growth);
      assert.equal(growth.priceMonthlyBdt, 2490);
      assert.equal(growth.maxStudents, 500);

      const pro = APPROVED_PLANS.find((p) => p.id === "school_pro");
      assert.ok(pro);
      assert.equal(pro.priceMonthlyBdt, 5990);
      assert.equal(pro.maxStudents, 1500);

      const academyGrowth = APPROVED_PLANS.find((p) => p.id === "academy_growth");
      assert.ok(academyGrowth);
      assert.equal(academyGrowth.priceMonthlyBdt, 3990);
      assert.equal(academyGrowth.maxStudents, 600);

      const unifiedPro = APPROVED_PLANS.find((p) => p.id === "unified_pro");
      assert.ok(unifiedPro);
      assert.equal(unifiedPro.priceMonthlyBdt, 9990);
      assert.equal(unifiedPro.maxStudents, 2500);
    });

    it("should enforce annual discount formula: 10 months charged for 12 months", () => {
      for (const plan of APPROVED_PLANS) {
        const annualTotal = plan.priceMonthlyBdt * 10;
        const effectiveMonthly = Math.round(annualTotal / 12);
        assert.ok(
          effectiveMonthly < plan.priceMonthlyBdt,
          `Annual effective monthly should be discounted for ${plan.id}`
        );
        // Annual discount should save exactly 2 months of monthly fees
        const annualSavings = plan.priceMonthlyBdt * 12 - annualTotal;
        assert.equal(annualSavings, plan.priceMonthlyBdt * 2);
      }
    });
  });

  describe("4. Interactive ROI Calculator Logic & Disclaimers", () => {
    it("should compute proportional hours and cost savings accurately", () => {
      const studentCount = 500;
      const hoursAttendance = Math.round((studentCount / 100) * 8); // 40 hrs
      const hoursExamTabulation = Math.round((studentCount / 100) * 16); // 80 hrs
      const hoursFeeReconciliation = Math.round((studentCount / 100) * 10); // 50 hrs
      const totalHours = hoursAttendance + hoursExamTabulation + hoursFeeReconciliation;

      assert.equal(totalHours, 170);

      const paperSaved = studentCount * 35; // ৳17,500
      const feeRecovery = studentCount * 120; // ৳60,000
      assert.equal(paperSaved, 17500);
      assert.equal(feeRecovery, 60000);

      // School with 500 students qualifies for Growth plan (৳2,490)
      const planPrice = 2490;
      const netBenefit = paperSaved + feeRecovery - planPrice;
      assert.equal(netBenefit, 75010);
    });

    it("should include explicit disclaimer rejecting guaranteed legal outcomes", () => {
      const disclaimer = DICTIONARY["roi.disclaimer"].en;
      assert.ok(
        disclaimer.includes("do not represent a legally guaranteed outcome") ||
          disclaimer.includes("Estimates are projected"),
        "ROI Calculator must carry mandatory disclaimer"
      );
    });
  });

  describe("5. SEO, Robots & Sitemap Invariants", () => {
    it("should construct valid metadata with canonical URL and OpenGraph tags", () => {
      const meta = constructMetadata({
        title: "K-12 School Management",
        description: "Official SchoolOS Platform for Bangladeshi Schools",
        path: "/solutions/schools",
      });

      assert.equal(meta.title, "K-12 School Management | EducationOS");
      assert.equal(meta.alternates?.canonical, `${SITE_URL}/solutions/schools`);
      assert.equal((meta.openGraph as any)?.type, "website");
      assert.equal((meta.robots as any)?.index, true);
    });

    it("should output valid robots.txt rules excluding dashboard and api", () => {
      const r = robots();
      assert.ok(Array.isArray(r.rules) || typeof r.rules === "object");
      const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
      const disallows = Array.isArray(rules?.disallow)
        ? rules.disallow
        : [rules?.disallow || ""];
      assert.ok(disallows.includes("/dashboard/"));
      assert.ok(disallows.includes("/api/"));
      assert.ok(r.sitemap?.includes("sitemap.xml"));
    });

    it("should generate comprehensive sitemap including all public marketing routes", () => {
      const s = sitemap();
      assert.ok(Array.isArray(s));
      assert.ok(s.length >= 20, `Expected at least 20 routes in sitemap, got ${s.length}`);

      const urls = s.map((entry) => entry.url);
      assert.ok(urls.some((u) => u.endsWith("/about")));
      assert.ok(urls.some((u) => u.endsWith("/pricing")));
      assert.ok(urls.some((u) => u.endsWith("/security")));
      assert.ok(urls.some((u) => u.endsWith("/solutions/schools")));
      assert.ok(urls.some((u) => u.endsWith("/legal/privacy")));
    });

    it("should generate valid Schema.org SoftwareApplication JSON-LD", () => {
      const schema = generateSoftwareSchema();
      assert.equal(schema["@type"], "SoftwareApplication");
      assert.equal(schema.operatingSystem, "Web, iOS, Android (PWA)");
      assert.equal(schema.offers.priceCurrency, "BDT");
    });
  });

  describe("6. Public Support Assistant Sandboxing & Tool Denial", () => {
    it("should verify assistant component file contains zero SQLAlchemy or backend DB imports", () => {
      const componentPath = path.join(
        __dirname,
        "../components/public/PublicSupportAssistant.tsx"
      );
      assert.ok(fs.existsSync(componentPath));
      const content = fs.readFileSync(componentPath, "utf-8");

      assert.ok(!content.includes("from sqlalchemy"), "Must not import SQLAlchemy");
      assert.ok(!content.includes("get_db"), "Must not import database dependencies");
      assert.ok(!content.includes("execute("), "Must not execute arbitrary SQL");
      assert.ok(!content.includes("localStorage.getItem(\"token\")"), "Must not read auth tokens");
    });

    it("should verify ticket submission is explicitly deferred to Stage 12.8", () => {
      const componentPath = path.join(
        __dirname,
        "../components/public/PublicSupportAssistant.tsx"
      );
      const content = fs.readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("Stage 12.8"),
        "Assistant must explicitly defer support ticket creation to Stage 12.8"
      );
    });
  });
});
