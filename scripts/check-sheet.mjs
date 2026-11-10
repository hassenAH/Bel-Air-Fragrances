// Diagnoses the Google Sheet connection. Run:  npm run check:sheet
// Reads APPS_SCRIPT_URL / APPS_SCRIPT_SECRET from .env.local. Creates NO order row.

const url = process.env.APPS_SCRIPT_URL?.trim();
const secret = process.env.APPS_SCRIPT_SECRET?.trim();
let failed = false;

const ok = (m) => console.log(`  OK    ${m}`);
const bad = (m, fix) => {
  failed = true;
  console.log(`  FAIL  ${m}`);
  if (fix) console.log(`        -> ${fix}`);
};

console.log("\nChecking the Google Sheet connection\n");

// 1) Env vars
if (!url) bad("APPS_SCRIPT_URL is empty or missing", "Put the Web app URL (ends in /exec) in .env.local, then restart `npm run dev`.");
else if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
  bad(
    `APPS_SCRIPT_URL does not look right: ${url.replace(/\/s\/[^/]+/, "/s/<ID>")}`,
    "It must look like https://script.google.com/macros/s/<ID>/exec (use the /exec URL from Deploy > Manage deployments, not /dev).",
  );
} else ok("APPS_SCRIPT_URL looks right");

if (!secret) bad("APPS_SCRIPT_SECRET is empty or missing", "Set it to the same value as the API_SECRET script property in Apps Script.");
else ok("APPS_SCRIPT_SECRET is set");

if (!url || !secret || failed) {
  console.log("\nFix the problems above and run `npm run check:sheet` again.\n");
  process.exit(1);
}

const isHtml = (t) => /^\s*</.test(t);

// 2) Can the site read products? (GET)
try {
  const res = await fetch(`${url}?action=catalog`, { redirect: "follow" });
  const text = await res.text();
  if (res.status === 404) {
    bad(
      "Google says this Web app does not exist (HTTP 404)",
      "The deployment ID in APPS_SCRIPT_URL is wrong or the deployment was deleted. Copy the URL again from Deploy > Manage deployments.",
    );
  } else if (isHtml(text)) {
    bad(
      `Google answered with a web page instead of data (HTTP ${res.status})`,
      'In Apps Script: Deploy > Manage deployments > edit > "Who has access" = Anyone, then Deploy. (A login page here means access is not set to Anyone.)',
    );
  } else {
    const data = JSON.parse(text);
    if (!data.ok) bad(`Apps Script returned an error: ${data.error}`, "Check the sheet tab is named exactly Products.");
    else {
      ok(`Products tab is readable (${data.products.length} active products)`);
      if (data.products.length === 0) bad("The Products tab has no active products", "Add rows under the header row (id, name, price, size, stock, ...).");
    }
  }
} catch (e) {
  bad(`Could not reach the Web app: ${e.message}`, "Check your internet connection and the URL.");
}

// 3) Is the secret accepted and the latest code deployed? (POST with an empty customer: nothing is saved)
try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret, items: [{ id: "check", qty: 1 }], customer: {} }),
    redirect: "follow",
  });
  const text = await res.text();
  if (isHtml(text)) {
    bad(
      "The Web app does not accept orders (got a web page back)",
      "Paste the latest Code.gs, then Deploy > Manage deployments > edit > Version: New version > Deploy.",
    );
  } else {
    const data = JSON.parse(text);
    if (data.error === "Unauthorized") {
      bad(
        "The secret was rejected (Unauthorized)",
        "API_SECRET in Apps Script > Project Settings > Script properties must equal APPS_SCRIPT_SECRET in .env.local (no spaces/quotes).",
      );
    } else if (data.error === "Missing customer details.") {
      ok("Secret accepted and order endpoint is live (no order was created)");
    } else {
      bad(`Unexpected reply from order endpoint: ${text.slice(0, 120)}`, "Redeploy the latest Code.gs as a New version.");
    }
  }
} catch (e) {
  bad(`Order endpoint failed: ${e.message}`);
}

// 4) Are coupons supported by the deployed script? (checks a code that cannot exist: nothing is used)
try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret, action: "coupon", code: "CHECK-NOT-A-REAL-CODE" }),
    redirect: "follow",
  });
  const text = await res.text();
  const data = isHtml(text) ? null : JSON.parse(text);
  if (data?.error === "Invalid coupon code." && data.version >= 2) {
    ok("Coupons are supported, including shared codes (max_uses, one use per customer)");
  } else if (data?.error === "Invalid coupon code.") {
    bad(
      "The deployed script has coupons but not shared codes (max_uses / one use per customer) yet",
      "Paste the latest Code.gs, then Deploy > Manage deployments > edit > Version: New version > Deploy.",
    );
  } else if (data?.error === "Missing customer details." || data === null) {
    bad(
      "The deployed script does not know about coupons yet",
      "Paste the latest Code.gs, then Deploy > Manage deployments > edit > Version: New version > Deploy.",
    );
  } else bad(`Unexpected reply to the coupon check: ${text.slice(0, 120)}`);
} catch (e) {
  bad(`Coupon check failed: ${e.message}`);
}

// 5) How are emails sent? (read-only status: queue = fast orders, direct = emails sent during the order)
try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret, action: "status" }),
    redirect: "follow",
  });
  const text = await res.text();
  const data = isHtml(text) ? null : JSON.parse(text);
  if (data?.ok && data.mail === "queue") {
    const age = data.heartbeatAgeSec;
    if (age === null || age > 300) {
      bad(
        `Email queue is on but its trigger has not run for ${age === null ? "a while" : Math.round(age / 60) + " min"}`,
        "In Apps Script open Triggers (clock icon) and check sendQueuedMail exists, or run installMailTrigger again. Until it runs, orders send their emails immediately (slower, but nothing is lost).",
      );
    } else {
      ok(`Email queue is running (last run ${age}s ago, ${data.queued} waiting) — orders are fast`);
    }
  } else if (data?.ok) {
    console.log("  NOTE  Emails are sent during the order, which makes orders slow (often 8-12 s).");
    console.log("        -> For fast orders run installMailTrigger once in Apps Script (see README: Faster orders).");
  } else {
    console.log("  NOTE  Could not read the email status (older script?). Paste the latest Code.gs and redeploy to get fast orders.");
  }
} catch (e) {
  bad(`Status check failed: ${e.message}`);
}

console.log(
  failed
    ? "\nSome checks failed. Fix them, then run `npm run check:sheet` again.\n"
    : "\nAll good. Restart `npm run dev`, place a test order, and check the Orders tab.\n",
);
process.exit(failed ? 1 : 0);
