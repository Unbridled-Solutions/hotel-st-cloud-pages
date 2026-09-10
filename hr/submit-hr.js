(function (global) {
  var submitted = false;

  function flatten(obj, prefix, out) {
    out = out || {};
    prefix = prefix || "";
    if (!obj || typeof obj !== "object") return out;
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      var key = prefix ? prefix + "." + k : k;
      if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
      else if (Array.isArray(v)) out[key] = v.join(", ");
      else out[key] = v;
    });
    return out;
  }

  function setStatus(msg, ok) {
    var el = document.getElementById("hr-submit-status");
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok ? "#2e7d4f" : "#c44027";
  }

  global.submitHrForm = async function (type, fields, employeeName) {
    if (submitted) {
      setStatus("Already sent to HR.", true);
      return true;
    }
    var btn = document.getElementById("hr-submit-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sending to HR…";
    }
    setStatus("Sending to HR…", true);
    try {
      var res = await fetch("/api/hr/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: type,
          employeeName: employeeName || "",
          fields: flatten(fields || {}),
        }),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not submit");
      submitted = true;
      setStatus(data.emailed ? "Sent to Jackie (HR). You can still print a copy for your records." : "Saved on the HR tracker. Email may have failed — tell Jackie.", true);
      if (btn) btn.textContent = "Sent to HR";
      return true;
    } catch (err) {
      setStatus("Could not send. Check your connection and try again. " + (err.message || ""), false);
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Submit to HR";
      }
      return false;
    }
  };
})(window);
