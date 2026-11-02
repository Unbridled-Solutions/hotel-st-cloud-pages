/*
  Christmas Lights page: behaviour (checkout + visual effects)
  ---------------------------------------------------------------
  DESIGN FILE: no copy lives here. Edit words, prices and dates in
  /christmas-lights/index.html only.

  - Prices for the on-screen total come from the form's data-price-* attributes.
  - The "pick a date" error message comes from the form's data-date-error attribute.
  - Every effect checks that its element exists, so removing a section
    from index.html won't break the rest of the page.
*/

/* ---------- Checkout (same request as before: POST /api/events/checkout) ---------- */
(function () {
  var form = document.getElementById('ticket-form');
  if (!form) return;
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var err = document.getElementById('form-err');
    var btn = document.getElementById('pay-btn');
    err.textContent = '';
    btn.disabled = true;
    var eventDate = document.getElementById('eventDate').value;
    if (!eventDate) {
      err.textContent = form.dataset.dateError || 'Please choose a date.';
      btn.disabled = false;
      return;
    }
    var body = {
      event: 'christmas-lights',
      eventDate: eventDate,
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      adults: document.getElementById('adults').value,
      children: document.getElementById('children').value,
      family: document.getElementById('family').value,
      under3: document.getElementById('under3').value,
      wantRoom: document.getElementById('wantRoom').value,
      notes: ''
    };
    try {
      var res = await fetch('/api/events/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      var data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Checkout failed');
      window.location = data.url;
    } catch (ex) {
      err.textContent = ex.message || 'Could not start checkout.';
      btn.disabled = false;
    }
  });
})();

/* ---------- Visual enhancements ---------- */
(function () {
  document.documentElement.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };

  // Strings of lights: fill each .lights strip to its width
  function hang() {
    document.querySelectorAll('.lights').forEach(function (el) {
      var n = Math.ceil(el.offsetWidth / 56) + 1;
      if (el.children.length === n) return;
      el.innerHTML = '';
      for (var i = 0; i < n; i++) {
        var b = document.createElement('i');
        b.style.setProperty('--delay', (-(i * 0.37) % 3).toFixed(2) + 's');
        el.appendChild(b);
      }
    });
  }
  hang();
  window.addEventListener('resize', hang);

  // Date buttons mirror the "Which night" dropdown
  var sel = $('eventDate');
  var pills = document.querySelectorAll('.date-pill');
  if (sel) {
    var syncPills = function () {
      pills.forEach(function (p) { p.setAttribute('aria-pressed', String(p.dataset.date === sel.value)); });
    };
    pills.forEach(function (p) {
      p.addEventListener('click', function () {
        sel.value = p.dataset.date;
        syncPills();
        if ($('form-err')) $('form-err').textContent = '';
      });
    });
    sel.addEventListener('change', syncPills);
  }

  // Running total (display only; Stripe charges what the server calculates)
  var form = $('ticket-form');
  var out = $('est-total');
  if (form && out) {
    var price = {
      adults: Number(form.dataset.priceAdult) || 0,
      children: Number(form.dataset.priceChild) || 0,
      family: Number(form.dataset.priceFamily) || 0
    };
    var count = function (id) {
      var el = $(id); if (!el) return 0;
      var v = parseInt(el.value, 10); return isNaN(v) || v < 0 ? 0 : v;
    };
    var total = function () {
      var t = 0;
      Object.keys(price).forEach(function (id) { t += count(id) * price[id]; });
      out.textContent = '$' + t.toLocaleString();
    };
    Object.keys(price).forEach(function (id) { if ($(id)) $(id).addEventListener('input', total); });
    total();
  }

  // Header turns solid after the hero; phone booking bar shows while the form is off screen
  var header = $('site-header');
  var bar = $('mobile-bar');
  var book = $('book');
  var bookVisible = false;
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle('solid', y > 60);
    if (bar) bar.classList.toggle('show', y > window.innerHeight * 0.7 && !bookVisible);
  }
  if (book) new IntersectionObserver(function (es) { bookVisible = es[0].isIntersecting; onScroll(); }, { threshold: 0.05 }).observe(book);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Fade sections in on scroll
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(function (el, i) {
    el.style.transitionDelay = (el.classList.contains('day-card') ? (i % 3) * 120 : 0) + 'ms';
    io.observe(el);
  });

  // Gentle snowfall on any <canvas class="snow">
  function snow(canvas, density) {
    if (reduce || !canvas) return;
    var ctx = canvas.getContext('2d');
    var w, h, flakes = [], running = false, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function size() {
      w = canvas.offsetWidth; h = canvas.offsetHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round((w * h) / density);
      flakes = Array.from({ length: n }, function () {
        return { x: Math.random() * w, y: Math.random() * h, r: Math.random() * 2.2 + .6, s: Math.random() * .6 + .25, d: Math.random() * Math.PI * 2, o: Math.random() * .5 + .35 };
      });
    }
    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      flakes.forEach(function (f) {
        f.y += f.s; f.d += .01; f.x += Math.sin(f.d) * .35;
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + f.o + ')'; ctx.fill();
      });
      requestAnimationFrame(tick);
    }
    size(); window.addEventListener('resize', size);
    new IntersectionObserver(function (es) {
      var vis = es[0].isIntersecting;
      if (vis && !running) { running = true; requestAnimationFrame(tick); } else if (!vis) { running = false; }
    }).observe(canvas);
  }
  snow($('snow'), 9000);
  snow($('snow2'), 12000);
})();
