/* Weighted ensembles: interactive figures for the highlight on
   Grusdt, Perrette and Robinson (2026, Earth Syst. Dynam.).
   Both figures use synthetic data. They reproduce the behavior of the
   weighting methods in the paper, not its numbers. */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------------
  // Random numbers (seeded, so that every visitor sees the same toy data)
  // ---------------------------------------------------------------------
  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normal(rand) { // Box–Muller
    let u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  }

  // Logarithm of a Gamma(a, 1) variate (Marsaglia and Tsang, 2000). For a < 1
  // the boost Gamma(a) = Gamma(a + 1) U^(1/a) is applied in log space, since
  // U^(1/a) underflows for the small concentration parameters used here.
  function logGamma(a, rand) {
    if (a < 1) {
      let u = 0;
      while (u === 0) u = rand();
      return logGamma(a + 1, rand) + Math.log(u) / a;
    }
    const d = a - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do { x = normal(rand); v = 1 + c * x; } while (v <= 0);
      v = v * v * v;
      const u = rand();
      if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return Math.log(d * v);
    }
  }

  // One weight vector from a symmetric Dirichlet(alpha) prior over n models
  function dirichlet(n, alpha, rand) {
    const lg = new Array(n);
    let mx = -Infinity;
    for (let i = 0; i < n; i++) { lg[i] = logGamma(alpha, rand); mx = Math.max(mx, lg[i]); }
    let sum = 0;
    for (let i = 0; i < n; i++) { lg[i] = Math.exp(lg[i] - mx); sum += lg[i]; }
    for (let i = 0; i < n; i++) lg[i] /= sum;
    return lg;
  }

  // ---------------------------------------------------------------------
  // Toy ensemble of Sect. 5 of the paper
  //
  // A 1D field along longitude (V points) is observed. Model 1 and model 2
  // are the observations plus errors, as in the toy examples of the paper.
  // The ensemble consists of model 1 and n2 identical copies of model 2.
  // ---------------------------------------------------------------------
  const V = 180;
  const LON = Array.from({ length: V }, function (_, k) { return (k + 0.5) * 360 / V; });
  const OBS = LON.map(function (x) {
    const r = x * Math.PI / 180;
    return 12 * Math.cos(r) + 6 * Math.sin(2 * r + 0.7) + 3 * Math.cos(5 * r + 1.3);
  });

  function makeScenario(kind) {
    const rand = rng(1712);
    const m1 = new Array(V), m2 = new Array(V);
    const eps = Array.from({ length: V / 2 }, function () { return 2 * normal(rand); });
    for (let k = 0; k < V; k++) {
      const e1 = 2 * normal(rand), e2 = normal(rand);
      if (kind === "pattern") { // each model is exact in one hemisphere, with the same error in the other
        const west = LON[k] >= 180;
        m1[k] = OBS[k] + (west ? eps[k % (V / 2)] : 0);
        m2[k] = OBS[k] + (west ? 0 : eps[k % (V / 2)]);
      } else if (kind === "random") { // independent errors of the same size
        m1[k] = OBS[k] + e1;
        m2[k] = OBS[k] + 2 * e2;
      } else { // model 2 has larger errors than model 1
        m1[k] = OBS[k] + e1;
        m2[k] = OBS[k] + 3 * e2;
      }
    }
    return { m1: m1, m2: m2 };
  }

  function mse(m) {
    let s = 0;
    for (let k = 0; k < V; k++) s += (m[k] - OBS[k]) ** 2;
    return s / V;
  }

  // Individual performance weighting: weights proportional to the inverse
  // mean squared error of each model, as in Sect. 5 of the paper
  function ipw(sc, n2) {
    const p1 = 1 / mse(sc.m1), p2 = 1 / mse(sc.m2);
    const z = p1 + n2 * p2;
    return { w1: p1 / z, copy: p2 / z, w2: n2 * p2 / z };
  }

  // Ensemble performance weighting with a Dirichlet(1/N) prior, a Gaussian
  // likelihood of the weighted mean and an inverse-gamma(2, 3) prior on the
  // error variance. The weighted mean depends only on w1 and on the summed
  // weight of the copies, w2 = 1 - w1, so the posterior reduces to one
  // dimension. Its prior is Beta(1/N, n2/N) by the aggregation property of
  // the Dirichlet distribution, and the variance is integrated out
  // analytically. The paper samples the full posterior with MCMC instead.
  function epw(sc, n2) {
    const N = n2 + 1, a = 2, b = 3, K = 4000;
    let A = 0, B = 0, C = 0;
    for (let k = 0; k < V; k++) {
      const r = OBS[k] - sc.m2[k], d = sc.m1[k] - sc.m2[k];
      A += d * d; B += r * d; C += r * r;
    }
    const lp = new Array(K);
    let mx = -Infinity;
    for (let i = 0; i < K; i++) {
      const w = (i + 0.5) / K;
      const sse = C - 2 * w * B + w * w * A;
      lp[i] = (1 / N - 1) * Math.log(w) + (n2 / N - 1) * Math.log(1 - w) - (a + V / 2) * Math.log(b + sse / 2);
      mx = Math.max(mx, lp[i]);
    }
    let z = 0, m = 0;
    for (let i = 0; i < K; i++) { const p = Math.exp(lp[i] - mx); z += p; m += p * (i + 0.5) / K; }
    const w1 = m / z;
    return { w1: w1, copy: (1 - w1) / n2, w2: 1 - w1 };
  }

  // ---------------------------------------------------------------------
  // Prior explorer of Sect. 3: 38 synthetic models drawn from N(3, 1)
  // ---------------------------------------------------------------------
  const NM = 38;
  const MODELS = (function () {
    const rand = rng(38);
    return Array.from({ length: NM }, function () { return 3 + normal(rand); });
  })();
  const MMM = MODELS.reduce(function (s, v) { return s + v; }, 0) / NM;

  function weightedMean(w) {
    let s = 0;
    for (let i = 0; i < NM; i++) s += w[i] * MODELS[i];
    return s;
  }

  function quantile(sorted, q) {
    const i = q * (sorted.length - 1), lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }

  root.WE = { ipw: ipw, epw: epw, makeScenario: makeScenario, dirichlet: dirichlet, MODELS: MODELS };

  // ---------------------------------------------------------------------
  // Page
  // ---------------------------------------------------------------------
  const SVGNS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function pct(w) { return Math.round(100 * w) + "%"; }

  function onResize(fn) {
    let id = null, lastW = root.innerWidth;
    root.addEventListener("resize", function () {
      if (root.innerWidth === lastW) return;
      lastW = root.innerWidth;
      clearTimeout(id);
      id = setTimeout(fn, 100);
    });
  }

  // -------------------------------------------------------------------
  // Hero: adding copies of model 2
  // -------------------------------------------------------------------
  const SCENARIOS = [
    { key: "pattern", name: "Complementary errors", note: "Each model is exact in one hemisphere and has the same error in the other." },
    { key: "random", name: "Independent errors", note: "Both models have random errors of the same size." },
    { key: "worse", name: "Model 2 is worse", note: "Model 2 has random errors about 1.5 times larger than model 1." },
  ];

  function initHero(container) {
    container.innerHTML =
      '<div class="we-hero-top">' +
        '<div class="we-controls">' +
          '<div class="we-ctl"><span class="we-ctl-name">Toy ensemble</span>' +
            '<div class="we-seg" role="group" aria-label="Toy ensemble"></div>' +
            '<p class="we-note"></p></div>' +
          '<label class="we-ctl"><span class="we-ctl-name">Copies of model 2</span>' +
            '<input type="range" class="we-n2" min="1" max="10" step="1" value="1">' +
            '<output class="we-n2-out"></output></label>' +
        '</div>' +
        '<div class="we-data">' +
          '<p class="we-fig-title">Observations and the two models</p>' +
          '<div class="we-data-fig"></div>' +
          '<div class="we-legend">' +
            '<span><i class="we-key we-key-obs"></i>Observations</span>' +
            '<span><i class="we-key we-key-m1"></i>Model 1</span>' +
            '<span><i class="we-key we-key-m2"></i>Model 2</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="we-bars"></div>' +
      '<p class="we-outcome" aria-live="polite"></p>';

    const seg = container.querySelector(".we-seg");
    const note = container.querySelector(".we-note");
    const slider = container.querySelector(".we-n2");
    const n2out = container.querySelector(".we-n2-out");
    const dataFig = container.querySelector(".we-data-fig");
    const bars = container.querySelector(".we-bars");
    const outcome = container.querySelector(".we-outcome");
    const cache = {};
    let kind = "pattern";

    SCENARIOS.forEach(function (s) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "we-btn we-btn-quiet";
      b.textContent = s.name;
      b.dataset.key = s.key;
      b.addEventListener("click", function () { kind = s.key; update(); });
      seg.appendChild(b);
    });

    function scenario() {
      if (!cache[kind]) cache[kind] = makeScenario(kind);
      return cache[kind];
    }

    function drawData() {
      const sc = scenario();
      clear(dataFig);
      const W = dataFig.clientWidth, H = Math.round(Math.max(150, Math.min(210, W * 0.42)));
      const svg = el("svg", { class: "we-svg", width: W, height: H, viewBox: "0 0 " + W + " " + H,
        role: "img", "aria-label": "Observed field and the two toy models along longitude" }, dataFig);
      const m = { l: 34, r: 16, t: 8, b: 26 };
      const X = function (x) { return m.l + x / 360 * (W - m.l - m.r); };
      const Y = function (y) { return m.t + (25 - y) / 50 * (H - m.t - m.b); };
      [-20, 0, 20].forEach(function (v) {
        el("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: "we-grid" }, svg);
        el("text", { x: m.l - 6, y: Y(v) + 4, class: "we-tick", "text-anchor": "end" }, svg).textContent = v;
      });
      [0, 90, 180, 270, 360].forEach(function (v) {
        el("text", { x: X(v), y: H - 8, class: "we-tick", "text-anchor": "middle" }, svg).textContent = v + "°";
      });
      if (kind === "pattern") {
        el("line", { x1: X(180), x2: X(180), y1: m.t, y2: H - m.b, class: "we-divide" }, svg);
        el("text", { x: X(90), y: m.t + 12, class: "we-tick", "text-anchor": "middle" }, svg).textContent = "Model 1 exact";
        el("text", { x: X(270), y: m.t + 12, class: "we-tick", "text-anchor": "middle" }, svg).textContent = "Model 2 exact";
      }
      function line(vals, cls) {
        let d = "";
        for (let k = 0; k < V; k++) d += (k ? "L" : "M") + X(LON[k]).toFixed(1) + "," + Y(vals[k]).toFixed(1);
        el("path", { d: d, class: "we-line " + cls }, svg);
      }
      line(sc.m2, "we-line-m2");
      line(sc.m1, "we-line-m1");
      line(OBS, "we-line-obs");
    }

    function drawBars(n2) {
      const sc = scenario();
      const rows = [
        { title: "Weighting each model individually", tag: "IPW", w: ipw(sc, n2) },
        { title: "Weighting the ensemble as a whole", tag: "EPW", w: epw(sc, n2) },
      ];
      clear(bars);
      const W = bars.clientWidth, BH = 30;
      rows.forEach(function (row) {
        const div = document.createElement("div");
        div.className = "we-bar";
        const m2 = n2 === 1 ? "model 2 " + pct(row.w.w2)
          : n2 + " copies of model 2 " + pct(row.w.w2) + " (" + pct(row.w.copy) + " each)";
        div.innerHTML = '<p class="we-bar-title"><span>' + row.title + ' <span class="we-light">(' + row.tag + ')</span></span>' +
          '<span class="we-bar-sum"><b class="we-txt-m1">Model 1 ' + pct(row.w.w1) + '</b> · <b class="we-txt-m2">' + m2 + '</b></span></p>';
        bars.appendChild(div);
        const svg = el("svg", { class: "we-svg", width: W, height: BH, viewBox: "0 0 " + W + " " + BH, role: "img",
          "aria-label": row.tag + ": model 1 " + pct(row.w.w1) + ", all copies of model 2 " + pct(row.w.w2) }, div);
        const x1 = row.w.w1 * W;
        el("rect", { x: 0, y: 0, width: x1, height: BH, class: "we-seg-m1" }, svg);
        for (let i = 0; i < n2; i++) {
          el("rect", { x: x1 + i * row.w.copy * W, y: 0, width: row.w.copy * W, height: BH, class: "we-seg-m2" }, svg);
        }
      });
      return rows;
    }

    function update() {
      const n2 = +slider.value;
      const s = SCENARIOS.find(function (s) { return s.key === kind; });
      seg.querySelectorAll("button").forEach(function (b) {
        const on = b.dataset.key === kind;
        b.classList.toggle("we-btn-quiet", !on);
        b.setAttribute("aria-pressed", on);
      });
      note.textContent = s.note;
      n2out.textContent = n2 === 1 ? "1 copy (2 models in total)" : n2 + " identical copies (" + (n2 + 1) + " models in total)";
      drawData();
      const rows = drawBars(n2);
      outcome.innerHTML = n2 === 1
        ? "With two distinct models, both approaches give model 1 a similar weight (" + pct(rows[0].w.w1) + " and " + pct(rows[1].w.w1) + "). Add copies of model 2 to see the difference."
        : "Individual weighting gives model 1 only <b>" + pct(rows[0].w.w1) + "</b>, since every copy counts as a new model. " +
          "Ensemble weighting keeps model 1 at <b>" + pct(rows[1].w.w1) + "</b> and splits the weight of model 2 among its copies.";
    }

    slider.addEventListener("input", update);
    onResize(update);
    update();
  }

  // -------------------------------------------------------------------
  // Prior explorer: Dirichlet concentration parameter
  // -------------------------------------------------------------------
  const NSAMP = 5000, NSHOW = 4;
  const PRESETS = [
    { name: "α = 1/N (recommended)", alpha: 1 / NM },
    { name: "α = 1", alpha: 1 },
    { name: "α = 1/500", alpha: 1 / 500 },
  ];

  function fmtAlpha(a) {
    if (Math.abs(a - 1 / NM) < 1e-4) return "1/N ≈ " + a.toFixed(3);
    if (a >= 1) return a.toFixed(a >= 10 ? 0 : 1);
    if (a >= 0.1) return a.toFixed(2);
    return a.toFixed(a >= 0.01 ? 3 : 4);
  }

  // Color of a model by its value (low = blue, high = orange)
  function valueColor(v) {
    const t = Math.min(1, Math.max(0, (v - 1) / 4));
    const lo = [58, 120, 181], mid = [214, 220, 224], hi = [212, 104, 61];
    const c = t < 0.5
      ? lo.map(function (x, i) { return Math.round(x + (mid[i] - x) * t * 2); })
      : mid.map(function (x, i) { return Math.round(x + (hi[i] - x) * (t - 0.5) * 2); });
    return "rgb(" + c.join(",") + ")";
  }

  function initPrior(container) {
    container.innerHTML =
      '<div class="we-prior-top">' +
        '<div class="we-controls">' +
          '<label class="we-ctl"><span class="we-ctl-name">Concentration parameter α</span>' +
            '<input type="range" class="we-alpha" min="-3" max="1" step="0.01" value="0">' +
            '<output class="we-alpha-out"></output></label>' +
          '<div class="we-presets"></div>' +
          '<button type="button" class="we-btn we-btn-quiet we-resample">Draw new samples</button>' +
        '</div>' +
        '<div class="we-samples">' +
          '<p class="we-fig-title">Four weight vectors drawn from the prior <span>(one slice per model)</span></p>' +
          '<div class="we-samples-fig"></div>' +
        '</div>' +
      '</div>' +
      '<div class="we-hist">' +
        '<p class="we-fig-title">Weighted mean of the ensemble <span>(' + NSAMP.toLocaleString("en") + ' prior samples)</span></p>' +
        '<div class="we-hist-fig"></div>' +
        '<div class="we-legend">' +
          '<span><i class="we-key we-key-hist"></i>Prior-weighted mean</span>' +
          '<span><i class="we-key we-key-src"></i>Distribution the models are drawn from</span>' +
          '<span><i class="we-key we-key-rug"></i>Individual models</span>' +
          '<span><i class="we-key we-key-mmm"></i>Multi-model mean</span>' +
        '</div>' +
      '</div>' +
      '<p class="we-outcome" aria-live="polite"></p>';

    const slider = container.querySelector(".we-alpha");
    const aout = container.querySelector(".we-alpha-out");
    const presets = container.querySelector(".we-presets");
    const sampFig = container.querySelector(".we-samples-fig");
    const histFig = container.querySelector(".we-hist-fig");
    const outcome = container.querySelector(".we-outcome");
    const sortedModels = MODELS.slice().sort(function (a, b) { return a - b; });
    let alpha = 1 / NM, seed = 1, samples = null, means = null;

    PRESETS.forEach(function (p) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "we-btn we-btn-quiet";
      b.textContent = p.name;
      b.addEventListener("click", function () { setAlpha(p.alpha); });
      presets.appendChild(b);
    });

    function sample() {
      const rand = rng(seed * 7919 + Math.round(Math.log10(alpha) * 1000));
      samples = [];
      means = new Float64Array(NSAMP);
      for (let s = 0; s < NSAMP; s++) {
        const w = dirichlet(NM, alpha, rand);
        if (s < NSHOW) samples.push(w);
        means[s] = weightedMean(w);
      }
      means.sort();
    }

    function drawSamples() {
      clear(sampFig);
      const W = sampFig.clientWidth - 20, RH = 22, GAP = 9, LW = 64;
      const H = NSHOW * (RH + GAP) - GAP;
      const svg = el("svg", { class: "we-svg", width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img",
        "aria-label": "Four sampled weight vectors, each shown as a bar divided among the 38 models" }, sampFig);
      const BW = W - LW;
      samples.forEach(function (w, r) {
        const y = r * (RH + GAP);
        let x = 0;
        // Order the slices by model value so the colors read from blue to orange
        const order = MODELS.map(function (_, i) { return i; }).sort(function (a, b) { return MODELS[a] - MODELS[b]; });
        order.forEach(function (i) {
          const wd = w[i] * BW;
          if (wd > 0.05) el("rect", { x: x, y: y, width: wd, height: RH, fill: valueColor(MODELS[i]), class: "we-slice" }, svg);
          x += wd;
        });
        el("text", { x: W, y: y + RH / 2 + 4, class: "we-tick", "text-anchor": "end" }, svg).textContent =
          "mean " + weightedMean(w).toFixed(2);
      });
    }

    function drawHist() {
      clear(histFig);
      const W = histFig.clientWidth, H = Math.round(Math.max(170, Math.min(230, W * 0.3)));
      const m = { l: 36, r: 10, t: 10, b: 36 };
      const X0 = -1, X1 = 7, NB = 160, bw = (X1 - X0) / NB;
      const counts = new Array(NB).fill(0);
      for (let s = 0; s < NSAMP; s++) {
        const b = Math.floor((means[s] - X0) / bw);
        if (b >= 0 && b < NB) counts[b]++;
      }
      const dens = counts.map(function (c) { return c / (NSAMP * bw); });
      const ymax = Math.max(0.5, Math.max.apply(null, dens)) * 1.08;
      const X = function (x) { return m.l + (x - X0) / (X1 - X0) * (W - m.l - m.r); };
      const Y = function (y) { return m.t + (1 - y / ymax) * (H - m.t - m.b); };
      const svg = el("svg", { class: "we-svg", width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img",
        "aria-label": "Histogram of the prior-weighted ensemble mean with the individual model values" }, histFig);

      // 5–95% range of the prior-weighted mean
      const q05 = quantile(means, 0.05), q95 = quantile(means, 0.95);
      el("rect", { x: X(q05), y: m.t, width: Math.max(1, X(q95) - X(q05)), height: H - m.t - m.b, class: "we-range" }, svg);

      const step = ymax > 4 ? 2 : ymax > 2 ? 1 : 0.5;
      for (let v = 0; v <= ymax; v += step) {
        el("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: "we-grid" }, svg);
        el("text", { x: m.l - 6, y: Y(v) + 4, class: "we-tick", "text-anchor": "end" }, svg).textContent = +v.toFixed(1);
      }
      for (let v = X0; v <= X1; v++) {
        el("text", { x: X(v), y: H - m.b + 16, class: "we-tick", "text-anchor": "middle" }, svg).textContent = v;
      }
      el("text", { x: (m.l + W - m.r) / 2, y: H - 4, class: "we-ax-title", "text-anchor": "middle" }, svg).textContent = "Value";
      el("text", { x: 0, y: 0, class: "we-ax-title", "text-anchor": "middle",
        transform: "translate(11," + ((m.t + H - m.b) / 2) + ") rotate(-90)" }, svg).textContent = "Density";

      let d = "M" + X(X0) + "," + Y(0);
      dens.forEach(function (v, b) { d += "L" + X(X0 + b * bw).toFixed(1) + "," + Y(v).toFixed(1) + "L" + X(X0 + (b + 1) * bw).toFixed(1) + "," + Y(v).toFixed(1); });
      d += "L" + X(X1) + "," + Y(0) + "Z";
      el("path", { d: d, class: "we-hist-area" }, svg);

      let ds = "";
      for (let k = 0; k <= 120; k++) {
        const x = X0 + k * (X1 - X0) / 120;
        ds += (k ? "L" : "M") + X(x).toFixed(1) + "," + Y(Math.exp(-0.5 * (x - 3) ** 2) / Math.sqrt(2 * Math.PI)).toFixed(1);
      }
      el("path", { d: ds, class: "we-src" }, svg);

      MODELS.forEach(function (v) {
        el("line", { x1: X(v), x2: X(v), y1: Y(0) - 9, y2: Y(0), class: "we-rug" }, svg);
      });
      el("line", { x1: X(MMM), x2: X(MMM), y1: Y(0) - 14, y2: Y(0) + 4, class: "we-mmm" }, svg);
      el("line", { x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0), class: "we-ax" }, svg);

      const r5 = quantile(sortedModels, 0.05), r95 = quantile(sortedModels, 0.95);
      const ratio = (q95 - q05) / (r95 - r5);
      outcome.innerHTML = "90% of the prior-weighted means lie between <b>" + q05.toFixed(2) + "</b> and <b>" + q95.toFixed(2) +
        "</b> (shaded), which covers <b>" + Math.round(100 * ratio) + "%</b> of the 5–95% range of the models themselves (" +
        r5.toFixed(2) + "–" + r95.toFixed(2) + ")." +
        (ratio < 0.4 ? " The prior alone has already narrowed the ensemble, before any observations are used." : "");
    }

    function draw() {
      aout.textContent = "α = " + fmtAlpha(alpha);
      drawSamples();
      drawHist();
    }

    function setAlpha(a) {
      alpha = a;
      slider.value = Math.log10(a);
      sample();
      draw();
    }

    slider.addEventListener("input", function () { alpha = Math.pow(10, +slider.value); sample(); draw(); });
    container.querySelector(".we-resample").addEventListener("click", function () { seed++; sample(); draw(); });
    onResize(draw);
    setAlpha(1 / NM);
  }

  function init() {
    const hero = document.getElementById("we-hero");
    if (hero) initHero(hero);
    const prior = document.getElementById("we-prior");
    if (prior) initPrior(prior);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : this);
