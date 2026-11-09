// 모든 공개 페이지(홈 · 리서치 · 갤러리)가 함께 쓰는 것: 공용 함수, 내비게이션, 푸터, 내용 불러오기.
// 각 페이지는 QLab.start(페이지를_그리는_함수)로 시작합니다.

const $ = (sel, root = document) => root.querySelector(sel);

const PREVIEW_KEY = "qlab-preview";
const PREVIEW_FILES_KEY = "qlab-preview-files";
const isPreview = new URLSearchParams(location.search).has("preview");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PAGE = document.body.dataset.page || "home";

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

// \n 을 <br> 로 바꿔 줄바꿈을 살린다
const multiline = (value) => esc(value).replace(/\n/g, "<br>");

const pad2 = (n) => String(n).padStart(2, "0");
const icon = (name) => window.qlabIcon?.(name) ?? ""; // js/icons.js

// javascript: 처럼 위험한 주소는 링크로 쓰지 않는다
function safeUrl(url = "") {
  const value = String(url).trim();
  if (/^(https?:|mailto:)/i.test(value)) return value;
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? "" : value;
}

const listHtml = (items, render, emptyText = "아직 등록된 내용이 없어요.") =>
  items?.length ? items.map(render).join("") : `<li class="empty">${esc(emptyText)}</li>`;

const formatDate = (iso) => String(iso ?? "").slice(0, 10).replace(/-/g, ".");

// 미리보기 중에는 사이트 안 링크에도 ?preview 를 붙여 저장 전 내용을 계속 보여 준다
function pageUrl(path, params = {}) {
  const query = new URLSearchParams(params);
  if (isPreview) query.set("preview", "");
  const qs = query.toString().replace(/=(?=&|$)/g, "");
  return qs ? `${path}?${qs}` : path;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`${src}를 불러오지 못했습니다.`));
    document.head.append(script);
  });
}

function readStoredJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

/* ── 모집 상태와 지원 버튼 ── */
const RECRUIT_STATUS = {
  open: { label: "모집 중", button: "지원하기" },
  upcoming: { label: "모집 예정", button: "모집 예정" },
  closed: { label: "모집 마감", button: "모집 마감" },
};

const recruitStatus = (data) => RECRUIT_STATUS[data.recruit.status] ?? RECRUIT_STATUS.closed;

// 첫 화면 · 메뉴 · 마지막 안내의 버튼은 모두 같은 곳으로 보낸다
function ctaInfo(data) {
  const applyUrl = safeUrl(data.recruit.applyUrl);
  if (data.recruit.status === "open" && applyUrl) {
    return { label: "지금 지원하기", href: applyUrl, external: true };
  }
  const label = data.recruit.status === "upcoming" ? "Q-LAB 합류하기" : "모집 안내 보기";
  return { label, href: pageUrl("recruit.html"), external: false };
}

function renderCtas(data) {
  const cta = ctaInfo(data);
  document.querySelectorAll("[data-cta]").forEach((a) => {
    a.href = cta.href;
    a.innerHTML = `${esc(cta.label)} ${icon(cta.external ? "arrow-up-right" : "arrow-right")}`;
    if (cta.external) {
      a.target = "_blank";
      a.rel = "noopener";
    } else {
      a.removeAttribute("target");
      a.removeAttribute("rel");
    }
  });
}

/* ── 내비게이션 · 모바일 메뉴 · 푸터 (모든 페이지 공통) ── */
const NAV_ITEMS = [
  { label: "홈", hash: "top" },
  { label: "활동", hash: "activities" },
  { label: "리서치", page: "research" },
  { label: "갤러리", page: "gallery" },
  { label: "모집", page: "recruit" },
  { label: "공지", page: "notice" },
];

const navHref = (item) => {
  if (item.page) return pageUrl(`${item.page}.html`);
  return PAGE === "home" ? `#${item.hash}` : `${pageUrl("./")}#${item.hash}`;
};

function renderShell() {
  const current = (item) => (item.page === PAGE ? ' class="active" aria-current="page"' : "");
  $("#site-nav").innerHTML = `
    <div class="nav-inner">
      <a href="${PAGE === "home" ? "#top" : pageUrl("./")}" class="logo" aria-label="Q-Lab 처음으로">
        <span class="logo-mark">${window.qlabLogo?.() ?? "Q-Lab"}</span>
      </a>
      <nav class="nav-links" id="nav" aria-label="주요 메뉴">
        ${NAV_ITEMS.map((item) => `<a href="${navHref(item)}"${current(item)}>${item.label}</a>`).join("")}
      </nav>
      <button class="theme-btn" type="button" data-theme-toggle></button>
      <a class="btn btn-primary btn-sm nav-cta" href="${pageUrl("recruit.html")}" data-cta>지원하기</a>
      <button class="menu-btn" id="menu-btn" type="button" aria-label="메뉴 열기" aria-expanded="false" aria-controls="mobile-menu">
        <span></span><span></span>
      </button>
    </div>`;

  $("#mobile-menu").innerHTML = `
    <nav aria-label="모바일 메뉴">
      ${NAV_ITEMS.map((item, i) => `<a href="${navHref(item)}" style="--i: ${i}"${current(item)}>${item.label}</a>`).join("")}
      <a class="btn btn-primary" href="${pageUrl("recruit.html")}" style="--i: ${NAV_ITEMS.length}" data-cta>지원하기</a>
    </nav>`;

  $("#site-footer").innerHTML = `
    <div class="container footer-inner">
      <div>
        <span class="footer-logo">${window.qlabLogo?.("stack") ?? ""}</span>
        <p class="footer-name" id="footer-name"></p>
        <p class="footer-sub" id="footer-sub"></p>
      </div>
      <ul class="contact-list" id="contact-list"></ul>
    </div>
    <div class="container footer-bottom">
      <p class="copyright" id="copyright"></p>
      <a class="admin-link" href="admin.html">관리자</a>
    </div>`;
}

function renderFooter(data) {
  const { email, instagram, youtube, github } = data.site.contact ?? {};
  const links = [
    email && { icon: "envelope-simple", text: email, href: `mailto:${email}` },
    safeUrl(instagram) && { icon: "instagram-logo", text: "Instagram", href: safeUrl(instagram) },
    safeUrl(youtube) && { icon: "youtube-logo", text: "YouTube", href: safeUrl(youtube) },
    safeUrl(github) && { icon: "github-logo", text: "GitHub", href: safeUrl(github) },
  ].filter(Boolean);

  $("#footer-name").textContent = data.site.fullName;
  $("#footer-sub").textContent = data.site.university;
  $("#contact-list").innerHTML = links
    .map((l) => {
      const external = l.href.startsWith("http") ? ' target="_blank" rel="noopener"' : "";
      return `<li><a href="${esc(l.href)}"${external}>${icon(l.icon)}${esc(l.text)}</a></li>`;
    })
    .join("");
  $("#copyright").textContent = `© ${new Date().getFullYear()} ${data.site.name}. All rights reserved.`;
}

// 관리 페이지에 로그인한 상태면 돌아가는 버튼을 보여 준다 (토큰 값은 읽지 않고 있는지만 본다)
function showAdminShortcut() {
  try {
    const key = "qlab-admin-token";
    if (!(sessionStorage.getItem(key) || localStorage.getItem(key))) return;
  } catch {
    return;
  }
  const fab = document.createElement("a");
  fab.className = "btn btn-primary btn-sm admin-fab";
  fab.href = "admin.html";
  fab.innerHTML = `관리 페이지 ${icon("arrow-up-right")}`;
  document.body.append(fab);
}

function renderPreviewBanner() {
  const banner = document.createElement("div");
  banner.className = "preview-banner";
  banner.textContent = "미리보기 · 아직 저장하지 않은 내용이에요";
  document.body.append(banner);
}

/* ── 스크롤하면 요소가 살짝 올라오며 나타남 (한 번만) ── */
const revealObserver =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -10% 0px" }
      )
    : null;

// 나중에 그려진 요소도 다시 불러서 등장 효과를 붙일 수 있다
function observeReveal(root = document) {
  root.querySelectorAll("[data-reveal]:not(.is-visible)").forEach((el) => {
    if (revealObserver) revealObserver.observe(el);
    else el.classList.add("is-visible");
  });
}

/* ── 모바일 메뉴 · 홈에서는 지금 보고 있는 섹션을 메뉴에 표시 ── */
function setupNav() {
  const menuBtn = $("#menu-btn");
  const mobileMenu = $("#mobile-menu");

  const setMenu = (open) => {
    document.body.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    mobileMenu.inert = !open;
  };
  const isOpen = () => document.body.classList.contains("menu-open");

  menuBtn.addEventListener("click", () => setMenu(!isOpen()));
  mobileMenu.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMenu(false);
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) setMenu(false);
  });
  matchMedia("(min-width: 821px)").addEventListener("change", (e) => {
    if (e.matches) setMenu(false);
  });

  if (PAGE !== "home") return;
  const links = [...document.querySelectorAll("#nav a[href^='#']")];
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

const QLab = {
  data: null,

  // 관리 페이지 '미리보기'에서 넘어온 저장 전 리서치 본문
  previewFile(path) {
    if (!isPreview) return null;
    return readStoredJson(PREVIEW_FILES_KEY)?.[path] ?? null;
  },

  async start(renderPage) {
    renderShell();
    setupNav();
    observeReveal();
    if (!isPreview) showAdminShortcut();

    const preview = isPreview && readStoredJson(PREVIEW_KEY);
    if (!preview) await loadScript(`js/data.js?v=${Date.now()}`);
    const data = preview || window.SITE_DATA;
    QLab.data = data;

    renderFooter(data);
    renderCtas(data);
    await renderPage?.(data);
    observeReveal();
    if (preview) renderPreviewBanner();
  },
};
