// Run: npm run test:script   —   runs the real apps-script/Code.gs against an in-memory fake of Google Sheets/Mail/Locks.
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const CODE = fs.readFileSync(process.argv[2] || "apps-script/Code.gs", "utf8");

function makeWorld(coupons, opts = {}) {
  const sheets = {
    Products: [
      ["id", "name", "price", "size", "stock", "image", "description", "top_notes", "heart_notes", "base_notes", "active"],
      ["a-50", "Alpha", 100, "50ml", 10, "", "", "", "", "", true],
      ["a-100", "Alpha", 150, "100ml", 1, "", "", "", "", "", true],
    ],
    Orders: [opts.ordersHeader || ["order_id", "date", "status", "name", "phone", "email", "city", "address", "items", "subtotal", "delivery", "total", "notes", "coupon", "discount"]],
    Settings: [["key", "value"], ["delivery_fee", 7], ["free_delivery_over", 200], ...(opts.settingsExtra || [])],
    ...(opts.testimonials ? { Testimonials: opts.testimonials.map((r) => r.slice()) } : {}),
    Coupons: coupons && coupons.map((row) => row.slice()), // copy: tests must never share state
  };
  const mails = [];
  // Mutable fake of Script Properties, triggers and locks (the email queue uses all three).
  const props = { API_SECRET: "s3cret", OWNER_EMAIL: "owner@x.com", STORE_NAME: "Shop" };
  const triggers = [];
  const failMail = { next: 0, always: false }; // make the next N sends throw (or all of them)
  const docLock = { busy: false };
  const mkSheet = (data) => ({
    getDataRange: () => ({ getValues: () => data.map((r) => r.slice()) }),
    getLastColumn: () => Math.max(...data.map((r) => r.length)),
    getLastRow: () => data.length,
    appendRow: (row) => data.push(row.slice()),
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (data[r - 1 + i] || [])[c - 1 + j] ?? "")),
      setValue: (v) => { data[r - 1][c - 1] = v; },
    }),
  });
  const ctx = {
    console,
    Date, Math, JSON, String, Number, Object, isNaN, RegExp, Array,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null),
        getProperties: () => ({ ...props }),
        setProperty: (k, v) => {
          if (opts.failQueueWrite && String(k).startsWith("mail:")) throw new Error("quota");
          props[k] = String(v);
        },
        deleteProperty: (k) => { delete props[k]; },
      }),
    },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (s) => ({ s, setMimeType() { return this; } }) },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
      getDocumentLock: () => ({ tryLock: () => !docLock.busy, releaseLock() {} }),
    },
    ScriptApp: {
      newTrigger: (fn) => ({ timeBased: () => ({ everyMinutes: (n) => ({ create: () => triggers.push({ fn, every: n }) }) }) }),
      getProjectTriggers: () => triggers.map((t) => ({ getHandlerFunction: () => t.fn, _t: t })),
      deleteTrigger: (h) => { const i = triggers.indexOf(h._t); if (i >= 0) triggers.splice(i, 1); },
    },
    SpreadsheetApp: {
      getActive: () => ({
        getSheetByName: (n) => (sheets[n] ? mkSheet(sheets[n]) : null),
        getUrl: () => ("sheetUrl" in opts ? opts.sheetUrl : "https://docs.google.com/spreadsheets/d/FAKE/edit"),
      }),
      flush() {},
    },
    Utilities: { formatDate: () => "260101" },
    Session: { getScriptTimeZone: () => "UTC", getEffectiveUser: () => ({ getEmail: () => "owner@x.com" }) },
    MailApp: {
      sendEmail: (m) => {
        if (failMail.always || failMail.next > 0) { failMail.next = Math.max(0, failMail.next - 1); throw new Error("mail quota"); }
        mails.push(m);
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  const call = (payload) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ secret: "s3cret", ...payload }) } }).s);
  return { sheets, mails, call, ctx, props, triggers, failMail, docLock };
}

const day = (offset) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset); return d; };
const H = ["code", "percent", "expires", "used", "used_at", "order_id"];
const customer = { name: "Test", phone: "+216 20 000 000", email: "t@x.com", city: "Tunis", address: "1 Rue" };
const order = (items, coupon) => ({ items, customer, ...(coupon ? { coupon } : {}) });

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };

console.log("Coupon checks");
test("valid coupon returns percent (case/space insensitive), does not use it", () => {
  const w = makeWorld([H, ["SAVE10", 10, day(5), false, "", ""]]);
  const r = w.call({ action: "coupon", code: "  save10 " });
  assert.deepStrictEqual(r, { ok: true, code: "SAVE10", percent: 10, version: 2 });
  assert.strictEqual(w.sheets.Coupons[1][3], false);
});
test("unknown code rejected", () => {
  const w = makeWorld([H, ["SAVE10", 10, day(5), false, "", ""]]);
  assert.strictEqual(w.call({ action: "coupon", code: "NOPE" }).error, "Invalid coupon code.");
  assert.strictEqual(w.call({ action: "coupon", code: "NOPE" }).version, 2, "check:sheet reads this marker");
  assert.strictEqual(w.call({ action: "coupon", code: "" }).error, "Enter a coupon code.");
});
test("expired yesterday -> expired; expires today -> still valid until end of day", () => {
  const w = makeWorld([H, ["OLD", 10, day(-1), false, "", ""], ["TODAY", 10, day(0), false, "", ""]]);
  assert.strictEqual(w.call({ action: "coupon", code: "OLD" }).error, "This coupon has expired.");
  assert.strictEqual(w.call({ action: "coupon", code: "TODAY" }).ok, true);
});
test("blank expiry never expires; text date is read", () => {
  const w = makeWorld([H, ["FOREVER", 15, "", false, "", ""], ["TXT", 5, "2999-12-31", false, "", ""], ["BADDATE", 5, "not a date", false, "", ""]]);
  assert.strictEqual(w.call({ action: "coupon", code: "FOREVER" }).percent, 15);
  assert.strictEqual(w.call({ action: "coupon", code: "TXT" }).ok, true);
  assert.strictEqual(w.call({ action: "coupon", code: "BADDATE" }).ok, false); // fails closed
});
test("used flag accepts TRUE/true/yes", () => {
  const w = makeWorld([H, ["A", 10, "", true, "", ""], ["B", 10, "", "TRUE", "", ""], ["C", 10, "", "yes", "", ""]]);
  for (const c of ["A", "B", "C"]) assert.strictEqual(w.call({ action: "coupon", code: c }).error, "This coupon has already been used.");
});
test("percent: 10% formatted cell (0.1) -> 10; >100 capped; 0 or text rejected", () => {
  const w = makeWorld([H, ["P1", 0.1, "", false, "", ""], ["P2", 250, "", false, "", ""], ["P0", 0, "", false, "", ""], ["PX", "abc", "", false, "", ""]]);
  assert.strictEqual(w.call({ action: "coupon", code: "P1" }).percent, 10);
  assert.strictEqual(w.call({ action: "coupon", code: "P2" }).percent, 100);
  assert.strictEqual(w.call({ action: "coupon", code: "P0" }).ok, false);
  assert.strictEqual(w.call({ action: "coupon", code: "PX" }).ok, false);
});
test("coupons sheet without a 'used' column fails closed (could never be marked used)", () => {
  const w = makeWorld([["code", "percent", "expires"], ["NOUSED", 10, ""]]);
  assert.strictEqual(w.call({ action: "coupon", code: "NOUSED" }).ok, false);
});
test("missing Coupons tab -> invalid, not a crash; wrong secret -> Unauthorized", () => {
  const w = makeWorld(undefined);
  delete w.sheets.Coupons;
  assert.strictEqual(w.call({ action: "coupon", code: "X" }).error, "Invalid coupon code.");
  const bad = JSON.parse(w.ctx.doPost({ postData: { contents: JSON.stringify({ secret: "wrong", action: "coupon", code: "X" }) } }).s);
  assert.strictEqual(bad.error, "Unauthorized");
});

console.log("Orders with coupons");
test("10% off 2x100: discount 20, total 180 + 7 delivery (180 < 200), coupon marked used, row written, stock down", () => {
  const w = makeWorld([H, ["SAVE10", 10, day(3), false, "", ""]]);
  const r = w.call(order([{ id: "a-50", qty: 2 }], "save10"));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.discount, 20);
  assert.strictEqual(r.total, 187);
  assert.strictEqual(w.sheets.Coupons[1][3], true);
  assert.strictEqual(w.sheets.Coupons[1][5], r.orderId);
  assert.ok(w.sheets.Coupons[1][4] instanceof Date);
  const row = w.sheets.Orders[1];
  assert.deepStrictEqual([row[9], row[10], row[11], row[13], row[14]], [200, 7, 187, "SAVE10", 20]);
  assert.strictEqual(w.sheets.Products[1][4], 8);
  assert.ok(w.mails.some((m) => /Coupon SAVE10/.test(m.htmlBody)), "owner email shows the coupon");
});
test("ONE-TIME USE: the second order with the same code is rejected; stock and orders untouched", () => {
  const w = makeWorld([H, ["ONCE", 10, "", false, "", ""]]);
  assert.strictEqual(w.call(order([{ id: "a-50", qty: 1 }], "ONCE")).ok, true);
  const second = w.call(order([{ id: "a-50", qty: 1 }], "ONCE"));
  assert.deepStrictEqual([second.ok, second.error], [false, "This coupon has already been used."]);
  assert.strictEqual(w.sheets.Orders.length, 2);
  assert.strictEqual(w.sheets.Products[1][4], 9);
});
test("expired coupon blocks the order: nothing is written, stock unchanged", () => {
  const w = makeWorld([H, ["OLD", 10, day(-2), false, "", ""]]);
  const r = w.call(order([{ id: "a-50", qty: 1 }], "OLD"));
  assert.deepStrictEqual([r.ok, r.error], [false, "This coupon has expired."]);
  assert.strictEqual(w.sheets.Orders.length, 1);
  assert.strictEqual(w.sheets.Products[1][4], 10);
});
test("out-of-stock order does NOT burn the coupon", () => {
  const w = makeWorld([H, ["KEEP", 10, "", false, "", ""]]);
  const r = w.call(order([{ id: "a-100", qty: 5 }], "KEEP"));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(w.sheets.Coupons[1][3], false);
});
test("free delivery is judged after the discount: 2x100=200 -10% = 180 -> pays delivery; 3x100 -10% = 270 -> free", () => {
  let w = makeWorld([H, ["D", 10, "", false, "", ""]]);
  assert.strictEqual(w.call(order([{ id: "a-50", qty: 2 }], "D")).total, 187);
  w = makeWorld([H, ["D", 10, "", false, "", ""]]);
  assert.strictEqual(w.call(order([{ id: "a-50", qty: 3 }], "D")).total, 270);
});
test("100% coupon: products free, only delivery to pay", () => {
  const w = makeWorld([H, ["FREE", 100, "", false, "", ""]]);
  const r = w.call(order([{ id: "a-50", qty: 1 }], "FREE"));
  assert.deepStrictEqual([r.ok, r.discount, r.total], [true, 100, 7]);
});
test("odd percent rounds to cents: 15% of 150 = 22.5 ; 12.5% of 100 = 12.5", () => {
  let w = makeWorld([H, ["R", 15, "", false, "", ""]]);
  assert.strictEqual(w.call(order([{ id: "a-100", qty: 1 }], "R")).discount, 22.5);
  w = makeWorld([H, ["R", 12.5, "", false, "", ""]]);
  assert.strictEqual(w.call(order([{ id: "a-50", qty: 1 }], "R")).discount, 12.5);
});
test("orders without a coupon are unchanged (blank coupon, 0 discount)", () => {
  const w = makeWorld([H, ["X", 10, "", false, "", ""]]);
  const r = w.call(order([{ id: "a-50", qty: 1 }]));
  assert.deepStrictEqual([r.ok, r.discount, r.total], [true, 0, 107]);
  const row = w.sheets.Orders[1];
  assert.deepStrictEqual([row[13], row[14]], ["", 0]);
  assert.strictEqual(w.sheets.Coupons[1][3], false);
});

console.log("Shared codes: max_uses, uses counter, one use per customer");
const H2 = ["code", "percent", "expires", "max_uses", "uses", "used", "used_at", "order_id"];
const as = (phone, email, coupon, items = [{ id: "a-50", qty: 1 }]) => ({
  items,
  customer: { name: "C", phone, email, city: "Tunis", address: "1 Rue" },
  coupon,
});

test("max_uses=3: three different customers can use it, the 4th is refused; counter and 'used' follow", () => {
  const w = makeWorld([H2, ["TEAM", 10, "", 3, 0, "", "", ""]]);
  assert.strictEqual(w.call(as("+216 20 000 001", "a@x.com", "TEAM")).ok, true);
  assert.strictEqual(w.sheets.Coupons[1][4], 1);
  assert.notStrictEqual(w.sheets.Coupons[1][5], true, "not used up after 1 use");
  assert.strictEqual(w.call(as("+216 20 000 002", "b@x.com", "TEAM")).ok, true);
  assert.strictEqual(w.call(as("+216 20 000 003", "c@x.com", "TEAM")).ok, true);
  assert.strictEqual(w.sheets.Coupons[1][4], 3);
  assert.strictEqual(w.sheets.Coupons[1][5], true, "ticked when used up");
  const fourth = w.call(as("+216 20 000 004", "d@x.com", "TEAM"));
  assert.deepStrictEqual([fourth.ok, fourth.error], [false, "This coupon has reached its usage limit."]);
  assert.strictEqual(w.sheets.Coupons[1][4], 3);
  assert.strictEqual(w.sheets.Orders.length, 4);
});
test("the same customer cannot use a shared code twice (same phone, any format)", () => {
  const w = makeWorld([H2, ["TEAM", 10, "", 50, 0, "", "", ""]]);
  assert.strictEqual(w.call(as("+216 20 123 456", "", "TEAM")).ok, true);
  for (const phone of ["+216 20 123 456", "20123456", "(216) 20-123-456", "0020 123 456"]) {
    const r = w.call(as(phone, "", "TEAM"));
    assert.deepStrictEqual([r.ok, r.error], [false, "You have already used this coupon."], phone);
  }
  assert.strictEqual(w.sheets.Coupons[1][4], 1);
  assert.strictEqual(w.sheets.Products[1][4], 9, "refused orders did not take stock");
});
test("the same customer cannot use it twice with another phone but the same email (case-insensitive)", () => {
  const w = makeWorld([H2, ["TEAM", 10, "", 50, 0, "", "", ""]]);
  assert.strictEqual(w.call(as("+216 20 000 001", "Same@X.com", "TEAM")).ok, true);
  const r = w.call(as("+216 55 555 555", " same@x.COM ", "TEAM"));
  assert.strictEqual(r.error, "You have already used this coupon.");
  assert.strictEqual(w.call(as("+216 55 555 555", "other@x.com", "TEAM")).ok, true);
});
test("different customers with a similar-looking phone are NOT confused", () => {
  const w = makeWorld([H2, ["TEAM", 10, "", 50, 0, "", "", ""]]);
  assert.strictEqual(w.call(as("+216 20 123 456", "", "TEAM")).ok, true);
  assert.strictEqual(w.call(as("+216 20 123 457", "", "TEAM")).ok, true);
});
test("'unlimited' has no cap and never ticks 'used'", () => {
  const w = makeWorld([H2, ["ALL", 5, "", "Unlimited", "", "", "", ""]]);
  for (let i = 0; i < 6; i++) assert.strictEqual(w.call(as("+216 20 000 00" + i, "", "ALL")).ok, true);
  assert.strictEqual(w.sheets.Coupons[1][4], 6);
  assert.notStrictEqual(w.sheets.Coupons[1][5], true);
});
test("blank or 1 max_uses = single use, exactly as before (no per-customer lookup needed)", () => {
  for (const mu of ["", 1]) {
    const w = makeWorld([H2, ["ONE", 10, "", mu, "", "", "", ""]]);
    assert.strictEqual(w.call(as("+216 20 000 001", "", "ONE")).ok, true);
    assert.strictEqual(w.sheets.Coupons[1][5], true);
    assert.strictEqual(w.call(as("+216 20 000 002", "", "ONE")).error, "This coupon has already been used.");
  }
});
test("invalid max_uses (0, -2, text, 2.5) -> coupon not valid (fails closed)", () => {
  for (const mu of [0, -2, "many", 2.5]) {
    const w = makeWorld([H2, ["BAD", 10, "", mu, "", "", "", ""]]);
    assert.strictEqual(w.call({ action: "coupon", code: "BAD" }).ok, false, String(mu));
  }
});
test("shared code but the sheet has no 'uses' column -> refused (the limit could not be enforced)", () => {
  const w = makeWorld([["code", "percent", "expires", "max_uses", "used"], ["TEAM", 10, "", 5, ""]]);
  assert.strictEqual(w.call({ action: "coupon", code: "TEAM" }).ok, false);
});
test("shared code but Orders has no 'coupon' column -> order refused (can't check earlier customers)", () => {
  const w = makeWorld([H2, ["TEAM", 10, "", 5, 0, "", "", ""]], { ordersHeader: ["order_id", "date", "status", "name", "phone", "email"] });
  const r = w.call(as("+216 20 000 001", "", "TEAM"));
  assert.deepStrictEqual([r.ok, r.error], [false, "This coupon is not valid."]);
  assert.strictEqual(w.sheets.Products[1][4], 10);
});
test("the apply-time check (no customer yet) accepts a shared code; the order-time check enforces one-per-customer", () => {
  const w = makeWorld([H2, ["TEAM", 10, "", 50, 0, "", "", ""]]);
  assert.strictEqual(w.call(as("+216 20 123 456", "", "TEAM")).ok, true);
  assert.strictEqual(w.call({ action: "coupon", code: "TEAM" }).ok, true);
  assert.strictEqual(w.call(as("+216 20 123 456", "", "TEAM")).ok, false);
});
test("a failed order (out of stock) does not count as a use of a shared code", () => {
  const w = makeWorld([H2, ["TEAM", 10, "", 2, 0, "", "", ""]]);
  assert.strictEqual(w.call(as("+216 20 000 001", "", "TEAM", [{ id: "a-100", qty: 9 }])).ok, false);
  assert.strictEqual(w.sheets.Coupons[1][4], 0);
  assert.strictEqual(w.call(as("+216 20 000 001", "", "TEAM")).ok, true);
});
test("expired shared code is refused; manually ticking 'used' switches a shared code off", () => {
  let w = makeWorld([H2, ["OLD", 10, day(-1), 50, 0, "", "", ""]]);
  assert.strictEqual(w.call(as("+216 20 000 001", "", "OLD")).error, "This coupon has expired.");
  w = makeWorld([H2, ["OFF", 10, "", 50, 3, true, "", ""]]);
  assert.strictEqual(w.call(as("+216 20 000 001", "", "OFF")).error, "This coupon has reached its usage limit.");
});
test("two shared codes are counted separately (same customer may use two different codes)", () => {
  const w = makeWorld([H2, ["ONE", 10, "", 50, 0, "", "", ""], ["TWO", 10, "", 50, 0, "", "", ""]]);
  assert.strictEqual(w.call(as("+216 20 000 001", "", "ONE")).ok, true);
  assert.strictEqual(w.call(as("+216 20 000 001", "", "TWO")).ok, true);
  assert.strictEqual(w.sheets.Coupons[1][4], 1);
  assert.strictEqual(w.sheets.Coupons[2][4], 1);
});

console.log("Email queue (faster orders)");
const COUP = [H, ["SAVE10", 10, "", false, "", ""]];
const queued = (w) => Object.keys(w.props).filter((k) => k.startsWith("mail:"));
const queueWorld = (coupons = COUP, opts) => { const w = makeWorld(coupons, opts); w.ctx.installMailTrigger(); return w; };

test("default (queue not installed): emails are sent during the order, nothing is queued", () => {
  const w = makeWorld(COUP);
  const r = w.call(as("+216 20 000 001", "a@x.com"));
  assert.deepStrictEqual([r.ok, r.mail], [true, "sent"]);
  assert.strictEqual(w.mails.length, 2);
  assert.deepStrictEqual(queued(w), []);
  assert.strictEqual(w.call({ action: "status" }).mail, "direct");
});
test("installMailTrigger: one 1-minute trigger, queue mode on, heartbeat set; running it twice keeps ONE trigger", () => {
  const w = makeWorld(COUP);
  w.ctx.installMailTrigger();
  w.ctx.installMailTrigger();
  assert.deepStrictEqual(w.triggers, [{ fn: "sendQueuedMail", every: 1 }]);
  assert.strictEqual(w.props.MAIL_MODE, "queue");
  assert.ok(Date.now() - Number(w.props.MAIL_HEARTBEAT) < 5000);
});
test("queue on: the order answers without sending any email; the trigger then sends BOTH, once", () => {
  const w = queueWorld();
  const r = w.call(as("+216 20 000 001", "a@x.com", "SAVE10", [{ id: "a-50", qty: 2 }]));
  assert.deepStrictEqual([r.ok, r.mail, typeof r.ms], [true, "queued", "number"]);
  assert.strictEqual(w.mails.length, 0, "no email during the order");
  // everything else about the order is already saved
  assert.strictEqual(w.sheets.Orders.length, 2);
  assert.strictEqual(w.sheets.Products[1][4], 8);
  assert.strictEqual(w.sheets.Coupons[1][3], true);
  assert.deepStrictEqual(queued(w), ["mail:" + r.orderId]);

  w.ctx.sendQueuedMail();
  assert.strictEqual(w.mails.length, 2);
  const owner = w.mails.find((m) => m.to === "owner@x.com");
  const customer = w.mails.find((m) => m.to === "a@x.com");
  assert.ok(owner.subject.includes(r.orderId) && owner.htmlBody.includes("SAVE10") && owner.htmlBody.includes("+216 20 000 001"));
  assert.ok(owner.body.includes("Phone: +216 20 000 001") && owner.body.includes("Coupon SAVE10"), "plain-text part");
  assert.ok(customer.subject.includes(r.orderId));
  assert.deepStrictEqual(queued(w), []);
  w.ctx.sendQueuedMail();
  assert.strictEqual(w.mails.length, 2, "a second run sends nothing more");
});
test("customer without an email: only the owner is emailed", () => {
  const w = queueWorld();
  w.call(as("+216 20 000 001", ""));
  w.ctx.sendQueuedMail();
  assert.deepStrictEqual(w.mails.map((m) => m.to), ["owner@x.com"]);
  assert.deepStrictEqual(queued(w), []);
});
test("SAFETY NET: heartbeat older than 10 minutes (or missing) -> emails are sent immediately, nothing queued", () => {
  let w = queueWorld();
  w.props.MAIL_HEARTBEAT = String(Date.now() - 11 * 60 * 1000);
  let r = w.call(as("+216 20 000 001", "a@x.com"));
  assert.deepStrictEqual([r.mail, w.mails.length, queued(w).length], ["sent", 2, 0]);
  w = queueWorld();
  delete w.props.MAIL_HEARTBEAT;
  r = w.call(as("+216 20 000 001", "a@x.com"));
  assert.deepStrictEqual([r.mail, w.mails.length], ["sent", 2]);
  w = queueWorld();
  w.props.MAIL_HEARTBEAT = String(Date.now() - 9 * 60 * 1000);
  assert.strictEqual(w.call(as("+216 20 000 001", "a@x.com")).mail, "queued", "9 minutes is still healthy");
});
test("if the queue cannot be written, the emails are sent immediately instead of being lost", () => {
  const w = queueWorld(COUP, { failQueueWrite: true });
  const r = w.call(as("+216 20 000 001", "a@x.com"));
  assert.deepStrictEqual([r.ok, r.mail, w.mails.length], [true, "sent", 2]);
});
test("RETRY: if the owner email fails, only the owner email is retried (the customer is not emailed twice)", () => {
  const w = queueWorld();
  const r = w.call(as("+216 20 000 001", "a@x.com"));
  w.failMail.next = 1; // the owner email is sent first and fails
  w.ctx.sendQueuedMail();
  assert.deepStrictEqual(w.mails.map((m) => m.to), ["a@x.com"]);
  const job = JSON.parse(w.props["mail:" + r.orderId]);
  assert.deepStrictEqual([job.ownerDone, job.customerDone, job.attempts], [false, true, 1]);
  w.ctx.sendQueuedMail();
  assert.deepStrictEqual(w.mails.map((m) => m.to).sort(), ["a@x.com", "owner@x.com"]);
  assert.deepStrictEqual(queued(w), []);
  w.ctx.sendQueuedMail();
  assert.strictEqual(w.mails.length, 2);
});
test("GIVES UP after 5 failed tries (no endless loop); order itself is untouched", () => {
  const w = queueWorld();
  const r = w.call(as("+216 20 000 001", "a@x.com"));
  w.failMail.always = true;
  for (let i = 1; i <= 4; i++) { w.ctx.sendQueuedMail(); assert.strictEqual(queued(w).length, 1, "still queued after try " + i); }
  w.ctx.sendQueuedMail();
  assert.deepStrictEqual(queued(w), []);
  w.ctx.sendQueuedMail();
  assert.strictEqual(w.mails.length, 0);
  assert.strictEqual(w.sheets.Orders[1][0], r.orderId);
});
test("two runs at once: the second one does nothing (document lock held by the first)", () => {
  const w = queueWorld();
  w.call(as("+216 20 000 001", "a@x.com"));
  w.docLock.busy = true;
  w.ctx.sendQueuedMail();
  assert.strictEqual(w.mails.length, 0);
  assert.strictEqual(queued(w).length, 1);
  w.docLock.busy = false;
  w.ctx.sendQueuedMail();
  assert.strictEqual(w.mails.length, 2);
});
test("every run refreshes the heartbeat, even with nothing to send", () => {
  const w = queueWorld();
  w.props.MAIL_HEARTBEAT = String(Date.now() - 5 * 60 * 1000);
  w.ctx.sendQueuedMail();
  assert.ok(Date.now() - Number(w.props.MAIL_HEARTBEAT) < 5000);
});
test("removeMailTrigger: pending emails are sent first, trigger and queue mode removed, orders send immediately again", () => {
  const w = queueWorld();
  w.call(as("+216 20 000 001", "a@x.com"));
  w.ctx.removeMailTrigger();
  assert.strictEqual(w.mails.length, 2);
  assert.deepStrictEqual([w.triggers.length, w.props.MAIL_MODE, w.props.MAIL_HEARTBEAT], [0, undefined, undefined]);
  const r = w.call(as("+216 20 000 002", "b@x.com"));
  assert.deepStrictEqual([r.mail, w.mails.length], ["sent", 4]);
});
test("status action: direct vs queue, queued count, heartbeat age; needs the secret", () => {
  const w = queueWorld();
  w.call(as("+216 20 000 001", "a@x.com"));
  const s = w.call({ action: "status" });
  assert.deepStrictEqual([s.ok, s.version, s.mail, s.queued], [true, 2, "queue", 1]);
  assert.ok(s.heartbeatAgeSec >= 0 && s.heartbeatAgeSec < 5);
  const bad = JSON.parse(w.ctx.doPost({ postData: { contents: JSON.stringify({ secret: "nope", action: "status" }) } }).s);
  assert.strictEqual(bad.error, "Unauthorized");
});
test("queued orders are processed oldest first, each exactly once", () => {
  const w = queueWorld();
  const ids = [1, 2, 3].map((n) => w.call(as("+216 20 000 00" + n, n + "@x.com")).orderId);
  w.ctx.sendQueuedMail();
  const subjects = w.mails.filter((m) => m.to === "owner@x.com").map((m) => ids.find((id) => m.subject.includes(id)));
  assert.deepStrictEqual(subjects, ids);
  assert.strictEqual(w.mails.length, 6);
});

console.log("Email design");
const placeAndGet = (w, payload) => {
  const r = w.call(payload);
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  return { r, owner: w.mails.find((m) => m.to === "owner@x.com"), customer: w.mails.find((m) => m.to !== "owner@x.com") };
};
const full = (over = {}) => ({
  items: [{ id: "a-50", qty: 1 }],
  customer: { name: "Sana B.", phone: "+216 20 123 456", email: "sana@x.com", city: "Tunis", address: "12 Rue de Test", notes: "Call after 6pm" },
  currency: "tnd",
  ...over,
});

test("both emails are full HTML documents with a plain-text version and a preheader", () => {
  const { owner, customer } = placeAndGet(makeWorld(COUP), full());
  for (const m of [owner, customer]) {
    assert.ok(m.htmlBody.startsWith("<!doctype html>"));
    assert.ok(typeof m.body === "string" && m.body.length > 40, "plain-text part");
    assert.ok(/display:none;max-height:0/.test(m.htmlBody), "hidden preheader");
  }
  assert.ok(owner.htmlBody.includes("Sana B. · 107 TND to collect"), "owner preheader");
});
test("currency (from the website) is printed; letters only, upper-cased; junk is ignored", () => {
  let { owner, customer, r } = placeAndGet(makeWorld(COUP), full());
  assert.ok(owner.subject.endsWith("(107 TND)"));
  assert.ok(owner.htmlBody.includes("100 TND") && customer.htmlBody.includes("107 TND"));
  assert.ok(customer.body.includes("TOTAL TO PAY ON DELIVERY: 107 TND"));
  ({ owner } = placeAndGet(makeWorld(COUP), full({ currency: "<b>x</b>" })));
  assert.ok(!owner.htmlBody.includes("<b>x</b>") && owner.subject.endsWith("(107)"), "junk currency dropped");
  ({ owner } = placeAndGet(makeWorld(COUP), (({ currency, ...rest }) => rest)(full())));
  assert.ok(owner.subject.endsWith("(107)"), "no currency sent -> plain numbers");
});
test("everything the customer typed is HTML-escaped (no injected markup in either email)", () => {
  const evil = full({ customer: { name: '<script>alert(1)</script>', phone: "+216 20 123 456", email: "e@x.com", city: 'T"unis', address: "A & B <img src=x onerror=1>", notes: "<b>bold</b>" } });
  const { owner, customer } = placeAndGet(makeWorld(COUP), evil);
  for (const m of [owner, customer]) {
    assert.ok(!/<script/i.test(m.htmlBody) && !/<img src=x/i.test(m.htmlBody) && !m.htmlBody.includes("<b>bold</b>"), "no raw markup");
  }
  assert.ok(owner.htmlBody.includes("&lt;script&gt;alert(1)&lt;/script&gt;") && owner.htmlBody.includes("A &amp; B &lt;img"));
});
test("owner email: tel and mailto links, notes callout only when there are notes, link to the orders sheet", () => {
  let { owner } = placeAndGet(makeWorld(COUP), full());
  assert.ok(owner.htmlBody.includes('href="tel:+21620123456"') && owner.htmlBody.includes('href="mailto:sana@x.com"'));
  assert.ok(owner.htmlBody.includes("Call after 6pm") && owner.htmlBody.includes("Open orders sheet"));
  assert.ok(owner.htmlBody.includes('href="https://docs.google.com/spreadsheets/d/FAKE/edit"'));
  ({ owner } = placeAndGet(makeWorld(COUP), full({ customer: { name: "N", phone: "+216 20 123 456", email: "", city: "T", address: "A" } })));
  assert.ok(!owner.htmlBody.includes("font-style:italic") && !owner.htmlBody.includes("mailto:"), "no notes / no email -> nothing printed");
  ({ owner } = placeAndGet(makeWorld(COUP, { sheetUrl: "http://insecure" }), full()));
  assert.ok(!owner.htmlBody.includes("Open orders sheet"), "only an https link is used");
});
test("customer email: thank-you, total to pay, delivery address and the next steps", () => {
  const { customer } = placeAndGet(makeWorld(COUP), full());
  for (const s of ["Thank you, Sana B.!", "What happens next", "12 Rue de Test", "Questions? Just reply to this email."]) assert.ok(customer.htmlBody.includes(s), s);
  assert.ok(customer.htmlBody.includes("Total to pay on delivery") && customer.htmlBody.includes("You pay <b>107 TND</b> in cash"));
});
test("totals: coupon row with percent, 'Free' delivery when 0, the delivery fee when not", () => {
  let w = makeWorld(COUP);
  let { owner } = placeAndGet(w, full({ items: [{ id: "a-50", qty: 3 }], coupon: "SAVE10" })); // 300 -30 = 270 >= 200
  assert.ok(owner.htmlBody.includes("SAVE10") && owner.htmlBody.includes("(&minus;10%)") && owner.htmlBody.includes("&minus;30 TND"));
  assert.ok(owner.htmlBody.includes(">Free<") && owner.body.includes("Delivery: Free") && owner.body.includes("Coupon SAVE10 (-10%): -30 TND"));
  ({ owner } = placeAndGet(makeWorld(COUP), full()));
  assert.ok(owner.htmlBody.includes("7 TND") && !owner.htmlBody.includes("&minus;"), "delivery fee shown, no coupon row");
});
test("optional LOGO_URL: an https image replaces the text brand; anything else is ignored", () => {
  let w = makeWorld(COUP);
  w.props.LOGO_URL = 'https://example.com/logo.png?a=1&b="2"';
  let { owner } = placeAndGet(w, full());
  assert.ok(owner.htmlBody.includes('<img src="https://example.com/logo.png?a=1&amp;b=&quot;2&quot;"'));
  w = makeWorld(COUP);
  w.props.LOGO_URL = "javascript:alert(1)";
  ({ owner } = placeAndGet(w, full()));
  assert.ok(!owner.htmlBody.includes("javascript:") && owner.htmlBody.includes("letter-spacing:5px"), "text brand used");
});
test("helpers: money formatting, unreadable dates do not crash", () => {
  const w = makeWorld(COUP);
  assert.deepStrictEqual([w.ctx.money_(89, "TND"), w.ctx.money_(22.5, "TND"), w.ctx.money_(12.345, ""), w.ctx.money_(0, "TND")], ["89 TND", "22.50 TND", "12.35", "0 TND"]);
  assert.strictEqual(w.ctx.when_("not a date"), "");
});
test("testSetup sends the owner email plus a sample customer email to your own address", () => {
  const w = makeWorld(COUP);
  w.ctx.testSetup();
  assert.deepStrictEqual(w.mails.map((m) => m.subject.split(" — ")[0]), ["New order TEST-0000", "Your order TEST-0000"]);
  assert.ok(w.mails.every((m) => m.to === "owner@x.com" && m.htmlBody.includes("EXAMPLE10")));
});
test("currency and coupon survive the queue (the queued job carries everything the emails need)", () => {
  const w = queueWorld();
  w.call(full({ coupon: "SAVE10" }));
  w.ctx.sendQueuedMail();
  const owner = w.mails.find((m) => m.to === "owner@x.com");
  assert.ok(owner.htmlBody.includes("SAVE10") && owner.htmlBody.includes("TND"));
  const job = w.mails.length;
  assert.strictEqual(job, 2);
});

console.log("Home page content (About + testimonials)");
const catalog = (w) => JSON.parse(w.ctx.doGet({}).s);
const TH = ["name", "rating", "text", "active"];

test("no Testimonials tab and no content keys: the catalog still loads, with empty content", () => {
  const c = catalog(makeWorld(COUP));
  assert.strictEqual(c.ok, true);
  assert.deepStrictEqual([c.content, c.testimonials], [{}, []]);
  assert.strictEqual(c.products.length, 2);
  assert.deepStrictEqual(c.settings, { deliveryFee: 7, freeDeliveryOver: 200 });
});
test("content: only the known keys are sent (nothing else in Settings leaks), trimmed, blanks skipped", () => {
  const w = makeWorld(COUP, {
    settingsExtra: [
      ["about_title", "  Our story  "], ["ABOUT_TEXT", "Line one\n\nLine two"], ["about_image", ""],
      ["google_rating", 4.8], ["google_reviews_count", 127], ["google_maps_url", "https://maps.app.goo.gl/abc"],
      ["reviews_summary", "Clients love it."], ["reviews_title", "What they say"],
      ["api_secret", "TOP-SECRET"], ["owner_email", "me@x.com"], ["something_else", "x"],
    ],
  });
  const c = catalog(w).content;
  assert.deepStrictEqual(c, {
    about_title: "Our story", about_text: "Line one\n\nLine two", google_rating: "4.8", google_reviews_count: "127",
    google_maps_url: "https://maps.app.goo.gl/abc", reviews_summary: "Clients love it.", reviews_title: "What they say",
  });
  assert.ok(!JSON.stringify(catalog(w)).includes("TOP-SECRET"));
});
test("content values are capped at 2000 characters", () => {
  const w = makeWorld(COUP, { settingsExtra: [["about_text", "x".repeat(5000)]] });
  assert.strictEqual(catalog(w).content.about_text.length, 2000);
});
test("testimonials: hidden and empty ones skipped; rating rounded and clamped 0-5; text and name trimmed/capped", () => {
  const w = makeWorld(COUP, {
    testimonials: [
      TH,
      ["Sana", 5, "  Lovely scent!  ", true],
      ["Hidden", 5, "Not shown", false],
      ["No text", 5, "", true],
      ["Too high", 9, "Clamped", ""],
      ["Low", -3, "Clamped up", "yes"],
      ["Decimal", "4,4", "Rounded", true],
      ["", "", "No name, no rating", true],
      ["N".repeat(100), 4, "T".repeat(900), true],
    ],
  });
  const t = catalog(w).testimonials;
  assert.deepStrictEqual(t.slice(0, 6), [
    { name: "Sana", rating: 5, text: "Lovely scent!" },
    { name: "Too high", rating: 5, text: "Clamped" },
    { name: "Low", rating: 0, text: "Clamped up" },
    { name: "Decimal", rating: 4, text: "Rounded" },
    { name: "", rating: 0, text: "No name, no rating" },
    { name: "N".repeat(60), rating: 4, text: "T".repeat(600) },
  ]);
  assert.strictEqual(t.length, 6);
});
test("at most 12 testimonials, in Sheet order", () => {
  const rows = Array.from({ length: 20 }, (_, i) => ["P" + i, 5, "Review " + i, true]);
  const t = catalog(makeWorld(COUP, { testimonials: [TH, ...rows] })).testimonials;
  assert.deepStrictEqual([t.length, t[0].name, t[11].name], [12, "P0", "P11"]);
});

console.log(`\n${passed} tests passed`);

