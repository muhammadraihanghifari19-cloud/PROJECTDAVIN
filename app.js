/* =========================================================
   FRAMELESS · Motion Path Animation Studio
   Engine: path drawing + object motion along SVG path
   Vanilla JS, zero dependency. SVG namespace aware.
   ========================================================= */
(function () {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);

  /* ---------- Elemen DOM ---------- */
  const svg          = $("canvas");
  const layerPaths   = $("layerPaths");
  const layerObjects = $("layerObjects");
  const layerTravelers = $("layerTravelers");

  const btnPlay   = $("btnPlay");
  const btnReset  = $("btnReset");
  const btnExport = $("btnExport");
  const btnTheme  = $("btnTheme");
  const scrubber  = $("scrubber");
  const timeLabel = $("timeLabel");

  const durationEl = $("duration");
  const durationOut= $("durationOut");
  const easingEl   = $("easing");
  const loopEl     = $("loop");
  const orientEl   = $("orient");
  const trailEl    = $("trail");

  const objSizeEl  = $("objSize");
  const objSizeOut = $("objSizeOut");
  const objColorEl = $("objColor");
  const objNote    = $("objNote");

  const hintEl     = $("hint");
  const stageHint  = $("stageHint");
  const coordsEl   = $("coords");
  const paletteEl  = $("palette");
  const statusObjects = $("statusObjects");
  const statusPoints  = $("statusPoints");

  /* ---------- State ---------- */
  const state = {
    tool: "select",        // select | path | object | erase
    shape: "circle",
    points: [],            // titik jalur: {x,y}
    objects: [],           // {id, shape, size, color, start(0..1), el}
    selectedId: null,
    playing: false,
    progress: 0,           // 0..1 posisi global timeline
    rafId: null,
    lastTs: 0,
  };

  let pathEl = null;       // <path> motion path aktif
  let uid = 1;

  /* ---------- Easing functions ---------- */
  const easings = {
    linear: (t) => t,
    easeIn: (t) => t * t,
    easeOut: (t) => t * (2 - t),
    easeInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    elastic: (t) => {
      if (t === 0 || t === 1) return t;
      const p = 0.3;
      return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
    },
    bounce: (t) => {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
  };

  /* ---------- Util: konversi koordinat layar -> viewBox SVG ---------- */
  function toSvgPoint(evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = pt.matrixTransform(ctm.inverse());
    return { x: Math.round(inv.x), y: Math.round(inv.y) };
  }

  function el(tag, attrs) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* ---------- Bangun data path "d" dari titik (smooth catmull-rom) ---------- */
  function buildPathD(points) {
    if (points.length < 2) return "";
    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }
    // Catmull-Rom -> Bezier agar jalur melengkung halus
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
    }
    return d;
  }

  /* ---------- Render ulang jalur + node ---------- */
  function renderPath() {
    layerPaths.innerHTML = "";
    pathEl = null;
    const d = buildPathD(state.points);

    if (d) {
      // jejak gerak (trail) di bawah path utama
      if (trailEl.checked) {
        const trail = el("path", { d, class: "mp-trail", stroke: "var(--accent-4)", "stroke-width": 10 });
        layerPaths.appendChild(trail);
      }
      pathEl = el("path", { d, class: "mp-path" });
      layerPaths.appendChild(pathEl);
    }

    // node titik (bisa digeser)
    state.points.forEach((p, i) => {
      const node = el("circle", { cx: p.x, cy: p.y, r: 7, class: "mp-node", "data-i": i });
      layerPaths.appendChild(node);
    });

    statusPoints.textContent = `Titik jalur: ${state.points.length}`;
  }

  /* ---------- Gambar bentuk objek sebagai elemen SVG ---------- */
  function makeShapeEl(shape, size, color) {
    const r = size / 2;
    let node;
    switch (shape) {
      case "square":
        node = el("rect", { x: -r, y: -r, width: size, height: size, rx: size * 0.12, fill: color });
        break;
      case "triangle":
        node = el("polygon", { points: `0,${-r} ${r},${r} ${-r},${r}`, fill: color });
        break;
      case "diamond":
        node = el("polygon", { points: `0,${-r} ${r},0 0,${r} ${-r},0`, fill: color });
        break;
      case "star":
        node = el("polygon", { points: starPoints(r), fill: color });
        break;
      case "ring":
        node = el("circle", { cx: 0, cy: 0, r: r, fill: "none", stroke: color, "stroke-width": Math.max(3, size * 0.18) });
        break;
      case "circle":
      default:
        node = el("circle", { cx: 0, cy: 0, r: r, fill: color });
    }
    return node;
  }

  function starPoints(r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const rad = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      pts.push(`${(Math.cos(rad) * rr).toFixed(1)},${(Math.sin(rad) * rr).toFixed(1)}`);
    }
    return pts.join(" ");
  }

  /* ---------- Tambah objek di posisi klik ---------- */
  function addObject(pt) {
    const obj = {
      id: uid++,
      shape: state.shape,
      size: parseInt(objSizeEl.value, 10),
      color: objColorEl.value,
      start: 0,              // offset start sepanjang path (0..1)
      home: { x: pt.x, y: pt.y }, // posisi diam ketika belum ada path
    };
    state.objects.push(obj);
    state.selectedId = obj.id;
    renderObjects();
    syncSelectedUI();
  }

  /* ---------- Render semua objek ---------- */
  function renderObjects() {
    layerObjects.innerHTML = "";
    state.objects.forEach((obj) => {
      const g = el("g", { class: "mp-obj", "data-id": obj.id });
      const shapeEl = makeShapeEl(obj.shape, obj.size, obj.color);
      g.appendChild(shapeEl);
      if (obj.id === state.selectedId) {
        const ring = el("circle", { cx: 0, cy: 0, r: obj.size / 2 + 8, class: "sel-ring" });
        g.appendChild(ring);
      }
      obj.el = g;
      layerObjects.appendChild(g);
    });
    statusObjects.textContent = `Objek: ${state.objects.length}`;
    positionObjects(state.progress);
  }

  /* ---------- Posisikan objek di sepanjang path sesuai progress ---------- */
  function positionObjects(globalT) {
    const hasPath = pathEl && state.points.length >= 2;
    let totalLen = 0;
    if (hasPath) {
      try { totalLen = pathEl.getTotalLength(); } catch (e) { totalLen = 0; }
    }
    const easeFn = easings[easingEl.value] || easings.linear;

    state.objects.forEach((obj) => {
      if (!obj.el) return;
      if (hasPath && totalLen > 0) {
        // t per objek: offset start + progress global, dibungkus 0..1
        let t = (globalT + obj.start) % 1;
        if (t < 0) t += 1;
        const eased = Math.min(1, Math.max(0, easeFn(t)));
        const point = pathEl.getPointAtLength(eased * totalLen);
        let angle = 0;
        if (orientEl.checked) {
          const ahead = pathEl.getPointAtLength(Math.min(totalLen, eased * totalLen + 1));
          angle = Math.atan2(ahead.y - point.y, ahead.x - point.x) * (180 / Math.PI);
        }
        obj.el.setAttribute("transform", `translate(${point.x} ${point.y}) rotate(${angle})`);
      } else {
        // belum ada path: diam di rumah
        obj.el.setAttribute("transform", `translate(${obj.home.x} ${obj.home.y})`);
      }
    });
  }

  /* ---------- Animasi loop ---------- */
  function tick(ts) {
    if (!state.playing) return;
    if (!state.lastTs) state.lastTs = ts;
    const dt = (ts - state.lastTs) / 1000;
    state.lastTs = ts;

    const dur = parseFloat(durationEl.value) || 4;
    state.progress += dt / dur;

    if (state.progress >= 1) {
      if (loopEl.checked) {
        state.progress = state.progress % 1;
      } else {
        state.progress = 1;
        stop();
      }
    }

    syncScrubber();
    positionObjects(state.progress);
    if (state.playing) state.rafId = requestAnimationFrame(tick);
  }

  function play() {
    if (state.objects.length === 0 || state.points.length < 2) {
      flashHint("Butuh minimal 1 objek dan jalur dengan 2+ titik untuk memutar animasi.");
      return;
    }
    state.playing = true;
    state.lastTs = 0;
    btnPlay.textContent = "⏸ Pause";
    btnPlay.classList.add("is-playing");
    state.rafId = requestAnimationFrame(tick);
  }

  function stop() {
    state.playing = false;
    btnPlay.textContent = "▶ Play";
    btnPlay.classList.remove("is-playing");
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }

  function togglePlay() {
    state.playing ? stop() : play();
  }

  function resetAnim() {
    stop();
    state.progress = 0;
    syncScrubber();
    positionObjects(0);
  }

  /* ---------- Scrubber sinkronisasi ---------- */
  function syncScrubber() {
    scrubber.value = Math.round(state.progress * 1000);
    timeLabel.textContent = Math.round(state.progress * 100) + "%";
  }

  /* ---------- UI objek terpilih ---------- */
  function getSelected() {
    return state.objects.find((o) => o.id === state.selectedId) || null;
  }
  function syncSelectedUI() {
    const o = getSelected();
    if (o) {
      objSizeEl.value = o.size;
      objSizeOut.textContent = o.size;
      objColorEl.value = o.color;
      objNote.textContent = `Terpilih: ${o.shape} · ukuran ${o.size}px`;
    } else {
      objNote.textContent = "Tidak ada objek terpilih.";
    }
  }

  /* ---------- Tool switching ---------- */
  function setTool(tool) {
    state.tool = tool;
    document.querySelectorAll(".tool").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.tool === tool)
    );
    const labels = { select: "Select", path: "Path", object: "Object", erase: "Erase" };
    stageHint.textContent = "Mode: " + (labels[tool] || tool);
    svg.style.cursor = tool === "select" ? "default" : "crosshair";
  }

  function flashHint(msg) {
    const prev = hintEl.innerHTML;
    hintEl.innerHTML = `<b>⚠ ${msg}</b>`;
    setTimeout(() => (hintEl.innerHTML = prev), 2600);
  }

  /* ---------- Event: klik kanvas ---------- */
  svg.addEventListener("click", (evt) => {
    const pt = toSvgPoint(evt);

    if (state.tool === "path") {
      state.points.push(pt);
      renderPath();
      positionObjects(state.progress);
    } else if (state.tool === "object") {
      addObject(pt);
    } else if (state.tool === "erase") {
      // tangani di handler per-elemen di bawah
    }
  });

  /* ---------- Event: delegasi klik untuk select / erase ---------- */
  svg.addEventListener("pointerdown", (evt) => {
    const objG = evt.target.closest(".mp-obj");
    const node = evt.target.closest(".mp-node");

    if (state.tool === "erase") {
      if (objG) {
        const id = parseInt(objG.dataset.id, 10);
        state.objects = state.objects.filter((o) => o.id !== id);
        if (state.selectedId === id) state.selectedId = null;
        renderObjects(); syncSelectedUI();
      } else if (node) {
        const i = parseInt(node.dataset.i, 10);
        state.points.splice(i, 1);
        renderPath(); positionObjects(state.progress);
      }
      return;
    }

    if (state.tool === "select") {
      if (objG) {
        state.selectedId = parseInt(objG.dataset.id, 10);
        renderObjects(); syncSelectedUI();
        startDragObject(evt);
      } else if (node) {
        startDragNode(evt, parseInt(node.dataset.i, 10));
      } else {
        state.selectedId = null;
        renderObjects(); syncSelectedUI();
      }
    }
  });

  /* ---------- Drag node jalur (pointer capture: jalan di mouse & sentuh) ---------- */
  function startDragNode(evt, index) {
    evt.preventDefault();
    const pid = evt.pointerId;
    try { svg.setPointerCapture(pid); } catch (e) {}
    const move = (e) => {
      if (e.pointerId !== pid) return;
      const pt = toSvgPoint(e);
      if (state.points[index]) {
        state.points[index] = pt;
        renderPath();
        positionObjects(state.progress);
      }
    };
    const up = (e) => {
      if (e.pointerId !== pid) return;
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerup", up);
      svg.removeEventListener("pointercancel", up);
      try { svg.releasePointerCapture(pid); } catch (err) {}
    };
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
  }

  /* ---------- Drag objek (ubah posisi "home") ---------- */
  function startDragObject(evt) {
    const o = getSelected();
    if (!o) return;
    evt.preventDefault();
    const pid = evt.pointerId;
    try { svg.setPointerCapture(pid); } catch (e) {}
    const move = (e) => {
      if (e.pointerId !== pid) return;
      const pt = toSvgPoint(e);
      o.home = { x: pt.x, y: pt.y };
      positionObjects(state.progress);
    };
    const up = (e) => {
      if (e.pointerId !== pid) return;
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerup", up);
      svg.removeEventListener("pointercancel", up);
      try { svg.releasePointerCapture(pid); } catch (err) {}
    };
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
  }

  /* ---------- Koordinat live ---------- */
  svg.addEventListener("pointermove", (evt) => {
    const pt = toSvgPoint(evt);
    coordsEl.textContent = `x: ${pt.x} · y: ${pt.y}`;
  });

  /* ---------- Tombol tool & shape ---------- */
  document.querySelectorAll(".tool").forEach((b) =>
    b.addEventListener("click", () => setTool(b.dataset.tool))
  );
  document.querySelectorAll(".shape").forEach((b) =>
    b.addEventListener("click", () => {
      state.shape = b.dataset.shape;
      document.querySelectorAll(".shape").forEach((s) =>
        s.classList.toggle("is-active", s === b)
      );
      const o = getSelected();
      if (o) { o.shape = state.shape; renderObjects(); }
    })
  );

  /* ---------- Kontrol transport ---------- */
  btnPlay.addEventListener("click", togglePlay);
  btnReset.addEventListener("click", resetAnim);
  scrubber.addEventListener("input", () => {
    stop();
    state.progress = parseInt(scrubber.value, 10) / 1000;
    timeLabel.textContent = Math.round(state.progress * 100) + "%";
    positionObjects(state.progress);
  });

  /* ---------- Kontrol properti ---------- */
  durationEl.addEventListener("input", () => {
    durationOut.textContent = parseFloat(durationEl.value).toFixed(1) + "s";
  });
  easingEl.addEventListener("change", () => positionObjects(state.progress));
  orientEl.addEventListener("change", () => positionObjects(state.progress));
  trailEl.addEventListener("change", () => { renderPath(); positionObjects(state.progress); });

  objSizeEl.addEventListener("input", () => {
    objSizeOut.textContent = objSizeEl.value;
    const o = getSelected();
    if (o) { o.size = parseInt(objSizeEl.value, 10); renderObjects(); }
  });
  objColorEl.addEventListener("input", () => {
    const o = getSelected();
    if (o) { o.color = objColorEl.value; renderObjects(); }
  });

  /* ---------- Export JSON ---------- */
  btnExport.addEventListener("click", () => {
    const data = {
      project: "FRAMELESS Motion Path Animation Studio",
      version: 1,
      exportedAt: new Date().toISOString(),
      animation: {
        duration: parseFloat(durationEl.value),
        easing: easingEl.value,
        loop: loopEl.checked,
        orient: orientEl.checked,
        trail: trailEl.checked,
      },
      path: state.points,
      objects: state.objects.map((o) => ({
        shape: o.shape, size: o.size, color: o.color, start: o.start, home: o.home,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "frameless-motion.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  /* ---------- Theme toggle ---------- */
  btnTheme.addEventListener("click", () => {
    document.body.classList.toggle("theme-solar");
    renderPath();
    renderObjects();
  });

  /* ---------- Keyboard shortcuts ---------- */
  window.addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
    const map = { v: "select", p: "path", o: "object", e: "erase" };
    if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
    if (e.code === "Space") { e.preventDefault(); togglePlay(); }
    if (e.key === "Delete" || e.key === "Backspace") {
      const o = getSelected();
      if (o) {
        state.objects = state.objects.filter((x) => x.id !== o.id);
        state.selectedId = null;
        renderObjects(); syncSelectedUI();
      }
    }
  });

  /* ---------- Palet swatches di panel design system ---------- */
  function buildPalette() {
    const styles = getComputedStyle(document.body);
    const vars = ["--accent", "--accent-2", "--accent-3", "--accent-4"];
    paletteEl.innerHTML = "";
    vars.forEach((v) => {
      const hex = styles.getPropertyValue(v).trim() || "#000";
      const sw = document.createElement("div");
      sw.className = "swatch";
      sw.style.background = hex;
      sw.setAttribute("data-hex", hex);
      sw.title = `Pakai ${hex} untuk objek terpilih`;
      sw.addEventListener("click", () => {
        objColorEl.value = hex.length === 7 ? hex : objColorEl.value;
        const o = getSelected();
        if (o) { o.color = hex; renderObjects(); }
      });
      paletteEl.appendChild(sw);
    });
  }

  /* ---------- Demo awal: beri jalur contoh agar langsung hidup ---------- */
  function seedDemo() {
    state.points = [
      { x: 180, y: 560 }, { x: 360, y: 220 }, { x: 600, y: 520 },
      { x: 840, y: 200 }, { x: 1040, y: 540 },
    ];
    renderPath();
    const demoColors = ["#F5F749", "#FF4D6D", "#4DE1FF"];
    const demoShapes = ["circle", "star", "diamond"];
    for (let i = 0; i < 3; i++) {
      state.objects.push({
        id: uid++, shape: demoShapes[i], size: 26 + i * 6,
        color: demoColors[i], start: i / 3, home: { x: 180, y: 560 },
      });
    }
    renderObjects();
    syncSelectedUI();
  }

  /* ---------- Init ---------- */
  function init() {
    setTool("select");
    durationOut.textContent = parseFloat(durationEl.value).toFixed(1) + "s";
    objSizeOut.textContent = objSizeEl.value;
    buildPalette();
    seedDemo();
    syncScrubber();
    // auto-putar demo biar langsung terasa hidup
    setTimeout(play, 400);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
