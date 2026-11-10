// Renders the REAL email templates from apps-script/Code.gs into .email-preview/ so you can look at
// them in a browser without placing orders or sending anything.
//   npm run preview:email      then open .email-preview/index.html
// Uses NEXT_PUBLIC_BRAND_NAME from .env.local as the shop name.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const codePath = process.argv[2] || "apps-script/Code.gs";
const outDir = path.join(process.cwd(), ".email-preview");
const store = process.env.NEXT_PUBLIC_BRAND_NAME || "Bel Air Fragrances";
const props = { API_SECRET: "x", OWNER_EMAIL: "owner@example.com", STORE_NAME: store };
if (process.env.LOGO_URL) props.LOGO_URL = process.env.LOGO_URL;
const sent = [];

const ctx = {
  console, Date, Math, JSON, String, Number, Object, isNaN, RegExp, Array,
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }) },
  Session: { getScriptTimeZone: () => "UTC", getEffectiveUser: () => ({ getEmail: () => "owner@example.com" }) },
  Utilities: {
    formatDate: (d) => d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }),
  },
  SpreadsheetApp: { getActive: () => ({ getUrl: () => "https://docs.google.com/spreadsheets/d/YOUR-SHEET/edit" }) },
  MailApp: { sendEmail: (m) => sent.push(m) },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(codePath, "utf8"), ctx);
ctx.testSetup(); // sample order: 3 items, a coupon, free delivery, a note

fs.mkdirSync(outDir, { recursive: true });
const owner = sent.find((m) => m.subject.startsWith("New order"));
const customer = sent.find((m) => m.subject.startsWith("Your order"));
fs.writeFileSync(path.join(outDir, "owner.html"), owner.htmlBody);
fs.writeFileSync(path.join(outDir, "customer.html"), customer.htmlBody);
fs.writeFileSync(path.join(outDir, "owner.txt"), owner.body);
fs.writeFileSync(path.join(outDir, "customer.txt"), customer.body);

const frame = (title, subject, file, w) =>
  `<figure><figcaption><b>${title}</b><br><small>Subject: ${subject.replace(/</g, "&lt;")}</small></figcaption>` +
  `<iframe src="${file}" style="width:${w}px;height:${w > 400 ? 1150 : 1250}px;border:1px solid #ccc;background:#fff"></iframe></figure>`;
fs.writeFileSync(
  path.join(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Email preview</title>
<body style="font-family:Arial,sans-serif;background:#ddd;margin:0;padding:20px">
<h2 style="margin:0 0 4px">Email preview</h2>
<p style="margin:0 0 20px;color:#555">The real templates from apps-script/Code.gs with sample data. Nothing is sent. Plain-text versions: owner.txt, customer.txt.</p>
<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">
${frame("Owner email (desktop)", owner.subject, "owner.html", 640)}
${frame("Customer email (desktop)", customer.subject, "customer.html", 640)}
${frame("Customer email (phone width)", customer.subject, "customer.html", 375)}
</div></body>`,
);
console.log("Wrote " + path.relative(process.cwd(), outDir) + "/ (open index.html in your browser)");
