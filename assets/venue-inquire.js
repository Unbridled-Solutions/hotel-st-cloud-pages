(function () {
  var API = "https://offers.hotelstcloud.com/api/venue-inquire";
  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }
  function bind(form) {
    if (!form || form.getAttribute("data-venue-bound")) return;
    form.setAttribute("data-venue-bound", "1");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var sent = document.getElementById("sent");
      var payload = {
        venue: form.getAttribute("data-venue") || document.title || "Venue",
        page: location.href,
        name: val("name"),
        email: val("email"),
        phone: val("phone"),
        kind: val("kind"),
        date: val("date"),
        guests: val("guests"),
        room: val("room"),
        kitchen: val("kitchen"),
        notes: val("notes")
      };
      if (!payload.name || !payload.email) {
        if (sent) {
          sent.style.display = "block";
          sent.textContent = "Name and email, please.";
        }
        return;
      }
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (sent) {
            sent.style.display = "block";
            sent.textContent = res.ok && res.d && res.d.success
              ? "Got it. It went to hello@unbridledhospitality.com. We will write back."
              : "That did not send. Call (719) 602-3469 or write hello@unbridledhospitality.com.";
          }
          if (res.ok && res.d && res.d.success) form.reset();
        })
        .catch(function () {
          if (sent) {
            sent.style.display = "block";
            sent.textContent = "That did not send. Call (719) 602-3469 or write hello@unbridledhospitality.com.";
          }
        })
        .then(function () {
          if (btn) { btn.disabled = false; btn.textContent = "Send the request"; }
        });
    });
  }
  bind(document.getElementById("venue-form"));
})();
