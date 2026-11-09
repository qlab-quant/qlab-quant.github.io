// 첫 화면: Q-Lab의 사고방식을 그리는 수식 지구본 (홈 전용)
//
// 지구본은 네 겹으로 되어 있고, 위경도 격자가 뼈대를 잡는다.
//   수식 레이어   적분 · 시그마 · 확률분포 · 행렬 · 미분 · 기대값 · 최적화 식과 코드 조각
//   그래프 레이어 선 그래프 · 산점도와 회귀선 · 막대 · 캔들 · 정규분포 모양의 작은 차트
//   네트워크 레이어 노드와 연결선, 그 위를 오가는 신호
//   데이터 레이어 적도를 도는 틱 막대 고리와 점 구름
// 마우스를 움직이면 지구본이 살짝 기울고, 마우스 쪽 면이 밝아진다.
//
// 스크롤을 내리면 네 장면이 이어진다 (추상 수학 → 구조 → 데이터 → 전략).
//   1 Equation  지구본이 천천히 돌고 수식 조각이 둘레를 떠다닌다
//   2 Structure 표면의 수식이 행렬로, 나머지는 격자 점으로 정렬된다
//   3 Data      수식이 점으로 분해되고 축이 그려진 뒤, 점들이 수익률 곡선 · 산점도 · 거래량으로 다시 모인다
//   4 Strategy  시장보다 낙폭이 작은 전략 곡선이 완성되고, 곡선의 고점이 위쪽 네트워크로 이어진다
// '동작 줄이기' 설정이면 멈춘 지구본만 보여 준다.
(function () {
  const stage = document.getElementById("hero-stage");
  const canvas = document.getElementById("hero-canvas");
  if (!stage || !canvas) return;
  const hero = stage.parentElement;
  const ctx = canvas.getContext("2d");
  const copy = document.getElementById("hero-copy");
  const label = document.getElementById("hero-chart-label");
  const hint = document.getElementById("hero-hint");
  const progress = document.getElementById("hero-progress");
  const progressLabel = document.getElementById("hero-progress-label");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── 재료 ── */
  const SYMBOLS = [
    "σ", "μ", "β", "α", "Σ", "∫", "∂", "Δ", "∇", "λ", "ρ", "θ", "π", "√", "∞", "γ", "κ", "≈", "≥", "%",
    "E[R]", "σ²", "dW", "dt", "Var", "Cov", "R²", "β̂", "ŷ", "x̄", "t₀", "Σᵢⱼ", "‖w‖₁", "N(0,1)", "w′Σw",
    "∂V/∂t", "e^−rT", "∫f dμ", "[1 ρ]", "[ρ 1]", "0.25", "1.00", "−0.03", "+2.4%", "β=0.8", "argmax",
  ];
  const PHRASES = [
    "dS = μS dt + σS dW", "E[Rₚ] − r_f", "N(d₁)", "ln(S/K)", "Cov(X, Y)", "Sharpe = μ/σ", "VaR₉₅", "GARCH(1,1)",
    "Kelly f*", "min w′Σw", "s.t. Σwᵢ = 1", "np.log(p)", "df.rolling(20)", "def backtest():", "cov = X.T @ X",
    "returns.std()", "for t in range(T):", "√252", "λ = 0.94", "argmax U(w)", "P(X > x)", "∂²V/∂S²", "ŷ = Xβ̂",
  ];
  const MINIS = ["spark", "scatter", "bars", "candles", "bell", "axes"];

  // 화면 모드별 색. 다크는 빛이 겹쳐 밝아지고(lighter), 라이트는 종이 위 잉크처럼 덮어 그린다
  const THEMES = {
    dark: {
      blend: "lighter",
      ink: ["#f4f7fb", "#f4f7fb", "#bfd3ff", "#94a3b8", "#7aa2ff", "#59d0ff"],
      dot: "#bfd3ff",
      grid: "148, 163, 184",
      net: "89, 208, 255",
      glow: "47, 107, 255",
      glowA: 0.22,
      blue: "#2f6bff",
      cyan: "#59d0ff",
      bench: "148, 163, 184",
      alpha: 1,
    },
    light: {
      blend: "source-over",
      ink: ["#0b1220", "#0b1220", "#1e3a8a", "#475569", "#2f6bff", "#0a8fc4"],
      dot: "#1e3a8a",
      grid: "71, 85, 105",
      net: "10, 143, 196",
      glow: "47, 107, 255",
      glowA: 0.12,
      blue: "#2f6bff",
      cyan: "#0a8fc4",
      bench: "100, 116, 139",
      alpha: 0.92,
    },
  };
  const currentTheme = () => (getComputedStyle(document.documentElement).colorScheme.includes("dark") ? THEMES.dark : THEMES.light);
  let theme = currentTheme();

  /* ── 도구 ── */
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const span = (p, from, len) => ease(clamp01((p - from) / len));

  let W = 0, H = 0, dpr = 1;
  let globe = { x: 0, y: 0, r: 0 };
  let region = { x0: 0, x1: 0, y0: 0, y1: 0 };
  let matrix = { x0: 0, x1: 0, y0: 0, y1: 0 };

  /* ── 미리 그려 두는 작은 그림 (매 프레임 붙이기만 한다) ── */
  const sprites = new Map();

  function textSprite(text, color, size) {
    const key = `t|${text}|${color}|${size}|${dpr}`;
    let img = sprites.get(key);
    if (img) return img;
    img = document.createElement("canvas");
    const g = img.getContext("2d");
    const font = `500 ${size * dpr}px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
    g.font = font;
    img.width = Math.ceil(g.measureText(text).width + 4 * dpr);
    img.height = Math.ceil(size * dpr * 1.4);
    g.font = font;
    g.fillStyle = color;
    g.textBaseline = "middle";
    g.fillText(text, 2 * dpr, img.height / 2);
    sprites.set(key, img);
    return img;
  }

  // 그래프 레이어의 작은 차트 (가로 52, 세로 32)
  function miniSprite(type, color, accent) {
    const key = `m|${type}|${color}|${accent}|${dpr}`;
    let img = sprites.get(key);
    if (img) return img;
    img = document.createElement("canvas");
    img.width = 52 * dpr;
    img.height = 32 * dpr;
    const g = img.getContext("2d");
    g.scale(dpr, dpr);
    g.lineWidth = 1.2;
    g.strokeStyle = color;
    g.fillStyle = color;
    let s = 3;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    if (type === "spark") {
      g.beginPath();
      let y = 24;
      for (let i = 0; i <= 12; i++) {
        y = Math.max(4, Math.min(28, y - 1.4 + (r() - 0.45) * 7));
        i ? g.lineTo(2 + i * 4, y) : g.moveTo(2, y);
      }
      g.strokeStyle = accent;
      g.stroke();
    } else if (type === "scatter") {
      for (let i = 0; i < 16; i++) {
        const x = 4 + r() * 44;
        g.fillRect(x, 28 - x * 0.45 - (r() - 0.5) * 12, 1.6, 1.6);
      }
      g.beginPath();
      g.moveTo(3, 27);
      g.lineTo(49, 6);
      g.strokeStyle = accent;
      g.stroke();
    } else if (type === "bars") {
      for (let i = 0; i < 9; i++) {
        const bh = 4 + r() * 22;
        g.fillRect(3 + i * 5.4, 29 - bh, 3, bh);
      }
    } else if (type === "candles") {
      let mid = 18;
      for (let i = 0; i < 7; i++) {
        const x = 5 + i * 7;
        const body = 3 + r() * 8;
        mid = Math.max(8, Math.min(24, mid + (r() - 0.5) * 8));
        g.beginPath();
        g.moveTo(x + 1.5, mid - body / 2 - 3);
        g.lineTo(x + 1.5, mid + body / 2 + 3);
        g.stroke();
        g.fillStyle = i % 3 === 1 ? accent : color;
        g.fillRect(x, mid - body / 2, 3, body);
      }
    } else if (type === "bell") {
      g.beginPath();
      for (let i = 0; i <= 24; i++) {
        const x = (i - 12) / 4;
        const y = 28 - 22 * Math.exp((-x * x) / 2);
        i ? g.lineTo(2 + i * 2, y) : g.moveTo(2, y);
      }
      g.strokeStyle = accent;
      g.stroke();
      g.globalAlpha = 0.5;
      g.fillRect(26, 6, 1, 22);
    } else {
      g.beginPath();
      g.moveTo(4, 2);
      g.lineTo(4, 28);
      g.lineTo(50, 28);
      g.stroke();
      g.beginPath();
      g.moveTo(5, 24);
      g.bezierCurveTo(18, 22, 26, 8, 48, 6);
      g.strokeStyle = accent;
      g.stroke();
    }
    sprites.set(key, img);
    return img;
  }

  // 빛나는 점 (신호 · 노드 · 곡선 끝)
  function glowSprite(color) {
    const key = `g|${color}|${dpr}`;
    let img = sprites.get(key);
    if (img) return img;
    img = document.createElement("canvas");
    img.width = img.height = 32 * dpr;
    const g = img.getContext("2d");
    const c = img.width / 2;
    const grad = g.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, color);
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.35, `${color}66`);
    grad.addColorStop(1, `${color}00`);
    g.fillStyle = grad;
    g.fillRect(0, 0, img.width, img.height);
    sprites.set(key, img);
    return img;
  }

  /* ── 장면 재료 만들기 ── */
  let particles = [];
  let orbiters = [];
  let nodes = [];
  let links = [];
  let pulses = [];
  let ring = [];
  let graticule = [];
  let strategy = [];
  let market = [];
  let volume = [];
  const CURVE = 160;

  function fibonacci(i, n) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    return [Math.cos(i * golden) * r, y, Math.sin(i * golden) * r];
  }

  function build(narrow) {
    const nText = narrow ? 120 : 230;
    const nMini = narrow ? 14 : 28;
    const nDot = narrow ? 200 : 380;
    const total = nText + nMini + nDot;
    seed = 7;
    const order = Array.from({ length: total }, (_, i) => i);
    for (let i = total - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    particles = order.map((k, i) => {
      const kind = i < nText ? "text" : i < nText + nMini ? "mini" : "dot";
      const long = kind === "text" && rand() < 0.12;
      const [ux, uy, uz] = fibonacci(k, total);
      return {
        kind,
        long,
        text: kind === "text" ? (long ? pick(PHRASES) : pick(SYMBOLS)) : "",
        mini: kind === "mini" ? pick(MINIS) : "",
        tone: Math.floor(rand() * 6),
        ux, uy, uz,
        lx: rand(), ly: rand(),
        drift: 0.4 + rand() * 0.8,
        phase: rand() * Math.PI * 2,
        delay: rand() * 0.6,
      };
    });
    // 행렬 칸에 들어갈 수식: 짧은 기호 중에서 고른다
    const cells = narrow ? 24 : 48;
    let c = 0;
    particles.forEach((p) => {
      p.cell = p.kind === "text" && !p.long && c < cells ? c++ : -1;
    });

    // 둘레를 떠다니는 긴 수식 조각
    orbiters = Array.from({ length: narrow ? 6 : 12 }, (_, i) => ({
      text: PHRASES[(i * 5) % PHRASES.length],
      radius: 1.28 + rand() * 0.38,
      tilt: (rand() - 0.5) * 1.4,
      speed: (0.05 + rand() * 0.06) * (rand() < 0.5 ? -1 : 1),
      phase: rand() * Math.PI * 2,
      tone: 3 + Math.floor(rand() * 3),
    }));

    // 네트워크: 구 위의 노드와, 가장 가까운 두 노드를 잇는 선
    const nNodes = narrow ? 22 : 36;
    nodes = Array.from({ length: nNodes }, (_, i) => ({ v: fibonacci((i * 7 + 3) % nNodes, nNodes), flicker: rand() * 10 }));
    const seen = new Set();
    links = [];
    nodes.forEach((n, i) => {
      nodes
        .map((m, j) => [j, (n.v[0] - m.v[0]) ** 2 + (n.v[1] - m.v[1]) ** 2 + (n.v[2] - m.v[2]) ** 2])
        .filter(([j]) => j !== i)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 2)
        .forEach(([j]) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (!seen.has(key)) {
            seen.add(key);
            links.push([i, j]);
          }
        });
    });
    pulses = Array.from({ length: narrow ? 5 : 9 }, () => ({ link: Math.floor(rand() * links.length), t: rand(), speed: 0.25 + rand() * 0.35 }));

    // 적도 둘레의 틱 막대 고리 (호가 · 거래량 느낌)
    ring = Array.from({ length: 96 }, (_, i) => ({
      a: (i / 96) * Math.PI * 2,
      h: 0.04 + 0.1 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11)) + rand() * 0.05,
    }));

    // 위경도 격자: 경선 6개(대원) + 위선 5개
    graticule = [];
    for (let lon = 0; lon < 180; lon += 30) {
      const L = (lon * Math.PI) / 180;
      graticule.push(Array.from({ length: 73 }, (_, i) => {
        const t = (i / 72) * Math.PI * 2;
        return [Math.cos(t) * Math.cos(L), Math.sin(t), Math.cos(t) * Math.sin(L)];
      }));
    }
    for (const lat of [-60, -30, 0, 30, 60]) {
      const B = (lat * Math.PI) / 180;
      graticule.push(Array.from({ length: 73 }, (_, i) => {
        const t = (i / 72) * Math.PI * 2;
        return [Math.cos(B) * Math.cos(t), Math.sin(B), Math.cos(B) * Math.sin(t)];
      }));
    }

    // 전략 곡선: 꾸준히 오르다 한 번 작게 흔들리고 새 고점으로 (돈을 지킨다)
    // 시장 곡선: 더 크게 출렁이고, 같은 구간에서 크게 빠진다
    seed = 11;
    let v = 0, m = 0;
    strategy = [];
    market = [];
    for (let i = 0; i < CURVE; i++) {
      const t = i / (CURVE - 1);
      const shock = t > 0.55 && t < 0.63;
      const rebound = t > 0.66 && t < 0.86;
      v += 0.11 + (rand() - 0.5) * 0.5 - (shock ? 0.3 : 0);
      m += 0.1 + (rand() - 0.5) * 1.1 - (shock ? 1.1 : 0) + (rebound ? 0.22 : 0);
      strategy.push(v);
      market.push(m);
    }
    const lo = Math.min(...strategy, ...market);
    const hi = Math.max(...strategy, ...market);
    strategy = strategy.map((x) => (x - lo) / (hi - lo));
    market = market.map((x) => (x - lo) / (hi - lo));
    volume = Array.from({ length: narrow ? 36 : 64 }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.31)) * (0.6 + rand() * 0.4));
  }

  const curveAt = (series, xn) => {
    const f = xn * (CURVE - 1);
    const i = Math.min(CURVE - 2, Math.floor(f));
    const v = lerp(series[i], series[i + 1], f - i);
    return region.y1 - v * (region.y1 - region.y0);
  };

  /* ── 화면 크기에 맞춘 자리 잡기 ── */
  let peaks = [];
  let constellation = [];
  let constLinks = [];

  function layout() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sprites.clear();

    // 휴대폰이나 세로로 세운 태블릿은 글 아래에 지구본을 쌓는다
    const narrow = W < 720 || W < H * 0.9;
    globe = narrow
      ? { x: W * 0.5, y: H * 0.72, r: Math.min(W * 0.34, H * 0.18) }
      : { x: W * 0.7, y: H * 0.5, r: Math.min(W * 0.21, H * 0.33) };
    region = narrow
      ? { x0: W * 0.1, x1: W * 0.92, y0: H * 0.62, y1: H * 0.85 }
      : { x0: W * 0.5, x1: W * 0.93, y0: H * 0.3, y1: H * 0.76 };
    const rw = region.x1 - region.x0;
    const rh = region.y1 - region.y0;
    matrix = { x0: region.x0 + rw * 0.06, x1: region.x1 - rw * 0.06, y0: region.y0 - rh * 0.12, y1: region.y1 + rh * 0.02 };

    // 행렬 칸과 격자 점
    const cols = narrow ? 4 : 6;
    const rows = Math.ceil(particles.filter((p) => p.cell >= 0).length / cols);
    const lattice = particles.filter((p) => p.cell < 0).length;
    const lcols = narrow ? 22 : 34;
    const lrows = Math.ceil(lattice / lcols);
    let li = 0;
    particles.forEach((p) => {
      if (p.cell >= 0) {
        const cx = p.cell % cols;
        p.mx = lerp(matrix.x0, matrix.x1, (cx + 0.5) / cols);
        p.my = lerp(matrix.y0, matrix.y1, (Math.floor(p.cell / cols) + 0.5) / rows);
        p.wave = cx / cols;
      } else {
        const cx = li % lcols;
        p.mx = lerp(matrix.x0, matrix.x1, (cx + 0.5) / lcols);
        p.my = lerp(matrix.y0, matrix.y1, (Math.floor(li / lcols) + 0.5) / lrows);
        p.wave = cx / lcols;
        li++;
      }
    });

    // 그래프 자리: 일부는 곡선 위, 나머지는 곡선 아래를 채운다
    seed = 23;
    const onCurve = Math.round(particles.length * 0.4);
    const shuffled = particles.map((p) => [rand(), p]).sort((a, b) => a[0] - b[0]).map(([, p]) => p);
    shuffled.forEach((p, i) => {
      if (i < onCurve) {
        p.xn = i / (onCurve - 1);
        p.cx = lerp(region.x0, region.x1, p.xn);
        p.cy = curveAt(strategy, p.xn) + (rand() - 0.5) * 2;
        p.ca = 0.9;
        p.curve = true;
      } else {
        p.xn = rand();
        p.cx = lerp(region.x0, region.x1, p.xn);
        const crest = curveAt(strategy, p.xn);
        p.cy = crest + (region.y1 - crest) * Math.pow(rand(), 1.6);
        p.ca = 0.06 + 0.3 * (1 - (p.cy - crest) / Math.max(1, region.y1 - crest));
        p.curve = false;
      }
    });

    // 곡선의 고점 다섯 개와, 그 위쪽 네트워크(별자리)
    peaks = [];
    for (let i = 8; i < CURVE - 4; i++) {
      if (strategy[i] >= Math.max(...strategy.slice(Math.max(0, i - 8), i + 9))) peaks.push(i);
    }
    if (peaks.length > 5) peaks = peaks.filter((_, i) => i % Math.ceil(peaks.length / 5) === 0);
    seed = 41;
    const band = narrow ? { y0: region.y0 - H * 0.12, y1: region.y0 - H * 0.03 } : { y0: H * 0.1, y1: region.y0 - H * 0.05 };
    const nCols = narrow ? 5 : 8;
    constellation = Array.from({ length: nCols * 2 }, (_, i) => ({
      x: lerp(region.x0 + rw * 0.05, region.x1, ((i % nCols) + 0.2 + rand() * 0.6) / nCols),
      y: lerp(band.y0, band.y1, (Math.floor(i / nCols) + 0.15 + rand() * 0.7) / 2),
      flicker: rand() * 10,
    }));
    constLinks = [];
    constellation.forEach((a, i) => {
      constellation
        .map((b, j) => [j, (a.x - b.x) ** 2 + (a.y - b.y) ** 2])
        .filter(([j]) => j > i)
        .sort((x, y) => x[1] - y[1])
        .slice(0, 2)
        .forEach(([j]) => constLinks.push([i, j]));
    });
    // 고점마다 가장 가까운 별
    peaks = peaks.map((pi) => {
      const px = lerp(region.x0, region.x1, pi / (CURVE - 1));
      const py = curveAt(strategy, pi / (CURVE - 1));
      let best = 0, bestD = Infinity;
      constellation.forEach((s, si) => {
        const d = (s.x - px) ** 2 + (s.y - py) ** 2;
        if (d < bestD) (bestD = d), (best = si);
      });
      return { px, py, star: constellation[best] };
    });

    label.style.transform = `translate(${region.x0}px, ${region.y0 - (narrow ? 30 : 40)}px)`;
  }

  // 스크롤이 히어로 구간에서 어디까지 왔는지 (0 = 맨 위, 1 = 끝)
  function scrollProgress() {
    const r = hero.getBoundingClientRect();
    const total = r.height - H;
    return total > 0 ? clamp01(-r.top / total) : 0;
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0, px: -1e4, py: -1e4 };
  stage.addEventListener("pointermove", (e) => {
    pointer.tx = e.clientX / W - 0.5;
    pointer.ty = e.clientY / H - 0.5;
    pointer.px = e.clientX;
    pointer.py = e.clientY;
  });
  stage.addEventListener("pointerleave", () => {
    pointer.tx = 0;
    pointer.ty = 0;
    pointer.px = pointer.py = -1e4;
  });

  /* ── 3차원 회전과 원근 ── */
  let cosY = 1, sinY = 0, cosP = 1, sinP = 0, gx0 = 0, gy0 = 0, focal = 1;
  const rotate = (x, y, z) => {
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;
    return [x1, y * cosP - z1 * sinP, y * sinP + z1 * cosP];
  };
  // 화면 좌표 x, y와 원근 배율, 앞쪽 정도(1 = 바로 앞)
  const project = ([x, y, z]) => {
    const persp = focal / (focal + z * globe.r);
    return [gx0 + x * globe.r * persp, gy0 + y * globe.r * persp, persp, (1 - z) / 2];
  };

  /* ── 레이어 그리기 ── */
  function drawGlow(alpha) {
    if (alpha <= 0) return;
    const r = globe.r * 1.9;
    const g = ctx.createRadialGradient(gx0, gy0, 0, gx0, gy0, r);
    g.addColorStop(0, `rgba(${theme.glow}, ${theme.glowA})`);
    g.addColorStop(0.5, `rgba(${theme.glow}, ${theme.glowA / 4})`);
    g.addColorStop(1, `rgba(${theme.glow}, 0)`);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(gx0 - r, gy0 - r, r * 2, r * 2);
  }

  function drawGraticule(alpha) {
    if (alpha <= 0) return;
    const front = new Path2D();
    const back = new Path2D();
    for (const circle of graticule) {
      let prev = null;
      for (const v of circle) {
        const q = project(rotate(v[0], v[1], v[2]));
        if (prev) {
          const path = prev[3] + q[3] > 1 ? front : back;
          path.moveTo(prev[0], prev[1]);
          path.lineTo(q[0], q[1]);
        }
        prev = q;
      }
    }
    ctx.lineWidth = 1;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `rgba(${theme.grid}, 0.07)`;
    ctx.stroke(back);
    ctx.strokeStyle = `rgba(${theme.grid}, 0.22)`;
    ctx.stroke(front);
  }

  function drawRing(alpha, t) {
    if (alpha <= 0) return;
    ctx.lineWidth = 1.4;
    const spin = t * 0.08;
    for (const b of ring) {
      const a = b.a + spin;
      const live = b.h * (0.8 + 0.2 * Math.sin(t * 1.6 + b.a * 5));
      const inner = project(rotate(Math.cos(a) * 1.16, 0, Math.sin(a) * 1.16));
      const outer = project(rotate(Math.cos(a) * (1.16 + live), 0, Math.sin(a) * (1.16 + live)));
      ctx.globalAlpha = alpha * (0.12 + 0.6 * inner[3] * inner[3]);
      ctx.strokeStyle = b.h > 0.12 ? theme.cyan : theme.blue;
      ctx.beginPath();
      ctx.moveTo(inner[0], inner[1]);
      ctx.lineTo(outer[0], outer[1]);
      ctx.stroke();
    }
  }

  // 두 단위벡터 사이 대원 위의 점 (구면 선형 보간)
  function slerp(a, b, t, scale = 1.02) {
    const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const om = Math.acos(dot);
    const s = Math.sin(om) || 1;
    const ka = (om < 1e-4 ? 1 - t : Math.sin((1 - t) * om) / s) * scale;
    const kb = (om < 1e-4 ? t : Math.sin(t * om) / s) * scale;
    return rotate(a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb);
  }

  function drawNetwork(alpha, t, dt) {
    if (alpha <= 0) return;
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgb(${theme.net})`;
    for (const [i, j] of links) {
      ctx.beginPath();
      let depth = 0;
      for (let k = 0; k <= 8; k++) {
        const q = project(slerp(nodes[i].v, nodes[j].v, k / 8));
        depth += q[3];
        k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      }
      depth /= 9;
      ctx.globalAlpha = alpha * (0.04 + 0.32 * depth * depth);
      ctx.stroke();
    }
    const img = glowSprite(theme.cyan);
    for (const n of nodes) {
      const q = project(rotate(n.v[0] * 1.02, n.v[1] * 1.02, n.v[2] * 1.02));
      const flick = Math.sin(t * 1.3 + n.flicker) > 0.94 ? 1 : 0; // 가끔 깜빡인다
      const s = (6 + 6 * flick) * q[2];
      ctx.globalAlpha = alpha * (0.15 + 0.85 * q[3] * q[3]);
      ctx.drawImage(img, q[0] - s, q[1] - s, s * 2, s * 2);
    }
    for (const p of pulses) {
      p.t += dt * p.speed;
      if (p.t > 1) {
        p.t = 0;
        p.link = Math.floor(Math.random() * links.length);
      }
      const [i, j] = links[p.link];
      const q = project(slerp(nodes[i].v, nodes[j].v, p.t));
      const s = 7 * q[2];
      ctx.globalAlpha = alpha * q[3];
      ctx.drawImage(img, q[0] - s, q[1] - s, s * 2, s * 2);
    }
  }

  function drawOrbiters(alpha, t) {
    if (alpha <= 0) return;
    for (const o of orbiters) {
      const a = o.phase + t * o.speed;
      const vx = Math.cos(a) * o.radius;
      const vy = Math.sin(a) * Math.sin(o.tilt) * o.radius;
      const vz = Math.sin(a) * Math.cos(o.tilt) * o.radius;
      const q = project([vx, vy * cosP - vz * sinP, vy * sinP + vz * cosP]);
      const img = textSprite(o.text, theme.ink[o.tone], 11);
      const s = 0.55 + 0.35 * q[3];
      const w = (img.width / dpr) * s;
      const h = (img.height / dpr) * s;
      ctx.globalAlpha = alpha * (0.15 + 0.45 * q[3]);
      ctx.drawImage(img, q[0] - w / 2, q[1] - h / 2, w, h);
    }
  }

  // 2장면: 행렬 괄호와 차원 표시
  function drawBrackets(alpha) {
    if (alpha <= 0) return;
    const { x0, x1, y0, y1 } = matrix;
    const pad = 14, arm = 10;
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = theme.ink[3];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0 - pad + arm, y0 - 8);
    ctx.lineTo(x0 - pad, y0 - 8);
    ctx.lineTo(x0 - pad, y1 + 8);
    ctx.lineTo(x0 - pad + arm, y1 + 8);
    ctx.moveTo(x1 + pad - arm, y0 - 8);
    ctx.lineTo(x1 + pad, y0 - 8);
    ctx.lineTo(x1 + pad, y1 + 8);
    ctx.lineTo(x1 + pad - arm, y1 + 8);
    ctx.stroke();
    const img = textSprite("M ∈ ℝⁿˣᵏ", theme.cyan, 12);
    ctx.drawImage(img, x0 - pad, y0 - 34, img.width / dpr, img.height / dpr);
  }

  // 3장면: 축과 눈금
  function drawAxes(k) {
    if (k <= 0) return;
    const { x0, x1, y0, y1 } = region;
    const bottom = y1 + 10;
    const reach = lerp(x0 - 10, x1, k);
    ctx.globalAlpha = 0.55 * k;
    ctx.strokeStyle = theme.ink[3];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 - 10, bottom);
    ctx.lineTo(reach, bottom);
    ctx.moveTo(x0 - 10, bottom);
    ctx.lineTo(x0 - 10, lerp(bottom, y0 - 10, k));
    for (let i = 1; i <= 6; i++) {
      const x = lerp(x0, x1, i / 6);
      if (x > reach) break;
      ctx.moveTo(x, bottom);
      ctx.lineTo(x, bottom + 4);
    }
    ctx.stroke();
    if (k > 0.9) {
      ctx.globalAlpha = 0.55 * (k - 0.9) * 10;
      const tImg = textSprite("t", theme.ink[3], 11);
      ctx.drawImage(tImg, x1 + 4, bottom - 8, tImg.width / dpr, tImg.height / dpr);
      const pImg = textSprite("P&L", theme.ink[3], 11);
      ctx.drawImage(pImg, x0 - 10, y0 - 30, pImg.width / dpr, pImg.height / dpr);
    }
  }

  function drawVolume(k) {
    if (k <= 0) return;
    const { x0, x1, y1 } = region;
    const bw = (x1 - x0) / volume.length;
    const maxH = (region.y1 - region.y0) * 0.12;
    ctx.fillStyle = theme.blue;
    ctx.globalAlpha = 0.28;
    volume.forEach((v, i) => {
      const local = clamp01((k - (i / volume.length) * 0.4) / 0.6);
      if (!local) return;
      const h = v * maxH * ease(local);
      ctx.fillRect(x0 + i * bw + bw * 0.2, y1 + 8 - h, bw * 0.6, h);
    });
  }

  // 3~4장면: 전략 곡선(실선)과 시장 곡선(점선), 그 사이 지켜 낸 구간
  function drawCurves(k, t) {
    if (k <= 0) return;
    const n = Math.max(2, Math.floor(k * CURVE));
    const xs = (i) => lerp(region.x0, region.x1, i / (CURVE - 1));
    const ys = (i) => curveAt(strategy, i / (CURVE - 1));
    const ym = (i) => curveAt(market, i / (CURVE - 1));

    // 지켜 낸 낙폭: 시장이 전략보다 아래로 빠진 곳을 옅게 칠한다
    ctx.globalAlpha = 0.16 * k;
    ctx.fillStyle = theme.cyan;
    let from = -1;
    for (let i = 0; i <= n; i++) {
      const below = i < n && ym(i) > ys(i) + 2;
      if (below && from < 0) from = i;
      if (!below && from >= 0) {
        ctx.beginPath();
        for (let j = from; j < i; j++) j === from ? ctx.moveTo(xs(j), ys(j)) : ctx.lineTo(xs(j), ys(j));
        for (let j = i - 1; j >= from; j--) ctx.lineTo(xs(j), ym(j));
        ctx.closePath();
        ctx.fill();
        from = -1;
      }
    }

    ctx.lineJoin = "round";
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.7 * k;
    ctx.strokeStyle = `rgb(${theme.bench})`;
    ctx.beginPath();
    for (let i = 0; i < n; i++) i ? ctx.lineTo(xs(i), ym(i)) : ctx.moveTo(xs(i), ym(i));
    ctx.stroke();
    ctx.setLineDash([]);

    const grad = ctx.createLinearGradient(region.x0, 0, region.x1, 0);
    grad.addColorStop(0, theme.blue);
    grad.addColorStop(1, theme.cyan);
    const path = new Path2D();
    for (let i = 0; i < n; i++) i ? path.lineTo(xs(i), ys(i)) : path.moveTo(xs(i), ys(i));
    ctx.strokeStyle = grad;
    ctx.globalAlpha = 0.18 * k;
    ctx.lineWidth = 7;
    ctx.stroke(path);
    ctx.globalAlpha = k;
    ctx.lineWidth = 2;
    ctx.stroke(path);

    // 곡선 끝이 맥박처럼 빛난다
    const ex = xs(n - 1);
    const ey = ys(n - 1);
    const beat = 1 + 0.35 * Math.sin(t * 3);
    ctx.drawImage(glowSprite(theme.cyan), ex - 14 * beat, ey - 14 * beat, 28 * beat, 28 * beat);

    if (k > 0.96) {
      ctx.globalAlpha = (k - 0.96) * 25;
      const sImg = textSprite("strategy", theme.cyan, 11);
      ctx.drawImage(sImg, ex - sImg.width / dpr, ey - 26, sImg.width / dpr, sImg.height / dpr);
      const mImg = textSprite("market", `rgb(${theme.bench})`, 11);
      ctx.drawImage(mImg, xs(CURVE - 1) - mImg.width / dpr, ym(CURVE - 1) + 8, mImg.width / dpr, mImg.height / dpr);
    }
  }

  // 4장면: 곡선의 고점이 위쪽 네트워크로 이어지고 신호가 오간다
  function drawConstellation(k, t) {
    if (k <= 0) return;
    const img = glowSprite(theme.cyan);
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgb(${theme.net})`;
    constLinks.forEach(([i, j], idx) => {
      const local = ease(clamp01((k - (idx / constLinks.length) * 0.5) / 0.5));
      if (!local) return;
      const a = constellation[i], b = constellation[j];
      ctx.globalAlpha = 0.35 * local;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(lerp(a.x, b.x, local), lerp(a.y, b.y, local));
      ctx.stroke();
    });
    ctx.setLineDash([2, 3]);
    peaks.forEach(({ px, py, star }, idx) => {
      const local = ease(clamp01((k - 0.2 - idx * 0.1) / 0.4));
      if (!local) return;
      ctx.globalAlpha = 0.5 * local;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(lerp(px, star.x, local), lerp(py, star.y, local));
      ctx.stroke();
    });
    ctx.setLineDash([]);
    peaks.forEach(({ px, py, star }, idx) => {
      const local = clamp01((k - 0.2 - idx * 0.1) / 0.4);
      if (!local) return;
      if (local === 1) {
        const f = (t * 0.6 + idx * 0.2) % 1; // 고점에서 별로 오르는 신호
        ctx.globalAlpha = 0.9 * Math.sin(f * Math.PI);
        ctx.drawImage(img, lerp(px, star.x, f) - 6, lerp(py, star.y, f) - 6, 12, 12);
      }
      ctx.globalAlpha = local;
      ctx.drawImage(img, px - 8, py - 8, 16, 16);
    });
    constellation.forEach((c) => {
      const flick = Math.sin(t * 1.1 + c.flicker) > 0.9 ? 1.6 : 1;
      ctx.globalAlpha = k * 0.9;
      ctx.drawImage(img, c.x - 7 * flick, c.y - 7 * flick, 14 * flick, 14 * flick);
    });
  }

  /* ── 한 프레임 ── */
  let start = 0, last = 0, frameId = 0, running = false;
  let chapterShown = -1;

  function frame(now) {
    frameId = 0;
    if (!start) start = last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = reduce ? 12 : (now - start) / 1000;
    const p = reduce ? 0 : scrollProgress();

    // 글 · 장면 표시 (장면이 바뀔 때만 속성을 바꾼다)
    const fade = span(p, 0.03, 0.07);
    copy.style.opacity = String(1 - fade);
    copy.style.transform = fade ? `translateY(${-24 * fade}px)` : "";
    copy.style.visibility = fade > 0.99 ? "hidden" : "";
    const chapter = p < 0.08 ? 0 : p < 0.3 ? 1 : p < 0.5 ? 2 : p < 0.74 ? 3 : 4;
    if (chapter !== chapterShown) {
      chapterShown = chapter;
      stage.dataset.chapter = String(chapter);
      progressLabel.textContent = `0${Math.max(1, chapter)}`;
    }
    progress.style.setProperty("--p", clamp01((p - 0.08) / 0.84).toFixed(3));

    const k1 = clamp01((p - 0.2) / 0.16); // 지구본 → 행렬
    const k2 = span(p, 0.46, 0.08); // 수식 → 점, 축
    const k3 = clamp01((p - 0.52) / 0.16); // 점 → 그래프
    const k4 = span(p, 0.62, 0.14); // 곡선 긋기
    const k5 = span(p, 0.78, 0.16); // 네트워크로 잇기
    const globeA = 1 - span(p, 0.18, 0.12);

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    const yaw = t * 0.16 + Math.sin(t * 0.35) * 0.35 + pointer.x * 0.6;
    const pitch = 0.3 + pointer.y * 0.35;
    cosY = Math.cos(yaw);
    sinY = Math.sin(yaw);
    cosP = Math.cos(pitch);
    sinP = Math.sin(pitch);
    gx0 = globe.x + Math.sin(t * 0.35) * globe.r * 0.1; // 좌우로 천천히 흔들린다
    gy0 = globe.y + Math.sin(t * 0.7) * 4;
    focal = globe.r * 2.8;

    // 마우스가 가리키는 쪽 면을 밝히는 빛의 방향
    const ldx = (pointer.px - gx0) / globe.r;
    const ldy = (pointer.py - gy0) / globe.r;
    const near = Math.hypot(ldx, ldy) < 1.6;
    const ll = Math.hypot(ldx, ldy, 1.1);
    const lx = ldx / ll, ly = ldy / ll, lz = -1.1 / ll;

    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    drawGlow(globeA);
    ctx.globalCompositeOperation = theme.blend;
    drawGraticule(globeA);
    drawRing(globeA, t);
    drawNetwork(globeA, t, dt);
    drawOrbiters(globeA * (reduce ? 1 : span(t, 0.8, 1.6)), t);
    drawBrackets(Math.min(k1, 1 - k2));
    drawAxes(k2);
    drawVolume(k3);

    let lastFill = "";
    for (const q of particles) {
      // 1) 흩어진 자리 → 2) 지구본 위 자리
      const lx0 = q.lx * W + Math.sin(t * q.drift + q.phase) * 10;
      const ly0 = q.ly * H + Math.cos(t * q.drift * 0.8 + q.phase) * 10;
      const [x1, y2, z2] = rotate(q.ux, q.uy, q.uz);
      const [gx, gy, , front] = project([x1, y2, z2]);
      const hl = near ? Math.pow(Math.max(0, x1 * lx + y2 * ly + z2 * lz), 6) : 0;
      const g = reduce ? 1 : ease(clamp01((t - 0.2 - q.delay) / 1.8));
      let x = lerp(lx0, gx, g);
      let y = lerp(ly0, gy, g);
      let s = lerp(0.7, (0.42 + 0.55 * front) * (1 + hl * 0.5), g);
      let a = lerp(0.15, (0.1 + 0.9 * front * front) * (1 + hl), g);
      let dotness = q.kind === "dot" ? 1 : 0;

      // 3) 행렬 · 격자 자리 (왼쪽 열부터 차례로)
      const m = ease(clamp01((k1 - q.wave * 0.35) / 0.65));
      if (m > 0) {
        x = lerp(x, q.mx, m);
        y = lerp(y, q.my, m);
        s = lerp(s, q.cell >= 0 ? 0.85 : 0.6, m);
        a = lerp(a, q.cell >= 0 ? 0.95 : 0.3, m);
        if (q.cell < 0) dotness = Math.max(dotness, m);
      }
      // 4) 점으로 분해
      if (k2 > 0) dotness = Math.max(dotness, k2);
      // 5) 그래프 자리 (왼쪽 점부터 출발해 곡선이 왼쪽에서 오른쪽으로 그려진다)
      const c = ease(clamp01((k3 - q.xn * 0.4) / 0.6));
      if (c > 0) {
        x = lerp(x, q.cx, c);
        y = lerp(y, q.cy, c) - Math.sin(c * Math.PI) * 30;
        a = lerp(a, q.ca, c);
      }
      a *= theme.alpha;
      if (a <= 0.01) continue;

      if (dotness < 1) {
        const img = q.kind === "mini" ? miniSprite(q.mini, theme.ink[3], theme.ink[5]) : textSprite(q.text, theme.ink[q.tone], q.long ? 11 : 13);
        const w = (img.width / dpr) * s;
        const h = (img.height / dpr) * s;
        ctx.globalAlpha = Math.min(1, a * (1 - dotness));
        ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
      }
      if (dotness > 0) {
        const lit = q.curve && c > 0.5;
        const r = lit ? 1.3 : q.kind === "dot" && m === 0 ? 0.5 + 0.8 * front : 1;
        const fill = lit ? theme.cyan : theme.dot;
        if (fill !== lastFill) {
          ctx.fillStyle = fill;
          lastFill = fill;
        }
        ctx.globalAlpha = Math.min(1, a * dotness);
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }

    drawCurves(k4, t);
    drawConstellation(k5, t);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    label.style.opacity = String(span(p, 0.7, 0.08));
    hint.style.opacity = reduce ? "0" : String((1 - clamp01(p * 20)) * clamp01((t - 2.4) / 0.6));

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
    last = performance.now();
    if (running) play();
  });

  // 화면 모드를 바꾸면(버튼 또는 시스템 설정) 바로 색을 바꾼다
  const retheme = () => {
    theme = currentTheme();
    play();
  };
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", retheme);

  // 휴대폰 ↔ 큰 화면을 넘나들 때만 재료를 다시 만들고, 크기가 바뀌면 자리만 다시 잡는다
  let narrowBuilt = null;
  new ResizeObserver(() => {
    const narrow = stage.clientWidth < 720;
    if (narrow !== narrowBuilt) {
      narrowBuilt = narrow;
      build(narrow);
    }
    layout();
    play();
  }).observe(stage);

  // 글꼴이 늦게 도착하면 글자 그림을 다시 만든다
  document.fonts?.ready.then(() => {
    sprites.clear();
    play();
  });
})();
