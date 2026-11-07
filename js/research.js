// 리서치 페이지: 목록, 글 하나(마크다운 또는 PDF), GitHub 저장소 정보.
// 리서치는 관리 페이지의 '리서치' 메뉴에서 올립니다.

const params = new URLSearchParams(location.search);
const view = $("#research-view");

/* ── GitHub 저장소 정보 (로그인 없이 공개 API로 읽고, 10분 동안 기억해 둔다) ── */
const GITHUB_CACHE_MS = 10 * 60 * 1000;

async function githubJson(path) {
  const key = `qlab-gh:${path}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(key));
    if (cached && Date.now() - cached.at < GITHUB_CACHE_MS) return cached.body;
  } catch {}
  const res = await fetch(`https://api.github.com${path}`, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const body = await res.json();
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), body }));
  } catch {}
  return body;
}

// "owner/name" 또는 GitHub 주소에서 "owner/name"만 꺼낸다
function repoName(value = "") {
  const match = String(value).trim().match(/^(?:https?:\/\/github\.com\/)?([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i);
  return match ? match[1] : "";
}

let orgReposPromise = null;
function loadOrgRepos(org) {
  orgReposPromise ??= githubJson(`/orgs/${encodeURIComponent(org)}/repos?per_page=100&sort=pushed`).then((repos) =>
    repos.filter((r) => !r.fork && !r.archived && r.name.toLowerCase() !== `${org}.github.io`.toLowerCase())
  );
  return orgReposPromise;
}

// 조직 저장소 목록에 있으면 그걸 쓰고, 없을 때만 따로 묻는다 (요청 횟수 제한을 아끼려고)
async function loadRepo(full, org) {
  const repos = await loadOrgRepos(org).catch(() => []);
  return repos.find((r) => r.full_name.toLowerCase() === full.toLowerCase()) ?? githubJson(`/repos/${full}`);
}

const LANGUAGE_COLORS = {
  Python: "#3572A5",
  "Jupyter Notebook": "#DA5B0B",
  R: "#198CE7",
  "C++": "#f34b7d",
  C: "#555555",
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Rust: "#dea584",
  Julia: "#a270ba",
  Go: "#00ADD8",
};

function timeAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days < 1) return "오늘";
  if (days < 30) return `${days}일 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

function repoCard(repo) {
  const lang = repo.language
    ? `<span class="repo-lang"><span class="repo-dot" style="background:${LANGUAGE_COLORS[repo.language] ?? "var(--text-faint)"}"></span>${esc(repo.language)}</span>`
    : "";
  const topics = (repo.topics ?? []).slice(0, 4).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  return `
    <a class="repo-card spotlight" href="${esc(repo.html_url)}" target="_blank" rel="noopener">
      <span class="repo-name">${icon("git-branch")}<span>${esc(repo.full_name)}</span>${icon("arrow-up-right")}</span>
      <p class="repo-desc">${esc(repo.description || "설명이 아직 없어요.")}</p>
      ${topics ? `<div class="repo-topics">${topics}</div>` : ""}
      <span class="repo-meta">
        ${lang}
        <span>${icon("star")}${repo.stargazers_count}</span>
        <span>${icon("clock")}${timeAgo(repo.pushed_at)} 업데이트</span>
      </span>
    </a>`;
}

async function renderOrgRepos(org) {
  const list = $("#repo-list");
  const link = $("#org-link");
  link.href = `https://github.com/${org}`;
  link.hidden = false;
  list.innerHTML = `<li class="empty">저장소를 불러오는 중…</li>`;
  try {
    const repos = await loadOrgRepos(org);
    list.innerHTML = listHtml(
      repos,
      (r) => `<li>${repoCard(r)}</li>`,
      `아직 공개된 저장소가 없어요. ${org} 조직에 저장소를 만들면 여기에 자동으로 나타나요.`
    );
  } catch {
    list.innerHTML = `<li class="empty">GitHub에서 저장소 정보를 불러오지 못했어요. 잠시 뒤 다시 시도하거나 아래 버튼으로 GitHub에서 확인해 주세요.</li>`;
  }
}

/* ── 마크다운 → HTML (수식은 KaTeX, 위험한 태그는 DOMPurify가 걸러 낸다) ── */
function renderMarkdown(md) {
  const code = [];
  const math = [];
  // 코드 안의 $는 수식이 아니므로 잠시 치워 둔다
  let text = md.replace(/```[\s\S]*?```|`[^`\n]+`/g, (m) => `QLABCODE${code.push(m) - 1}END`);
  text = text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => `\n\nQLABMATH${math.push({ tex, display: true }) - 1}END\n\n`)
    .replace(/\$(?!\s)([^$\n]+?)(?<!\s)\$/g, (_, tex) => `QLABMATH${math.push({ tex, display: false }) - 1}END`);
  text = text.replace(/QLABCODE(\d+)END/g, (_, i) => code[i]);

  let html = DOMPurify.sanitize(marked.parse(text));
  html = html.replace(/(?:<p>)?QLABMATH(\d+)END(?:<\/p>)?/g, (whole, i) => {
    const { tex, display } = math[i];
    const rendered = katex.renderToString(tex, { displayMode: display, throwOnError: false });
    return display ? `<div class="math-block">${rendered}</div>` : rendered;
  });
  return html;
}

/* ── 목록 ── */
const byDate = (a, b) => String(b.date).localeCompare(String(a.date));

function researchCard(r) {
  const repo = repoName(r.repo);
  const tags = (r.tags ?? []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  return `
    <li>
      <a class="research-card spotlight" href="${pageUrl("research.html", { id: r.id })}">
        <span class="research-meta">
          <span class="research-format" data-format="${esc(r.format)}">${r.format === "pdf" ? `${icon("file-pdf")}PDF` : `${icon("article")}글`}</span>
          <time datetime="${esc(r.date)}">${formatDate(r.date)}</time>
        </span>
        <h3>${esc(r.title)}</h3>
        <p>${esc(r.summary)}</p>
        <span class="research-foot">
          <span class="research-authors">${esc((r.authors ?? []).join(", "))}</span>
          ${repo ? `<span class="research-repo">${icon("github-logo")}${esc(repo)}</span>` : ""}
        </span>
        ${tags ? `<span class="research-tags">${tags}</span>` : ""}
      </a>
    </li>`;
}

function renderList(data) {
  const items = [...(data.research ?? [])].sort(byDate);
  const allTags = [...new Set(items.flatMap((r) => r.tags ?? []))];
  let active = params.get("tag") ?? "";

  view.innerHTML = `
    <header class="page-head" data-reveal>
      <span class="section-num">RESEARCH</span>
      <h1>리서치</h1>
      <p>가설을 세우고 데이터로 검증한 과정을 그대로 공개해요. 코드는 GitHub 저장소에서 볼 수 있어요.</p>
    </header>
    ${allTags.length ? `<div class="filter-chips" role="group" aria-label="태그로 거르기" id="tag-filter"></div>` : ""}
    <ul class="research-list" id="research-list" data-reveal></ul>`;

  const draw = () => {
    const shown = active ? items.filter((r) => (r.tags ?? []).includes(active)) : items;
    $("#research-list").innerHTML = listHtml(shown, researchCard, "아직 올라온 리서치가 없어요.");
    const filter = $("#tag-filter");
    if (filter) {
      filter.innerHTML = ["", ...allTags]
        .map((t) => `<button type="button" class="chip" data-tag="${esc(t)}" aria-pressed="${t === active}">${esc(t || "전체")}</button>`)
        .join("");
    }
  };

  view.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-tag]");
    if (!chip) return;
    active = chip.dataset.tag;
    draw();
  });
  draw();
}

/* ── 글 하나 ── */
async function loadArticle(path) {
  const preview = QLab.previewFile(path);
  if (preview != null) return preview;
  const res = await fetch(`${path}?v=${Date.now()}`);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.text();
}

async function renderDetail(data, id) {
  const r = (data.research ?? []).find((item) => item.id === id);
  if (!r) {
    view.innerHTML = `
      <div class="not-found-inline">
        <h1>리서치를 찾을 수 없어요</h1>
        <p>주소가 바뀌었거나 삭제된 글이에요.</p>
        <a class="btn btn-primary" href="${pageUrl("research.html")}">리서치 목록 ${icon("arrow-right")}</a>
      </div>`;
    return;
  }

  document.title = `${r.title} | Q-Lab 리서치`;
  const tags = (r.tags ?? []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  const pdf = safeUrl(r.pdf);
  const repo = repoName(r.repo);

  view.innerHTML = `
    <article class="article">
      <a class="back-link" href="${pageUrl("research.html")}">${icon("arrow-left")}리서치 목록</a>
      <header class="article-head">
        <span class="research-meta">
          <span class="research-format" data-format="${esc(r.format)}">${r.format === "pdf" ? `${icon("file-pdf")}PDF` : `${icon("article")}글`}</span>
          <time datetime="${esc(r.date)}">${formatDate(r.date)}</time>
        </span>
        <h1>${esc(r.title)}</h1>
        <p class="article-summary">${esc(r.summary)}</p>
        <p class="article-authors">${esc((r.authors ?? []).join(", "))}</p>
        ${tags ? `<div class="research-tags">${tags}</div>` : ""}
      </header>
      <div class="article-repo" id="article-repo" ${repo ? "" : "hidden"}></div>
      <div class="article-body" id="article-body"><p class="empty">불러오는 중…</p></div>
    </article>`;

  if (repo) {
    $("#article-repo").innerHTML = `<p class="article-label">코드 저장소</p><div class="repo-loading">${esc(repo)}</div>`;
    loadRepo(repo, data.site.githubOrg)
      .then((info) => ($("#article-repo").innerHTML = `<p class="article-label">코드 저장소</p>${repoCard(info)}`))
      .catch(() => {
        $("#article-repo").innerHTML = `
          <p class="article-label">코드 저장소</p>
          <a class="btn btn-ghost" href="https://github.com/${esc(repo)}" target="_blank" rel="noopener">${icon("github-logo")}${esc(repo)}</a>`;
      });
  }

  const body = $("#article-body");
  if (r.format === "pdf") {
    body.innerHTML = pdf
      ? `
        <div class="pdf-actions">
          <a class="btn btn-primary" href="${esc(pdf)}" target="_blank" rel="noopener">PDF 새 창에서 열기 ${icon("arrow-up-right")}</a>
          <a class="btn btn-ghost" href="${esc(pdf)}" download>${icon("download-simple")}내려받기</a>
        </div>
        <iframe class="pdf-frame" src="${esc(pdf)}" title="${esc(r.title)} PDF"></iframe>`
      : `<p class="empty">아직 PDF 파일이 올라오지 않았어요.</p>`;
    return;
  }

  try {
    body.innerHTML = `<div class="prose">${renderMarkdown(await loadArticle(r.file))}</div>`;
  } catch {
    body.innerHTML = `<p class="empty">본문을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</p>`;
  }
}

QLab.start(async (data) => {
  const org = data.site.githubOrg;
  const id = params.get("id");
  if (id) {
    $("#repos").hidden = true;
    await renderDetail(data, id);
  } else {
    renderList(data);
    if (org) renderOrgRepos(org);
    else $("#repos").hidden = true;
  }
}).catch((err) => console.error(err));
