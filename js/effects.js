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
    let stickyPairs = [];
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
      const stickyCopies = pageLayer.querySelectorAll("[data-lens-sticky]");
      stickyPairs = [...document.querySelectorAll("main [data-lens-sticky]")].map((el, i) => [el, stickyCopies[i]]);
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
      stickyPairs.forEach(([from, to]) => {
        if (to) to.style.transform = `translateY(${from.getBoundingClientRect().top - from.parentElement.getBoundingClientRect().top}px)`;
      });
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

  setupSpotlight();
  setupMagnifier();
  setupMagnetic();
})();
