// 홈페이지 렌더링. 공용 함수와 내비게이션 · 푸터는 common.js에 있습니다.
// 내용은 관리 페이지(admin.html)나 js/data.js에서 수정하세요.

let DATA;

// 모집 · 공지는 따로 페이지가 생겼다. 예전 주소(#recruit, #notice)로 들어오면 그쪽으로 보낸다
const MOVED_SECTIONS = { "#recruit": "recruit.html", "#notice": "notice.html" };
if (MOVED_SECTIONS[location.hash]) location.replace(pageUrl(MOVED_SECTIONS[location.hash]));

/* ── 텍스트 바인딩 ── */
function renderBindings() {
  const values = {
    tagline: DATA.site.tagline,
    description: DATA.site.description,
    fullName: DATA.site.fullName,
    university: DATA.site.university,
    memberTerm: DATA.membersTerm,
  };
  document.querySelectorAll("[data-bind]").forEach((el) => {
    el.innerHTML = multiline(values[el.dataset.bind] ?? "");
  });
}

/* ── 첫 화면 헤드라인: 줄마다 감싸 두면 CSS가 한 줄씩 아래에서 올라오게 한다 ── */
function renderHeadline() {
  const text = DATA.site.headline || "From Equation\nto Execution.";
  $("#hero-headline").innerHTML = text
    .split("\n")
    .map((line, i) => `<span class="line" style="--i: ${i}"><span class="line-inner">${esc(line)}</span></span>`)
    .join("");
  // 글꼴이 도착한 뒤에 등장시킨다 (글꼴이 바뀌며 글자가 튀는 것을 막는다)
  const stage = $("#hero-stage");
  const ready = () => stage.classList.add("is-ready");
  document.fonts?.ready.then(ready);
  setTimeout(ready, 1200);
}

/* ── 첫 화면 아래를 흐르는 수식 띠 ── */
const TICKER = [
  "E[Rₚ] = Σ wᵢ μᵢ", "σ²ₚ = w′Σw", "dS = μS dt + σS dW", "Sharpe = (μ − r_f) / σ", "VaR₉₅ = μ − 1.645σ",
  "β = Cov(Rᵢ, Rₘ) / Var(Rₘ)", "argmax w′μ − λ·w′Σw", "MDD = max(peak − trough) / peak", "f* = μ / σ²",
  "ρ = Cov(X, Y) / σₓσᵧ", "rₜ = ln(Sₜ / Sₜ₋₁)", "C = S·N(d₁) − K·e^(−rT)·N(d₂)", "ŷ = Xβ̂ + ε",
];

function renderTicker() {
  const items = TICKER.map((t) => `<span>${esc(t)}</span>`).join("");
  $("#ticker-track").innerHTML = items + items; // 두 벌을 이어 붙여 끊김 없이 돈다
}

/* ── 통계: 숫자로 시작하는 값은 화면에 들어올 때 0부터 올라간다 ── */
function renderStats() {
  const list = $("#stats");
  list.innerHTML = (DATA.site.stats ?? [])
    .map((s) => `<div class="stat"><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`)
    .join("");
  if (reduceMotion || !("IntersectionObserver" in window)) return;
  list.querySelectorAll("dd").forEach((dd) => {
    const match = dd.textContent.match(/^(\d[\d,]*)(.*)$/);
    if (!match) return;
    const target = Number(match[1].replace(/,/g, ""));
    const suffix = match[2];
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / 1400);
        const eased = 1 - Math.pow(1 - t, 4);
        dd.textContent = `${Math.round(target * eased).toLocaleString("ko-KR")}${suffix}`;
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(dd);
  });
}

/* ── 큰 문구: 스크롤 진행에 맞춰 단어를 읽는 순서대로 하나씩 켠다 ── */
function renderTagline() {
  const el = $("#tagline");
  const text = DATA.site.manifesto || DATA.site.tagline || "";
  el.innerHTML = text
    .split("\n")
    .map((line) => line.split(/\s+/).filter(Boolean).map((w) => `<span class="word">${esc(w)}</span>`).join(" "))
    .join("<br>");

  const words = [...el.querySelectorAll(".word")];
  if (reduceMotion) {
    words.forEach((w) => w.classList.add("is-on"));
    return;
  }

  let ticking = false;
  const update = () => {
    ticking = false;
    const rect = el.getBoundingClientRect();
    // 문단 윗부분이 화면 80% 지점에 오면 시작, 아랫부분이 35% 지점을 지나면 모두 켜짐
    const start = innerHeight * 0.8;
    const end = innerHeight * 0.35;
    const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end + rect.height)));
    const count = Math.round(progress * words.length);
    words.forEach((w, i) => w.classList.toggle("is-on", i < count));
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  update();
}

/* ── 소개: 첫 문단은 크게, 원칙은 번호 붙은 카드로 ── */
const VALUE_ICONS = ["research", "engineering", "practice", "network", "candles"];

function renderAbout() {
  $("#about-body").innerHTML = (DATA.about.paragraphs ?? []).map((p) => `<p>${multiline(p)}</p>`).join("");
  $("#values").innerHTML = listHtml(DATA.about.values, (v, i) => `
    <li class="principle spotlight" style="--i: ${i}">
      <div class="principle-head">
        <span class="principle-num">P.${pad2(i + 1)}</span>
        <span class="principle-icon">${icon(VALUE_ICONS[i % VALUE_ICONS.length])}</span>
      </div>
      <h3>${esc(v.title)}</h3>
      <p>${esc(v.desc)}</p>
    </li>`);
}

/* ── 활동: 한 학기의 흐름을 레일 위 정거장처럼 ── */
function renderActivities() {
  $("#activity-list").innerHTML = listHtml(DATA.activities, (a, i) => `
    <li class="process-step spotlight" style="--i: ${i}">
      <span class="process-node" aria-hidden="true"></span>
      <div class="process-meta">
        <span class="process-num">${pad2(i + 1)}</span>
        <span class="process-cycle">${esc(a.cycle)}</span>
      </div>
      <h3>${esc(a.title)}</h3>
      <p>${esc(a.desc)}</p>
    </li>`);
}

/* ── 프로젝트: 미리보기 차트 + 요약 + 검증 포인트 ──
 * 차트는 프로젝트 성격에 맞는 모양을 제목으로 정한 씨앗값으로 그리는 '예시'다 (실제 성과 수치가 아니다).
 * 모양은 관리 페이지에서 고를 수 있고, 비워 두면 태그와 제목을 보고 정한다. */
const CHART_KINDS = {
  equity: "Backtest",
  spread: "Stat-arb",
  scatter: "Regression",
  volatility: "Risk",
};

function chartKind(p) {
  if (CHART_KINDS[p.chart]) return p.chart;
  const text = `${p.title} ${(p.tags ?? []).join(" ")}`;
  if (/페어|스프레드|공적분|차익|pair/i.test(text)) return "spread";
  if (/감성|NLP|회귀|머신러닝|분류|예측/i.test(text)) return "scatter";
  if (/변동성|자산배분|리스크|위험/i.test(text)) return "volatility";
  return "equity";
}

// 제목으로 정해지는 난수 (같은 프로젝트는 늘 같은 그림)
function seeded(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  let s = (h >>> 0) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function projectChart(p) {
  const kind = chartKind(p);
  const rand = seeded(p.title);
  const W = 320, H = 168, pad = 16;
  const toPath = (ys) => ys.map((y, i) => `${i ? "L" : "M"}${(pad + (i / (ys.length - 1)) * (W - pad * 2)).toFixed(1)} ${y.toFixed(1)}`).join("");
  const norm = (vs, top = 22, bottom = H - 22) => {
    const lo = Math.min(...vs), hi = Math.max(...vs);
    return vs.map((v) => bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top));
  };
  const grid = [0.25, 0.5, 0.75].map((f) => `<line x1="${pad}" x2="${W - pad}" y1="${H * f}" y2="${H * f}" />`).join("");
  let body = "";
  let series = [];
  if (kind === "spread") {
    let z = 0;
    const vs = Array.from({ length: 90 }, () => (z = z * 0.86 + (rand() - 0.5) * 1.2));
    series = norm(vs.map((v) => Math.max(-2.6, Math.min(2.6, v))), 30, H - 30);
    const mid = H / 2, band = (H - 60) * 0.38;
    body = `
      <line class="chart-band" x1="${pad}" x2="${W - pad}" y1="${mid - band}" y2="${mid - band}" />
      <line class="chart-band" x1="${pad}" x2="${W - pad}" y1="${mid + band}" y2="${mid + band}" />
      <line class="chart-zero" x1="${pad}" x2="${W - pad}" y1="${mid}" y2="${mid}" />
      <path class="chart-line" d="${toPath(series)}" pathLength="1" />
      ${series.map((y, i) => (Math.abs(y - mid) > band ? `<circle class="chart-mark" cx="${pad + (i / 89) * (W - pad * 2)}" cy="${y}" r="2.5" />` : "")).join("")}`;
  } else if (kind === "scatter") {
    const pts = Array.from({ length: 46 }, () => {
      const x = rand();
      return [pad + x * (W - pad * 2), H - 26 - x * (H - 70) - (rand() - 0.5) * 56];
    });
    body = `
      ${pts.map(([x, y]) => `<circle class="chart-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" />`).join("")}
      <path class="chart-line" d="M${pad} ${H - 22} L${W - pad} ${H - 22 - (H - 70)}" pathLength="1" />`;
    series = [];
  } else if (kind === "volatility") {
    let v = 0.5;
    const vs = Array.from({ length: 90 }, (_, i) => (v = Math.max(0.1, v + (rand() - 0.5) * 0.12 + (i > 50 && i < 62 ? 0.06 : 0) - (v - 0.45) * 0.05)));
    series = norm(vs, 26, H - 26);
    const target = H * 0.52;
    body = `
      <rect class="chart-target" x="${pad}" y="${target - 12}" width="${W - pad * 2}" height="24" />
      <path class="chart-line" d="${toPath(series)}" pathLength="1" />`;
  } else {
    let e = 0;
    const vs = Array.from({ length: 90 }, (_, i) => (e += 0.06 + (rand() - 0.47) * 0.4 - (i > 52 && i < 60 ? 0.18 : 0)));
    series = norm(vs);
    body = `
      <path class="chart-area" d="${toPath(series)} L${W - pad} ${H} L${pad} ${H} Z" />
      <path class="chart-line" d="${toPath(series)}" pathLength="1" />
      <circle class="chart-end" cx="${W - pad}" cy="${series[series.length - 1].toFixed(1)}" r="3.5" />`;
  }
  return {
    kind,
    series,
    svg: `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <g class="chart-grid">${grid}</g>${body}</svg>`,
  };
}

function renderProjects() {
  $("#project-list").innerHTML = listHtml(DATA.projects, (p, i) => {
    const tags = (p.tags ?? []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
    const points = (p.points ?? []).filter(Boolean);
    const link = safeUrl(p.link);
    const chart = projectChart(p);
    const title = link
      ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(p.title)} ${icon("arrow-up-right")}</a>`
      : esc(p.title);
    return `
      <li class="project-card spotlight" style="--i: ${i}" data-series="${esc(JSON.stringify(chart.series.map((y) => Math.round(y))))}">
        <div class="project-visual" data-kind="${chart.kind}">
          ${chart.svg}
          <span class="project-crosshair" aria-hidden="true"></span>
          <span class="project-visual-tag">${esc(CHART_KINDS[chart.kind])} · illustrative</span>
        </div>
        <div class="project-body">
          <p class="project-meta"><span>${esc(p.period)}</span><span>${String(i + 1).padStart(3, "0")}</span></p>
          <h3>${title}</h3>
          <p class="project-summary">${esc(p.summary)}</p>
          ${points.length ? `<ul class="project-points">${points.map((pt) => `<li>${esc(pt)}</li>`).join("")}</ul>` : ""}
          <div class="project-tags">${tags}</div>
        </div>
      </li>`;
  });
  setupProjectHover();
}

// 프로젝트 차트 위에서 마우스를 움직이면 세로선이 곡선을 따라가고, 차트가 살짝 기운다(시차)
function setupProjectHover() {
  if (!matchMedia("(hover: hover)").matches) return;
  document.querySelectorAll(".project-card").forEach((card) => {
    const visual = card.querySelector(".project-visual");
    const cross = card.querySelector(".project-crosshair");
    const series = JSON.parse(card.dataset.series || "[]");
    card.addEventListener("pointermove", (e) => {
      const r = visual.getBoundingClientRect();
      const fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      card.style.setProperty("--rx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      card.style.setProperty("--ry", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      if (!series.length) return;
      const pad = 16 / 320;
      const idx = Math.round(Math.min(1, Math.max(0, (fx - pad) / (1 - pad * 2))) * (series.length - 1));
      cross.style.setProperty("--cx", `${(pad + (idx / (series.length - 1)) * (1 - pad * 2)) * 100}%`);
      cross.style.setProperty("--cy", `${(series[idx] / 168) * 100}%`);
      cross.classList.add("is-on");
    });
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--rx", "0");
      card.style.setProperty("--ry", "0");
      cross.classList.remove("is-on");
    });
  });
}

/* ── 멤버: 역할에서 트랙(리드 · 리서치 · 엔지니어링 · 네트워크 · 운영)을 읽어 표시 ── */
const TRACKS = [
  [/회장|대표|리드|lead/i, "Lead"],
  [/리서치|연구|research|퀀트/i, "Research"],
  [/개발|엔지니어|engineer|데이터/i, "Engineering"],
  [/대외|홍보|협력|네트워크/i, "Network"],
  [/총무|회계|운영|기획/i, "Operations"],
];

function renderMembers() {
  $("#member-list").innerHTML = listHtml(DATA.members, (m, i) => {
    const photo = safeUrl(m.photo);
    const avatar = photo
      ? `<img src="${esc(photo)}" alt="${esc(m.name)} 사진" loading="lazy" />`
      : `<span>${esc(m.name.charAt(0))}</span>`;
    const track = TRACKS.find(([re]) => re.test(m.role))?.[1] ?? "Member";
    return `
      <li class="member spotlight" style="--i: ${i}" data-track="${track.toLowerCase()}">
        <div class="avatar">${avatar}</div>
        <div class="member-body">
          <p class="member-track"><span>${track}</span><span class="member-role">${esc(m.role)}</span></p>
          <h3>${esc(m.name)}</h3>
          <p class="member-major">${esc(m.major)}</p>
          <p class="member-intro">${esc(m.intro)}</p>
        </div>
      </li>`;
  });
}

/* ── 마지막 지원 안내 카드 (자세한 모집 내용은 recruit.html) ── */
function renderCtaCard() {
  const badge = $("#cta-badge");
  badge.textContent = recruitStatus(DATA).label;
  badge.dataset.status = DATA.recruit.status;
  $("#cta-title").textContent = DATA.recruit.title;
  $("#cta-period").textContent = DATA.recruit.period;
}

function renderHeroNote() {
  const period = DATA.recruit.period ? ` · ${DATA.recruit.period}` : "";
  $("#hero-note").innerHTML = `<span class="status-dot" data-status="${esc(DATA.recruit.status)}"></span>${esc(
    recruitStatus(DATA).label + period
  )}`;
}

/* ── 영상 (유튜브) ── */
// 여러 형태의 유튜브 주소에서 영상 ID만 꺼낸다
function youtubeId(url = "") {
  const match = String(url).match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/
  );
  return match ? match[1] : "";
}

function renderVideos() {
  const videos = (DATA.videos ?? []).map((v) => ({ ...v, id: youtubeId(v.url) })).filter((v) => v.id);
  const channel = safeUrl(DATA.site.contact?.youtube);
  const section = $("#videos");
  section.hidden = !videos.length && !channel;
  if (section.hidden) return;

  const list = $("#video-list");
  list.hidden = !videos.length;
  list.innerHTML = videos
    .map((v) => `
      <li class="video spotlight">
        <button class="video-thumb" type="button" data-video="${esc(v.id)}" aria-label="영상 재생: ${esc(v.title)}">
          <img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy" />
          <span class="video-play">${icon("play")}</span>
        </button>
        <h3>${esc(v.title)}</h3>
      </li>`)
    .join("");

  // 썸네일을 누를 때만 유튜브 플레이어를 불러온다 (페이지가 가벼워진다)
  list.addEventListener("click", (e) => {
    const thumb = e.target.closest("[data-video]");
    if (!thumb) return;
    const iframe = document.createElement("iframe");
    iframe.className = "video-frame";
    iframe.src = `https://www.youtube-nocookie.com/embed/${thumb.dataset.video}?autoplay=1&rel=0`;
    iframe.title = thumb.getAttribute("aria-label");
    iframe.allow = "autoplay; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    thumb.replaceWith(iframe);
  });

  const link = $("#youtube-link");
  link.hidden = !channel;
  if (channel) link.href = channel;
}

function renderHome(data) {
  DATA = data;
  renderBindings();
  renderHeadline();
  renderTicker();
  renderHeroNote();
  renderStats();
  renderTagline();
  renderAbout();
  renderActivities();
  renderProjects();
  renderMembers();
  renderCtaCard();
  renderVideos();
}

QLab.start(renderHome).catch((err) => console.error(err));
