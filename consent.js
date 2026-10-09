/*
 * Cookie notice + HubSpot tracking loader for jscottstrategy.com
 *
 * - Europe/UK visitors (by browser time zone): opt-in. HubSpot tracking loads only
 *   after they click "Accept". Closing the notice does not count as consent.
 * - Everyone else: opt-out. Tracking loads by default; the notice informs them and
 *   lets them decline. Closing the notice keeps tracking on.
 * - The choice is remembered for 12 months. Any element with [data-cookie-settings]
 *   reopens the notice.
 */
(function () {
  var HUBSPOT_SRC = 'https://js.hs-scripts.com/46318869.js';
  var STORE_KEY = 'jss-cookie-consent';
  var MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
  var HS_COOKIES = ['hubspotutk', '__hstc', '__hssc', '__hssrc'];

  // ---- Region (best effort, from the browser's time zone) ----
  var tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var OPT_IN_ZONES = ['Atlantic/Reykjavik', 'Atlantic/Canary', 'Atlantic/Madeira', 'Atlantic/Azores',
    'Atlantic/Faroe', 'Asia/Nicosia', 'Asia/Famagusta', 'Arctic/Longyearbyen'];
  var optIn = tz.indexOf('Europe/') === 0 || OPT_IN_ZONES.indexOf(tz) !== -1;

  // ---- Stored choice: 'granted' | 'denied' | 'dismissed' ----
  function readChoice() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || Date.now() - data.at > MAX_AGE_MS) return null;
      return data.choice;
    } catch (e) { return null; }
  }
  function saveChoice(choice) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ choice: choice, at: Date.now() })); } catch (e) {}
  }
  function trackingAllowed(choice) {
    if (choice === 'granted') return true;
    if (choice === 'denied') return false;
    return !optIn; // no choice yet, or dismissed
  }

  // ---- HubSpot ----
  var loaded = false;
  function loadHubSpot() {
    window._hsq = window._hsq || [];
    if (window.__jssDNT) { window._hsq.push(['doNotTrack', { track: true }]); window.__jssDNT = false; }
    if (loaded || document.getElementById('hs-script-loader')) { loaded = true; return; }
    var s = document.createElement('script');
    s.id = 'hs-script-loader'; s.async = true; s.defer = true; s.src = HUBSPOT_SRC;
    document.body.appendChild(s);
    loaded = true;
  }
  // Defer the tracking script until the page has finished loading and the browser is idle,
  // or until the visitor first interacts, whichever comes first. Keeps it off the critical path.
  function scheduleLoad() {
    var started = false;
    var events = ['scroll', 'pointerdown', 'keydown', 'touchstart'];
    function go() {
      if (started) return; started = true;
      events.forEach(function (ev) { window.removeEventListener(ev, go, true); });
      loadHubSpot();
    }
    events.forEach(function (ev) { window.addEventListener(ev, go, { capture: true, passive: true, once: true }); });
    function whenIdle() {
      if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 });
      else setTimeout(go, 1500);
    }
    if (document.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle, { once: true });
  }

  function stopHubSpot() {
    if (loaded) {
      window._hsq = window._hsq || [];
      window._hsq.push(['doNotTrack']);
      window.__jssDNT = true;
    }
    var host = location.hostname.replace(/^www\./, '');
    HS_COOKIES.forEach(function (name) {
      ['', '; domain=' + host, '; domain=.' + host].forEach(function (d) {
        document.cookie = name + '=; Max-Age=0; path=/' + d;
      });
    });
  }

  // ---- Notice UI ----
  var css =
    '.cc{position:fixed;left:16px;right:16px;bottom:16px;z-index:50;max-width:760px;margin:0 auto;background:#16181D;color:#F3F1EC;' +
    'border:1px solid #2E3138;box-shadow:0 16px 40px rgba(0,0,0,.25);padding:18px 52px 18px 22px;display:flex;flex-wrap:wrap;' +
    'align-items:center;gap:14px 24px;font-family:"Nunito Sans",system-ui,sans-serif;font-size:15px;line-height:1.5}' +
    '.cc[hidden]{display:none}' +
    '.cc p{margin:0;flex:1 1 320px;color:#C8C5BD}' +
    '.cc p a{color:#F3F1EC}' +
    '.cc-actions{display:flex;gap:10px;flex-wrap:wrap}' +
    '.cc-btn{font:inherit;font-size:12px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;padding:11px 18px;min-height:44px;cursor:pointer;border:1px solid #8FD3C1}' +
    '.cc-accept{background:#8FD3C1;color:#16181D}.cc-accept:hover{background:#A9E0D1}' +
    '.cc-decline{background:transparent;color:#F3F1EC;border-color:#5A5E66}.cc-decline:hover{border-color:#F3F1EC}' +
    '.cc-close{position:absolute;top:6px;right:6px;width:44px;height:44px;background:none;border:0;color:#A9A69E;cursor:pointer;font-size:22px;line-height:1}' +
    '.cc-close:hover{color:#F3F1EC}' +
    '.cc-btn:focus-visible,.cc-close:focus-visible{outline:2px solid #8FD3C1;outline-offset:2px}' +
    '[data-cookie-settings]{font:inherit;color:inherit;background:none;border:0;padding:0;text-decoration:underline;cursor:pointer}' +
    '@media (max-width:560px){.cc{left:12px;right:12px;bottom:12px}.cc-actions{width:100%}.cc-btn{flex:1}}';

  var banner, msgEl, acceptBtn;
  function build() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    banner = document.createElement('div');
    banner.className = 'cc';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie notice');
    banner.hidden = true;

    msgEl = document.createElement('p');
    var actions = document.createElement('div');
    actions.className = 'cc-actions';

    acceptBtn = document.createElement('button');
    acceptBtn.type = 'button'; acceptBtn.className = 'cc-btn cc-accept';
    acceptBtn.addEventListener('click', function () { decide('granted'); });

    var declineBtn = document.createElement('button');
    declineBtn.type = 'button'; declineBtn.className = 'cc-btn cc-decline'; declineBtn.textContent = 'Decline';
    declineBtn.addEventListener('click', function () { decide('denied'); });

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button'; closeBtn.className = 'cc-close';
    closeBtn.setAttribute('aria-label', 'Close cookie notice');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', function () { decide('dismissed'); });

    actions.appendChild(acceptBtn); actions.appendChild(declineBtn);
    banner.appendChild(msgEl); banner.appendChild(actions); banner.appendChild(closeBtn);
    document.body.appendChild(banner);
  }
  function setMessage() {
    var link = ' See our <a href="/privacy.html">Privacy Policy</a>.';
    msgEl.innerHTML = optIn
      ? 'With your permission, this site uses cookies. Not the good kind, just the analytics kind.' + link
      : 'This site uses cookies. Not the good kind, just the analytics kind.' + link;
    acceptBtn.textContent = optIn ? 'Accept' : 'OK';
  }
  function show() { setMessage(); banner.hidden = false; }
  function hide() { banner.hidden = true; }

  function decide(choice) {
    // Dismissing after an earlier explicit choice keeps that choice.
    var previous = readChoice();
    if (choice === 'dismissed' && (previous === 'granted' || previous === 'denied')) { hide(); return; }
    saveChoice(choice);
    if (trackingAllowed(choice)) loadHubSpot(); else stopHubSpot();
    hide();
  }

  function init() {
    build();
    var choice = readChoice();
    if (trackingAllowed(choice)) scheduleLoad();
    if (!choice) show();
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-cookie-settings]')) { e.preventDefault(); show(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !banner.hidden) decide('dismissed');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
