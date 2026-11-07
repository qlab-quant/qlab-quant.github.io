// 첫 화면 애니메이션 (홈 전용)
// 금융공학 수식과 코드 조각들이 흩어져 있다가 지구본으로 모여 돌고 좌우로 흔들린다.
// 스크롤을 내리면 조각들이 왼쪽부터 차례로 날아가 수익률 그래프를 그린다.
// '동작 줄이기' 설정이면 완성된 그래프를 멈춘 채로 보여 준다.
(function () {
  const stage = document.getElementById("hero-stage");
  const canvas = document.getElementById("hero-canvas");
  if (!stage || !canvas) return;
  const hero = stage.parentElement;
  const ctx = canvas.getContext("2d");
  const label = document.getElementById("hero-chart-label");
  const hint = document.getElementById("hero-hint");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 지구본을 이루는 조각: 짧은 기호가 대부분이고, 긴 수식 · 코드가 가끔 섞인다
  const GLYPHS = [
    "σ", "μ", "β", "α", "Σ", "∫", "∂", "Δ", "Γ", "ρ", "λ", "θ", "π", "√", "∞", "%", "+", "−", "≈", "≥",
    "E[R]", "σ²", "dW", "dt", "ln", "Var", "0.25", "1.00", "−0.03", "+2.4%", "0", "1", "β=0.8", "{ }", "[ ]", "→",
  ];
  const PHRASES = [
    "dS = μS dt + σS dW", "E[Rp] − rf", "∂V/∂t", "N(d₁)", "ln(S/K)", "w′Σw", "Cov(X, Y)", "max DD",
    "Sharpe = μ/σ", "VaR₉₅", "GARCH(1,1)", "Kelly f*", "np.log(p)", "pct_change()", "df.rolling(20)",
    "def backtest():", "cov = X.T @ X", "returns.std()", "if signal > 0:", "for t in range(T):", "e^(−rT)",
    "√252", "P(X > x)", "λ = 0.94",
  ];
  // 흰색이 바탕이고 보라 · 호박색 · 청록 · 분홍이 반짝인다
  const PALETTE = ["#ffffff", "#ffffff", "#e9e4ff", "#a58fff", "#8052ff", "#ffb829", "#ffd27a", "#2fd6b5", "#fde9ff", "#ff9ad5"];
  const CURVE_POINTS = 180;

  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  let W = 0, H = 0, dpr = 1;
  let particles = [];
  let curve = []; // 0~1로 맞춘 수익률 곡선
  let curvePts = []; // 화면 위 곡선 좌표
  let globe = { x: 0, y: 0, r: 0 };
  let region = { x0: 0, x1: 0, y0: 0, y1: 0 };
  const sprites = new Map();

  // 글자를 미리 작은 그림으로 만들어 두고 매 프레임 붙이기만 한다 (빠르다)
  function sprite(text, color, size) {
    const key = `${text}|${color}|${size}|${dpr}`;
    let img = sprites.get(key);
    if (img) return img;
    img = document.createElement("canvas");
    const g = img.getContext("2d");
    const font = `500 ${size * dpr}px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
    g.font = font;
    img.width = Math.ceil(g.measureText(text).width + 4 * dpr);
    img.height = Math.ceil(size * dpr * 1.35);
    g.font = font;
    g.fillStyle = color;
    g.textBaseline = "middle";
    g.fillText(text, 2 * dpr, img.height / 2);
    sprites.set(key, img);
    return img;
  }

  function build() {
    const count = innerWidth < 720 ? 380 : 900;
    const golden = Math.PI * (3 - Math.sqrt(5));
    seed = 7;
    // 구 위 자리는 피보나치 나선으로 고르게, 순서는 섞어서 그래프 순서와 상관없게 한다
    const order = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let onCurve = 0;
    particles = order.map((k) => {
      const long = rand() < 0.1;
      const y = 1 - (k / (count - 1)) * 2;
      const ring = Math.sqrt(1 - y * y);
      const p = {
        text: long ? pick(PHRASES) : pick(GLYPHS),
        color: pick(PALETTE),
        long,
        ux: Math.cos(k * golden) * ring,
        uy: y,
        uz: Math.sin(k * golden) * ring,
        lx: rand(),
        ly: rand(),
        drift: 0.4 + rand() * 0.8,
        phase: rand() * Math.PI * 2,
        delay: rand() * 0.6,
        // 짧은 기호 절반은 곡선 위에, 나머지는 곡선 아래를 채운다
        onCurve: !long && onCurve < count * 0.48,
      };
      if (p.onCurve) onCurve++;
      return p;
    });

    // 수익률 곡선: 꾸준히 오르다가 한 번 작게 흔들리고(지켜 낸 낙폭) 새 고점으로 올라선다
    seed = 11;
    let v = 0;
    curve = [];
    for (let i = 0; i < CURVE_POINTS; i++) {
      const t = i / (CURVE_POINTS - 1);
      let step = 0.12 + (rand() - 0.5) * 0.55;
      if (t > 0.55 && t < 0.62) step -= 0.32;
      curve.push((v += step));
    }
    const lo = Math.min(...curve);
    const hi = Math.max(...curve);
    curve = curve.map((c) => (c - lo) / (hi - lo));
  }

  const curveY = (xn) => {
    const f = xn * (CURVE_POINTS - 1);
    const i = Math.min(CURVE_POINTS - 2, Math.floor(f));
    const v = lerp(curve[i], curve[i + 1], f - i);
    return region.y1 - v * (region.y1 - region.y0);
  };

  function layout() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const mobile = W < 720;
    globe = mobile
      ? { x: W * 0.5, y: H * 0.72, r: Math.min(W * 0.36, H * 0.19) }
      : { x: W * 0.7, y: H * 0.52, r: Math.min(W * 0.23, H * 0.34) };
    region = mobile
      ? { x0: W * 0.06, x1: W * 0.94, y0: H * 0.68, y1: H * 0.92 }
      : { x0: W * 0.46, x1: W * 0.95, y0: H * 0.24, y1: H * 0.8 };

    seed = 23;
    const curveCount = particles.filter((p) => p.onCurve).length;
    let ci = 0;
    particles.forEach((p) => {
      if (p.onCurve) {
        p.xn = ci++ / Math.max(1, curveCount - 1);
        p.cx = lerp(region.x0, region.x1, p.xn);
        p.cy = curveY(p.xn) + (rand() - 0.5) * 3;
        p.ca = 1;
        p.cs = 0.82;
      } else {
        p.xn = rand();
        p.cx = lerp(region.x0, region.x1, p.xn);
        const crest = curveY(p.xn);
        p.cy = crest + (region.y1 + 8 - crest) * Math.pow(rand(), 1.7);
        p.ca = 0.08 + 0.3 * (1 - (p.cy - crest) / (region.y1 + 8 - crest));
        p.cs = p.long ? 0.5 : 0.62;
      }
    });
    curvePts = curve.map((_, i) => [lerp(region.x0, region.x1, i / (CURVE_POINTS - 1)), curveY(i / (CURVE_POINTS - 1))]);
    label.style.transform = `translate(${region.x0}px, ${region.y0 - (mobile ? 36 : 48)}px)`;
  }

  // 스크롤이 히어로 구간에서 어디까지 왔는지 (0 = 맨 위, 1 = 끝)
  function scrollProgress() {
    const r = hero.getBoundingClientRect();
    const total = r.height - H;
    return total > 0 ? clamp01(-r.top / total) : 1;
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  stage.addEventListener("pointermove", (e) => {
    pointer.tx = e.clientX / W - 0.5;
    pointer.ty = e.clientY / H - 0.5;
  });
  stage.addEventListener("pointerleave", () => {
    pointer.tx = 0;
    pointer.ty = 0;
  });

  function drawGlow(x, y, r, alpha) {
    if (alpha <= 0) return;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 1.7);
    glow.addColorStop(0, "rgba(128, 82, 255, 0.24)");
    glow.addColorStop(0.45, "rgba(47, 214, 181, 0.07)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 1.7, y - r * 1.7, r * 3.4, r * 3.4);
  }

  // 그래프가 거의 다 모이면 곡선을 따라 빛나는 선을 이어 준다
  function drawLine(amount) {
    const n = Math.max(2, Math.floor(amount * curvePts.length));
    const line = ctx.createLinearGradient(region.x0, 0, region.x1, 0);
    line.addColorStop(0, "#8052ff");
    line.addColorStop(0.6, "#ff9ad5");
    line.addColorStop(1, "#ffb829");
    ctx.globalAlpha = 0.9 * amount;
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    curvePts.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    const [ex, ey] = curvePts[n - 1];
    const dot = ctx.createRadialGradient(ex, ey, 0, ex, ey, 18);
    dot.addColorStop(0, "rgba(255, 184, 41, 0.9)");
    dot.addColorStop(1, "rgba(255, 184, 41, 0)");
    ctx.fillStyle = dot;
    ctx.fillRect(ex - 18, ey - 18, 36, 36);
  }

  let start = 0;
  let frameId = 0;
  let running = false;

  function frame(now) {
    frameId = 0;
    if (!start) start = now;
    const t = reduce ? 30 : (now - start) / 1000;
    const m = reduce ? 1 : clamp01((scrollProgress() - 0.08) / 0.72); // 지구본 → 그래프

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    const yaw = t * 0.32 + Math.sin(t * 0.55) * 0.45 + pointer.x * 0.7;
    const pitch = 0.32 + pointer.y * 0.4;
    const sway = Math.sin(t * 0.55) * globe.r * 0.16; // 좌우로 왔다갔다
    const gx0 = globe.x + sway;
    const gy0 = globe.y + Math.sin(t * 0.9) * 4;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw), cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    const focal = globe.r * 2.8;

    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    drawGlow(gx0, gy0, globe.r, 1 - m);
    ctx.globalCompositeOperation = "lighter";

    for (const p of particles) {
      // 1) 흩어진 자리 (천천히 떠다닌다)
      const lx = p.lx * W + Math.sin(t * p.drift + p.phase) * 10;
      const ly = p.ly * H + Math.cos(t * p.drift * 0.8 + p.phase) * 10;
      // 2) 지구본 위 자리 (y축으로 돌고 x축으로 기울인 뒤 원근을 준다)
      const x1 = p.ux * cosY + p.uz * sinY;
      const z1 = -p.ux * sinY + p.uz * cosY;
      const y2 = p.uy * cosP - z1 * sinP;
      const z2 = p.uy * sinP + z1 * cosP;
      const persp = focal / (focal + z2 * globe.r);
      const front = (1 - z2) / 2; // 1이면 바로 앞
      const gx = gx0 + x1 * globe.r * persp;
      const gy = gy0 + y2 * globe.r * persp;

      const g = reduce ? 1 : ease(clamp01((t - 0.3 - p.delay) / 2));
      let x = lerp(lx, gx, g);
      let y = lerp(ly, gy, g);
      let s = lerp(0.75, 0.45 + 0.6 * front, g);
      let a = lerp(0.2, 0.12 + 0.88 * front * front, g);

      // 3) 그래프 자리 (왼쪽 조각부터 출발해 곡선이 왼쪽에서 오른쪽으로 그려진다)
      const k = ease(clamp01((m - p.xn * 0.45) / 0.55));
      if (k > 0) {
        x = lerp(x, p.cx, k);
        y = lerp(y, p.cy, k) - Math.sin(k * Math.PI) * 40;
        s = lerp(s, p.cs, k);
        a = lerp(a, p.ca, k);
      }

      const img = sprite(p.text, p.color, p.long ? 11 : 13);
      const w = (img.width / dpr) * s;
      const h = (img.height / dpr) * s;
      ctx.globalAlpha = a;
      ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    }

    if (m > 0.72) drawLine(clamp01((m - 0.72) / 0.28));
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    label.style.opacity = clamp01((m - 0.8) / 0.2);
    hint.style.opacity = reduce ? 0 : (1 - clamp01(m * 5)) * clamp01((t - 2.6) / 0.6);

    if (running && !reduce) frameId = requestAnimationFrame(frame);
  }

  const play = () => {
    if (!frameId) frameId = requestAnimationFrame(frame);
  };

  // 화면에 보일 때만 그린다
  new IntersectionObserver(([entry]) => {
    running = entry.isIntersecting && !document.hidden;
    if (running || reduce) play();
  }).observe(hero);
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden && hero.getBoundingClientRect().bottom > 0;
    if (running) play();
  });
  new ResizeObserver(() => {
    layout();
    play();
  }).observe(stage);

  build();
  layout();
  // 글꼴이 늦게 도착하면 글자 그림을 다시 만든다
  document.fonts?.ready.then(() => {
    sprites.clear();
    play();
  });
})();
