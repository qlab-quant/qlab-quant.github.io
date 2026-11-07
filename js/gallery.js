// 갤러리: 운영진이 가입을 승인한 회원이 글과 댓글을 쓰는 게시판.
// 화면은 주소의 # 뒤를 보고 바꾼다 (#/ 목록, #/post/3 글, #/write 글쓰기, #/login, #/signup, #/members).
// 데이터는 gallery-api.js(Supabase)로 주고받고, 설정은 gallery-config.js에 있습니다.

const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
const PAGE_SIZE = 20;
const MAX_IMAGES = 5;
const MEMBER_STATUS = {
  pending: { label: "승인 대기", badge: "upcoming" },
  approved: { label: "회원", badge: "open" },
  rejected: { label: "이용 제한", badge: "" },
};

const gview = $("#gallery-view");
const gbar = $("#gallery-bar");
let api = null;
let me = null; // { id, nickname, status, role }
let ctx = {}; // 지금 화면이 쓰는 값 (보고 있는 글 번호 등)

const isApproved = () => me?.status === "approved";
const isAdmin = () => isApproved() && me.role === "admin";
const go = (hash) => {
  location.hash = hash;
};

function parseHash() {
  const [path, query = ""] = (location.hash.slice(1) || "/").split("?");
  return { path: path || "/", params: new URLSearchParams(query) };
}

function shortDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const md = `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
  return d.getFullYear() === now.getFullYear() ? md : `${String(d.getFullYear()).slice(2)}.${md}`;
}

const fullDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// 본문: 줄바꿈을 살리고 http(s) 주소는 링크로 바꾼다 (먼저 이스케이프해서 안전하다)
const linkify = (text) =>
  multiline(text).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" target="_blank" rel="noopener nofollow">${url}</a>`);

const skeleton = (rows = 6) =>
  `<div class="skeleton-list" aria-label="불러오는 중">${'<span class="skeleton"></span>'.repeat(rows)}</div>`;

const notice = (title, body, action = "") =>
  `<div class="gallery-notice"><h2>${esc(title)}</h2><p>${body}</p>${action}</div>`;

// 사진은 긴 변 1600px JPEG로 줄여서 올린다 (저장 공간을 아끼려고)
function resizeImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("사진을 줄이지 못했어요."))), "image/jpeg", 0.85);
    };
    img.onerror = () => reject(new Error(`${file.name}은(는) 열 수 없는 사진이에요.`));
    img.src = URL.createObjectURL(file);
  });
}

/* ── 위쪽 막대: 로그인 상태와 버튼 ── */
function renderBar() {
  gbar.hidden = false;
  if (!me) {
    gbar.innerHTML = `
      <p class="gallery-hello">승인된 회원이 되면 글과 댓글을 쓸 수 있어요.</p>
      <div class="gallery-actions">
        <a class="btn btn-ghost btn-sm" href="#/login">로그인</a>
        <a class="btn btn-primary btn-sm" href="#/signup">회원가입</a>
      </div>`;
    return;
  }
  const status = MEMBER_STATUS[me.status] ?? MEMBER_STATUS.pending;
  gbar.innerHTML = `
    <p class="gallery-hello">
      <span class="avatar-sm">${esc(me.nickname.charAt(0))}</span>
      <strong>${esc(me.nickname)}</strong>
      <span class="badge" data-status="${status.badge}">${me.role === "admin" && isApproved() ? "운영진" : status.label}</span>
      ${me.status === "pending" ? `<span class="gallery-hint">운영진이 가입을 승인하면 글을 쓸 수 있어요.</span>` : ""}
    </p>
    <div class="gallery-actions">
      ${isApproved() ? `<a class="btn btn-primary btn-sm" href="#/write">${icon("pencil-simple")}글쓰기</a>` : ""}
      ${isAdmin() ? `<a class="btn btn-ghost btn-sm" href="#/members">${icon("users-three")}회원 관리</a>` : ""}
      <button class="btn btn-ghost btn-sm" type="button" data-action="logout">로그아웃</button>
    </div>`;
}

/* ── 목록 ── */
function postRow(p) {
  return `
    <li>
      <a class="post-row" href="#/post/${p.id}">
        <span class="post-no">${p.id}</span>
        <span class="post-title">
          <span>${esc(p.title)}</span>
          ${p.has_images ? icon("image") : ""}
          ${p.comment_count ? `<span class="post-count">[${p.comment_count}]</span>` : ""}
        </span>
        <span class="post-author">${esc(p.author?.nickname ?? "알 수 없음")}</span>
        <time class="post-date" datetime="${esc(p.created_at)}">${shortDate(p.created_at)}</time>
        <span class="post-likes">${icon("heart")}${p.like_count}</span>
      </a>
    </li>`;
}

function pager(page, pages, query) {
  const link = (n, label, attrs = "") =>
    `<a class="pager-link" href="#/?p=${n}${query ? `&q=${encodeURIComponent(query)}` : ""}" ${attrs}>${label}</a>`;
  const from = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = [];
  for (let n = from; n <= Math.min(pages, from + 4); n++) {
    nums.push(link(n, n, n === page ? 'aria-current="page"' : ""));
  }
  return `
    <nav class="pager" aria-label="페이지">
      ${page > 1 ? link(page - 1, icon("caret-left"), 'aria-label="이전 페이지"') : ""}
      ${nums.join("")}
      ${page < pages ? link(page + 1, icon("caret-right"), 'aria-label="다음 페이지"') : ""}
    </nav>`;
}

async function viewList(params) {
  const page = Math.max(1, Number(params.get("p")) || 1);
  const query = (params.get("q") || "").trim();
  gview.innerHTML = skeleton();
  const { rows, total } = await api.listPosts({ page, pageSize: PAGE_SIZE, query });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const empty = query ? "검색 결과가 없어요." : "아직 글이 없어요. 첫 글을 남겨 보세요.";

  gview.innerHTML = `
    <form class="gallery-search" data-form="search" role="search">
      <input class="input" type="search" name="q" value="${esc(query)}" placeholder="제목으로 찾기" aria-label="제목으로 찾기" />
      <button class="btn btn-ghost" type="submit">${icon("magnifying-glass")}검색</button>
    </form>
    <div class="post-table">
      <div class="post-row post-row-head" aria-hidden="true">
        <span>번호</span><span>제목</span><span>글쓴이</span><span>날짜</span><span>추천</span>
      </div>
      <ol class="post-list">${rows.length ? rows.map(postRow).join("") : `<li class="empty">${empty}</li>`}</ol>
    </div>
    ${pages > 1 ? pager(page, pages, query) : ""}`;
}

/* ── 글 하나 ── */
function commentItem(c) {
  const canDelete = me && (c.author?.id === me.id || isAdmin());
  return `
    <li class="comment">
      <div class="comment-head">
        <strong>${esc(c.author?.nickname ?? "알 수 없음")}</strong>
        <time datetime="${esc(c.created_at)}">${fullDate(c.created_at)}</time>
        ${canDelete ? `<button class="text-btn" type="button" data-action="delete-comment" data-id="${c.id}">삭제</button>` : ""}
      </div>
      <p>${linkify(c.body)}</p>
    </li>`;
}

async function viewPost(id) {
  gview.innerHTML = skeleton(4);
  const [post, comments, liked] = await Promise.all([api.getPost(id), api.listComments(id), api.hasLiked(id)]);
  if (!post) {
    gview.innerHTML = notice("글을 찾을 수 없어요", "삭제됐거나 주소가 잘못됐어요.", `<a class="btn btn-primary" href="#/">목록으로 ${icon("arrow-right")}</a>`);
    return;
  }
  ctx = { postId: id, liked, likes: post.like_count };
  const mine = me && post.author?.id === me.id;
  const images = (post.images ?? [])
    .map((src) => `<a href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="" loading="lazy" /></a>`)
    .join("");
  const commentBox = isApproved()
    ? `
      <form class="comment-form" data-form="comment">
        <textarea class="input" name="body" rows="3" maxlength="1000" placeholder="댓글을 남겨 주세요" aria-label="댓글" required></textarea>
        <div class="form-foot">
          <p class="form-error" role="alert"></p>
          <button class="btn btn-primary btn-sm" type="submit">댓글 달기</button>
        </div>
      </form>`
    : `<p class="comment-locked">${me ? "운영진이 가입을 승인하면 댓글을 쓸 수 있어요." : '<a href="#/login">로그인</a>하면 댓글을 쓸 수 있어요.'}</p>`;

  gview.innerHTML = `
    <article class="post">
      <a class="back-link" href="#/">${icon("arrow-left")}목록</a>
      <header class="post-head">
        <h2>${esc(post.title)}</h2>
        <p class="post-meta">
          <strong>${esc(post.author?.nickname ?? "알 수 없음")}</strong>
          <time datetime="${esc(post.created_at)}">${fullDate(post.created_at)}</time>
          ${post.updated_at ? "<span>수정됨</span>" : ""}
        </p>
      </header>
      <div class="post-body">${linkify(post.body)}</div>
      ${images ? `<div class="post-images">${images}</div>` : ""}
      <div class="post-actions">
        <button class="like-btn" type="button" data-action="like" aria-pressed="${liked}" ${isApproved() ? "" : 'disabled title="승인된 회원만 추천할 수 있어요"'}>
          ${icon("heart")}<span>추천</span><strong id="like-count">${post.like_count}</strong>
        </button>
        <span class="post-owner">
          ${mine && isApproved() ? `<a class="btn btn-ghost btn-sm" href="#/edit/${id}">${icon("pencil-simple")}수정</a>` : ""}
          ${mine || isAdmin() ? `<button class="btn btn-ghost btn-sm danger-btn" type="button" data-action="delete-post">${icon("trash")}삭제</button>` : ""}
        </span>
      </div>
      <section class="comments" aria-label="댓글">
        <h3>댓글 <span>${comments.length}</span></h3>
        <ul class="comment-list">${comments.length ? comments.map(commentItem).join("") : '<li class="empty">첫 댓글을 남겨 보세요.</li>'}</ul>
        ${commentBox}
      </section>
    </article>`;
}

/* ── 글쓰기 · 수정 ── */
function renderPicker() {
  const items = ctx.images
    .map(
      (img, i) => `
      <li class="picker-item">
        <img src="${esc(img.preview ?? img.url)}" alt="" />
        <button class="picker-remove" type="button" data-action="remove-image" data-index="${i}" aria-label="사진 빼기">${icon("x")}</button>
      </li>`
    )
    .join("");
  const add =
    ctx.images.length < MAX_IMAGES
      ? `<li><button class="picker-add" type="button" data-action="add-image">${icon("image")}<span>사진 추가</span></button></li>`
      : "";
  $("#image-picker").innerHTML = items + add;
}

async function viewForm(id) {
  if (!me) return go("#/login");
  if (!isApproved()) {
    gview.innerHTML = notice("아직 글을 쓸 수 없어요", "운영진이 가입을 승인하면 글을 쓸 수 있어요.", `<a class="btn btn-ghost" href="#/">목록으로</a>`);
    return;
  }
  let post = null;
  if (id) {
    gview.innerHTML = skeleton(3);
    post = await api.getPost(id);
    if (!post || post.author?.id !== me.id) {
      gview.innerHTML = notice("수정할 수 없는 글이에요", "본인이 쓴 글만 고칠 수 있어요.", `<a class="btn btn-ghost" href="#/">목록으로</a>`);
      return;
    }
  }
  ctx = { editId: id ?? null, images: (post?.images ?? []).map((url) => ({ url })) };

  gview.innerHTML = `
    <form class="post-form" data-form="post" novalidate>
      <h2>${id ? "글 수정" : "새 글"}</h2>
      <div class="field">
        <label class="field-label" for="post-title">제목</label>
        <input class="input" id="post-title" name="title" maxlength="100" required value="${esc(post?.title ?? "")}" />
      </div>
      <div class="field">
        <label class="field-label" for="post-body">내용</label>
        <textarea class="input" id="post-body" name="body" rows="14" maxlength="20000" required>${esc(post?.body ?? "")}</textarea>
      </div>
      <div class="field">
        <span class="field-label">사진 <span class="field-help">최대 ${MAX_IMAGES}장, 자동으로 줄여서 올려요</span></span>
        <ul class="image-picker" id="image-picker"></ul>
        <input type="file" id="image-input" accept="image/*" multiple hidden />
      </div>
      <div class="form-foot">
        <p class="form-error" role="alert"></p>
        <a class="btn btn-ghost" href="${id ? `#/post/${id}` : "#/"}">취소</a>
        <button class="btn btn-primary" type="submit">${id ? "수정하기" : "올리기"}</button>
      </div>
    </form>`;
  renderPicker();
  $("#image-input").addEventListener("change", (e) => {
    const room = MAX_IMAGES - ctx.images.length;
    [...e.target.files].slice(0, room).forEach((file) => ctx.images.push({ file, preview: URL.createObjectURL(file) }));
    e.target.value = "";
    renderPicker();
  });
  $("#post-title").focus();
}

async function submitPost(form) {
  const title = form.title.value.trim();
  const body = form.body.value.trim();
  if (!title) throw new Error("제목을 써 주세요.");
  if (!body) throw new Error("내용을 써 주세요.");

  const images = [];
  for (const img of ctx.images) {
    images.push(img.url ?? (await api.uploadImage(await resizeImage(img.file))));
  }
  if (ctx.editId) {
    await api.updatePost(ctx.editId, { title, body, images });
    go(`#/post/${ctx.editId}`);
  } else {
    go(`#/post/${await api.createPost({ title, body, images })}`);
  }
}

/* ── 로그인 · 회원가입 ── */
function viewLogin() {
  if (me) return go("#/");
  gview.innerHTML = `
    <form class="auth-form" data-form="login" novalidate>
      <h2>로그인</h2>
      <div class="field">
        <label class="field-label" for="login-email">이메일</label>
        <input class="input" id="login-email" name="email" type="email" autocomplete="email" required />
      </div>
      <div class="field">
        <label class="field-label" for="login-password">비밀번호</label>
        <input class="input" id="login-password" name="password" type="password" autocomplete="current-password" required />
      </div>
      <p class="form-error" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit">로그인</button>
      <p class="auth-switch">아직 회원이 아니라면 <a href="#/signup">회원가입</a></p>
    </form>`;
}

function viewSignup() {
  if (me) return go("#/");
  gview.innerHTML = `
    <form class="auth-form" data-form="signup" novalidate>
      <h2>회원가입</h2>
      <p class="auth-desc">가입 신청을 보내면 운영진이 확인하고 승인해요. 승인 후에 글과 댓글을 쓸 수 있어요.</p>
      <div class="field">
        <label class="field-label" for="su-email">이메일</label>
        <input class="input" id="su-email" name="email" type="email" autocomplete="email" required />
      </div>
      <div class="field">
        <label class="field-label" for="su-password">비밀번호</label>
        <input class="input" id="su-password" name="password" type="password" autocomplete="new-password" minlength="8" required />
        <p class="field-help">8자 이상</p>
      </div>
      <div class="field">
        <label class="field-label" for="su-password2">비밀번호 확인</label>
        <input class="input" id="su-password2" name="password2" type="password" autocomplete="new-password" required />
      </div>
      <div class="field">
        <label class="field-label" for="su-nickname">닉네임</label>
        <input class="input" id="su-nickname" name="nickname" maxlength="20" required />
        <p class="field-help">2~20자, 글과 댓글에 보이는 이름이에요.</p>
      </div>
      <div class="field">
        <label class="field-label" for="su-message">가입 메시지</label>
        <textarea class="input" id="su-message" name="message" rows="3" maxlength="300" placeholder="예: 경영학과 26학번 김OO입니다. 정기 세미나에 참여하고 있어요."></textarea>
        <p class="field-help">운영진만 볼 수 있어요. 누구인지 알 수 있게 적어 주세요.</p>
      </div>
      <p class="form-error" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit">가입 신청</button>
      <p class="auth-switch">이미 회원이라면 <a href="#/login">로그인</a></p>
    </form>`;
}

function checkSignup(form) {
  const email = form.email.value.trim();
  const password = form.password.value;
  const nickname = form.nickname.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("이메일 형식이 올바르지 않아요.");
  if (password.length < 8) throw new Error("비밀번호는 8자 이상이어야 해요.");
  if (password !== form.password2.value) throw new Error("비밀번호 확인이 일치하지 않아요.");
  if (nickname.length < 2 || nickname.length > 20) throw new Error("닉네임은 2~20자로 정해 주세요.");
  return { email, password, nickname, message: form.message.value.trim() };
}

/* ── 회원 관리 (운영진만) ── */
function memberRow(m) {
  const self = m.id === me.id;
  const btn = (action, value, label, cls = "btn-ghost") =>
    `<button class="btn ${cls} btn-sm" type="button" data-action="${action}" data-id="${esc(m.id)}" data-value="${value}">${label}</button>`;
  let actions = "";
  if (m.status === "pending") actions = btn("member-status", "approved", "승인", "btn-primary") + btn("member-status", "rejected", "거절");
  else if (m.status === "approved" && !self) {
    actions = (m.role === "admin" ? btn("member-role", "member", "일반 회원으로") : btn("member-role", "admin", "운영진으로")) + btn("member-status", "rejected", "이용 제한");
  } else if (m.status === "rejected") actions = btn("member-status", "approved", "다시 승인");

  return `
    <li class="member-admin-row">
      <div class="member-admin-info">
        <p><strong>${esc(m.nickname)}</strong>${m.role === "admin" ? '<span class="badge" data-status="upcoming">운영진</span>' : ""}${self ? '<span class="gallery-hint">나</span>' : ""}</p>
        <p class="member-admin-date">${fullDate(m.created_at)} 가입 신청</p>
        ${m.message ? `<p class="member-admin-msg">${multiline(m.message)}</p>` : ""}
      </div>
      <div class="member-admin-actions">${actions}</div>
    </li>`;
}

async function viewMembers() {
  if (!isAdmin()) {
    gview.innerHTML = notice("운영진만 볼 수 있어요", "회원 관리는 운영진 계정으로 로그인해야 해요.", `<a class="btn btn-ghost" href="#/">목록으로</a>`);
    return;
  }
  gview.innerHTML = skeleton(4);
  const members = await api.listMembers();
  const group = (status) => members.filter((m) => m.status === status);
  const block = (title, rows, empty) => `
    <section class="member-admin-group">
      <h3>${title} <span>${rows.length}</span></h3>
      <ul>${rows.length ? rows.map(memberRow).join("") : `<li class="empty">${empty}</li>`}</ul>
    </section>`;

  gview.innerHTML = `
    <div class="member-admin">
      <a class="back-link" href="#/">${icon("arrow-left")}목록</a>
      <h2>회원 관리</h2>
      ${block("승인 대기", group("pending"), "기다리는 가입 신청이 없어요.")}
      ${block("회원", group("approved"), "아직 승인된 회원이 없어요.")}
      ${block("이용 제한", group("rejected"), "이용이 제한된 회원이 없어요.")}
    </div>`;
}

/* ── 화면 전환 ── */
async function route() {
  const { path, params } = parseHash();
  let match;
  try {
    if ((match = path.match(/^\/post\/(\d+)$/))) await viewPost(Number(match[1]));
    else if (path === "/write") await viewForm();
    else if ((match = path.match(/^\/edit\/(\d+)$/))) await viewForm(Number(match[1]));
    else if (path === "/login") viewLogin();
    else if (path === "/signup") viewSignup();
    else if (path === "/members") await viewMembers();
    else await viewList(params);
  } catch (err) {
    gview.innerHTML = notice("불러오지 못했어요", esc(err.message), `<a class="btn btn-ghost" href="#/">목록으로</a>`);
  }
}

/* ── 버튼 · 폼 처리 (화면이 바뀌어도 한 곳에서 받는다) ── */
async function withBusy(button, task) {
  const label = button.innerHTML;
  button.disabled = true;
  button.textContent = "처리 중…";
  try {
    await task();
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.innerHTML = label;
    }
  }
}

document.addEventListener("click", async (e) => {
  const target = e.target.closest("[data-action]");
  if (!target || !api) return;
  const { action, id, value, index } = target.dataset;
  try {
    if (action === "logout") {
      await api.signOut();
      go("#/");
    } else if (action === "like") {
      const on = !ctx.liked;
      ctx.liked = on;
      ctx.likes += on ? 1 : -1;
      target.setAttribute("aria-pressed", String(on));
      $("#like-count").textContent = ctx.likes;
      await api.setLike(ctx.postId, on);
    } else if (action === "delete-post") {
      if (!confirm("이 글을 삭제할까요? 되돌릴 수 없어요.")) return;
      await withBusy(target, () => api.deletePost(ctx.postId));
      go("#/");
    } else if (action === "delete-comment") {
      if (!confirm("이 댓글을 삭제할까요?")) return;
      await api.deleteComment(Number(id));
      await viewPost(ctx.postId);
    } else if (action === "add-image") {
      $("#image-input").click();
    } else if (action === "remove-image") {
      ctx.images.splice(Number(index), 1);
      renderPicker();
    } else if (action === "member-status" || action === "member-role") {
      await withBusy(target, () => (action === "member-status" ? api.setMemberStatus(id, value) : api.setMemberRole(id, value)));
      await viewMembers();
    }
  } catch (err) {
    alertInline(target, err.message);
  }
});

function showToast(message, type = "info") {
  const toast = document.createElement("p");
  toast.className = "gallery-toast";
  toast.dataset.type = type;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 5000);
}

// 오류는 팝업 대신 가까운 자리에 보여 준다
function alertInline(near, message) {
  const box = near.closest("form")?.querySelector(".form-error");
  if (box) box.textContent = message;
  else showToast(message, "error");
}

document.addEventListener("submit", async (e) => {
  const form = e.target.closest("[data-form]");
  if (!form || !api) return;
  e.preventDefault();
  const kind = form.dataset.form;
  const errorBox = form.querySelector(".form-error");
  const submit = form.querySelector('[type="submit"]');
  if (errorBox) errorBox.textContent = "";

  try {
    if (kind === "search") {
      const q = form.q.value.trim();
      go(q ? `#/?q=${encodeURIComponent(q)}` : "#/");
    } else if (kind === "login") {
      const email = form.email.value.trim();
      const password = form.password.value;
      if (!email || !password) throw new Error("이메일과 비밀번호를 입력해 주세요.");
      await withBusy(submit, () => api.signIn({ email, password }));
      go("#/");
    } else if (kind === "signup") {
      const input = checkSignup(form);
      let result;
      await withBusy(submit, async () => (result = await api.signUp(input)));
      if (result.needsConfirm) {
        gview.innerHTML = notice("메일을 확인해 주세요", "메일함에서 인증 링크를 누른 뒤 로그인하면 가입 신청이 운영진에게 전달돼요.");
      } else {
        go("#/");
        showToast("가입 신청을 보냈어요. 운영진이 승인하면 글과 댓글을 쓸 수 있어요.");
      }
    } else if (kind === "comment") {
      const body = form.body.value.trim();
      if (!body) throw new Error("댓글 내용을 써 주세요.");
      await withBusy(submit, () => api.addComment(ctx.postId, body));
      await viewPost(ctx.postId);
    } else if (kind === "post") {
      await withBusy(submit, () => submitPost(form));
    }
  } catch (err) {
    if (errorBox) errorBox.textContent = err.message;
    else alertInline(form, err.message);
  }
});

/* ── 시작 ── */
async function initGallery() {
  const config = window.GALLERY_CONFIG ?? {};
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

  if (local && new URLSearchParams(location.search).has("mock")) {
    await loadScript("js/gallery-mock.js");
    api = createMockGalleryApi();
  } else if (config.url && config.anonKey) {
    await loadScript(SUPABASE_JS);
    api = createGalleryApi(config);
  } else {
    gbar.hidden = true;
    gview.innerHTML = notice("갤러리를 준비하고 있어요", "곧 회원가입과 글쓰기를 열 예정이에요. 조금만 기다려 주세요.");
    return;
  }

  await api.session();
  me = await api.me().catch(() => null);
  let lastUser = me?.id ?? null;

  api.onAuthChange(async (session) => {
    const userId = session?.user.id ?? null;
    me = userId ? await api.me().catch(() => null) : null;
    renderBar();
    if (userId !== lastUser) {
      lastUser = userId;
      route();
    }
  });

  addEventListener("hashchange", () => {
    route();
    $("#main").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  });
  renderBar();
  await route();
}

QLab.start(initGallery).catch((err) => console.error(err));
