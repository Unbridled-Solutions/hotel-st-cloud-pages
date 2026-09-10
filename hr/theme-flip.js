(function () {
  var KEY = "uhg-hr-theme";
  function current() {
    var t = "paper";
    try { t = localStorage.getItem(KEY) || document.documentElement.getAttribute("data-theme") || "paper"; } catch (e) {}
    return t === "dark" ? "dark" : "paper";
  }
  function apply(theme) {
    var t = theme === "dark" ? "dark" : "paper";
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(KEY, t); } catch (e) {}
    var paperBtn = document.getElementById("theme-paper-btn");
    var darkBtn = document.getElementById("theme-dark-btn");
    if (paperBtn) paperBtn.classList.toggle("on", t === "paper");
    if (darkBtn) darkBtn.classList.toggle("on", t === "dark");
  }
  window.uhgSetTheme = apply;
  apply(current());
})();
