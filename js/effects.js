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

  /* ── 돋보기: 커서 자리의 페이지를 진짜 렌즈처럼 확대해 보여 준다 (지구본이 있는 홈에서만) ──
   * 렌즈 모양은 그림이 아니라 광선 추적으로 계산한다.
   *  - 렌즈: 지름 160px 평볼록 렌즈. 윗면은 곡률반지름 100px 구면, 아랫면은 평면.
   *  - 유리: Schott F2 플린트 유리. 빨강(C선 656nm) · 초록(e선 546nm) · 파랑(F선 486nm)의 굴절률이 달라서
   *    가장자리에 색 번짐(분산)이 생기고, 파랑이 가장 많이 꺾인다.
   *  - 눈은 화면 정면에서 내려다본다. 시선이 윗면에서 꺾이고(스넬 법칙) 아랫면에서 한 번 더 꺾여 종이에 닿는 자리를 보여 준다.
   *    렌즈와 종이 사이 거리는 가운데 배율이 1.75배가 되도록 정한다. 가장자리로 갈수록 배율이 조금씩 커진다(실패형 왜곡).
   *  - 유리 면의 반사(프레넬 식)는 가장자리로 갈수록 세지고, 반사 방지 코팅이 정면 반사를 줄인다.
   *    반사에는 위-왼쪽 조명이 비치고, 같은 조명이 오른쪽 아래로 옅은 그림자를 드리운다.
   * 페이지를 한 벌 복제해 렌즈 안에 배율만큼 크게 놓고, 남은 굴절은 SVG 변위 필터로 채널마다 입힌다.
   * 렌즈가 커서 노릇을 하므로 렌즈가 떠 있는 동안 마우스 커서는 숨긴다. */
  const LENS = 160; // 렌즈 지름(px)
  const OPTICS = {
    curvature: 100, // 윗면 곡률반지름(px)
    edge: 3, // 가장자리 두께(px)
    magnification: 1.75, // 가운데 배율
    glass: [1.61503, 1.62408, 1.63208], // 빨강 · 초록 · 파랑 굴절률 (Schott F2)
    coating: 0.8, // 반사 방지 코팅이 정면 반사를 줄이는 비율
    light: [-0.45, -0.6, 0.66], // 조명 방향 (위-왼쪽 앞)
  };
  const HOVERABLE = "a, button, summary, label, select, [data-cursor]";
  const NO_LENS = "input, textarea, [contenteditable], iframe";

  // 렌즈 축을 지나는 단면(가로 r, 세로 z)에서의 굴절. v: 나아가는 방향, n: 빛이 들어오는 쪽 법선, eta = n1 / n2
  function refract([vx, vz], [nx, nz], eta) {
    const cosi = -(vx * nx + vz * nz);
    const k = 1 - eta * eta * (1 - cosi * cosi);
    if (k < 0) return null; // 전반사
    const c = eta * cosi - Math.sqrt(k);
    return [eta * vx + c * nx, eta * vz + c * nz];
  }

  // 프레넬 반사율 (편광되지 않은 빛)
  function fresnel(cosi, n1, n2) {
    const sint = (n1 / n2) * Math.sqrt(Math.max(0, 1 - cosi * cosi));
    if (sint >= 1) return 1;
    const cost = Math.sqrt(1 - sint * sint);
    const rs = ((n1 * cosi - n2 * cost) / (n1 * cosi + n2 * cost)) ** 2;
    const rp = ((n1 * cost - n2 * cosi) / (n1 * cost + n2 * cosi)) ** 2;
    return (rs + rp) / 2;
  }

  // 렌즈 위 반지름 r 자리를 내려다보는 시선이 종이에 닿는 반지름(rho)과, 유리를 지나는 빛의 비율(T) · 윗면 반사율(R)
  function traceRay(r, gap, n) {
    const a = LENS / 2;
    const R = OPTICS.curvature;
    const top = OPTICS.edge + Math.sqrt(R * R - r * r) - Math.sqrt(R * R - a * a); // 아랫면에서 윗면까지 높이
    const normal = [r / R, Math.sqrt(R * R - r * r) / R];
    const inGlass = refract([0, -1], normal, 1 / n);
    const x = r + (top / -inGlass[1]) * inGlass[0];
    const out = refract(inGlass, [0, 1], n);
    const r0 = fresnel(1, 1, n) * OPTICS.coating;
    const r1 = Math.max(0, fresnel(normal[1], 1, n) - r0);
    if (!out) return { rho: NaN, T: 0, R: r1, normal };
    const r2 = Math.max(0, fresnel(-inGlass[1], n, 1) - r0);
    return { rho: x + (gap / -out[1]) * out[0], T: (1 - r1) * (1 - r2), R: r1, normal };
  }

  // 가운데 배율이 magnification이 되는 렌즈-종이 거리 (초점 거리 안쪽에서 이분법)
  function solveGap(n) {
    const eps = 0.01;
    let lo = 0, hi = 5000;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (traceRay(eps, mid, n).rho > 0) lo = mid;
      else hi = mid;
    }
    hi = lo * 0.999;
    lo = 0;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (eps / traceRay(eps, mid, n).rho < OPTICS.magnification) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  // 반지름별 결과를 표로 만들어 두고, 화소마다 표를 읽어 지도 그림을 만든다
  function buildOptics() {
    const a = LENS / 2;
    const M = OPTICS.magnification;
    const gap = solveGap(OPTICS.glass[1]);
    const STEPS = 400;
    const table = OPTICS.glass.map((n) =>
      Array.from({ length: STEPS + 1 }, (_, i) => traceRay(Math.max(1e-3, (a * i) / STEPS), gap, n))
    );
    const at = (c, r) => table[c][Math.min(STEPS, Math.round((r / a) * STEPS))];

    const k = Math.min(2, window.devicePixelRatio || 1); // 레티나 화면에서는 2배로
    const size = Math.round(LENS * k);
    const offsets = [0, 1, 2].map(() => new Float32Array(size * size * 2));
    let reach = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const qx = (x + 0.5) / k - a;
        const qy = (y + 0.5) / k - a;
        const r = Math.hypot(qx, qy);
        if (r >= a) continue;
        for (let c = 0; c < 3; c++) {
          const { rho } = at(c, r);
          // 페이지 복제본은 이미 M배로 커져 있으니, 렌즈가 더 꺾는 만큼만 옮긴다
          const f = Number.isNaN(rho) ? 0 : (M * rho) / Math.max(r, 1e-6) - 1;
          const i = (y * size + x) * 2;
          offsets[c][i] = f * qx;
          offsets[c][i + 1] = f * qy;
          reach = Math.max(reach, Math.abs(f * qx), Math.abs(f * qy));
        }
      }
    }
    const scale = reach * 2 + 1;
    const toImage = (paint) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      const img = ctx.createImageData(size, size);
      paint(img.data);
      ctx.putImageData(img, 0, 0);
      return canvas.toDataURL();
    };
    // 변위 지도: 빨강 = 가로, 초록 = 세로 (0.5가 그대로)
    const maps = offsets.map((o) =>
      toImage((px) => {
        for (let i = 0, j = 0; i < o.length; i += 2, j += 4) {
          px[j] = Math.round((0.5 + o[i] / scale) * 255);
          px[j + 1] = Math.round((0.5 + o[i + 1] / scale) * 255);
          px[j + 2] = 128;
          px[j + 3] = 255;
        }
      })
    );

    // 빛이 유리를 지나며 줄어드는 만큼 어둡게(흡수 층), 유리 면에 비친 조명은 밝게(반사 층)
    const [lx, ly, lz] = OPTICS.light.map((v, _, l) => v / Math.hypot(...l));
    const edgeLine = (r) => clamp(1 - Math.abs(r - (a - 0.9)) / 0.9, 0, 1); // 연마한 가장자리
    const pixel = (paint) =>
      toImage((px) => {
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const qx = (x + 0.5) / k - a;
            const qy = (y + 0.5) / k - a;
            const r = Math.hypot(qx, qy);
            const cover = clamp(a - r, 0, 1); // 렌즈 테두리를 부드럽게
            if (!cover) continue;
            paint(px, (y * size + x) * 4, qx, qy, r, cover);
          }
        }
      });
    const absorb = pixel((px, j, qx, qy, r, cover) => {
      const { T } = at(1, r);
      px[j + 3] = Math.round(clamp(1 - T + edgeLine(r) * 0.35, 0, 1) * cover * 255);
    });
    const reflect = pixel((px, j, qx, qy, r, cover) => {
      const { R, normal } = at(1, r);
      // 3차원 법선 → 시선(아래 방향)이 반사된 방향 → 그 방향에서 오는 조명
      const ux = r ? qx / r : 0;
      const uy = r ? qy / r : 0;
      const nx = normal[0] * ux, ny = normal[0] * uy, nz = normal[1];
      const rx = 2 * nz * nx, ry = 2 * nz * ny, rz = 2 * nz * nz - 1;
      const key = Math.max(0, rx * lx + ry * ly + rz * lz) ** 80 * 8;
      const sky = 0.1 + 0.5 * Math.max(0, rz) ** 3;
      const v = clamp((R * (sky + key) + edgeLine(r) * 0.25) * cover, 0, 1) * 255;
      px[j] = px[j + 1] = px[j + 2] = Math.round(v);
      px[j + 3] = 255;
    });
    return { maps, scale, absorb, reflect, size };
  }

  // 렌즈 굴절 필터: 빨강 · 초록 · 파랑을 각자의 굴절률로 따로 꺾은 뒤 합친다
  function addLensFilter(optics) {
    const channel = (c, name, matrix) => `
      <feImage href="${optics.maps[c]}" x="0" y="0" width="${LENS}" height="${LENS}" preserveAspectRatio="none" result="m${name}" />
      <feDisplacementMap in="SourceGraphic" in2="m${name}" scale="${optics.scale.toFixed(3)}" xChannelSelector="R" yChannelSelector="G" result="d${name}" />
      <feColorMatrix in="d${name}" type="matrix" values="${matrix}" result="${name}" />`;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
        <filter id="lens-optics" x="0" y="0" width="${LENS}" height="${LENS}" filterUnits="userSpaceOnUse"
                primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          ${channel(0, "r", "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0")}
          ${channel(1, "g", "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0")}
          ${channel(2, "b", "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0")}
          <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg" />
          <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" />
        </filter>
      </svg>`;
    document.body.append(wrap.firstElementChild);
  }

  function setupMagnifier() {
    if (!animated || document.body.dataset.page !== "home") return;
    const pageSources = [...document.querySelectorAll("main, .site-footer")];
    const fixedSources = [...document.querySelectorAll(".site-nav")];
    if (!pageSources.length) return;

    const optics = buildOptics();
    const ZOOM = OPTICS.magnification;
    addLensFilter(optics);
    const lens = document.createElement("div");
    lens.className = "magnifier";
    lens.setAttribute("aria-hidden", "true");
    lens.style.setProperty("--lens", `${LENS}px`);
    lens.innerHTML = `
      <div class="magnifier-shadow"></div>
      <div class="magnifier-glass">
        <div class="magnifier-page"></div>
        <div class="magnifier-fixed"></div>
      </div>
      <div class="magnifier-absorb"></div>
      <div class="magnifier-reflect"></div>`;
    lens.querySelector(".magnifier-absorb").style.backgroundImage = `url(${optics.absorb})`;
    lens.querySelector(".magnifier-reflect").style.backgroundImage = `url(${optics.reflect})`;
    lens.inert = true;
    document.body.append(lens);
    const pageLayer = lens.querySelector(".magnifier-page");
    const fixedLayer = lens.querySelector(".magnifier-fixed");

    let canvasPairs = [];
    let stickyPairs = [];
    let livePairs = [];
    let stale = true;

    // 원본을 복제한다. 영상은 두 번 불러오지 않게 빈 상자로 바꾸고, 캔버스는 렌즈 아래 조각만 그림을 옮긴다
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
        copy.querySelectorAll(".hero-stage").forEach((el) => el.classList.add("is-ready"));
        const originals = source.querySelectorAll("canvas");
        copy.querySelectorAll("canvas").forEach((c, i) => canvasPairs.push([originals[i], c]));
        frag.append(copy);
      });
      layer.replaceChildren(frag);
    }

    // 첫 화면 스크립트가 매 프레임 바꾸는 글 · 진행 막대(style)와 장면 번호(data-chapter)는 복제본에도 옮겨 준다
    // (무대 자체의 style은 위에서 붙어 있는 위치를 맞추느라 쓰므로 건드리지 않는다)
    const LIVE = ["hero-copy", "hero-progress", "hero-chart-label", "hero-hint"];
    let chapterPair = [];

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
      livePairs = LIVE.map((id) => [document.getElementById(id), pageLayer.querySelector(`#${id}`)]).filter(([a, b]) => a && b);
      chapterPair = [document.getElementById("hero-stage"), pageLayer.querySelector("#hero-stage")];
      stale = false;
    }

    let mx = 0, my = 0, frame = 0, mutationTimer = 0, scrollTimer = 0;
    const render = () => {
      frame = 0;
      if (lens.classList.contains("is-scrolling")) return;
      if (stale) rebuild();
      // 먼저 위치를 모두 읽고 나서 쓴다 (레이아웃 계산이 한 번만 일어나게)
      const sticky = stickyPairs.map(([from]) => from.getBoundingClientRect().top - from.parentElement.getBoundingClientRect().top);
      const rects = canvasPairs.map(([from]) => (from && from.width ? from.getBoundingClientRect() : null));

      const half = LENS / 2;
      lens.style.transform = `translate3d(${mx - half}px, ${my - half}px, 0)`;
      pageLayer.style.transform = `translate3d(${half - (mx + scrollX) * ZOOM}px, ${half - (my + scrollY) * ZOOM}px, 0) scale(${ZOOM})`;
      fixedLayer.style.transform = `translate3d(${half - mx * ZOOM}px, ${half - my * ZOOM}px, 0) scale(${ZOOM})`;
      stickyPairs.forEach(([, to], i) => {
        if (to) to.style.transform = `translateY(${sticky[i]}px)`;
      });
      livePairs.forEach(([from, to]) => {
        if (to.style.cssText !== from.style.cssText) to.style.cssText = from.style.cssText;
      });
      const [stageFrom, stageTo] = chapterPair;
      if (stageFrom && stageTo && stageTo.dataset.chapter !== stageFrom.dataset.chapter) stageTo.dataset.chapter = stageFrom.dataset.chapter ?? "";

      // 캔버스는 렌즈가 덮는 조각만 옮긴다 (예전에는 화면 전체 크기 그림을 매번 통째로 복사했다)
      let live = false;
      canvasPairs.forEach(([from, to], i) => {
        const r = rects[i];
        if (!r || r.bottom < my - half || r.top > my + half || r.right < mx - half || r.left > mx + half) return;
        if (to.width !== from.width || to.height !== from.height) {
          to.width = from.width;
          to.height = from.height;
        }
        const k = from.width / r.width; // 캔버스 픽셀 ÷ 화면 px
        const reach = half / ZOOM + 24; // 렌즈에 비치는 범위 + 굴절로 끌려오는 여유
        const sx = Math.max(0, Math.floor((mx - r.left - reach) * k));
        const sy = Math.max(0, Math.floor((my - r.top - reach) * k));
        const sw = Math.min(from.width - sx, Math.ceil(reach * 2 * k));
        const sh = Math.min(from.height - sy, Math.ceil(reach * 2 * k));
        if (sw <= 0 || sh <= 0) return;
        const g = to.getContext("2d");
        g.clearRect(sx, sy, sw, sh);
        g.drawImage(from, sx, sy, sw, sh, sx, sy, sw, sh);
        live = true;
      });
      // 렌즈가 움직이는 그림(지구본) 위에 있으면 마우스가 멈춰 있어도 계속 따라 그린다
      if (live && lens.classList.contains("is-visible")) schedule();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const show = (on) => {
      lens.classList.toggle("is-visible", on);
      document.documentElement.classList.toggle("lens-on", on);
    };

    // 페이지 내용이 바뀌면 잠시 뒤 다시 복제한다
    // (등장 효과처럼 class만 바뀌는 것, 마우스 효과용 style, 렌즈 자신 안의 변화는 무시한다)
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
      attributeFilter: ["open", "hidden", "src", "aria-pressed", "aria-current", "data-status", "value"],
    });

    addEventListener("resize", () => {
      stale = true;
      schedule();
    });
    // 스크롤하는 동안에는 렌즈를 잠깐 감춘다 (스크롤마다 렌즈 속 페이지를 다시 그리지 않게)
    addEventListener(
      "scroll",
      () => {
        if (!lens.classList.contains("is-visible")) return;
        lens.classList.add("is-scrolling");
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          lens.classList.remove("is-scrolling");
          schedule();
        }, 160);
      },
      { passive: true }
    );

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
