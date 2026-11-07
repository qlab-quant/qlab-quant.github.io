// 마우스를 따라 움직이는 장식 효과. 모양은 css/style.css의 '인터랙션' 부분에 있습니다.
// 터치 기기에서는 마우스 전용 효과가 꺼지고, '동작 줄이기' 설정이면 움직이는 효과가 모두 꺼집니다.
(function () {
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animated = finePointer && !reduceMotion;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ── 카드 스포트라이트: 마우스 위치를 CSS 변수(--mx, --my)로 넘긴다 ── */
  function setupSpotlight() {
    if (!finePointer) return;
    document.addEventListener(
      "pointermove",
      (e) => {
        const card = e.target.closest?.(".spotlight");
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      },
      { passive: true }
    );
  }

  /* ── 커서를 따라다니는 링 ── */
  const HOVERABLE = "a, button, summary, label, input, textarea, select, [data-cursor]";

  function setupCursor() {
    if (!animated) return;
    const cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML = '<div class="cursor-ring"></div>';
    document.body.append(cursor);

    let x = 0, y = 0, cx = 0, cy = 0, frame = 0;
    const tick = () => {
      cx = lerp(cx, x, 0.22);
      cy = lerp(cy, y, 0.22);
      cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      frame = Math.abs(cx - x) + Math.abs(cy - y) > 0.1 ? requestAnimationFrame(tick) : 0;
    };

    document.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        x = e.clientX;
        y = e.clientY;
        if (!cursor.classList.contains("is-visible")) {
          cx = x;
          cy = y;
          cursor.classList.add("is-visible");
        }
        cursor.classList.toggle("is-hover", Boolean(e.target.closest?.(HOVERABLE)));
        if (!frame) frame = requestAnimationFrame(tick);
      },
      { passive: true }
    );
    document.addEventListener("pointerdown", () => cursor.classList.add("is-down"));
    document.addEventListener("pointerup", () => cursor.classList.remove("is-down"));
    document.addEventListener("mouseout", (e) => {
      if (!e.relatedTarget) cursor.classList.remove("is-visible");
    });
  }

  /* ── 대시보드 카드 기울기: 히어로 안에서 마우스 쪽으로 기운다 ── */
  function setupTilt() {
    if (!animated) return;
    const hero = document.querySelector(".hero");
    const card = document.querySelector(".hero-visual");
    if (!hero || !card) return;

    hero.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - (r.left + r.width / 2)) / r.width;
      const py = (e.clientY - (r.top + r.height / 2)) / r.height;
      card.style.setProperty("--ry", `${clamp(px, -1, 1) * 6}deg`);
      card.style.setProperty("--rx", `${clamp(-py, -1, 1) * 4}deg`);
    });
    hero.addEventListener("pointerleave", () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  }

  /* ── 자석 버튼: data-magnetic이 붙은 버튼이 마우스 쪽으로 끌려온다 ── */
  function setupMagnetic() {
    if (!animated) return;
    document.querySelectorAll("[data-magnetic]").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        btn.style.setProperty("--tx", `${(e.clientX - r.left - r.width / 2) * 0.3}px`);
        btn.style.setProperty("--ty", `${(e.clientY - r.top - r.height / 2) * 0.4}px`);
      });
      btn.addEventListener("pointerleave", () => {
        btn.style.setProperty("--tx", "0px");
        btn.style.setProperty("--ty", "0px");
      });
    });
  }

  /* ── 히어로 점 격자: 마우스 근처 점이 커지고 밝아지며 바깥으로 밀려난다 ── */
  const GAP = 28; // 점 사이 거리(px)
  const RADIUS = 180; // 마우스가 영향을 주는 반경(px)
  const PUSH = 10; // 가장 많이 밀려나는 거리(px)

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function setupDotGrid() {
    const canvas = document.querySelector("#hero-grid");
    if (!canvas) return;
    const hero = canvas.parentElement;
    const ctx = canvas.getContext("2d");

    let width = 0, height = 0, dots = [], colors = null;
    const target = { x: 0, y: 0 };
    const mouse = { x: 0, y: 0 };
    let power = 0, goal = 0, frame = 0;

    const readColors = () => {
      const style = getComputedStyle(document.documentElement);
      colors = {
        base: hexToRgb(style.getPropertyValue("--text").trim()),
        accent: hexToRgb(style.getPropertyValue("--accent").trim()),
      };
    };

    function draw() {
      ctx.clearRect(0, 0, width, height);
      const [br, bg, bb] = colors.base;
      const [ar, ag, ab] = colors.accent;
      for (const [x0, y0] of dots) {
        const dx = x0 - mouse.x;
        const dy = y0 - mouse.y;
        const dist = Math.hypot(dx, dy) || 1;
        const f = power * Math.max(0, 1 - dist / RADIUS);
        const t = f * f * (3 - 2 * f); // 부드럽게(smoothstep)
        const x = x0 + (dx / dist) * PUSH * t;
        const y = y0 + (dy / dist) * PUSH * t;
        ctx.fillStyle = `rgba(${Math.round(lerp(br, ar, t))}, ${Math.round(lerp(bg, ag, t))}, ${Math.round(lerp(bb, ab, t))}, ${lerp(0.14, 1, t)})`;
        ctx.beginPath();
        ctx.arc(x, y, 1 + t * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = hero.clientWidth;
      height = hero.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      const offsetX = (width % GAP) / 2;
      for (let y = GAP / 2; y < height; y += GAP) {
        for (let x = offsetX; x < width; x += GAP) dots.push([x, y]);
      }
      draw();
    }

    // 마우스가 움직이거나 효과가 사라지는 동안에만 그린다
    function loop() {
      power = lerp(power, goal, 0.1);
      mouse.x = lerp(mouse.x, target.x, 0.18);
      mouse.y = lerp(mouse.y, target.y, 0.18);
      draw();
      const settled = Math.abs(power - goal) < 0.005 && Math.abs(mouse.x - target.x) + Math.abs(mouse.y - target.y) < 0.5;
      frame = settled ? 0 : requestAnimationFrame(loop);
    }
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(loop);
    };

    readColors();
    new ResizeObserver(resize).observe(hero);

    // 화면 모드가 바뀌면 점 색도 바꾼다
    const recolor = () => {
      readColors();
      draw();
    };
    new MutationObserver(recolor).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", recolor);

    if (!animated) return;
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
      if (power < 0.01) {
        mouse.x = target.x;
        mouse.y = target.y;
      }
      goal = 1;
      kick();
    });
    hero.addEventListener("pointerleave", () => {
      goal = 0;
      kick();
    });
  }

  setupSpotlight();
  setupCursor();
  setupTilt();
  setupMagnetic();
  setupDotGrid();
})();
