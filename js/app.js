/* App shell: state, hash router, navigation, theme. */
(function () {
  var KAI = (window.KAI = window.KAI || {});
  var U = KAI.util, h = U.h, E = KAI.E;

  var DEFAULT = {checklist: {}, decisions: {}, signoffs: {}, exceptions: [], pack: null};
  KAI.state = Object.assign({}, DEFAULT, U.store.get("kai.state.v1", {}));
  KAI.save = function () { U.store.set("kai.state.v1", KAI.state); };
  KAI.resetState = function () {
    KAI.state = JSON.parse(JSON.stringify(DEFAULT));
    KAI.save();
  };

  E.init();

  KAI.views = KAI.views || {};
  var NAV = [
    {group: "Overview", items: [["home", "Home"], ["analysis", "Analysis"]]},
    {group: "The six tasks", items: [
      ["checklist", "Data-pull checklist", 1], ["reviewers", "Reviewer assignment", 2], ["criteria", "Review criteria", 3],
      ["sod", "SoD conflict rules", 4], ["exceptions", "Exception workflow", 5], ["evidence", "Evidence retention", 6]]},
    {group: "Work with the data", items: [["workbench", "Review workbench"], ["accounts", "Accounts explorer"], ["report", "Printable report"]]}
  ];

  var nav = document.getElementById("nav"), main = document.getElementById("main");
  NAV.forEach(function (g) {
    nav.appendChild(h("h4", null, g.group));
    g.items.forEach(function (it) {
      nav.appendChild(h("a", {href: "#/" + (it[0] === "home" ? "" : it[0]), "data-id": it[0]},
        it[2] ? h("span", {class: "num"}, it[2]) : null, it[1]));
    });
  });

  function parse() {
    var raw = location.hash.replace(/^#\/?/, "");
    var parts = raw.split("?");
    var q = {};
    (parts[1] || "").split("&").forEach(function (kv) {
      if (!kv) return;
      var p = kv.split("=");
      q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
    });
    return {id: parts[0] || "home", q: q};
  }

  function route() {
    var r = parse();
    var v = KAI.views[r.id] || KAI.views.home;
    if (!KAI.views[r.id]) r.id = "home";
    Array.prototype.forEach.call(nav.querySelectorAll("a"), function (a) {
      if (a.dataset.id === r.id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    U.clear(main);
    document.title = v.title + " - SOX Access Review Lab";
    try { main.appendChild(v.render(r.q)); }
    catch (e) {
      console.error(e);
      main.appendChild(h("div", {class: "note bad"}, "Something went wrong drawing this page: " + e.message));
    }
    document.body.classList.remove("nav-open");
    document.getElementById("burger").setAttribute("aria-expanded", "false");
    window.scrollTo(0, 0);
  }
  KAI.refresh = route;
  KAI.go = function (id, q) {
    var qs = q ? "?" + Object.keys(q).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(q[k]); }).join("&") : "";
    location.hash = "#/" + id + qs;
  };
  window.addEventListener("hashchange", route);

  document.getElementById("burger").addEventListener("click", function () {
    var open = document.body.classList.toggle("nav-open");
    this.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.getElementById("theme").addEventListener("click", function () {
    var cur = document.documentElement.getAttribute("data-theme");
    var dark = cur ? cur === "dark" : window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
    var next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("kai.theme", next); } catch (e) {}
  });

  /* Docs live in the repo; link to GitHub's renderer when hosted on github.io */
  (function () {
    var box = document.getElementById("docs");
    var m = location.hostname.match(/^([^.]+)\.github\.io$/);
    var repo = location.pathname.split("/")[1];
    var base = m && repo ? "https://github.com/" + m[1] + "/" + repo + "/blob/main/" : "";
    ["README.md", "docs/HLD.md", "docs/LLD.md"].forEach(function (f, i) {
      box.appendChild(h("a", {href: base + f, target: "_blank", rel: "noopener"}, f.replace("docs/", "").replace(".md", "")));
      if (i < 2) box.appendChild(document.createTextNode(" | "));
    });
  })();

  route();
})();
