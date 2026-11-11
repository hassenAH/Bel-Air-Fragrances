/**
 * Perfume store backend — Google Apps Script bound to a Google Sheet.
 *
 * Sheets used (create them with exactly these names and header rows — see ../sheet-template/):
 *   Products : id | name | price | size | stock | image | description | top_notes | heart_notes | base_notes | active
 *   Orders   : order_id | date | status | name | phone | email | city | address | items | subtotal | delivery | total | notes | coupon | discount
 *   Settings : key | value          (optional: delivery_fee, free_delivery_over, and the home page texts:
 *              about_title, about_text, about_image, reviews_title, reviews_summary,
 *              google_rating, google_reviews_count, google_maps_url, and for search engines / sharing:
 *              seo_title, seo_description, seo_image, instagram_url, facebook_url, tiktok_url, contact_phone)
 *   Testimonials : name | rating | text | active     (customer reviews shown on the home page)
 *   Coupons  : code | percent | expires | max_uses | uses | used | used_at | order_id     (% off codes)
 *              percent = plain number (10 = 10% off the products). expires = last valid day (blank = never).
 *              max_uses = blank -> single use (one order in total); a number N -> N orders in total;
 *                         "unlimited" -> no cap. Shared codes (not single use) are also limited to ONE USE
 *                         PER CUSTOMER (same phone or same email).
 *              uses / used / used_at / order_id = leave empty: the script fills them in. "used" is ticked
 *                         when the code is used up (or tick it yourself to switch a code off).
 *              Older sheets with only code | percent | expires | used | used_at | order_id still work
 *              (every code is single use).
 *
 * Script Properties (Project Settings -> Script properties):
 *   API_SECRET   : a long random string, also set as APPS_SCRIPT_SECRET in the website env
 *   OWNER_EMAIL  : (optional) where order notifications go; defaults to the script owner's Gmail
 *   STORE_NAME   : (optional) shown in emails
 *   (MAIL_MODE, MAIL_HEARTBEAT and mail:* are managed by the email queue: do not edit them.)
 *
 * Faster orders: run installMailTrigger once from the editor (see "Email queue" below).
 *
 * Deploy: Deploy -> New deployment -> Web app -> Execute as: Me, Who has access: Anyone.
 */

var PRODUCTS = 'Products';
var ORDERS = 'Orders';
var SETTINGS = 'Settings';
var COUPONS = 'Coupons';
var TESTIMONIALS = 'Testimonials';

function prop_(key, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  return v ? v : fallback;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Read a sheet into an array of objects keyed by the (lower-cased) header row. */
function readTable_(name) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  return values.slice(1).map(function (row, i) {
    var o = { _row: i + 2 };
    headers.forEach(function (h, c) { o[h] = row[c]; });
    return o;
  });
}

function num_(v, d) {
  var n = Number(String(v).replace(',', '.'));
  return isFinite(n) ? n : d;
}

function isActive_(v) {
  if (v === '' || v === null || v === undefined) return true; // blank = active
  var s = String(v).trim().toLowerCase();
  return !(s === 'false' || s === 'no' || s === 'non' || s === '0' || s === 'off');
}

function getSettings_() {
  var s = { deliveryFee: 0, freeDeliveryOver: 0 };
  readTable_(SETTINGS).forEach(function (r) {
    var k = String(r.key).trim().toLowerCase();
    if (k === 'delivery_fee') s.deliveryFee = num_(r.value, 0);
    if (k === 'free_delivery_over') s.freeDeliveryOver = num_(r.value, 0);
  });
  return s;
}

/**
 * Free-text shop content for the home page, from the Settings tab (key | value).
 * Only these keys are ever sent to the website; blank values are skipped.
 */
var CONTENT_KEYS = ['about_title', 'about_text', 'about_image', 'reviews_title', 'reviews_summary',
  'google_rating', 'google_reviews_count', 'google_maps_url',
  'seo_title', 'seo_description', 'seo_image', 'instagram_url', 'facebook_url', 'tiktok_url', 'contact_phone'];

function getContent_() {
  var out = {};
  readTable_(SETTINGS).forEach(function (r) {
    var k = String(r.key).trim().toLowerCase();
    if (CONTENT_KEYS.indexOf(k) < 0) return;
    var v = String(r.value === null || r.value === undefined ? '' : r.value).trim();
    if (v) out[k] = v.slice(0, 2000);
  });
  return out;
}

/** Testimonials tab: name | rating | text | active. Rating 0 (blank) = no stars. At most 12 are shown. */
function getTestimonials_() {
  return readTable_(TESTIMONIALS)
    .filter(function (r) { return String(r.text === null || r.text === undefined ? '' : r.text).trim() !== '' && isActive_(r.active); })
    .slice(0, 12)
    .map(function (r) {
      var rating = Math.round(num_(r.rating, 0));
      return {
        name: String(r.name || '').trim().slice(0, 60),
        rating: Math.min(5, Math.max(0, isNaN(rating) ? 0 : rating)),
        text: String(r.text).trim().slice(0, 600)
      };
    });
}

function getProducts_() {
  return readTable_(PRODUCTS)
    .filter(function (r) { return String(r.id).trim() !== '' && isActive_(r.active); })
    .map(function (r) {
      return {
        id: String(r.id).trim(),
        name: String(r.name),
        price: num_(r.price, 0),
        size: String(r.size || ''),
        stock: Math.max(0, Math.floor(num_(r.stock, 0))),
        image: String(r.image || ''),
        description: String(r.description || ''),
        topNotes: String(r.top_notes || ''),
        heartNotes: String(r.heart_notes || ''),
        baseNotes: String(r.base_notes || '')
      };
    });
}

function isTrue_(v) {
  return v === true || /^(true|yes|oui|1|used)$/i.test(String(v).trim());
}

/** "10" -> 10 ; a cell formatted as % (10% is stored as 0.1) -> 10 ; capped at 100. */
function percent_(v) {
  var n = num_(v, 0);
  if (n > 0 && n < 1) n = n * 100;
  return Math.min(100, Math.round(n * 100) / 100);
}

/** null = never expires, 'invalid' = unreadable date, otherwise the end of the last valid day. */
function expiry_(v) {
  if (v === '' || v === null || v === undefined) return null;
  var d = v instanceof Date ? new Date(v.getTime()) : new Date(String(v));
  if (isNaN(d.getTime())) return 'invalid';
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * How many orders a code may be used on: blank = 1 (single use), "unlimited" = no cap,
 * a whole number >= 1 = that many. Anything else (0, negative, text) is NaN = invalid.
 */
function maxUses_(v) {
  if (v === '' || v === null || v === undefined) return 1;
  var s = String(v).trim().toLowerCase();
  if (s === '') return 1;
  if (/^(unlimited|illimit[eé]|no limit|infinity|∞)$/.test(s)) return Infinity;
  var n = Number(s.replace(',', '.'));
  return isFinite(n) && n >= 1 && Math.floor(n) === n ? n : NaN;
}

function digits_(s) {
  return String(s === null || s === undefined ? '' : s).replace(/\D/g, '');
}

/** Same phone = same last 8 digits (so "+216 20 123 456" and "20123456" match). */
function samePhone_(a, b) {
  var x = digits_(a), y = digits_(b);
  if (!x || !y) return false;
  return x.slice(-8) === y.slice(-8);
}

function sheetHasColumn_(name, column) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet || sheet.getLastColumn() < 1) return false;
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .some(function (h) { return String(h).trim().toLowerCase() === column; });
}

/** Has this customer (same phone or same email) already ordered with this code? */
function customerUsedCoupon_(code, customer) {
  var mail = String(customer.email || '').trim().toLowerCase();
  var rows = readTable_(ORDERS);
  for (var i = 0; i < rows.length; i++) {
    var o = rows[i];
    if (String(o.coupon).trim().toUpperCase() !== code) continue;
    if (samePhone_(o.phone, customer.phone)) return true;
    if (mail && String(o.email).trim().toLowerCase() === mail) return true;
  }
  return false;
}

/**
 * Checks a coupon WITHOUT using it. Fails closed: anything odd means "not valid".
 * `customer` ({phone, email}) is only known when an order is placed; with it, shared codes
 * (max_uses other than 1) are limited to one use per customer.
 * Returns { ok:true, code, percent, row, cap, uses } or { ok:false, error }.
 */
function checkCoupon_(code, customer) {
  var wanted = String(code || '').trim().toUpperCase();
  if (!wanted) return { ok: false, error: 'Enter a coupon code.' };
  var bad = { ok: false, error: 'This coupon is not valid.' };
  var has = function (obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); };
  var rows = readTable_(COUPONS);
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r.code).trim().toUpperCase() !== wanted) continue;

    var cap = maxUses_(r.max_uses);
    if (isNaN(cap)) return bad;
    var single = cap === 1;
    var uses = Math.max(0, Math.floor(num_(r.uses, 0)));

    if (single) {
      // Without a "used" column a single-use code could never be marked as used, so refuse it.
      if (!has(r, 'used')) return bad;
      if (isTrue_(r.used) || uses >= 1) return { ok: false, error: 'This coupon has already been used.' };
    } else {
      // Shared codes are counted in the "uses" column: without it the limit could not be enforced.
      if (!has(r, 'uses')) return bad;
      if (isTrue_(r.used) || uses >= cap) return { ok: false, error: 'This coupon has reached its usage limit.' };
    }

    var exp = expiry_(r.expires);
    if (exp === 'invalid') return bad;
    if (exp && new Date() > exp) return { ok: false, error: 'This coupon has expired.' };
    var pct = percent_(r.percent);
    if (!(pct > 0)) return bad;

    if (!single && customer) {
      // One use per customer. Needs the Orders "coupon" column to look back at earlier orders.
      if (!sheetHasColumn_(ORDERS, 'coupon')) return bad;
      if (customerUsedCoupon_(wanted, customer)) return { ok: false, error: 'You have already used this coupon.' };
    }
    return { ok: true, code: wanted, percent: pct, row: r._row, cap: cap, uses: uses };
  }
  return { ok: false, error: 'Invalid coupon code.' };
}

/** Records a use (called inside the lock, right after the order is written). */
function useCoupon_(coupon, orderId) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(COUPONS);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase(); });
  function set(name, value) {
    var i = headers.indexOf(name);
    if (i >= 0) sheet.getRange(coupon.row, i + 1).setValue(value);
  }
  var uses = coupon.uses + 1;
  set('uses', uses);
  // Tick "used" when the code is exhausted (single-use codes: right away), so the Sheet shows it.
  if (coupon.cap !== Infinity && uses >= coupon.cap) set('used', true);
  set('used_at', new Date());   // last use
  set('order_id', orderId);     // last order
}

/** GET ?action=catalog  ->  { products: [...], settings: {...} } */
function doGet(e) {
  try {
    return json_({
      ok: true,
      products: getProducts_(),
      settings: getSettings_(),
      content: getContent_(),
      testimonials: getTestimonials_()
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/**
 * POST { secret, action:'coupon', code }                                   -> check a coupon (does not use it)
 * POST { secret, items:[{id,qty}], customer:{...}, coupon? }               -> place an order
 */
function doPost(e) {
  var startedAt = Date.now();
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse(e.postData.contents);
    var secret = prop_('API_SECRET', '');
    if (!secret || body.secret !== secret) return json_({ ok: false, error: 'Unauthorized' });

    if (body.action === 'coupon') {
      var chk = checkCoupon_(body.code);
      var reply = chk.ok ? { ok: true, code: chk.code, percent: chk.percent } : { ok: false, error: chk.error };
      reply.version = 2; // 2 = shared codes (max_uses / uses / one use per customer); read by `npm run check:sheet`
      return json_(reply);
    }

    if (body.action === 'status') {
      // Read-only health report for `npm run check:sheet`: how are emails sent, is the trigger alive?
      var all = PropertiesService.getScriptProperties().getProperties();
      var beat = Number(all.MAIL_HEARTBEAT || 0);
      return json_({
        ok: true,
        version: 2,
        mail: all.MAIL_MODE === 'queue' ? 'queue' : 'direct',
        heartbeatAgeSec: beat ? Math.round((Date.now() - beat) / 1000) : null,
        queued: Object.keys(all).filter(function (k) { return k.indexOf(MAIL_PREFIX) === 0; }).length
      });
    }

    var c = body.customer || {};
    var name = String(c.name || '').trim();
    var phone = String(c.phone || '').trim();
    var address = String(c.address || '').trim();
    var city = String(c.city || '').trim();
    var email = String(c.email || '').trim();
    var notes = String(c.notes || '').trim();
    // Currency label for the emails, sent by the website (NEXT_PUBLIC_CURRENCY). Letters only, so it is safe to print.
    var currency = /^[A-Za-z]{1,6}$/.test(String(body.currency || '').trim()) ? String(body.currency).trim().toUpperCase() : '';
    if (!name || !phone || !address || !city) return json_({ ok: false, error: 'Missing customer details.' });
    if (!body.items || !body.items.length) return json_({ ok: false, error: 'Your cart is empty.' });

    lock.waitLock(30000); // prevents two orders from taking the same last bottle

    var sheet = SpreadsheetApp.getActive().getSheetByName(PRODUCTS);
    var table = readTable_(PRODUCTS);
    var settings = getSettings_();

    // Validate every line against the sheet — never trust prices/stock sent by the browser.
    var lines = [];
    var subtotal = 0;
    for (var i = 0; i < body.items.length; i++) {
      var qty = Math.floor(Number(body.items[i].qty));
      var id = String(body.items[i].id).trim();
      if (!(qty > 0) || qty > 20) return json_({ ok: false, error: 'Invalid quantity.' });
      var row = null;
      for (var j = 0; j < table.length; j++) if (String(table[j].id).trim() === id) { row = table[j]; break; }
      if (!row || !isActive_(row.active)) return json_({ ok: false, error: 'An item in your cart is no longer available.' });
      var stock = Math.floor(num_(row.stock, 0));
      if (stock < qty) {
        return json_({ ok: false, error: 'Only ' + stock + ' left of "' + row.name + ' ' + row.size + '".' });
      }
      var price = num_(row.price, 0);
      lines.push({ row: row, qty: qty, price: price, label: row.name + (row.size ? ' ' + row.size : '') });
      subtotal += price * qty;
    }

    // Coupon: re-checked here, inside the lock, so a one-time code can only win once.
    var couponCode = String(body.coupon || '').trim();
    var coupon = null;
    var discount = 0;
    if (couponCode) {
      coupon = checkCoupon_(couponCode, { phone: phone, email: email });
      if (!coupon.ok) return json_(coupon);
      discount = Math.round(subtotal * coupon.percent) / 100;
    }

    // Free delivery is judged on what the customer pays for the products (after the discount).
    var goods = subtotal - discount;
    var delivery = settings.deliveryFee;
    if (settings.freeDeliveryOver > 0 && goods >= settings.freeDeliveryOver) delivery = 0;
    var total = goods + delivery;

    // Decrement stock.
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h).trim().toLowerCase(); });
    var stockCol = headers.indexOf('stock') + 1;
    lines.forEach(function (l) {
      sheet.getRange(l.row._row, stockCol).setValue(Math.floor(num_(l.row.stock, 0)) - l.qty);
    });

    // Append the order.
    var orders = SpreadsheetApp.getActive().getSheetByName(ORDERS);
    var orderId = 'ORD-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMdd') + '-' +
      ('000' + Math.max(1, orders.getLastRow())).slice(-4);
    var itemsText = lines.map(function (l) { return l.qty + ' x ' + l.label + ' @ ' + l.price; }).join('\n');
    orders.appendRow([orderId, new Date(), 'New', name, "'" + phone, email, city, address, itemsText, subtotal, delivery, total, notes,
      coupon ? coupon.code : '', discount]);
    if (coupon) useCoupon_(coupon, orderId);

    SpreadsheetApp.flush();
    lock.releaseLock();

    // Emails: queued for the trigger when the queue is on and healthy, otherwise sent now.
    var mail = dispatchMail_({
      orderId: orderId,
      placedAt: new Date().toISOString(),
      currency: currency,
      customer: { name: name, phone: phone, email: email, city: city, address: address, notes: notes },
      lines: lines.map(function (l) { return { label: l.label, qty: l.qty, price: l.price }; }),
      subtotal: subtotal,
      delivery: delivery,
      total: total,
      coupon: coupon ? { code: coupon.code, percent: coupon.percent, amount: discount } : null,
      attempts: 0
    });

    return json_({ ok: true, orderId: orderId, total: total, discount: discount, mail: mail, ms: Date.now() - startedAt });
  } catch (err) {
    try { lock.releaseLock(); } catch (ignore) {}
    return json_({ ok: false, error: 'Server error: ' + err });
  }
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------------------------------
 * Email design. Everything is plain inline-styled tables, which is what Gmail, Outlook and
 * phone mail apps render reliably. Colours match the website. Optional Script Property
 * LOGO_URL (an https image link) replaces the text brand in the header.
 * ------------------------------------------------------------------------------------------ */
var MAIL_COLORS = {
  ink: '#1c1917', paper: '#fffdf9', page: '#f3eee6', line: '#e9e2d6', gold: '#a8895a',
  goldDark: '#8a6f45', soft: '#f6f0e4', text: '#44403c', muted: '#78716c', onInk: '#f6f0e4'
};
var MAIL_SANS = 'Helvetica,Arial,sans-serif';
var MAIL_SERIF = 'Georgia,Times New Roman,serif';

/** 89 -> "89 TND", 22.5 -> "22.50 TND" (no currency when the site did not send one). */
function money_(n, currency) {
  var v = Math.round(Number(n) * 100) / 100;
  var s = v % 1 === 0 ? String(v) : v.toFixed(2);
  return currency ? s + ' ' + currency : s;
}

function when_(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd MMM yyyy, HH:mm');
}

/** The branded frame shared by both emails. `o` = { store, title, preheader, body, footer }. */
function emailShell_(o) {
  var C = MAIL_COLORS;
  var store = esc_(o.store);
  var logo = prop_('LOGO_URL', '');
  var brand = /^https:\/\//i.test(logo)
    ? '<img src="' + esc_(logo) + '" alt="' + store + '" height="40" style="display:inline-block;border:0;height:40px;max-width:240px">'
    : '<span style="font-family:' + MAIL_SERIF + ';font-size:20px;letter-spacing:5px;text-transform:uppercase;color:' + C.onInk + '">' + store + '</span>';
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc_(o.title) + '</title></head>' +
    '<body style="margin:0;padding:0;background:' + C.page + '">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px">' + esc_(o.preheader) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + C.page + '"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:' + C.paper + ';border:1px solid ' + C.line + '">' +
    '<tr><td align="center" style="background:' + C.ink + ';padding:26px 20px">' + brand + '</td></tr>' +
    '<tr><td style="background:' + C.gold + ';height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>' +
    '<tr><td style="padding:32px 32px 12px;font-family:' + MAIL_SANS + ';font-size:15px;line-height:1.6;color:' + C.text + '">' + o.body + '</td></tr>' +
    '<tr><td style="padding:16px 32px 28px;border-top:1px solid ' + C.line + ';font-family:' + MAIL_SANS + ';font-size:12px;line-height:1.5;color:' + C.muted + '">' + o.footer + '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

/** Items, discount, delivery and the total to collect. */
function itemsTableHtml_(job) {
  var C = MAIL_COLORS, cur = job.currency;
  var cell = 'padding:12px 0;border-bottom:1px solid ' + C.line + ';font-family:' + MAIL_SANS + ';font-size:14px;';
  var rows = job.lines.map(function (l) {
    return '<tr><td style="' + cell + 'color:' + C.ink + '">' + esc_(l.label) +
      '<div style="font-size:12px;color:' + C.muted + '">' + money_(l.price, cur) + ' each</div></td>' +
      '<td align="center" width="48" style="' + cell + 'color:' + C.muted + '">&times;' + l.qty + '</td>' +
      '<td align="right" width="110" style="' + cell + 'color:' + C.ink + '">' + money_(l.price * l.qty, cur) + '</td></tr>';
  }).join('');
  var sum = function (label, value, color) {
    return '<tr><td colspan="2" style="padding:8px 0 0;font-family:' + MAIL_SANS + ';font-size:14px;color:' + (color || C.muted) + '">' + label + '</td>' +
      '<td align="right" style="padding:8px 0 0;font-family:' + MAIL_SANS + ';font-size:14px;color:' + (color || C.ink) + '">' + value + '</td></tr>';
  };
  var discount = job.coupon
    ? sum('Coupon ' + esc_(job.coupon.code) + ' (&minus;' + job.coupon.percent + '%)', '&minus;' + money_(job.coupon.amount, cur), C.goldDark)
    : '';
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 6px">' + rows +
    sum('Subtotal', money_(job.subtotal, cur)) + discount +
    sum('Delivery', job.delivery > 0 ? money_(job.delivery, cur) : 'Free') +
    '<tr><td colspan="3" style="padding-top:14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="background:' + C.soft + ';padding:14px 16px;font-family:' + MAIL_SANS + ';font-size:13px;letter-spacing:1px;text-transform:uppercase;color:' + C.goldDark + '">Total to pay on delivery</td>' +
    '<td align="right" style="background:' + C.soft + ';padding:14px 16px;font-family:' + MAIL_SERIF + ';font-size:22px;color:' + C.ink + '"><b>' + money_(job.total, cur) + '</b></td>' +
    '</tr></table></td></tr></table>';
}

function smallHeading_(text) {
  return '<p style="margin:26px 0 6px;font-family:' + MAIL_SANS + ';font-size:12px;letter-spacing:2px;text-transform:uppercase;color:' + MAIL_COLORS.goldDark + '">' + text + '</p>';
}

function orderText_(job) {
  var cur = job.currency;
  var out = job.lines.map(function (l) { return '  ' + l.qty + ' x ' + l.label + '  ' + money_(l.price * l.qty, cur); });
  out.push('  Subtotal: ' + money_(job.subtotal, cur));
  if (job.coupon) out.push('  Coupon ' + job.coupon.code + ' (-' + job.coupon.percent + '%): -' + money_(job.coupon.amount, cur));
  out.push('  Delivery: ' + (job.delivery > 0 ? money_(job.delivery, cur) : 'Free'));
  out.push('  TOTAL TO PAY ON DELIVERY: ' + money_(job.total, cur));
  return out.join('\n');
}

/** Notification to the shop owner. Returns true when sent. */
function sendOwnerEmail_(job) {
  try {
    var C = MAIL_COLORS, c = job.customer;
    var store = prop_('STORE_NAME', 'Our store');
    var owner = prop_('OWNER_EMAIL', Session.getEffectiveUser().getEmail());
    var sheetUrl = '';
    try { sheetUrl = SpreadsheetApp.getActive().getUrl(); } catch (e) { /* no link */ }
    var label = 'font-family:' + MAIL_SANS + ';font-size:12px;color:' + C.muted + ';padding:6px 12px 6px 0;vertical-align:top;white-space:nowrap';
    var value = 'font-family:' + MAIL_SANS + ';font-size:14px;color:' + C.ink + ';padding:6px 0;vertical-align:top';
    var detail = function (k, v) { return v ? '<tr><td style="' + label + '">' + k + '</td><td style="' + value + '">' + v + '</td></tr>' : ''; };
    var body =
      '<p style="margin:0 0 6px;font-family:' + MAIL_SANS + ';font-size:12px;letter-spacing:2px;text-transform:uppercase;color:' + C.goldDark + '">New order</p>' +
      '<h1 style="margin:0;font-family:' + MAIL_SERIF + ';font-size:28px;font-weight:normal;color:' + C.ink + '">' + esc_(job.orderId) + '</h1>' +
      '<p style="margin:4px 0 0;font-size:13px;color:' + C.muted + '">' + esc_(when_(job.placedAt)) + '</p>' +
      smallHeading_('Customer') +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:' + C.soft + '"><tr><td style="padding:12px 16px"><table role="presentation" cellpadding="0" cellspacing="0">' +
      detail('Name', '<b>' + esc_(c.name) + '</b>') +
      detail('Phone', '<a href="tel:' + esc_(c.phone.replace(/[^+\d]/g, '')) + '" style="color:' + C.ink + '">' + esc_(c.phone) + '</a>') +
      detail('Email', c.email ? '<a href="mailto:' + esc_(c.email) + '" style="color:' + C.ink + '">' + esc_(c.email) + '</a>' : '') +
      detail('Address', esc_(c.address) + '<br>' + esc_(c.city)) +
      '</table></td></tr></table>' +
      (c.notes ? '<p style="margin:14px 0 0;padding:10px 14px;border-left:3px solid ' + C.gold + ';background:' + C.paper + ';font-style:italic;color:' + C.text + '">' + esc_(c.notes) + '</p>' : '') +
      smallHeading_('Order') +
      itemsTableHtml_(job) +
      (sheetUrl && /^https:\/\//.test(sheetUrl)
        ? '<p style="margin:22px 0 8px"><a href="' + esc_(sheetUrl) + '" style="display:inline-block;background:' + C.ink + ';color:#ffffff;text-decoration:none;padding:12px 24px;font-family:' + MAIL_SANS + ';font-size:13px;letter-spacing:2px;text-transform:uppercase">Open orders sheet</a></p>'
        : '');
    var text = 'NEW ORDER ' + job.orderId + '\n' + when_(job.placedAt) + '\n\n' +
      'Customer: ' + c.name + '\nPhone: ' + c.phone + (c.email ? '\nEmail: ' + c.email : '') + '\nAddress: ' + c.address + ', ' + c.city +
      (c.notes ? '\nNote: ' + c.notes : '') + '\n\n' + orderText_(job) + (sheetUrl ? '\n\nOrders sheet: ' + sheetUrl : '');
    MailApp.sendEmail({
      to: owner,
      subject: 'New order ' + job.orderId + ' — ' + c.name + ' (' + money_(job.total, job.currency) + ')',
      replyTo: c.email || owner,
      name: store,
      body: text,
      htmlBody: emailShell_({
        store: store,
        title: 'New order ' + job.orderId,
        preheader: c.name + ' · ' + money_(job.total, job.currency) + ' to collect · ' + c.city,
        body: body,
        footer: 'Order notification from your store. Update the order status in the Orders tab of your Google Sheet.'
      })
    });
    return true;
  } catch (err) { console.error('Owner email failed: ' + err); return false; }
}

/** Confirmation to the customer. Returns true when sent, or when there is nothing to send (no email given). */
function sendCustomerEmail_(job) {
  var c = job.customer;
  if (!(c.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email))) return true;
  try {
    var C = MAIL_COLORS;
    var store = prop_('STORE_NAME', 'Our store');
    var owner = prop_('OWNER_EMAIL', Session.getEffectiveUser().getEmail());
    var step = function (n, text) {
      return '<tr><td width="34" valign="top" style="padding:6px 0"><div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:' + C.gold + ';color:#ffffff;text-align:center;font-family:' + MAIL_SANS + ';font-size:12px">' + n + '</div></td>' +
        '<td style="padding:6px 0;font-family:' + MAIL_SANS + ';font-size:14px;color:' + C.text + '">' + text + '</td></tr>';
    };
    var body =
      '<h1 style="margin:0 0 8px;font-family:' + MAIL_SERIF + ';font-size:28px;font-weight:normal;color:' + C.ink + '">Thank you, ' + esc_(c.name) + '!</h1>' +
      '<p style="margin:0">We received your order <b style="color:' + C.ink + '">' + esc_(job.orderId) + '</b> and we are getting it ready.</p>' +
      itemsTableHtml_(job) +
      smallHeading_('Delivery to') +
      '<p style="margin:0;color:' + C.ink + '">' + esc_(c.name) + '<br>' + esc_(c.address) + '<br>' + esc_(c.city) + '<br>' + esc_(c.phone) + '</p>' +
      smallHeading_('What happens next') +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">' +
      step(1, 'We call you on <b>' + esc_(c.phone) + '</b> to confirm your delivery.') +
      step(2, 'We prepare your parcel and send it to you.') +
      step(3, 'You pay <b>' + esc_(money_(job.total, job.currency)) + '</b> in cash when it arrives.') +
      '</table>' +
      '<p style="margin:24px 0 8px">Questions? Just reply to this email.</p>';
    var text = 'Thank you, ' + c.name + '!\n\nWe received your order ' + job.orderId + ' and we are getting it ready.\n\n' + orderText_(job) +
      '\n\nDelivery to: ' + c.address + ', ' + c.city + '\nWe will call you on ' + c.phone + ' to confirm. You pay in cash when the parcel arrives.\n\nQuestions? Just reply to this email.\n' + store;
    MailApp.sendEmail({
      to: c.email,
      subject: 'Your order ' + job.orderId + ' — ' + store,
      replyTo: owner,
      name: store,
      body: text,
      htmlBody: emailShell_({
        store: store,
        title: 'Your order ' + job.orderId,
        preheader: 'Thanks for your order! Total to pay on delivery: ' + money_(job.total, job.currency),
        body: body,
        footer: 'You receive this email because you placed an order at ' + esc_(store) + '. You pay on delivery, nothing has been charged online.'
      })
    });
    return true;
  } catch (err) { console.error('Customer email failed: ' + err); return false; }
}

/** Sends both emails right now (used when the email queue is off, and by testSetup). */
function sendEmails_(job) {
  sendOwnerEmail_(job);
  sendCustomerEmail_(job);
}

/* ------------------------------------------------------------------------------------------
 * Email queue (optional, makes orders much faster).
 * Sending an email takes seconds, so instead of sending during the order the script writes a small
 * job to Script Properties and a trigger sends the emails about every minute.
 *
 *   Turn on : run  installMailTrigger  once from the editor (it asks for one extra permission).
 *   Turn off: run  removeMailTrigger   (pending emails are sent first).
 *
 * Safety net: the trigger writes a heartbeat every run. If the heartbeat is older than 10 minutes
 * (trigger deleted or broken), orders send their emails immediately again, so no email is ever lost
 * silently. Failed emails are retried up to 5 times, and a retry only repeats the email that failed.
 * ------------------------------------------------------------------------------------------ */
var MAIL_PREFIX = 'mail:';
var MAIL_STALE_MS = 10 * 60 * 1000;
var MAIL_MAX_ATTEMPTS = 5;

/** Called by doPost after the order is saved. Returns 'queued' or 'sent'. */
function dispatchMail_(job) {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var beat = Number(all.MAIL_HEARTBEAT || 0);
  if (all.MAIL_MODE === 'queue' && beat && Date.now() - beat < MAIL_STALE_MS) {
    try {
      props.setProperty(MAIL_PREFIX + job.orderId, JSON.stringify(job));
      return 'queued';
    } catch (err) {
      console.error('Could not queue the emails, sending them now: ' + err);
    }
  }
  sendEmails_(job);
  return 'sent';
}

/** Trigger handler: sends the queued emails. Safe to run by hand too. */
function sendQueuedMail() {
  // A separate lock from the order lock, so sending emails never holds up orders.
  // (getDocumentLock can be null in some contexts: then fall back to the script lock.)
  var lock = LockService.getDocumentLock() || LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;          // another run is already working
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('MAIL_HEARTBEAT', String(Date.now()));
    var all = props.getProperties();
    var keys = Object.keys(all).filter(function (k) { return k.indexOf(MAIL_PREFIX) === 0; }).sort();
    var started = Date.now();
    for (var i = 0; i < keys.length; i++) {
      if (Date.now() - started > 4 * 60 * 1000) break; // leave the rest for the next run
      var key = keys[i];
      var job;
      try { job = JSON.parse(all[key]); } catch (e) { props.deleteProperty(key); continue; }
      if (!job.ownerDone) job.ownerDone = sendOwnerEmail_(job);
      if (!job.customerDone) job.customerDone = sendCustomerEmail_(job);
      if (job.ownerDone && job.customerDone) { props.deleteProperty(key); continue; }
      job.attempts = (job.attempts || 0) + 1;
      if (job.attempts >= MAIL_MAX_ATTEMPTS) {
        console.error('Giving up on the emails for ' + job.orderId + ' after ' + job.attempts + ' tries.');
        props.deleteProperty(key);
      } else {
        props.setProperty(key, JSON.stringify(job));
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function removeMailTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendQueuedMail') ScriptApp.deleteTrigger(t);
  });
}

/** Run ONCE from the editor: turns the email queue on. */
function installMailTrigger() {
  removeMailTriggers_(); // never end up with two triggers
  ScriptApp.newTrigger('sendQueuedMail').timeBased().everyMinutes(1).create();
  var props = PropertiesService.getScriptProperties();
  props.setProperty('MAIL_MODE', 'queue');
  props.setProperty('MAIL_HEARTBEAT', String(Date.now()));
  console.log('Email queue is ON: emails are now sent by a trigger about every minute.');
}

/** Run from the editor to go back to sending emails during the order. Pending emails are sent first. */
function removeMailTrigger() {
  var props = PropertiesService.getScriptProperties();
  removeMailTriggers_();
  props.deleteProperty('MAIL_MODE');
  sendQueuedMail();
  props.deleteProperty('MAIL_HEARTBEAT');
  console.log('Email queue is OFF: emails are sent during the order again.');
}

/**
 * Run once from the editor to authorise mail + sheet access, and to SEE the emails:
 * you receive the owner email and a copy of the customer email (sent to your own address).
 */
function testSetup() {
  var me = prop_('OWNER_EMAIL', Session.getEffectiveUser().getEmail());
  sendEmails_({
    orderId: 'TEST-0000',
    placedAt: new Date().toISOString(),
    currency: 'TND',
    customer: { name: 'Test Customer', phone: '+216 20 123 456', email: me, city: 'Tunis', address: '12 Rue de Test', notes: 'Please call before 6pm.' },
    lines: [{ label: 'Sample Perfume 50ml', qty: 1, price: 89 }, { label: 'Sample Perfume 30ml', qty: 2, price: 59 }],
    subtotal: 207,
    delivery: 0,
    total: 186.3,
    coupon: { code: 'EXAMPLE10', percent: 10, amount: 20.7 }
  });
}
