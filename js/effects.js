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

  /* ── 돋보기: 커서 자리의 페이지를 확대해서 보여 준다 ──
   * 페이지를 한 벌 복제해 렌즈 안에 크게 놓고, 커서 위치에 맞춰 옮긴다.
   * 렌즈 광학 효과(가장자리 볼록 왜곡 · 색수차)는 SVG 필터, 유리 반사는 CSS로 그린다. */
  const LENS = 150; // 렌즈 지름(px)
  const ZOOM = 1.8; // 확대 배율
  const BULGE = 14; // 가장자리가 부풀어 보이는 정도(px)
  const HOVERABLE = "a, button, summary, label, select, [data-cursor]";
  const NO_LENS = "input, textarea, [contenteditable], iframe";

  // 렌즈 가장자리로 갈수록 가운데 쪽을 끌어와 볼록하게 보이게 하는 변위 지도
  function displacementMap(size) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const image = ctx.createImageData(size, size);
    const r = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5 - r) / r;
        const dy = (y + 0.5 - r) / r;
        const d2 = dx * dx + dy * dy;
        const k = d2 < 1 ? d2 * d2 : 0;
        const i = (y * size + x) * 4;
        image.data[i] = 128 - dx * k * 127;
        image.data[i + 1] = 128 - dy * k * 127;
        image.data[i + 2] = 128;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL();
  }

  // 빨강 · 초록 · 파랑을 조금씩 다르게 휘게 해서 렌즈 가장자리에 색 번짐(색수차)을 만든다
  function addLensFilter() {
    const map = displacementMap(LENS);
    const channel = (name, scale, matrix) => `
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d${name}" />
      <feColorMatrix in="d${name}" type="matrix" values="${matrix}" result="${name}" />`;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
        <filter id="lens-optics" x="0" y="0" width="${LENS}" height="${LENS}" filterUnits="userSpaceOnUse"
                primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feImage href="${map}" x="0" y="0" width="${LENS}" height="${LENS}" preserveAspectRatio="none" result="map" />
          ${channel("r", BULGE * 2.15, "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0")}
          ${channel("g", BULGE * 2, "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0")}
          ${channel("b", BULGE * 1.85, "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0")}
          <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg" />
          <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" />
        </filter>
      </svg>`;
    document.body.append(wrap.firstElementChild);
  }

  function setupMagnifier() {
    if (!animated) return;
    const pageSources = [...document.querySelectorAll("main, .site-footer")];
    const fixedSources = [...document.querySelectorAll(".site-nav")];
    if (!pageSources.length) return;

    addLensFilter();
    const lens = document.createElement("div");
    lens.className = "magnifier";
    lens.setAttribute("aria-hidden", "true");
    lens.style.setProperty("--lens", `${LENS}px`);
    lens.innerHTML = `
      <div class="magnifier-glass">
        <div class="magnifier-page"></div>
        <div class="magnifier-fixed"></div>
      </div>
      <div class="magnifier-shine"></div>
      <div class="magnifier-handle"></div>`;
    lens.inert = true;
    document.body.append(lens);
    const pageLayer = lens.querySelector(".magnifier-page");
    const fixedLayer = lens.querySelector(".magnifier-fixed");

    let canvasPairs = [];
    let stale = true;

    // 원본을 복제한다. 영상은 두 번 불러오지 않게 빈 상자로 바꾸고, 캔버스는 매 프레임 그림을 옮긴다
    function cloneInto(layer, sources) {
      const frag = document.createDocumentFragment();
      sources.forEach((source) => {
        const copy = source.cloneNode(true);
        copy.querySelectorAll("iframe, video").forEach((el) => {
          const box = document.createElement("div");
          box.className = el.className;
          el.replaceWith(box);
        });
        copy.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-visible"));
        const originals = source.querySelectorAll("canvas");
        copy.querySelectorAll("canvas").forEach((c, i) => canvasPairs.push([originals[i], c]));
        frag.append(copy);
      });
      layer.replaceChildren(frag);
    }

    function rebuild() {
      canvasPairs = [];
      const width = `${document.documentElement.clientWidth}px`;
      pageLayer.style.width = width;
      fixedLayer.style.width = width;
      fixedLayer.style.height = `${innerHeight}px`;
      cloneInto(pageLayer, pageSources);
      cloneInto(fixedLayer, fixedSources);
      stale = false;
    }

    let mx = 0, my = 0, frame = 0, mutationTimer = 0;
    const render = () => {
      frame = 0;
      if (stale) rebuild();
      const half = LENS / 2;
      lens.style.transform = `translate3d(${mx - half}px, ${my - half}px, 0)`;
      pageLayer.style.transform = `translate3d(${half - (mx + scrollX) * ZOOM}px, ${half - (my + scrollY) * ZOOM}px, 0) scale(${ZOOM})`;
      fixedLayer.style.transform = `translate3d(${half - mx * ZOOM}px, ${half - my * ZOOM}px, 0) scale(${ZOOM})`;
      canvasPairs.forEach(([from, to]) => {
        if (!from || !from.width) return;
        const r = from.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        const ctx = to.getContext("2d");
        ctx.clearRect(0, 0, to.width, to.height);
        ctx.drawImage(from, 0, 0);
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const show = (on) => lens.classList.toggle("is-visible", on);

    // 페이지 내용이 바뀌면 잠시 뒤 다시 복제한다
    // (마우스 효과용 style 변경과, 렌즈 자신 안에서 생긴 변화는 무시)
    new MutationObserver((records) => {
      if (records.every((r) => lens.contains(r.target))) return;
      clearTimeout(mutationTimer);
      mutationTimer = setTimeout(() => {
        stale = true;
        if (lens.classList.contains("is-visible")) schedule();
      }, 250);
    }).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "open", "hidden", "src", "aria-pressed", "aria-current", "data-status", "value"],
    });

    addEventListener("resize", () => {
      stale = true;
      schedule();
    });
    addEventListener("scroll", schedule, { passive: true });

    document.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        mx = e.clientX;
        my = e.clientY;
        const target = e.target.closest?.(NO_LENS);
        show(!target);
        lens.classList.toggle("is-hover", Boolean(e.target.closest?.(HOVERABLE)));
        schedule();
      },
      { passive: true }
    );
    document.addEventListener("pointerdown", () => lens.classList.add("is-down"));
    document.addEventListener("pointerup", () => lens.classList.remove("is-down"));
    document.addEventListener("mouseout", (e) => {
      if (!e.relatedTarget || e.relatedTarget.tagName === "IFRAME") show(false);
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
  setupMagnifier();
  setupTilt();
  setupMagnetic();
  setupDotGrid();
})();
