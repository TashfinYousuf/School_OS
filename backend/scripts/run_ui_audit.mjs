// backend/scripts/run_ui_audit.mjs
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.resolve("docs/ui-audit");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const DESKTOP_VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false };
const MOBILE_VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };

// Authentic local test credentials for Kids Shine pilot
const AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZDhhNzhlYS05OTYyLTQzOTctOGRhYS03MzQyOGRiOTFkMDAiLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRfaWQiOiIxZGNkOTlmZi0wYzYyLTRhNDUtYTZkOS1hMDZhNmI1YjNiMzEiLCJ1c2VyX2lkIjoiYWQ4YTc4ZWEtOTk2Mi00Mzk3LThkYWEtNzM0MjhkYjkxZDAwIiwiZW1haWwiOiJhZG1pbkBraWRzc2hpbmUuY29tIiwianRpIjoiNDE3MGRiYWVkYjdlNDJlMTgxYjk5ZDNkZDY2ODZmODciLCJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzk0NzgxNjQ0LCJpYXQiOjE3OTQxNzY4NDR9.qa0pFRd7C_g1Zzqh9RZtjxvCg06qH8lyYuetSMehFuc";
const REFRESH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZDhhNzhlYS05OTYyLTQzOTctOGRhYS03MzQyOGRiOTFkMDAiLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRfaWQiOiIxZGNkOTlmZi0wYzYyLTRhNDUtYTZkOS1hMDZhNmI1YjNiMzEiLCJ1c2VyX2lkIjoiYWQ4YTc4ZWEtOTk2Mi00Mzk3LThkYWEtNzM0MjhkYjkxZDAwIiwiZW1haWwiOiJhZG1pbkBraWRzc2hpbmUuY29tIiwianRpIjoiNzI5YTZiOTZhMWYxNDMwNjkxMjU4MmQyMDRhMmJmMTQiLCJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc5Njc2ODg0NCwiaWF0IjoxNzk0MTc2ODQ0fQ.pjiA7SSk1I0Oy1ICwEUGwpFOobNfjdv4hYjOxLYSh58";
const TENANT_ID = "1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31";
const WORKSPACE_ID = "9648e003-b4e2-4d09-b170-478b6234544b";
const USER_NAME = "Kids Shine Admin";
const SCHOOL_NAME = "Kids Shine International School";

// Audit Route Definitions
const AUDIT_ROUTES = [
  // 1. Homepage & Public Routes (Desktop)
  { id: "01_homepage_desktop", path: "/", viewport: DESKTOP_VIEWPORT, auth: false, label: "Public Homepage (Desktop)" },
  { id: "02_solutions_overview", path: "/solutions", viewport: DESKTOP_VIEWPORT, auth: false, label: "Solutions Overview" },
  { id: "03_solutions_schools", path: "/solutions/schools", viewport: DESKTOP_VIEWPORT, auth: false, label: "Solutions - K-12 Formal Schools" },
  { id: "04_solutions_colleges", path: "/solutions/colleges", viewport: DESKTOP_VIEWPORT, auth: false, label: "Solutions - Higher Secondary Colleges" },
  { id: "05_solutions_academies", path: "/solutions/academies", viewport: DESKTOP_VIEWPORT, auth: false, label: "Solutions - Coaching & Test-Prep Academies" },
  { id: "06_features_catalog", path: "/features", viewport: DESKTOP_VIEWPORT, auth: false, label: "Features Module Catalog" },
  { id: "07_pricing_standalone", path: "/pricing", viewport: DESKTOP_VIEWPORT, auth: false, label: "Standalone Pricing Page" },
  { id: "08_about", path: "/about", viewport: DESKTOP_VIEWPORT, auth: false, label: "About & Engineering Principles" },
  { id: "09_mission", path: "/mission", viewport: DESKTOP_VIEWPORT, auth: false, label: "Mission & Vision 2030" },
  { id: "10_security", path: "/security", viewport: DESKTOP_VIEWPORT, auth: false, label: "Security & AEGIS-X Sentinel" },
  { id: "11_technology", path: "/technology", viewport: DESKTOP_VIEWPORT, auth: false, label: "Technology & Offline Architecture" },
  { id: "12_docs", path: "/docs", viewport: DESKTOP_VIEWPORT, auth: false, label: "Knowledge Base Documentation" },
  { id: "13_help", path: "/help", viewport: DESKTOP_VIEWPORT, auth: false, label: "Help Center & FAQs" },
  { id: "14_support", path: "/support", viewport: DESKTOP_VIEWPORT, auth: false, label: "Support Triage & SLA Desk" },
  { id: "15_contact", path: "/contact", viewport: DESKTOP_VIEWPORT, auth: false, label: "Contact & Institutional Demo" },
  { id: "16_onboard", path: "/onboard", viewport: DESKTOP_VIEWPORT, auth: false, label: "Onboarding Intake (Pre-Stage 12.6)" },
  { id: "17_legal_privacy", path: "/legal/privacy", viewport: DESKTOP_VIEWPORT, auth: false, label: "Legal Privacy Policy (Draft)" },
  { id: "18_legal_terms", path: "/legal/terms", viewport: DESKTOP_VIEWPORT, auth: false, label: "Legal Terms of Service (Draft)" },
  { id: "19_legal_refund", path: "/legal/refund", viewport: DESKTOP_VIEWPORT, auth: false, label: "Legal Refund Policy (Draft)" },
  { id: "20_legal_cancellation", path: "/legal/cancellation", viewport: DESKTOP_VIEWPORT, auth: false, label: "Legal Cancellation Policy (Draft)" },

  // 2. Authentication & Dashboard Shell (Desktop)
  { id: "21_login", path: "/login", viewport: DESKTOP_VIEWPORT, auth: false, label: "Login Portal" },
  { id: "22_dashboard_overview", path: "/dashboard", viewport: DESKTOP_VIEWPORT, auth: true, label: "Authenticated Dashboard Overview" },
  { id: "23_dashboard_students", path: "/dashboard/students", viewport: DESKTOP_VIEWPORT, auth: true, label: "Student Roster & Profiles" },
  { id: "24_dashboard_teachers", path: "/dashboard/teachers", viewport: DESKTOP_VIEWPORT, auth: true, label: "Teacher & Faculty Management" },
  { id: "25_dashboard_attendance", path: "/dashboard/attendance", viewport: DESKTOP_VIEWPORT, auth: true, label: "Digital Attendance Ledger" },
  { id: "26_dashboard_exams", path: "/dashboard/exams", viewport: DESKTOP_VIEWPORT, auth: true, label: "Examination & Question Paper Studio" },
  { id: "27_dashboard_results", path: "/dashboard/results", viewport: DESKTOP_VIEWPORT, auth: true, label: "NCTB Gradebook & Results" },
  { id: "28_dashboard_finance", path: "/dashboard/finance", viewport: DESKTOP_VIEWPORT, auth: true, label: "Student Fee Ledger & Vouchers" },
  { id: "29_dashboard_academic", path: "/dashboard/academic", viewport: DESKTOP_VIEWPORT, auth: true, label: "Academic Classes & Routines" },
  { id: "30_dashboard_guardians", path: "/dashboard/guardians", viewport: DESKTOP_VIEWPORT, auth: true, label: "Guardian Directory & Student Links" },
  { id: "31_dashboard_notices", path: "/dashboard/notices", viewport: DESKTOP_VIEWPORT, auth: true, label: "Notice Board & Bulletins" },
  { id: "32_dashboard_settings", path: "/dashboard/settings", viewport: DESKTOP_VIEWPORT, auth: true, label: "Institution & Campus Settings" },
  { id: "33_dashboard_approvals", path: "/dashboard/approvals", viewport: DESKTOP_VIEWPORT, auth: true, label: "Admin Action Center & Approvals" },

  // 3. Mobile Viewport Audits (390 x 844)
  { id: "34_homepage_mobile", path: "/", viewport: MOBILE_VIEWPORT, auth: false, label: "Public Homepage (Mobile 390x844)" },
  { id: "35_pricing_mobile", path: "/pricing", viewport: MOBILE_VIEWPORT, auth: false, label: "Pricing Page (Mobile 390x844)" },
  { id: "36_solutions_schools_mobile", path: "/solutions/schools", viewport: MOBILE_VIEWPORT, auth: false, label: "Schools Solution (Mobile 390x844)" },
  { id: "37_login_mobile", path: "/login", viewport: MOBILE_VIEWPORT, auth: false, label: "Login Portal (Mobile 390x844)" },
  { id: "38_dashboard_overview_mobile", path: "/dashboard", viewport: MOBILE_VIEWPORT, auth: true, label: "Dashboard Overview (Mobile 390x844)" },
  { id: "39_dashboard_attendance_mobile", path: "/dashboard/attendance", viewport: MOBILE_VIEWPORT, auth: true, label: "Attendance Marking (Mobile 390x844)" },
];

async function runAudit() {
  console.log("================================================================================");
  console.log("EDUCATIONOS COMPLETE UI/UX AUTOMATION AUDIT SUITE");
  console.log(`Target: ${BASE_URL} | Screenshots: ${OUTPUT_DIR}`);
  console.log("================================================================================\n");

  const chromeUserDataDir = `/tmp/chrome_audit_${Date.now()}`;
  const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=9222",
    `--user-data-dir=${chromeUserDataDir}`,
  ]);

  let ready = false;
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch("http://127.0.0.1:9222/json/version");
      if (res.ok) {
        ready = true;
        break;
      }
    } catch (e) {}
  }

  if (!ready) {
    console.error("Failed to start Chrome CDP instance.");
    chrome.kill();
    process.exit(1);
  }

  const newTargetRes = await fetch(`http://127.0.0.1:9222/json/new?${BASE_URL}/`, { method: "PUT" });
  const target = await newTargetRes.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  let msgId = 1;
  const callbacks = new Map();
  const pageLogs = [];
  const networkErrors = [];

  function send(method, params = {}, timeoutMs = 12000) {
    return new Promise((resolve) => {
      const id = msgId++;
      const timer = setTimeout(() => {
        if (callbacks.has(id)) {
          callbacks.delete(id);
          console.warn(`    [TIMEOUT] ${method} timed out after ${timeoutMs}ms`);
          resolve(null);
        }
      }, timeoutMs);

      callbacks.set(id, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
      try {
        ws.send(JSON.stringify({ id, method, params }));
      } catch (e) {
        clearTimeout(timer);
        resolve(null);
      }
    });
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      callbacks.get(data.id)(data.result);
      callbacks.delete(data.id);
    }

    if (data.method === "Runtime.consoleAPICalled") {
      const args = data.params?.args?.map((a) => a.value || a.description).join(" ");
      pageLogs.push(`[${data.params.type}] ${args}`);
    }

    if (data.method === "Runtime.exceptionThrown") {
      pageLogs.push(`[EXCEPTION] ${data.params?.exceptionDetails?.text}`);
    }

    if (data.method === "Network.responseReceived") {
      const status = data.params?.response?.status;
      const url = data.params?.response?.url;
      if (status >= 400 && !url.includes("favicon")) {
        networkErrors.push({ url, status });
      }
    }
  };

  await new Promise((r) => ws.onopen = r);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");

  const results = [];

  for (const route of AUDIT_ROUTES) {
    console.log(`\n--> Auditing Route ${route.id}: ${route.path} (${route.label})...`);
    pageLogs.length = 0;
    networkErrors.length = 0;

    // Set Viewport
    await send("Emulation.setDeviceMetricsOverride", {
      width: route.viewport.width,
      height: route.viewport.height,
      deviceScaleFactor: route.viewport.deviceScaleFactor,
      mobile: route.viewport.mobile,
    });

    const targetUrl = `${BASE_URL}${route.path}`;

    // Configure storage based on auth requirement
    if (route.auth) {
      await send("Runtime.evaluate", {
        expression: `
          try {
            localStorage.setItem("token", "${AUTH_TOKEN}");
            localStorage.setItem("access_token", "${AUTH_TOKEN}");
            localStorage.setItem("refresh_token", "${REFRESH_TOKEN}");
            localStorage.setItem("user_role", "admin");
            localStorage.setItem("user_name", "${USER_NAME}");
            localStorage.setItem("tenant_id", "${TENANT_ID}");
            localStorage.setItem("active_workspace_id", "${WORKSPACE_ID}");
            localStorage.setItem("school_name", "${SCHOOL_NAME}");
          } catch(e) {}
        `
      });
    } else {
      await send("Runtime.evaluate", {
        expression: `
          try {
            localStorage.clear();
          } catch(e) {}
        `
      });
    }

    // Navigate to target
    await send("Page.navigate", { url: targetUrl });
    await new Promise((r) => setTimeout(r, 2000));

    // Inspect DOM properties
    const evalResult = await send("Runtime.evaluate", {
      expression: `
        (() => {
          const links = Array.from(document.querySelectorAll("a")).map(a => ({
            text: (a.innerText || "").trim().slice(0, 50),
            href: a.getAttribute("href") || "",
            target: a.getAttribute("target") || "",
            rel: a.getAttribute("rel") || ""
          }));
          const title = document.title;
          const currentUrl = window.location.href;
          const hasNavbar = !!document.querySelector("nav, header");
          const hasFooter = !!document.querySelector("footer");
          const hasSidebar = !!document.querySelector("aside, [class*='sidebar'], [class*='w-64']");
          const hasTable = !!document.querySelector("table");
          const hasInputs = document.querySelectorAll("input, select, textarea").length;
          const bodyText = document.body.innerText || "";
          const hasError = bodyText.includes("500") || bodyText.includes("Error:") || bodyText.includes("Something went wrong");
          const hasEmpty = bodyText.includes("No records found") || bodyText.includes("No data") || bodyText.includes("Empty") || bodyText.includes("কোনো তথ্য পাওয়া যায়নি");
          return { title, currentUrl, links, hasNavbar, hasFooter, hasSidebar, hasTable, hasInputs, hasError, hasEmpty };
        })()
      `,
      returnByValue: true
    }, 6000);

    const domInfo = evalResult?.result?.value || {};

    const screenshotFilename = `${route.id}.png`;
    const screenshotFilePath = path.join(OUTPUT_DIR, screenshotFilename);

    // Capture Full Page Screenshot
    let screenshotData = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true
    }, 10000);

    if (!screenshotData || !screenshotData.data) {
      console.log(`    ⚠ Fallback: capturing standard viewport screenshot...`);
      screenshotData = await send("Page.captureScreenshot", { format: "png" }, 5000);
    }

    if (screenshotData && screenshotData.data) {
      fs.writeFileSync(screenshotFilePath, Buffer.from(screenshotData.data, "base64"));
      const sizeBytes = fs.statSync(screenshotFilePath).size;
      console.log(`    ✓ Saved ${screenshotFilename} (${Math.round(sizeBytes / 1024)} KB) - Title: "${domInfo.title}"`);
    } else {
      console.error(`    ✗ FAILED to capture screenshot for ${route.id}`);
    }

    results.push({
      id: route.id,
      path: route.path,
      label: route.label,
      screenshot: `docs/ui-audit/${screenshotFilename}`,
      viewport: `${route.viewport.width}x${route.viewport.height} (${route.viewport.mobile ? "Mobile" : "Desktop"})`,
      title: domInfo.title || "Untitled",
      finalUrl: domInfo.currentUrl || targetUrl,
      layoutShell: route.auth ? "Authenticated Dashboard Shell" : "Public Website Shell",
      hasHeader: domInfo.hasNavbar || false,
      hasFooter: domInfo.hasFooter || false,
      hasSidebar: domInfo.hasSidebar || false,
      hasTable: domInfo.hasTable || false,
      inputControlsCount: domInfo.hasInputs || 0,
      hasErrorBanner: domInfo.hasError || false,
      hasEmptyState: domInfo.hasEmpty || false,
      linksCount: domInfo.links?.length || 0,
      linksSample: (domInfo.links || []).slice(0, 10),
      allLinks: domInfo.links || [],
      consoleLogs: [...pageLogs],
      networkErrors: [...networkErrors]
    });
  }

  // Write master JSON results
  fs.writeFileSync(path.join(OUTPUT_DIR, "audit_summary.json"), JSON.stringify(results, null, 2));
  console.log(`\n================================================================================`);
  console.log(`Master audit data saved to docs/ui-audit/audit_summary.json (${results.length} routes captured)`);
  console.log(`================================================================================\n`);

  ws.close();
  chrome.kill();
  console.log("Audit complete. Closed Chrome cleanly.\n");
}

runAudit();
