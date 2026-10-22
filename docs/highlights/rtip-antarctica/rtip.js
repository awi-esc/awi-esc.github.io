/* Rate-induced tipping of a marine ice sheet: a toy model and the interactive
   figures for the highlight on Swierczek-Jereczek et al. (2026, Nat. Geosci.).
   The model is illustrative only: it reproduces the mechanism of the paper,
   not its numbers. */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------------
  // Toy model
  //
  // s : grounding-line position (km from the ice divide)
  // u : bedrock uplift below the grounding zone (m)
  //
  // The bed has a sill at ~700 km and a deep basin further inland whose bed
  // deepens towards the interior (retrograde slope). Ice outflow at the
  // grounding line scales with water depth^alpha (Schoof, 2007) and increases
  // with warming; inflow is the accumulation upstream. Uplift relaxes towards
  // its equilibrium value (proportional to the retreat) on the mantle
  // response timescale tau.
  // ---------------------------------------------------------------------
  const P = {
    a: 0.25,      // accumulation (m/yr)
    alpha: 4.75,  // grounding-line flux exponent
    kappa: 1.0,   // outflow sensitivity to warming (1/K)
    s0: 800,      // initial grounding line (km)
    gamma: 0.4,   // equilibrium uplift per km of retreat (m/km)
    umax: 450,    // maximum uplift (m)
    fice: 0.1,    // ice-dynamics speed factor
    sill: 700,    // position of the sill (km)
    scollapse: 450, // grounding line inland of this = basin collapsed (km)
  };

  function depth(s) { // water depth of the bed below sea level (m)
    const z = (s - P.sill) / 15;
    const softplus = z > 20 ? z : Math.log1p(Math.exp(z));
    return 200 + 1100 * Math.exp(-(((s - 480) / 130) ** 2)) + 45 * softplus;
  }

  function ueq(s) { // equilibrium uplift for a grounding line at s (m)
    const r = Math.max(P.s0 - s, 0);
    return P.umax * (1 - Math.exp(-P.gamma * r / P.umax));
  }

  const C0 = P.a * P.s0 * 1e3 / Math.pow(depth(P.s0), P.alpha);

  function dsdt(s, u, T) { // grounding-line migration (km/yr)
    const d = Math.max(depth(s) - u, 1);
    const qout = C0 * Math.exp(P.kappa * T) * Math.pow(d, P.alpha);
    return P.fice * (P.a * s * 1e3 - qout) / (1.12 * d) / 1e3;
  }

  // Equilibrium warming for a grounding line at s, with or without uplift
  function eqWarming(s, withUplift) {
    const d = depth(s) - (withUplift ? ueq(s) : 0);
    return Math.log(P.a * s * 1e3 / (C0 * Math.pow(d, P.alpha))) / P.kappa;
  }

  // Bifurcation point: the warming beyond which no equilibrium exists
  // seaward of the basin
  function bifurcation(withUplift) {
    let Tc = -Infinity;
    for (let s = 600; s <= P.s0; s += 0.25) Tc = Math.max(Tc, eqWarming(s, withUplift));
    return Tc;
  }
  const TC = bifurcation(true);     // equilibrium tipping point
  const TC_RIGID = bifurcation(false); // tipping point without any uplift

  // Warming ramp: rises at `rate` (K per century) up to `Tmax`, then held
  function warming(t, Tmax, rate) { return Math.min(Tmax, rate / 100 * t); }

  // Full trajectory, recorded at ~nrec points
  function simulate(Tmax, rate, tau, opts) {
    opts = opts || {};
    const dt = opts.dt || 10;
    const tRamp = Tmax / (rate / 100);
    const tEnd = opts.tEnd || tRamp + (opts.tAfter || 20000);
    const nsteps = Math.ceil(tEnd / dt);
    const every = Math.max(1, Math.round(nsteps / (opts.nrec || 400)));
    const relax = 1 - Math.exp(-dt / tau);
    const rec = { t: [], T: [], s: [], u: [], ue: [] };
    let s = P.s0, u = 0;
    for (let i = 0; i <= nsteps; i++) {
      const t = i * dt;
      const T = warming(t, Tmax, rate);
      if (i % every === 0 || i === nsteps) {
        rec.t.push(t); rec.T.push(T); rec.s.push(s); rec.u.push(u); rec.ue.push(ueq(s));
      }
      const k1 = dsdt(s, u, T);
      const k2 = dsdt(s + dt * k1, u, T);
      s = Math.min(Math.max(s + 0.5 * dt * (k1 + k2), 200), 1000);
      u += (ueq(s) - u) * relax;
    }
    rec.tRamp = tRamp;
    rec.tEnd = tEnd;
    rec.collapsed = s < P.scollapse;
    let i = rec.s.findIndex(function (v) { return v < P.scollapse; });
    rec.tCollapse = i < 0 ? null : rec.t[i];
    return rec;
  }

  // Does this forcing collapse the basin? Stops as soon as the answer is known.
  function collapses(Tmax, rate, tau) {
    const dt = 25;
    const tRamp = Tmax / (rate / 100);
    const tEnd = tRamp + 60000;
    const relax = 1 - Math.exp(-dt / tau);
    let s = P.s0, u = 0;
    for (let t = 0; t < tEnd; t += dt) {
      const T = warming(t, Tmax, rate);
      const k1 = dsdt(s, u, T);
      const k2 = dsdt(s + dt * k1, u, T);
      const ds = 0.5 * (k1 + k2);
      s += dt * ds;
      u += (ueq(s) - u) * relax;
      if (s < P.scollapse) return true;
      // After the ramp, uplift only grows, so a settled grounding line stays put
      if (t > tRamp + 2000 && Math.abs(ds) < 2e-7) return false;
    }
    return s < P.scollapse;
  }

  // ---------------------------------------------------------------------
  // Cross-section geometry (shared by the page and the teaser image)
  // ---------------------------------------------------------------------
  const XS = { xmin: 150, xmax: 1000, zmin: -1700, zmax: 700, exag: 3, shelf: 160 };

  function sig(z) { return 1 / (1 + Math.exp(-z)); }

  // Drawn bed elevation (m); uplift is exaggerated by XS.exag for visibility
  function bedZ(x, s, u) {
    const shape = sig((x - s + 60) / 20) * sig((P.s0 + 120 - x) / 40);
    return -depth(x) + XS.exag * u * shape;
  }

  function crossSectionPaths(s, u, W, H) {
    const X = function (x) { return ((x - XS.xmin) / (XS.xmax - XS.xmin) * W).toFixed(1); };
    const Z = function (z) { return ((XS.zmax - z) / (XS.zmax - XS.zmin) * H).toFixed(1); };
    const dx = 2;
    const zb = Math.min(bedZ(s, s, u), -20);  // ice base at the grounding line
    const Hg = -zb * 1.12;                     // flotation thickness

    let bed = "", bed0 = "", top = "", base = "", ocean = "";
    const x0 = XS.xmin - 10;
    for (let x = x0; x <= XS.xmax + 1e-9; x += dx) {
      const zbed = bedZ(x, s, u);
      bed += (x === x0 ? "M" : "L") + X(x) + "," + Z(zbed);
      bed0 += (x === x0 ? "M" : "L") + X(x) + "," + Z(-depth(x));
      if (x < s) {
        top += (top ? "L" : "M") + X(x) + "," + Z(0.11 * Hg + 110 * (Math.sqrt(s - x + 20) - Math.sqrt(20)));
      }
    }
    // Floating ice shelf: thins seaward, stays clear of the bed and ends
    // where it would run aground (e.g., on a bed rising towards a sill)
    for (let x = s; x <= Math.min(s + XS.shelf, XS.xmax) + 1e-9; x += dx) {
      const clearance = 15 * Math.min(1, (x - s) / 10);
      const h = Math.min(Hg * Math.exp(-(x - s) / 120), (-bedZ(x, s, u) - clearance) / 0.89);
      if (x > s && h < 40) break;
      top += "L" + X(x) + "," + Z(0.11 * h);
      base = "L" + X(x) + "," + Z(-0.89 * h) + base;
    }
    // Ice base follows the bed upstream of the grounding line
    let grounded = "";
    for (let x = s; x >= x0 - 1e-9; x -= dx) grounded += "L" + X(x) + "," + Z(bedZ(x, s, u));
    const ice = top + base + grounded + "Z";

    // Ocean: from the grounding line seaward, between sea level and the bed
    ocean = "M" + X(s) + "," + Z(0);
    ocean += "L" + X(XS.xmax) + "," + Z(0);
    for (let x = XS.xmax; x >= s - 1e-9; x -= dx) ocean += "L" + X(x) + "," + Z(bedZ(x, s, u));
    ocean += "Z";

    const bedFill = bed + "L" + X(XS.xmax) + "," + H + "L0," + H + "Z";
    return {
      ice: ice, ocean: ocean, bed: bed, bedFill: bedFill, bed0: bed0,
      sea: "M0," + Z(0) + "L" + W + "," + Z(0),
      gl: [+X(s), +Z(zb)],
      X: X, Z: Z,
    };
  }

  const model = {
    P: P, depth: depth, ueq: ueq, dsdt: dsdt, TC: TC, TC_RIGID: TC_RIGID,
    simulate: simulate, collapses: collapses, crossSectionPaths: crossSectionPaths, XS: XS,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = model;
    return;
  }
  root.RTip = model;

  // ---------------------------------------------------------------------
  // Page
  // ---------------------------------------------------------------------
  const SVGNS = "http://www.w3.org/2000/svg";
  const REDUCED = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function fmtRate(r) {
    if (r >= 1) return r.toFixed(r >= 10 ? 0 : 1);
    if (r >= 0.1) return r.toFixed(2);
    if (r >= 0.01) return r.toFixed(3);
    return r.toFixed(4);
  }
  function fmtTau(tau) {
    return tau >= 1000 ? (tau / 1000).toFixed(tau >= 10000 ? 0 : 1) + " kyr" : Math.round(tau) + " yr";
  }
  function fmtTime(t) {
    return t >= 10000 ? (t / 1000).toFixed(0) + " kyr" : t >= 1000 ? (t / 1000).toFixed(1) + " kyr" : Math.round(t) + " yr";
  }

  // A cross-section drawn into an SVG; update(s, u) moves it
  function CrossSection(container, opts) {
    opts = opts || {};
    const svg = el("svg", { class: "rt-xs", role: "img", "aria-label": opts.label || "Ice-sheet cross-section" });
    container.appendChild(svg);
    const g = {
      ocean: el("path", { class: "rt-ocean" }, svg),
      sea: el("path", { class: "rt-sea" }, svg),
      bedFill: el("path", { class: "rt-bed-fill" }, svg),
      bed0: el("path", { class: "rt-bed0" }, svg),
      ice: el("path", { class: "rt-ice" }, svg),
      bed: el("path", { class: "rt-bed" }, svg),
      gl: el("circle", { class: "rt-gl", r: 4.5 }, svg),
    };
    const labels = el("g", { class: "rt-xs-labels" }, svg);
    let W = 0, H = 0, last = null;

    function layout() {
      W = container.clientWidth;
      H = Math.round(Math.max(150, Math.min(240, W * 0.3)));
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.setAttribute("width", W);
      svg.setAttribute("height", H);
      while (labels.firstChild) labels.removeChild(labels.firstChild);
      const p = crossSectionPaths(P.s0, 0, W, H);
      const small = W < 480;
      el("text", { x: 8, y: 18, class: "rt-lbl rt-lbl-ice" }, labels).textContent = "Ice sheet";
      el("text", { x: W - 8, y: p.Z(0) - 6, class: "rt-lbl rt-lbl-ocean", "text-anchor": "end" }, labels).textContent = "Ocean";
      el("text", { x: p.X(480), y: H - 8, class: "rt-lbl rt-lbl-bed", "text-anchor": "middle" }, labels).textContent = small ? "Deep basin" : "Deep basin (bed deepens inland)";
      el("text", { x: p.X(P.sill), y: H - 8, class: "rt-lbl rt-lbl-bed", "text-anchor": "middle" }, labels).textContent = "Sill";
      if (last) update(last[0], last[1]);
    }

    function update(s, u) {
      last = [s, u];
      if (!W) return;
      const p = crossSectionPaths(s, u, W, H);
      g.bedFill.setAttribute("d", p.bedFill);
      g.ocean.setAttribute("d", p.ocean);
      g.sea.setAttribute("d", p.sea);
      g.bed0.setAttribute("d", p.bed0);
      g.ice.setAttribute("d", p.ice);
      g.bed.setAttribute("d", p.bed);
      g.gl.setAttribute("cx", p.gl[0]);
      g.gl.setAttribute("cy", p.gl[1]);
    }

    layout();
    return { layout: layout, update: update, svg: svg };
  }

  // Play/Pause, Reset and a time slider driving draw(progress in [0,1], playing).
  // A full run takes `duration` ms; label(progress) gives the time readout.
  function Player(container, duration) {
    container.classList.add("rt-player");
    container.innerHTML =
      '<button type="button" class="rt-btn rt-play"></button>' +
      '<button type="button" class="rt-btn rt-btn-quiet rt-reset">Reset</button>' +
      '<input type="range" class="rt-scrub" min="0" max="1000" step="1" value="0" aria-label="Simulation time">' +
      '<span class="rt-time"></span>';
    const btn = container.querySelector(".rt-play");
    const scrub = container.querySelector(".rt-scrub");
    const time = container.querySelector(".rt-time");
    let f = 0, playing = false, id = null, last = null, draw = null, label = null;

    function render() {
      btn.textContent = playing ? "❚❚ Pause" : f >= 1 ? "▶ Replay" : "▶ Play";
      scrub.value = Math.round(f * 1000);
      if (draw) { time.textContent = label(f); draw(f, playing); }
    }
    function frame(ts) {
      if (last !== null) f = Math.min(1, f + (ts - last) / duration);
      last = ts;
      if (f >= 1) playing = false;
      render();
      if (playing) id = requestAnimationFrame(frame);
    }
    function play() {
      if (f >= 1) f = 0;
      playing = true;
      last = null;
      id = requestAnimationFrame(frame);
      render();
    }
    function pause() {
      playing = false;
      if (id) cancelAnimationFrame(id);
      render();
    }
    function seek(g) { pause(); f = g; render(); }

    btn.addEventListener("click", function () { if (playing) pause(); else play(); });
    container.querySelector(".rt-reset").addEventListener("click", function () { seek(0); });
    scrub.addEventListener("input", function () { seek(+scrub.value / 1000); });

    return {
      // Show a new run at its start, without playing it
      load: function (drawFn, labelFn) { draw = drawFn; label = labelFn; seek(0); },
      play: play,
      seek: seek,
      redraw: render,
    };
  }

  function frameIndex(rec, f) { return Math.min(rec.t.length - 1, Math.floor(f * (rec.t.length - 1))); }
  function yearLabel(rec, f) {
    return "Year " + Math.round(rec.t[frameIndex(rec, f)]).toLocaleString("en") +
      " of " + Math.round(rec.tEnd).toLocaleString("en");
  }

  // -------------------------------------------------------------------
  // Hero: same warming, soft vs stiff mantle
  // -------------------------------------------------------------------
  function initHero(root_) {
    const T = 2.9, rate = 1.0, tEnd = 8000;
    const lanes = [
      { tau: 200, title: "Soft mantle: the bed rebounds quickly", note: "like West Antarctica" },
      { tau: 10000, title: "Stiff mantle: the bed rebounds slowly", note: "like the Recovery and Aurora basins" },
    ];
    root_.innerHTML =
      '<p class="rt-hero-forcing">Global warming of ' + T.toFixed(1) + " °C, reached at " + rate + " °C per century: " +
      "below the equilibrium tipping point of " + TC.toFixed(1) + " °C</p>" +
      '<div class="rt-hero-player"></div>';
    const player = Player(root_.querySelector(".rt-hero-player"), 9000);
    lanes.forEach(function (lane) {
      lane.rec = simulate(T, rate, lane.tau, { tEnd: tEnd, nrec: 480 });
      const box = document.createElement("div");
      box.className = "rt-lane";
      box.innerHTML = '<p class="rt-lane-title">' + lane.title + ' <span class="rt-lane-note">(' + lane.note + ")</span>" +
        '<span class="rt-tag" hidden></span></p>';
      root_.appendChild(box);
      lane.tag = box.querySelector(".rt-tag");
      const fig = document.createElement("div");
      box.appendChild(fig);
      lane.xs = CrossSection(fig, { label: lane.title });
    });
    const foot = document.createElement("p");
    foot.className = "rt-xs-foot";
    foot.innerHTML = '<span class="rt-key rt-key-bed0"></span>original bed &nbsp; <span class="rt-key rt-key-gl"></span>grounding line &nbsp; Bed uplift exaggerated ×' + XS.exag + ".";
    root_.appendChild(foot);

    function draw(f) {
      const i = frameIndex(lanes[0].rec, f);
      lanes.forEach(function (lane) {
        lane.xs.update(lane.rec.s[i], lane.rec.u[i]);
        const done = f >= 1;
        lane.tag.hidden = !done;
        if (done) {
          lane.tag.textContent = lane.rec.collapsed ? "Tipped: runaway retreat into the basin" : "Stable: held at the sill";
          lane.tag.className = "rt-tag " + (lane.rec.collapsed ? "rt-tag-tip" : "rt-tag-ok");
        }
      });
    }

    player.load(draw, function (f) { return yearLabel(lanes[0].rec, f); });
    window.addEventListener("resize", function () { lanes.forEach(function (l) { l.xs.layout(); }); player.redraw(); });

    // Play once when scrolled into view; with reduced motion, show the end state
    if (REDUCED) {
      player.seek(1);
    } else if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { io.disconnect(); player.play(); }
      }, { threshold: 0.3 });
      io.observe(root_);
    } else {
      player.play();
    }
  }

  // -------------------------------------------------------------------
  // Lab: controls, cross-section, time series
  // -------------------------------------------------------------------
  const RATE_LOG = [-3, 1];   // log10 K per century
  const TAU_LOG = [1.5, 4.5]; // log10 yr
  const T_RANGE = [2.3, 3.4];

  function initLab(labRoot) {
    const state = { T: 2.9, rate: 1.0, tau: 10000 };

    labRoot.innerHTML =
      '<div class="rt-controls">' +
      '  <label class="rt-ctl"><span class="rt-ctl-name">Global warming</span>' +
      '    <input type="range" name="T" min="' + T_RANGE[0] + '" max="' + T_RANGE[1] + '" step="0.01">' +
      '    <output name="T"></output></label>' +
      '  <label class="rt-ctl"><span class="rt-ctl-name">Rate of warming</span>' +
      '    <input type="range" name="rate" min="' + RATE_LOG[0] + '" max="' + RATE_LOG[1] + '" step="0.02">' +
      '    <output name="rate"></output></label>' +
      '  <label class="rt-ctl"><span class="rt-ctl-name">Mantle response time</span>' +
      '    <input type="range" name="tau" min="' + TAU_LOG[0] + '" max="' + TAU_LOG[1] + '" step="0.02">' +
      '    <output name="tau"></output></label>' +
      '  <div class="rt-presets">' +
      '    <button type="button" class="rt-btn rt-btn-quiet" data-tau="200">Soft mantle (West Antarctica)</button>' +
      '    <button type="button" class="rt-btn rt-btn-quiet" data-tau="10000">Stiff mantle (Recovery, Aurora)</button>' +
      '  </div>' +
      '</div>' +
      '<div class="rt-lab-fig">' +
      '  <p class="rt-outcome" aria-live="polite"></p>' +
      '  <div class="rt-lab-player"></div>' +
      '  <div class="rt-lab-xs"></div>' +
      '  <div class="rt-ts"></div>' +
      '</div>' +
      '<div class="rt-lab-map">' +
      '  <p class="rt-map-title">Outcome of every combination <span>(click a square to run it)</span></p>' +
      '  <div class="rt-map"></div>' +
      '</div>';

    const inputs = {
      T: labRoot.querySelector('input[name="T"]'),
      rate: labRoot.querySelector('input[name="rate"]'),
      tau: labRoot.querySelector('input[name="tau"]'),
    };
    const outputs = {
      T: labRoot.querySelector('output[name="T"]'),
      rate: labRoot.querySelector('output[name="rate"]'),
      tau: labRoot.querySelector('output[name="tau"]'),
    };
    const outcome = labRoot.querySelector(".rt-outcome");
    const xs = CrossSection(labRoot.querySelector(".rt-lab-xs"), { label: "Cross-section of the simulated ice sheet" });
    const ts = TimeSeries(labRoot.querySelector(".rt-ts"));
    const player = Player(labRoot.querySelector(".rt-lab-player"), 6000);
    const map = RateMap(labRoot.querySelector(".rt-map"), function (T, rate) { setState({ T: T, rate: rate }); });

    function syncInputs() {
      inputs.T.value = state.T;
      inputs.rate.value = Math.log10(state.rate);
      inputs.tau.value = Math.log10(state.tau);
      outputs.T.textContent = state.T.toFixed(2) + " °C";
      outputs.rate.textContent = fmtRate(state.rate) + " °C per century";
      outputs.tau.textContent = fmtTau(state.tau);
    }

    let debounce = null, lastTau = null;
    function run() {
      const rec = simulate(state.T, state.rate, state.tau, { tAfter: 20000, nrec: 500 });
      const below = state.T < TC;
      function draw(f, playing) {
        const i = frameIndex(rec, f);
        xs.update(rec.s[i], rec.u[i]);
        ts.draw(rec, i);
        if (f < 1) {
          outcome.className = "rt-outcome";
          outcome.textContent = playing ? "Running…" : f > 0 ? "Paused." : "Ready: press Play to run this simulation.";
        } else if (rec.collapsed) {
          outcome.className = "rt-outcome rt-outcome-tip";
          outcome.textContent = "Tipped after " + fmtTime(rec.tCollapse) + (below
            ? ", although the warming stays below the equilibrium tipping point of " + TC.toFixed(2) + " °C. This is rate-induced tipping."
            : ". The warming exceeds the equilibrium tipping point of " + TC.toFixed(2) + " °C.");
        } else {
          outcome.className = "rt-outcome rt-outcome-ok";
          outcome.textContent = "Stable: the grounding line holds at the sill" + (below ? "." : " for now, but this warming exceeds the equilibrium tipping point.");
        }
      }
      player.load(draw, function (f) { return yearLabel(rec, f); });
      map.mark(state.T, state.rate);
      if (state.tau !== lastTau) { lastTau = state.tau; map.compute(state.tau); }
    }

    function setState(patch) {
      Object.assign(state, patch);
      syncInputs();
      clearTimeout(debounce);
      debounce = setTimeout(run, 120);
    }

    inputs.T.addEventListener("input", function () { setState({ T: +inputs.T.value }); });
    inputs.rate.addEventListener("input", function () { setState({ rate: Math.pow(10, +inputs.rate.value) }); });
    inputs.tau.addEventListener("input", function () { setState({ tau: Math.pow(10, +inputs.tau.value) }); });
    labRoot.querySelectorAll("[data-tau]").forEach(function (b) {
      b.addEventListener("click", function () { setState({ tau: +b.getAttribute("data-tau") }); });
    });
    window.addEventListener("resize", function () { xs.layout(); ts.layout(); map.layout(); player.redraw(); });

    syncInputs();
    run();
  }

  // Three stacked panels sharing the time axis, with a hover crosshair
  function TimeSeries(container) {
    const svg = el("svg", { class: "rt-ts-svg", role: "img", "aria-label": "Time series of warming, grounding-line retreat and bed uplift" });
    container.appendChild(svg);
    const tip = document.createElement("div");
    tip.className = "rt-tip";
    tip.hidden = true;
    container.appendChild(tip);
    const panels = [
      { key: "T", title: "Global warming (°C)", h: 70, domain: [0, 3.6], ref: TC, refLabel: "equilibrium tipping point" },
      { key: "r", title: "Grounding-line retreat (km)", h: 100, domain: [0, 560], ref: P.s0 - P.sill, refLabel: "sill" },
      { key: "u", title: "Bed uplift (m)", h: 100, domain: [0, 180] },
    ];
    const M = { l: 44, r: 12, t: 20, gap: 30, b: 28 };
    let W = 0, H = 0, rec = null, upto = 0;

    function series(r) {
      return {
        T: r.T,
        r: r.s.map(function (s) { return P.s0 - s; }),
        u: r.u,
        ue: r.ue,
      };
    }

    function layout() {
      W = container.clientWidth;
      H = M.t + panels.reduce(function (a, p) { return a + p.h; }, 0) + M.gap * (panels.length - 1) + M.b;
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.setAttribute("width", W);
      svg.setAttribute("height", H);
      if (rec) draw(rec, upto);
    }

    function draw(r, i) {
      rec = r; upto = i;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      if (!W) return;
      const S = series(r);
      const tmax = r.tEnd;
      const X = function (t) { return M.l + t / tmax * (W - M.l - M.r); };
      let y0 = M.t;
      panels.forEach(function (p, k) {
        const Y = function (v) { return y0 + p.h - (Math.min(Math.max(v, p.domain[0]), p.domain[1]) - p.domain[0]) / (p.domain[1] - p.domain[0]) * p.h; };
        p.Y = Y; p.y0 = y0;
        el("text", { x: M.l, y: y0 - 7, class: "rt-ax-title" }, svg).textContent = p.title;
        el("line", { x1: M.l, x2: W - M.r, y1: y0 + p.h, y2: y0 + p.h, class: "rt-ax" }, svg);
        [p.domain[0], p.domain[1]].forEach(function (v) {
          el("text", { x: M.l - 6, y: Y(v) + 4, class: "rt-tick", "text-anchor": "end" }, svg).textContent = v;
          el("line", { x1: M.l, x2: W - M.r, y1: Y(v), y2: Y(v), class: "rt-grid" }, svg);
        });
        if (p.ref !== undefined) {
          el("line", { x1: M.l, x2: W - M.r, y1: Y(p.ref), y2: Y(p.ref), class: "rt-ref" }, svg);
          el("text", { x: W - M.r, y: Y(p.ref) - 4, class: "rt-ref-lbl", "text-anchor": "end" }, svg).textContent = p.refLabel;
        }
        function line(vals, cls) {
          let d = "";
          for (let j = 0; j <= i; j++) d += (j ? "L" : "M") + X(r.t[j]).toFixed(1) + "," + Y(vals[j]).toFixed(1);
          el("path", { d: d, class: cls }, svg);
        }
        if (p.key === "u") {
          line(S.ue, "rt-line rt-line-ueq");
          line(S.u, "rt-line rt-line-u");
          // Direct labels at the end of the visible lines, once the run has started
          if (i >= 0.05 * (r.t.length - 1)) {
            const xe = X(r.t[i]);
            const lblU = el("text", { x: Math.min(xe + 6, W - M.r), y: Y(S.u[i]) + 14, class: "rt-line-lbl rt-line-lbl-u" }, svg);
            lblU.textContent = "actual";
            const lblE = el("text", { x: Math.min(xe + 6, W - M.r), y: Y(S.ue[i]) - 6, class: "rt-line-lbl" }, svg);
            lblE.textContent = "with an instant mantle";
            if (xe > W * 0.6) { lblU.setAttribute("text-anchor", "end"); lblE.setAttribute("text-anchor", "end"); lblU.setAttribute("x", xe - 6); lblE.setAttribute("x", xe - 6); }
          }
        } else {
          line(S[p.key], "rt-line rt-line-" + p.key);
        }
        y0 += p.h + M.gap;
      });
      // Time axis
      const yb = y0 - M.gap;
      const ticks = niceTicks(tmax);
      ticks.forEach(function (t) {
        el("text", { x: X(t), y: yb + 18, class: "rt-tick", "text-anchor": "middle" }, svg).textContent = (t / 1000) + (t === ticks[ticks.length - 1] ? " kyr" : "");
      });
      // Crosshair
      const cross = el("line", { y1: M.t, y2: yb, class: "rt-cross", visibility: "hidden" }, svg);
      const hit = el("rect", { x: M.l, y: M.t, width: W - M.l - M.r, height: yb - M.t, fill: "transparent" }, svg);
      function move(ev) {
        const box = svg.getBoundingClientRect();
        const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - box.left;
        const t = Math.max(0, Math.min(1, (px - M.l) / (W - M.l - M.r))) * tmax;
        let j = 0;
        while (j < i && r.t[j + 1] <= t) j++;
        cross.setAttribute("x1", X(r.t[j])); cross.setAttribute("x2", X(r.t[j]));
        cross.setAttribute("visibility", "visible");
        tip.hidden = false;
        tip.innerHTML = "<b>Year " + Math.round(r.t[j]).toLocaleString("en") + "</b><br>" +
          "Warming " + S.T[j].toFixed(2) + " °C<br>Retreat " + S.r[j].toFixed(0) + " km<br>" +
          "Uplift " + S.u[j].toFixed(0) + " m (instant mantle: " + S.ue[j].toFixed(0) + " m)";
        const left = X(r.t[j]) + 12;
        tip.style.left = (left + 190 > W ? X(r.t[j]) - 200 : left) + "px";
        tip.style.top = M.t + "px";
      }
      function leave() { cross.setAttribute("visibility", "hidden"); tip.hidden = true; }
      hit.addEventListener("mousemove", move);
      hit.addEventListener("touchmove", move, { passive: true });
      hit.addEventListener("mouseleave", leave);
      hit.addEventListener("touchend", leave);
    }

    layout();
    return { draw: draw, layout: layout };
  }

  function niceTicks(tmax) {
    const steps = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
    const step = steps.find(function (s) { return tmax / s <= 6; }) || 100000;
    const out = [];
    for (let t = 0; t <= tmax + 1e-9; t += step) out.push(t);
    return out;
  }

  // -------------------------------------------------------------------
  // Rate x warming map: one simulation per square
  // -------------------------------------------------------------------
  function RateMap(container, onPick) {
    container.innerHTML =
      '<div class="rt-map-fig"></div>' +
      '<div class="rt-legend">' +
      '  <span><span class="rt-key rt-key-ok"></span>Grounding line holds</span>' +
      '  <span><span class="rt-key rt-key-tip"></span>Basin collapses</span>' +
      '  <span><span class="rt-key rt-key-dash"></span>Equilibrium tipping point</span>' +
      '  <span><span class="rt-key rt-key-dot"></span>Tipping point if the bed never rebounded</span>' +
      '  <span><span class="rt-key rt-key-vline"></span>~1 °C per century (since 1850) and ~5 °C per century (high emissions)</span>' +
      '</div>';
    const fig = container.querySelector(".rt-map-fig");
    const svg = el("svg", { class: "rt-map-svg", role: "img", "aria-label": "Outcome of simulations as a function of rate and amount of warming" });
    fig.appendChild(svg);
    const tip = document.createElement("div");
    tip.className = "rt-tip";
    tip.hidden = true;
    fig.appendChild(tip);

    const NX = 40, NY = 28;
    const rates = [], temps = [];
    for (let i = 0; i < NX; i++) rates.push(RATE_LOG[0] + (RATE_LOG[1] - RATE_LOG[0]) * (i + 0.5) / NX);
    for (let j = 0; j < NY; j++) temps.push(T_RANGE[0] + (T_RANGE[1] - T_RANGE[0]) * (j + 0.5) / NY);
    const cache = {};
    let grid = null, job = 0, W = 0, H = 0, M = { l: 52, r: 14, t: 30, b: 46 }, marker = null, cells = null, mk = null;

    const Xl = function (lr) { return M.l + (lr - RATE_LOG[0]) / (RATE_LOG[1] - RATE_LOG[0]) * (W - M.l - M.r); };
    const Yt = function (T) { return M.t + (T_RANGE[1] - T) / (T_RANGE[1] - T_RANGE[0]) * (H - M.t - M.b); };

    function layout() {
      W = fig.clientWidth;
      H = Math.round(Math.max(260, Math.min(420, W * 0.75)));
      M.l = W < 480 ? 40 : 52;
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.setAttribute("width", W);
      svg.setAttribute("height", H);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const cw = (W - M.l - M.r) / NX, ch = (H - M.t - M.b) / NY;
      cells = el("g", {}, svg);
      for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
        el("rect", {
          x: (Xl(rates[i]) - cw / 2 + 1).toFixed(1), y: (Yt(temps[j]) - ch / 2 + 1).toFixed(1),
          width: Math.max(cw - 2, 1).toFixed(1), height: Math.max(ch - 2, 1).toFixed(1), rx: 2,
          class: "rt-cell", "data-i": i, "data-j": j,
        }, cells);
      }
      // Axes
      const yb = H - M.b;
      [-3, -2, -1, 0, 1].forEach(function (lr) {
        el("text", { x: Xl(lr), y: yb + 18, class: "rt-tick", "text-anchor": "middle" }, svg).textContent = fmtRate(Math.pow(10, lr));
      });
      el("text", { x: (M.l + W - M.r) / 2, y: H - 6, class: "rt-ax-title", "text-anchor": "middle" }, svg).textContent = "Rate of warming (°C per century, log scale)";
      [2.4, 2.6, 2.8, 3.0, 3.2, 3.4].forEach(function (T) {
        el("text", { x: M.l - 6, y: Yt(T) + 4, class: "rt-tick", "text-anchor": "end" }, svg).textContent = T.toFixed(1);
      });
      el("text", { x: M.l, y: M.t - 12, class: "rt-ax-title" }, svg).textContent = "Global warming (°C)";
      // Reference lines
      el("line", { x1: M.l, x2: W - M.r, y1: Yt(TC), y2: Yt(TC), class: "rt-map-ref" }, svg);
      el("line", { x1: M.l, x2: W - M.r, y1: Yt(TC_RIGID), y2: Yt(TC_RIGID), class: "rt-map-ref rt-map-ref-dot" }, svg);
      [1, 5].forEach(function (r) {
        const x = Xl(Math.log10(r));
        el("line", { x1: x, x2: x, y1: M.t, y2: yb, class: "rt-map-vline" }, svg);
      });
      mk = el("g", { class: "rt-map-marker", visibility: "hidden" }, svg);
      el("circle", { r: 8.5, class: "rt-map-marker-ring" }, mk);
      el("circle", { r: 2.5, class: "rt-map-marker-dot" }, mk);
      if (marker) mark(marker[0], marker[1]);
      paint();
      cells.addEventListener("mousemove", hover);
      cells.addEventListener("mouseleave", function () { tip.hidden = true; });
      cells.addEventListener("click", function (ev) {
        const c = ev.target.closest(".rt-cell");
        if (c) onPick(+temps[+c.getAttribute("data-j")].toFixed(2), Math.pow(10, rates[+c.getAttribute("data-i")]));
      });
    }

    function hover(ev) {
      const c = ev.target.closest(".rt-cell");
      if (!c || !grid) { tip.hidden = true; return; }
      const i = +c.getAttribute("data-i"), j = +c.getAttribute("data-j");
      const v = grid[i * NY + j];
      if (v === undefined) { tip.hidden = true; return; }
      tip.hidden = false;
      tip.innerHTML = "<b>" + (v ? "Collapses" : "Holds") + "</b><br>" + temps[j].toFixed(2) + " °C at " +
        fmtRate(Math.pow(10, rates[i])) + " °C per century<br><i>Click to run it</i>";
      const x = Xl(rates[i]);
      tip.style.left = (x + 200 > W ? x - 210 : x + 12) + "px";
      tip.style.top = Math.max(0, Yt(temps[j]) - 30) + "px";
    }

    function paint() {
      if (!cells) return;
      const rects = cells.childNodes;
      for (let k = 0; k < rects.length; k++) {
        const i = +rects[k].getAttribute("data-i"), j = +rects[k].getAttribute("data-j");
        const v = grid ? grid[i * NY + j] : undefined;
        rects[k].setAttribute("class", "rt-cell" + (v === undefined ? "" : v ? " rt-cell-tip" : " rt-cell-ok"));
      }
    }

    function compute(tau) {
      const key = tau.toFixed(0);
      const my = ++job;
      if (cache[key]) { grid = cache[key]; paint(); return; }
      grid = new Array(NX * NY);
      paint();
      let i = 0;
      function column() {
        if (my !== job) return;
        for (let j = 0; j < NY; j++) grid[i * NY + j] = collapses(temps[j], Math.pow(10, rates[i]), tau);
        i++;
        paint();
        if (i < NX) setTimeout(column, 0);
        else cache[key] = grid;
      }
      setTimeout(column, 0);
    }

    function mark(T, rate) {
      marker = [T, rate];
      if (!mk) return;
      mk.setAttribute("transform", "translate(" + Xl(Math.log10(rate)).toFixed(1) + "," + Yt(T).toFixed(1) + ")");
      mk.setAttribute("visibility", T >= T_RANGE[0] && T <= T_RANGE[1] ? "visible" : "hidden");
    }

    layout();
    return { compute: compute, mark: mark, layout: layout };
  }

  function init() {
    const hero = document.getElementById("rt-hero");
    if (hero) initHero(hero);
    const lab = document.getElementById("rt-lab");
    if (lab) initLab(lab);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : this);
