// 홈페이지 렌더링. 공용 함수와 내비게이션 · 푸터는 common.js에 있습니다.
// 내용은 관리 페이지(admin.html)나 js/data.js에서 수정하세요.

let DATA;

// 모집 · 공지는 따로 페이지가 생겼다. 예전 주소(#recruit, #notice)로 들어오면 그쪽으로 보낸다
const MOVED_SECTIONS = { "#recruit": "recruit.html", "#notice": "notice.html" };
if (MOVED_SECTIONS[location.hash]) location.replace(pageUrl(MOVED_SECTIONS[location.hash]));

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
const VALUE_ICONS = ["research", "engineering", "practice", "network", "candles"];

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
  renderCtaCard();
  renderVideos();
}

QLab.start(renderHome).catch((err) => console.error(err));
