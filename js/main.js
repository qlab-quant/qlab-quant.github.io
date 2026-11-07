// 홈페이지 렌더링. 공용 함수와 내비게이션 · 푸터는 common.js에 있습니다.
// 내용은 관리 페이지(admin.html)나 js/data.js에서 수정하세요.

let DATA;

/* ── 텍스트 바인딩 ── */
function renderBindings() {
  const values = {
    eyebrow: DATA.site.university,
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

/* ── 히어로 차트 (장식용 랜덤워크, 카드 너비에 맞춰 다시 그린다) ── */
let chartWidth = 0;
let chart = null; // 십자선이 쓰는 점 좌표와 지수 값

function renderHeroChart() {
  const svg = $("#hero-chart");
  const W = Math.round(svg.clientWidth);
  const H = Math.round(svg.clientHeight);
  if (!W || W === chartWidth) return;
  if (chartWidth) svg.classList.add("static"); // 처음 한 번만 애니메이션
  chartWidth = W;

  // 매번 같은 모양이 나오도록 시드 고정 난수
  let seed = 20;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const N = W < 480 ? 48 : 96;
  const series = [];
  let v = 0;
  for (let i = 0; i < N; i++) {
    v += rand() - 0.42;
    series.push(v);
  }

  const PAD = 8;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const pts = series.map((s, i) => [
    PAD + (i / (N - 1)) * (W - PAD * 2),
    H - PAD - ((s - min) / (max - min)) * (H - PAD * 2),
  ]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const area = `${line}L${W - PAD},${H}L${PAD},${H}Z`;
  const [lastX, lastY] = pts[pts.length - 1];
  const grid = [1, 2, 3]
    .map((i) => `<line x1="0" x2="${W}" y1="${(H / 4) * i}" y2="${(H / 4) * i}" />`)
    .join("");

  // 장식용 지수: 시작을 100으로 두고 움직임을 키운 값
  chart = { pts, values: series.map((s) => 100 + (s - series[0]) * 1.8) };

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <defs>
      <clipPath id="chart-clip"><rect class="chart-reveal" width="${W}" height="${H}" /></clipPath>
    </defs>
    <g class="chart-grid">${grid}</g>
    <g clip-path="url(#chart-clip)">
      <path class="chart-area" d="${area}" />
      <path class="chart-line" d="${line}" />
    </g>
    <circle class="chart-dot" cx="${lastX}" cy="${lastY}" r="5" />
    <line class="chart-cross" y1="0" y2="${H}" />
    <circle class="chart-hover-dot" r="5" />
  `;
}

// 차트 위에 마우스(또는 손가락)를 올리면 가장 가까운 점에 십자선과 값이 따라붙는다
function setupChartHover() {
  const svg = $("#hero-chart");
  const wrap = svg.closest(".chart-wrap");
  const tip = $("#chart-tip");

  const show = (e) => {
    if (!chart) return;
    const r = svg.getBoundingClientRect();
    const x = e.clientX - r.left;
    let i = 0;
    chart.pts.forEach(([px], k) => {
      if (Math.abs(px - x) < Math.abs(chart.pts[i][0] - x)) i = k;
    });
    const [px, py] = chart.pts[i];
    const cross = svg.querySelector(".chart-cross");
    cross.setAttribute("x1", px);
    cross.setAttribute("x2", px);
    const dot = svg.querySelector(".chart-hover-dot");
    dot.setAttribute("cx", px);
    dot.setAttribute("cy", py);

    tip.textContent = `T+${i}  ${chart.values[i].toFixed(2)}`;
    const w = wrap.getBoundingClientRect();
    const left = r.left - w.left + px;
    const top = r.top - w.top + py;
    const tx = Math.min(Math.max(left - tip.offsetWidth / 2, 0), w.width - tip.offsetWidth);
    const ty = top - tip.offsetHeight - 12 < 0 ? top + 12 : top - tip.offsetHeight - 12;
    tip.style.transform = `translate(${tx}px, ${ty}px)`;
    wrap.classList.add("chart-hover");
  };

  svg.addEventListener("pointermove", show);
  svg.addEventListener("pointerdown", show);
  svg.addEventListener("pointerleave", () => wrap.classList.remove("chart-hover"));
}

/* ── 통계 ── */
function renderStats() {
  $("#stats").innerHTML = (DATA.site.stats ?? [])
    .map((s) => `<div class="stat"><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`)
    .join("");
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

/* ── 소개 ── */
const VALUE_ICONS = ["books", "code", "chart-line-up", "users-three", "lightbulb"];

function renderAbout() {
  $("#about-body").innerHTML = (DATA.about.paragraphs ?? []).map((p) => `<p>${multiline(p)}</p>`).join("");
  $("#values").innerHTML = listHtml(DATA.about.values, (v, i) => `
    <li class="value spotlight">
      <span class="value-icon">${icon(VALUE_ICONS[i % VALUE_ICONS.length])}</span>
      <div>
        <h3>${esc(v.title)}</h3>
        <p>${esc(v.desc)}</p>
      </div>
    </li>`);
}

/* ── 활동 ── */
function renderActivities() {
  $("#activity-list").innerHTML = listHtml(DATA.activities, (a, i) => `
    <li class="card spotlight">
      <div class="card-head">
        <span class="card-tag">${esc(a.cycle)}</span>
        <span class="card-num">${pad2(i + 1)}</span>
      </div>
      <h3>${esc(a.title)}</h3>
      <p>${esc(a.desc)}</p>
    </li>`);
}

/* ── 프로젝트 ── */
function renderProjects() {
  $("#project-list").innerHTML = listHtml(DATA.projects, (p) => {
    const tags = (p.tags ?? []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
    const link = safeUrl(p.link);
    const title = link
      ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(p.title)} ${icon("arrow-up-right")}</a>`
      : esc(p.title);
    return `
      <li class="project">
        <span class="project-period">${esc(p.period)}</span>
        <div class="project-main">
          <h3>${title}</h3>
          <p>${esc(p.summary)}</p>
        </div>
        <div class="project-tags">${tags}</div>
      </li>`;
  });
}

/* ── 멤버 ── */
function renderMembers() {
  $("#member-list").innerHTML = listHtml(DATA.members, (m) => {
    const photo = safeUrl(m.photo);
    const avatar = photo
      ? `<img src="${esc(photo)}" alt="${esc(m.name)} 사진" loading="lazy" />`
      : `<span>${esc(m.name.charAt(0))}</span>`;
    return `
      <li class="member spotlight">
        <div class="avatar">${avatar}</div>
        <div>
          <p class="member-role">${esc(m.role)}</p>
          <h3>${esc(m.name)}</h3>
          <p class="member-major">${esc(m.major)}</p>
          <p class="member-intro">${esc(m.intro)}</p>
        </div>
      </li>`;
  });
}

/* ── 모집 ── */
function renderRecruit() {
  const recruit = DATA.recruit;
  const status = recruitStatus(DATA);
  const applyUrl = safeUrl(recruit.applyUrl);

  ["#recruit-badge", "#cta-badge"].forEach((sel) => {
    const badge = $(sel);
    badge.textContent = status.label;
    badge.dataset.status = recruit.status;
  });

  $("#recruit-title").textContent = recruit.title;
  $("#recruit-period").textContent = recruit.period;
  $("#cta-title").textContent = recruit.title;
  $("#cta-period").textContent = recruit.period;

  const btn = $("#apply-btn");
  if (recruit.status === "open" && applyUrl) {
    btn.href = applyUrl;
    btn.innerHTML = `${esc(status.button)} ${icon("arrow-up-right")}`;
  } else {
    btn.textContent = status.button;
    btn.removeAttribute("href");
    btn.setAttribute("aria-disabled", "true");
  }

  $("#recruit-target").innerHTML = (recruit.target ?? [])
    .map((t) => `<li>${icon("check-circle")}<span>${esc(t)}</span></li>`)
    .join("");
  $("#recruit-steps").innerHTML = (recruit.steps ?? [])
    .map((s, i) => `
      <li class="step">
        <span class="step-num">${pad2(i + 1)}</span>
        <p class="step-title">${esc(s.title)}</p>
        <p class="step-date">${esc(s.date)}</p>
      </li>`)
    .join("");

  $("#faq-list").innerHTML = (recruit.faq ?? [])
    .map((f) => `
      <details class="faq-item">
        <summary><span>${esc(f.q)}</span>${icon("caret-down")}</summary>
        <p>${multiline(f.a)}</p>
      </details>`)
    .join("");
}

/* ── 공지 ── */
const NOTICE_PAGE = 5;

function renderNotices() {
  const list = $("#notice-list");
  const moreBtn = $("#notice-more");
  const sorted = [...(DATA.notices ?? [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  let shown = NOTICE_PAGE;

  const draw = () => {
    list.innerHTML = listHtml(sorted.slice(0, shown), (n) => `
      <li>
        <details class="notice">
          <summary>
            <span class="notice-cat">${esc(n.category)}</span>
            <span class="notice-title">${esc(n.title)}</span>
            <time datetime="${esc(n.date)}">${esc(String(n.date).replace(/-/g, "."))}</time>
            ${icon("caret-down")}
          </summary>
          <div class="notice-body"><p>${multiline(n.body)}</p></div>
        </details>
      </li>`);
    moreBtn.hidden = shown >= sorted.length;
  };

  moreBtn.addEventListener("click", () => {
    shown += NOTICE_PAGE;
    draw();
  });
  draw();
}

function renderHeroNote() {
  const period = DATA.recruit.period ? ` · ${DATA.recruit.period}` : "";
  $("#hero-note").textContent = `${recruitStatus(DATA).label}${period}`;
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
  renderHeroNote();
  renderStats();
  renderTagline();
  renderAbout();
  renderActivities();
  renderProjects();
  renderMembers();
  renderRecruit();
  renderNotices();
  renderVideos();
}

renderHeroChart();
setupChartHover();
addEventListener("resize", () => requestAnimationFrame(renderHeroChart));
QLab.start(renderHome).catch((err) => console.error(err));
