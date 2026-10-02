(function (global) {
  var submitted = false;
  var API = "";

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

  function extraFiles() {
    var files = [];
    if (global.hrI9Files && typeof global.hrI9Files === "function") {
      files = files.concat(global.hrI9Files() || []);
    }
    if (global.hrExtraDocs && typeof global.hrExtraDocs.files === "function") {
      files = files.concat(global.hrExtraDocs.files() || []);
    }
    return files.filter(Boolean);
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
      var payload = {
        type: type,
        employeeName: employeeName || "",
        fields: flatten(fields || {}),
      };
      var files = extraFiles();
      if (type === "new-hire" && !files.length) {
        throw new Error("I-9 photos did not attach. Go back and upload them again, then Submit to HR.");
      }
      var res;
      if (files.length) {
        var fd = new FormData();
        fd.append("data", JSON.stringify(payload));
        files.forEach(function (f) { fd.append("files", f, f.name || "upload.bin"); });
        res = await fetch(API + "/api/hr/submit", { method: "POST", body: fd });
      } else {
        res = await fetch(API + "/api/hr/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not submit");
      var sent = Number(data.files || 0);
      if (files.length && sent < files.length) {
        throw new Error("HR got the form but only " + sent + " of " + files.length + " files. Tell HR and try Submit to HR again.");
      }
      submitted = true;
      var extra = sent ? (" " + sent + " extra file" + (sent === 1 ? "" : "s") + " on file.") : "";
      setStatus((data.emailed ? "Sent to HR." : "Saved on the HR tracker. Email may have failed. Tell HR.") + extra + " You can still print a copy for your records.", true);
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
