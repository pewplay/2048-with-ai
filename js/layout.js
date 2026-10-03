// Responsive layout: picks a portrait (stacked) or landscape (side panel) layout,
// whichever gives the biggest board, and sizes the board to fill the window.
// Elements of .app:
//   .stage            the board slot
//   [data-col="2"]    goes in the right-hand column in landscape (otherwise left)
//   .optional         shown only when there is room for it
//   [data-reserve]    extra height (px) to keep free for it in portrait
(function () {
  var app = document.getElementById("app");
  if (!app) return;
  var root = document.documentElement;
  var sides = +(app.getAttribute("data-sides") || 1);

  if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
    root.classList.add("touch");
  }
  window.addEventListener("touchstart", function () {
    root.classList.add("touch");
  }, { passive: true, once: true });

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function kids(filter) {
    var out = [];
    for (var i = 0; i < app.children.length; i++) {
      var el = app.children[i];
      if (el.classList.contains("stage")) continue;
      if (filter(el)) out.push(el);
    }
    return out;
  }

  function shown(el) {
    return getComputedStyle(el).display !== "none";
  }

  function stackHeight(list, gap) {
    var h = 0, n = 0;
    list.forEach(function (el) {
      if (!shown(el)) return;
      h += el.getBoundingClientRect().height + (+el.getAttribute("data-reserve") || 0);
      n++;
    });
    return { h: h, n: n };
  }

  function setVars(board, side, ui) {
    app.style.setProperty("--board", Math.floor(board) + "px");
    if (side) app.style.setProperty("--side", Math.floor(side) + "px");
    app.style.setProperty("--ui", (Math.round(ui * 10) / 10) + "px");
  }

  function mode(name, hideOptional) {
    app.classList.remove("portrait", "landscape");
    app.classList.add(name);
    app.classList.toggle("no-opt", !!hideOptional);
  }

  function inner() {
    var cs = getComputedStyle(app);
    return {
      w: app.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      h: app.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
    };
  }

  function portrait(box, gap) {
    mode("portrait", true);
    var col = box.w, b = col, ui;
    for (var i = 0; i < 4; i++) {
      ui = clamp(col / 24, 13, 21);
      setVars(col, 0, ui);
      var s = stackHeight(kids(function () { return true; }), gap);
      b = Math.min(box.w, box.h - s.h - s.n * gap);
      if (Math.abs(b - col) < 1) break;
      col = b;
    }
    return { board: Math.max(120, b), ui: ui };
  }

  function landscape(box, gap, W, H) {
    mode("landscape", true);
    var side = sides === 2 ? clamp(W * 0.2, 168, 340) : clamp(W * 0.27, 200, 400);
    var b = Math.min(box.h, box.w - sides * (side + gap * 2));
    var ui = clamp(Math.min(side / 15, H / 28), 12, 24);
    for (; ui >= 11; ui -= 0.5) {
      setVars(b, side, ui);
      if (colFits(1, box.h, gap) && (sides < 2 || colFits(2, box.h, gap))) break;
    }
    return { board: Math.max(120, b), side: side, ui: Math.max(ui, 11) };
  }

  function colFits(col, height, gap) {
    var s = stackHeight(kids(function (el) {
      return (el.getAttribute("data-col") || "1") === String(col);
    }), gap);
    return s.h + (s.n + 1) * gap <= height + 0.5;
  }

  function fit() {
    var W = window.innerWidth, H = window.innerHeight;
    var m = Math.min(W, H);
    var gap = Math.round(clamp(m * 0.022, 8, 22));
    app.style.setProperty("--pad", Math.round(clamp(m * 0.025, 8, 28)) + "px");
    app.style.setProperty("--gap", gap + "px");
    var box = inner();

    var p = portrait(box, gap);
    var l = landscape(box, gap, W, H);

    if (l.board > p.board * 1.04) {
      mode("landscape", false);
      setVars(l.board, l.side, l.ui);
      if (!colFits(1, box.h, gap) || (sides === 2 && !colFits(2, box.h, gap))) {
        app.classList.add("no-opt");
      }
    } else {
      mode("portrait", false);
      setVars(p.board, 0, p.ui);
      var s = stackHeight(kids(function () { return true; }), gap);
      if (s.h + (s.n) * gap + p.board > box.h + 0.5) app.classList.add("no-opt");
    }
    app.classList.add("ready");
    fitValues();
  }

  // Shrink score values that do not fit their box (big scores, timers over an hour).
  function fitValues() {
    var values = app.querySelectorAll(".score-box .value");
    for (var i = 0; i < values.length; i++) {
      var el = values[i], box = el.parentNode;
      el.style.fontSize = "";
      var bs = getComputedStyle(box);
      var avail = box.clientWidth - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight) + 4;
      var need = el.firstChild ? el.firstChild.nodeType === 3 ? textWidth(el) : el.scrollWidth : 0;
      if (need > avail && avail > 0) {
        el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * avail / need) + "px";
      }
    }
  }

  function textWidth(el) {
    var range = document.createRange();
    range.selectNodeContents(el.firstChild);
    return range.getBoundingClientRect().width;
  }

  if (window.MutationObserver) {
    new MutationObserver(fitValues).observe(app.querySelector(".scores") || app, {
      childList: true, subtree: true, characterData: true
    });
  }

  var pending = 0;
  function schedule() {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(fit);
  }

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  window.addEventListener("load", schedule);
  window.pewplayLayout = schedule;
  fit();
})();
