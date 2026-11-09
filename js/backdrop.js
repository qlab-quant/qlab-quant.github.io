// 홈 배경 네트워크: 첫 화면 마지막 장면의 네트워크가 페이지 아래까지 이어진다 (홈 전용)
// 보고 있는 섹션에 따라 노드가 천천히 다른 모양으로 모인다.
//   소개 → 작은 지구본   활동 → 타임라인   프로젝트 → 산점도와 회귀선   멤버 → 팀 군집   영상 → 파형
// 아주 옅게 그려서 글 읽기를 방해하지 않는다. '동작 줄이기' 설정이면 모양만 바뀌고 움직이지 않는다.
(function () {
  if (document.body.dataset.page !== "home") return;
  const hero = document.querySelector(".hero");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.createElement("canvas");
  canvas.className = "backdrop";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");

  const COLORS = {
    dark: { node: "89, 208, 255", link: "122, 162, 255", guide: "148, 163, 184", alpha: 1 },
    light: { node: "10, 143, 196", link: "47, 107, 255", guide: "71, 85, 105", alpha: 0.75 },
  };
  const palette = () => (getComputedStyle(document.documentElement).colorScheme.includes("dark") ? COLORS.dark : COLORS.light);
  let colors = palette();

  let W = 0, H = 0;
  let heroEnd = 0; // 첫 화면이 끝나는 문서 위치 (스크롤할 때마다 레이아웃을 읽지 않으려고 미리 잰다)
  const FRAME_MS = 1000 / 30; // 아주 천천히 움직이므로 초당 30번이면 충분하다
  let seed = 5;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lerp = (a, b, t) => a + (b - a) * t;

  const N = innerWidth < 720 ? 42 : 72;
  const nodes = Array.from({ length: N }, () => ({
    x: rand() * innerWidth,
    y: rand() * innerHeight,
    tx: 0,
    ty: 0,
    u: rand(), // 모양 안에서의 자리(0~1)
    v: rand(),
    phase: rand() * Math.PI * 2,
    size: 1 + rand() * 1.4,
  }));
  const golden = Math.PI * (3 - Math.sqrt(5));

  // 섹션마다 노드가 모일 자리. guide는 모양을 알려 주는 옅은 선
  const MODES = {
    globe(n, i, t) {
      const narrow = W < 720;
      const cx = narrow ? W * 0.5 : W * 0.84, cy = H * 0.5, r = Math.min(W, H) * (narrow ? 0.32 : 0.2);
      const y = 1 - (i / (N - 1)) * 2;
      const ring = Math.sqrt(1 - y * y);
      const a = i * golden + t * 0.12;
      const z = Math.sin(a) * ring;
      return [cx + Math.cos(a) * ring * r, cy + (y * 0.92 - z * 0.25) * r, (1 - z) / 2];
    },
    timeline(n, i) {
      const x = lerp(W * 0.04, W * 0.96, i / (N - 1));
      return [x, H * 0.52 + (i % 6 === 0 ? 0 : Math.sin(i * 1.3) * H * 0.05), i % 6 === 0 ? 1 : 0.6];
    },
    regression(n) {
      const x = lerp(W * 0.04, W * 0.96, n.u);
      return [x, H * 0.78 - n.u * H * 0.5 + (n.v - 0.5) * H * 0.3, 0.8];
    },
    clusters(n, i) {
      const k = i % 5;
      const centers = [[0.12, 0.3], [0.88, 0.25], [0.5, 0.82], [0.1, 0.78], [0.9, 0.75]];
      const a = n.u * Math.PI * 2;
      const r = Math.sqrt(n.v) * Math.min(W, H) * 0.09;
      return [centers[k][0] * W + Math.cos(a) * r, centers[k][1] * H + Math.sin(a) * r, 0.8];
    },
    wave(n, i, t) {
      const x = lerp(W * 0.02, W * 0.98, i / (N - 1));
      return [x, H * 0.5 + Math.sin(i * 0.35 + t * 0.8) * H * 0.12 * (0.6 + 0.4 * Math.sin(i * 0.07)), 0.8];
    },
  };
  const SECTION_MODE = { about: "globe", activities: "timeline", projects: "regression", members: "clusters", videos: "wave" };
  let mode = "globe";

  // 옅은 배경이라 레티나에서도 1배 해상도로 그린다 (칠할 픽셀이 1/4로 준다)
  function resize() {
    W = innerWidth;
    H = innerHeight;
    canvas.width = W;
    canvas.height = H;
    heroEnd = hero ? hero.offsetTop + hero.offsetHeight : 0;
  }
  const heroBottom = () => heroEnd - window.scrollY;

  const pointer = { x: -1e4, y: -1e4 };
  addEventListener("pointermove", (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  }, { passive: true });

  const pulses = Array.from({ length: 5 }, () => ({ a: 0, b: 1, t: Math.random() }));

  function guide(t, fade) {
    ctx.strokeStyle = `rgba(${colors.guide}, ${0.12 * fade})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (mode === "timeline") {
      ctx.moveTo(W * 0.04, H * 0.52);
      ctx.lineTo(W * 0.96, H * 0.52);
    } else if (mode === "regression") {
      ctx.moveTo(W * 0.04, H * 0.78);
      ctx.lineTo(W * 0.96, H * 0.28);
    } else if (mode === "wave") {
      for (let i = 0; i < N; i++) {
        const [x, y] = MODES.wave(nodes[i], i, t);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  }

  let start = 0, frameId = 0, visible = false, settle = 0, drawn = 0;

  function frame(now) {
    frameId = 0;
    if (!start) start = now;
    if (!reduce && now - drawn < FRAME_MS - 2) {
      if (visible) frameId = requestAnimationFrame(frame);
      return;
    }
    drawn = now;
    const t = reduce ? 0 : (now - start) / 1000;
    ctx.clearRect(0, 0, W, H);
    // 첫 화면이 사라지는 동안 서서히 나타난다
    const fade = Math.min(1, Math.max(0, 1 - (heroBottom() - H * 0.3) / (H * 0.7)));
    if (fade <= 0) {
      if (visible && !reduce) frameId = requestAnimationFrame(frame);
      return;
    }
    ctx.globalAlpha = colors.alpha;

    const depth = new Float32Array(N);
    nodes.forEach((n, i) => {
      const [x, y, d] = MODES[mode](n, i, t);
      n.tx = x;
      n.ty = y;
      depth[i] = d;
      const k = reduce ? 1 : 0.035;
      n.x += (n.tx + Math.sin(t * 0.6 + n.phase) * 6 - n.x) * k;
      n.y += (n.ty + Math.cos(t * 0.5 + n.phase) * 6 - n.y) * k;
    });

    guide(t, fade);

    // 가까운 노드끼리 잇는다 (멀수록 옅게). 선마다 긋지 않고 밝기 네 단계로 묶어 네 번만 긋는다
    const maxD = Math.min(W, H) * (mode === "globe" ? 0.11 : 0.14);
    const maxD2 = maxD * maxD;
    const linkList = [];
    const tiers = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 > maxD2) continue;
        linkList.push([i, j]);
        const strength = (1 - Math.sqrt(d2) / maxD) * Math.min(depth[i], depth[j]);
        const path = tiers[Math.min(3, Math.floor(strength * 4))];
        path.moveTo(nodes[i].x, nodes[i].y);
        path.lineTo(nodes[j].x, nodes[j].y);
      }
    }
    ctx.lineWidth = 1;
    tiers.forEach((path, i) => {
      ctx.strokeStyle = `rgba(${colors.link}, ${(0.14 * fade * (i + 0.5)) / 4})`;
      ctx.stroke(path);
    });

    // 노드: 마우스 가까이에서 밝아진다
    nodes.forEach((n, i) => {
      const near = Math.max(0, 1 - Math.hypot(n.x - pointer.x, n.y - pointer.y) / 160);
      const a = (0.16 + 0.34 * depth[i] + near * 0.5) * fade;
      ctx.fillStyle = `rgba(${colors.node}, ${a})`;
      const s = n.size * (1 + near);
      ctx.fillRect(n.x - s, n.y - s, s * 2, s * 2);
    });

    // 연결선을 따라 오가는 신호
    if (linkList.length && !reduce) {
      pulses.forEach((p) => {
        p.t += 0.024;
        if (p.t > 1 || !nodes[p.a] || Math.hypot(nodes[p.a].x - nodes[p.b].x, nodes[p.a].y - nodes[p.b].y) > maxD * 1.2) {
          const [a, b] = linkList[Math.floor(Math.random() * linkList.length)];
          Object.assign(p, { a, b, t: 0 });
        }
        const x = lerp(nodes[p.a].x, nodes[p.b].x, p.t);
        const y = lerp(nodes[p.a].y, nodes[p.b].y, p.t);
        ctx.fillStyle = `rgba(${colors.node}, ${0.9 * fade * Math.sin(p.t * Math.PI)})`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 동작 줄이기: 모양이 자리 잡을 때까지만 다시 그린다
    if (reduce) {
      if (settle-- > 0) frameId = requestAnimationFrame(frame);
      return;
    }
    if (visible) frameId = requestAnimationFrame(frame);
  }

  const play = () => {
    settle = 2;
    if (!frameId) frameId = requestAnimationFrame(frame);
  };

  // 화면 가운데에 걸친 섹션을 보고 모양을 고른다
  const sections = [...document.querySelectorAll("main section[id]")];
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          mode = SECTION_MODE[entry.target.id] ?? "globe";
          play();
        }
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  sections.forEach((s) => sectionObserver.observe(s));

  // 첫 화면 아래가 보일 때만 움직인다
  addEventListener("scroll", () => {
    const wasVisible = visible;
    visible = !document.hidden && heroBottom() < H;
    if (visible && !wasVisible) play();
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden && heroBottom() < H;
    if (visible) play();
  });

  const retheme = () => {
    colors = palette();
    play();
  };
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", retheme);

  addEventListener("resize", () => {
    resize();
    play();
  });
  resize();
  // 글꼴 · 내용이 늦게 들어와 첫 화면 길이가 바뀔 수 있으니 한 번 더 잰다
  addEventListener("load", resize);
  new ResizeObserver(resize).observe(document.body);
  visible = heroBottom() < H;
  play();
})();
