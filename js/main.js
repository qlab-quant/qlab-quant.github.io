// 화면 렌더링 스크립트. 내용은 관리 페이지(admin.html)나 js/data.js에서 수정하세요.

const $ = (sel) => document.querySelector(sel);

const PREVIEW_KEY = "qlab-preview";
const isPreview = new URLSearchParams(location.search).has("preview");
let DATA;

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

// \n 을 <br> 로 바꿔 줄바꿈을 살린다
const multiline = (value) => esc(value).replace(/\n/g, "<br>");

const pad2 = (n) => String(n).padStart(2, "0");

// javascript: 처럼 위험한 주소는 링크로 쓰지 않는다
function safeUrl(url = "") {
  const value = String(url).trim();
  if (/^(https?:|mailto:)/i.test(value)) return value;
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? "" : value;
}

const listHtml = (items, render) =>
  items?.length ? items.map(render).join("") : `<li class="empty">아직 등록된 내용이 없어요.</li>`;

// 관리 페이지에서 저장한 내용이 바로 보이도록 data.js는 캐시 없이 불러온다
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`${src}를 불러오지 못했습니다.`));
    document.head.append(script);
  });
}

// 관리 페이지의 '미리보기'는 저장 전 내용을 localStorage로 넘겨준다
function readPreviewData() {
  try {
    return JSON.parse(localStorage.getItem(PREVIEW_KEY));
  } catch {
    return null;
  }
}

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

/* ── 히어로 차트 (장식용 랜덤워크) ── */
function renderHeroChart() {
  const svg = $("#hero-chart");
  const W = 480, H = 280, N = 72, PAD = 20;

  // 매번 같은 모양이 나오도록 시드 고정 난수
  let seed = 20;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const series = [];
  let v = 0;
  for (let i = 0; i < N; i++) {
    v += rand() - 0.42;
    series.push(v);
  }
  const min = Math.min(...series);
  const max = Math.max(...series);
  const pts = series.map((s, i) => [
    (i / (N - 1)) * W,
    H - PAD - ((s - min) / (max - min)) * (H - PAD * 2),
  ]);

  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const area = `${line}L${W},${H}L0,${H}Z`;
  const [lastX, lastY] = pts[pts.length - 1];
  const grid = [1, 2, 3]
    .map((i) => `<line x1="0" x2="${W}" y1="${(H / 4) * i}" y2="${(H / 4) * i}" />`)
    .join("");

  svg.innerHTML = `
    <defs>
      <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style="stop-color:var(--accent);stop-opacity:.16" />
        <stop offset="1" style="stop-color:var(--accent);stop-opacity:0" />
      </linearGradient>
    </defs>
    <g class="chart-grid">${grid}</g>
    <path class="chart-area" d="${area}" fill="url(#chart-fill)" />
    <path class="chart-line" d="${line}" pathLength="1" />
    <circle class="chart-dot" cx="${lastX}" cy="${lastY}" r="5" />
  `;
}

/* ── 통계 ── */
function renderStats() {
  $("#stats").innerHTML = (DATA.site.stats ?? [])
    .map((s) => `<div class="stat"><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`)
    .join("");
}

/* ── 소개 ── */
function renderAbout() {
  $("#about-body").innerHTML = (DATA.about.paragraphs ?? []).map((p) => `<p>${multiline(p)}</p>`).join("");
  $("#values").innerHTML = listHtml(DATA.about.values, (v, i) => `
    <li class="value">
      <span class="value-num">${pad2(i + 1)}</span>
      <div>
        <h3>${esc(v.title)}</h3>
        <p>${esc(v.desc)}</p>
      </div>
    </li>`);
}

/* ── 활동 ── */
function renderActivities() {
  $("#activity-list").innerHTML = listHtml(DATA.activities, (a) => `
    <li class="card">
      <span class="card-tag">${esc(a.cycle)}</span>
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
      ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(p.title)} <span aria-hidden="true">↗</span></a>`
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
      <li class="member">
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
const RECRUIT_STATUS = {
  open: { label: "모집 중", button: "지원하기" },
  upcoming: { label: "모집 예정", button: "모집 예정" },
  closed: { label: "모집 마감", button: "모집 마감" },
};

function renderRecruit() {
  const recruit = DATA.recruit;
  const status = RECRUIT_STATUS[recruit.status] ?? RECRUIT_STATUS.closed;
  const applyUrl = safeUrl(recruit.applyUrl);

  const badge = $("#recruit-badge");
  badge.textContent = status.label;
  badge.dataset.status = recruit.status;

  $("#recruit-title").textContent = recruit.title;
  $("#recruit-period").textContent = recruit.period;

  const btn = $("#apply-btn");
  btn.textContent = status.button;
  if (recruit.status === "open" && applyUrl) {
    btn.href = applyUrl;
  } else {
    btn.removeAttribute("href");
    btn.setAttribute("aria-disabled", "true");
  }

  $("#recruit-target").innerHTML = (recruit.target ?? []).map((t) => `<li>${esc(t)}</li>`).join("");
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
        <summary>${esc(f.q)}</summary>
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

/* ── 푸터 ── */
function renderFooter() {
  const { email, instagram, github } = DATA.site.contact ?? {};
  const links = [
    email && { label: "Email", text: email, href: `mailto:${email}` },
    safeUrl(instagram) && { label: "Instagram", text: "Instagram", href: safeUrl(instagram) },
    safeUrl(github) && { label: "GitHub", text: "GitHub", href: safeUrl(github) },
  ].filter(Boolean);

  $("#contact-list").innerHTML = links
    .map((l) => {
      const external = l.href.startsWith("http") ? ' target="_blank" rel="noopener"' : "";
      return `<li><span>${esc(l.label)}</span><a href="${esc(l.href)}"${external}>${esc(l.text)}</a></li>`;
    })
    .join("");

  $("#copyright").textContent = `© ${new Date().getFullYear()} ${DATA.site.name}. All rights reserved.`;
}

// 관리 페이지에 로그인한 상태면 돌아가는 버튼을 보여 준다 (토큰 값은 읽지 않고 있는지만 본다)
function showAdminShortcut() {
  try {
    const key = "qlab-admin-token";
    $("#admin-fab").hidden = !(sessionStorage.getItem(key) || localStorage.getItem(key));
  } catch {}
}

function renderPreviewBanner() {
  const banner = document.createElement("div");
  banner.className = "preview-banner";
  banner.textContent = "미리보기 · 아직 저장하지 않은 내용이에요";
  document.body.append(banner);
}

/* ── 헤더 · 모바일 메뉴 · 현재 섹션 표시 ── */
function setupNav() {
  const header = $("#site-header");
  const nav = $("#nav");
  const menuBtn = $("#menu-btn");

  const setMenu = (open) => {
    document.body.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
  };

  menuBtn.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMenu(false);
  });

  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const links = [...nav.querySelectorAll("a")];
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.classList.toggle("active", a.hash === `#${entry.target.id}`));
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  document.querySelectorAll("main section[id]").forEach((s) => observer.observe(s));
}

async function start() {
  setupNav();
  renderHeroChart();
  if (!isPreview) showAdminShortcut();

  const preview = isPreview && readPreviewData();
  if (!preview) await loadScript(`js/data.js?v=${Date.now()}`);
  DATA = preview || window.SITE_DATA;

  renderBindings();
  renderStats();
  renderAbout();
  renderActivities();
  renderProjects();
  renderMembers();
  renderRecruit();
  renderNotices();
  renderFooter();
  if (preview) renderPreviewBanner();
}

start().catch((err) => console.error(err));
