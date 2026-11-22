// backend/scripts/test_dashboard_capture.mjs
import { spawn } from "child_process";
import fs from "fs";

async function test() {
  console.log("Testing dashboard capture...");
  const chromeUserDataDir = `/tmp/chrome_diag_${Date.now()}`;
  const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=9223",
    `--user-data-dir=${chromeUserDataDir}`,
  ]);

  let ready = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch("http://127.0.0.1:9223/json/version");
      if (res.ok) {
        ready = true;
        break;
      }
    } catch (e) {}
  }

  if (!ready) {
    console.error("Chrome failed to start");
    chrome.kill();
    process.exit(1);
  }

  const newTargetRes = await fetch("http://127.0.0.1:9223/json/new?http://localhost:3000/login", { method: "PUT" });
  const target = await newTargetRes.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  let msgId = 1;
  const callbacks = new Map();

  function send(method, params = {}, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const timer = setTimeout(() => {
        if (callbacks.has(id)) {
          callbacks.delete(id);
          console.warn(`[TIMEOUT] ${method} timed out after ${timeoutMs}ms`);
          resolve(null);
        }
      }, timeoutMs);

      callbacks.set(id, (res) => {
        clearTimeout(timer);
        resolve(res);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.id && callbacks.has(data.id)) {
      callbacks.get(data.id)(data.result);
      callbacks.delete(data.id);
    }
    if (data.method === "Runtime.consoleAPICalled") {
      const args = data.params?.args?.map((a) => a.value || a.description).join(" ");
      console.log(`[BROWSER CONSOLE] [${data.params.type}] ${args}`);
    }
    if (data.method === "Runtime.exceptionThrown") {
      console.log(`[BROWSER EXCEPTION] ${data.params?.exceptionDetails?.text}`);
    }
  };

  await new Promise((r) => ws.onopen = r);
  console.log("WebSocket open");
  await send("Page.enable");
  await send("Runtime.enable");

  console.log("Adding Page.addScriptToEvaluateOnNewDocument...");
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (() => {
        const origRemove = Storage.prototype.removeItem;
        const origClear = Storage.prototype.clear;
        Storage.prototype.removeItem = function(key) {
          console.warn("Storage.removeItem CALLED for key: " + key + " from: " + new Error().stack);
          return origRemove.apply(this, arguments);
        };
        Storage.prototype.clear = function() {
          console.warn("Storage.clear CALLED from: " + new Error().stack);
          return origClear.apply(this, arguments);
        };

        try {
          console.log("INITIALIZING LOCALSTORAGE in new doc: " + window.location.href);
          localStorage.setItem("token", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZDhhNzhlYS05OTYyLTQzOTctOGRhYS03MzQyOGRiOTFkMDAiLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRfaWQiOiIxZGNkOTlmZi0wYzYyLTRhNDUtYTZkOS1hMDZhNmI1YjNiMzEiLCJ1c2VyX2lkIjoiYWQ4YTc4ZWEtOTk2Mi00Mzk3LThkYWEtNzM0MjhkYjkxZDAwIiwiZW1haWwiOiJhZG1pbkBraWRzc2hpbmUuY29tIiwianRpIjoiNDE3MGRiYWVkYjdlNDJlMTgxYjk5ZDNkZDY2ODZmODciLCJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzk0NzgxNjQ0LCJpYXQiOjE3OTQxNzY4NDR9.qa0pFRd7C_g1Zzqh9RZtjxvCg06qH8lyYuetSMehFuc");
          localStorage.setItem("access_token", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZDhhNzhlYS05OTYyLTQzOTctOGRhYS03MzQyOGRiOTFkMDAiLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRfaWQiOiIxZGNkOTlmZi0wYzYyLTRhNDUtYTZkOS1hMDZhNmI1YjNiMzEiLCJ1c2VyX2lkIjoiYWQ4YTc4ZWEtOTk2Mi00Mzk3LThkYWEtNzM0MjhkYjkxZDAwIiwiZW1haWwiOiJhZG1pbkBraWRzc2hpbmUuY29tIiwianRpIjoiNDE3MGRiYWVkYjdlNDJlMTgxYjk5ZDNkZDY2ODZmODciLCJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzk0NzgxNjQ0LCJpYXQiOjE3OTQxNzY4NDR9.qa0pFRd7C_g1Zzqh9RZtjxvCg06qH8lyYuetSMehFuc");
          localStorage.setItem("refresh_token", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZDhhNzhlYS05OTYyLTQzOTctOGRhYS03MzQyOGRiOTFkMDAiLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRfaWQiOiIxZGNkOTlmZi0wYzYyLTRhNDUtYTZkOS1hMDZhNmI1YjNiMzEiLCJ1c2VyX2lkIjoiYWQ4YTc4ZWEtOTk2Mi00Mzk3LThkYWEtNzM0MjhkYjkxZDAwIiwiZW1haWwiOiJhZG1pbkBraWRzc2hpbmUuY29tIiwianRpIjoiNzI5YTZiOTZhMWYxNDMwNjkxMjU4MmQyMDRhMmJmMTQiLCJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc5Njc2ODg0NCwiaWF0IjoxNzk0MTc2ODQ0fQ.pjiA7SSk1I0Oy1ICwEUGwpFOobNfjdv4hYjOxLYSh58");
          localStorage.setItem("user_role", "admin");
          localStorage.setItem("user_name", "Kids Shine Admin");
          localStorage.setItem("tenant_id", "1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31");
          localStorage.setItem("active_workspace_id", "9648e003-b4e2-4d09-b170-478b6234544b");
          localStorage.setItem("school_name", "Kids Shine International School");
        } catch(e) {
          console.error("LS ERROR: " + e.message);
        }
      })();
    `
  });

  console.log("Navigating directly to http://localhost:3000/dashboard...");
  await send("Page.navigate", { url: "http://localhost:3000/dashboard" });
  await new Promise((r) => setTimeout(r, 2500));

  const checkLs = await send("Runtime.evaluate", {
    expression: "JSON.stringify(localStorage)",
    returnByValue: true
  });
  console.log("LocalStorage on dashboard:", checkLs?.result?.value);

  console.log("Checking current location & title...");
  const loc = await send("Runtime.evaluate", {
    expression: "({ url: window.location.href, title: document.title, bodyLength: document.body.innerHTML.length })",
    returnByValue: true
  });
  console.log("Location info:", loc?.result?.value);

  console.log("Attempting captureScreenshot with captureBeyondViewport: true...");
  const ss1 = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, 8000);
  if (ss1 && ss1.data) {
    console.log("Screenshot 1 succeeded! Size bytes:", ss1.data.length);
    fs.writeFileSync("/tmp/dash_ss1.png", Buffer.from(ss1.data, "base64"));
  } else {
    console.log("Screenshot 1 failed/timed out, attempting without captureBeyondViewport...");
    const ss2 = await send("Page.captureScreenshot", { format: "png" }, 5000);
    if (ss2 && ss2.data) {
      console.log("Screenshot 2 succeeded! Size bytes:", ss2.data.length);
      fs.writeFileSync("/tmp/dash_ss2.png", Buffer.from(ss2.data, "base64"));
    }
  }

  ws.close();
  chrome.kill();
  console.log("Done test.");
}

test().catch(console.error);
