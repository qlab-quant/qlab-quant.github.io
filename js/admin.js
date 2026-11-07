// 관리 페이지 동작. 어떤 입력칸을 보여줄지는 admin-schema.js에서 정합니다.

/* ─────────────── 설정 ─────────────── */
// 사이트 내용이 저장되는 GitHub 저장소. 저장소를 옮기거나 이름을 바꾸면 여기도 고쳐 주세요.
// (비워 두면 계정.github.io/저장소 주소에서 자동으로 알아냅니다.)
const ADMIN_CONFIG = {
  owner: "qlab-quant",
  repo: "qlab-quant.github.io",
  branch: "main",
  dataPath: "js/data.js",
  imageDir: "images/members",
};

const STORAGE_KEYS = {
  repo: "qlab-admin-repo",
  token: "qlab-admin-token",
  draft: "qlab-admin-draft",
  preview: "qlab-preview",
};

const DATA_FILE_HEADER = `/*
 * Q-Lab 웹사이트 콘텐츠
 * 관리 페이지(admin.html)에서 저장하면 이 파일이 자동으로 다시 만들어집니다.
 * 직접 고칠 때는 JSON 형식(큰따옴표 사용, 마지막 항목 뒤 쉼표 금지)을 지켜 주세요.
 */
`;

const $ = (sel) => document.querySelector(sel);

const state = {
  mode: null, // "github" | "local"
  client: null,
  sha: null, // 불러온 data.js의 버전. 저장할 때 충돌 확인에 쓴다
  data: null, // 편집 중인 내용
  saved: null, // 마지막으로 저장된 내용
  section: ADMIN_SECTIONS[0].id,
  saving: false,
  lastSavedAt: null,
};

const openItems = new WeakSet(); // 펼쳐 둔 목록 항목
const photoPreviews = new Map(); // 방금 올린 사진 경로 → data URL (배포 전에도 미리 보이도록)
let focusItem = null; // 새로 추가해서 포커스를 줄 항목
let skipUnloadWarning = false;

/* ─────────────── 저장소(브라우저) ─────────────── */
const storage = {
  get(key) {
    try {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value, persist = true) {
    try {
      (persist ? localStorage : sessionStorage).setItem(key, value);
    } catch {}
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {}
  },
};

function readJson(key) {
  try {
    return JSON.parse(storage.get(key));
  } catch {
    return null;
  }
}

/* ─────────────── data.js 읽기 · 쓰기 ─────────────── */
function parseDataFile(text) {
  const start = text.indexOf("{", text.indexOf("SITE_DATA"));
  const end = text.lastIndexOf("}");
  return JSON.parse(text.slice(start, end + 1));
}

function buildDataFile(data) {
  return `${DATA_FILE_HEADER}window.SITE_DATA = ${JSON.stringify(data, null, 2)};\n`;
}

// 공지는 최신 날짜가 위로 오도록 정리해서 저장한다
function sortNotices(data) {
  if (!Array.isArray(data.notices)) return false;
  const before = JSON.stringify(data.notices);
  data.notices.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return JSON.stringify(data.notices) !== before;
}

/* ─────────────── 변경 추적 ─────────────── */
const snapshot = (value) => JSON.stringify(value ?? null);
const sectionById = (id) => ADMIN_SECTIONS.find((s) => s.id === id);
const sectionKeys = (section) => [...new Set(section.fields.map((f) => f.key.split(".")[0]))];
const isDirty = () => snapshot(state.data) !== snapshot(state.saved);
const isSectionDirty = (section) =>
  sectionKeys(section).some((key) => snapshot(state.data[key]) !== snapshot(state.saved[key]));
const dirtySections = () => ADMIN_SECTIONS.filter(isSectionDirty);

const getPath = (obj, path) => path.reduce((o, key) => o?.[key], obj);

function setPath(obj, path, value) {
  const parent = path.slice(0, -1).reduce((o, key) => (o[key] ??= {}), obj);
  parent[path[path.length - 1]] = value;
}

let draftTimer;
function onDataChange() {
  updateStatus();
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 400);
}

// 실수로 창을 닫아도 다시 열면 이어서 편집할 수 있게 임시 저장
function saveDraft() {
  if (isDirty()) storage.set(STORAGE_KEYS.draft, JSON.stringify({ sha: state.sha, data: state.data }));
  else storage.remove(STORAGE_KEYS.draft);
}

function restoreDraft() {
  const draft = readJson(STORAGE_KEYS.draft);
  if (!draft || draft.sha !== state.sha || snapshot(draft.data) === snapshot(state.data)) return;
  if (confirm("저장하지 않은 수정사항이 남아 있어요. 이어서 편집할까요?")) state.data = draft.data;
  else storage.remove(STORAGE_KEYS.draft);
}

/* ─────────────── DOM 헬퍼 ─────────────── */
const DOM_PROPS = new Set(["value", "checked", "disabled", "hidden", "open"]);

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  el.append(...children.flat(Infinity).filter((c) => c != null && c !== false));
  // select의 value는 option이 붙은 뒤에 넣어야 하므로 속성은 자식 다음에 설정한다
  for (const [key, value] of Object.entries(props)) {
    if (value == null || (value === false && !DOM_PROPS.has(key))) continue;
    if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "className") el.className = value;
    else if (DOM_PROPS.has(key)) el[key] = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  return el;
}

let toastTimer;
function toast(message, type = "info", duration = 4000) {
  const el = $("#toast");
  el.textContent = message;
  el.dataset.type = type;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), duration);
}

// login: 로그인(읽기) 단계의 오류인지. 같은 403이라도 원인이 다르다.
function describeError(err, { login = false } = {}) {
  if (err instanceof SyntaxError) {
    return "data.js 형식이 올바르지 않아 읽을 수 없어요. 마지막으로 직접 고친 부분을 확인해 주세요.";
  }
  if (err.status === undefined) {
    return err instanceof TypeError ? "네트워크 오류가 났어요. 인터넷 연결을 확인해 주세요." : err.message;
  }

  const owner = ADMIN_CONFIG.owner || "조직";
  const messages = {
    401: "토큰이 올바르지 않거나 만료됐어요. 새 토큰으로 다시 로그인해 주세요.",
    403: login
      ? `이 토큰으로 저장소에 접근할 수 없어요. 토큰의 Resource owner가 ${owner}인지, Repository access에서 이 저장소를 골랐는지, ${owner}의 승인을 기다리는 중은 아닌지 확인해 주세요.`
      : "이 토큰으로는 저장소에 쓸 권한이 없어요. 토큰의 Contents 권한이 'Read and write'인지 확인해 주세요.",
    404: "저장소나 파일을 찾을 수 없어요. 저장소 설정과 토큰의 저장소 접근 권한을 확인해 주세요.",
  };
  // 원인을 찾기 쉽도록 GitHub이 보낸 원래 메시지도 함께 보여 준다
  return `${messages[err.status] ?? "GitHub에서 오류가 났어요."} (GitHub ${err.status}: ${err.message})`;
}

/* ─────────────── 입력칸 ─────────────── */
let fieldSeq = 0;
const splitClean = (text, separator) => text.split(separator).map((s) => s.trim()).filter(Boolean);

function renderField(field, path, onEdit) {
  if (field.type === "list") return renderList(field, path);

  const id = `field-${++fieldSeq}`;
  const commit = (value) => {
    setPath(state.data, path, value);
    onEdit?.();
    onDataChange();
  };
  return h("div", { className: `field${field.half ? " half" : ""}` },
    h("label", { className: "field-label", for: id }, field.label),
    createControl(field, getPath(state.data, path), commit, id),
    field.help && h("p", { className: "field-help" }, field.help),
  );
}

function createControl(field, value, commit, id) {
  const base = { id, className: "input", placeholder: field.placeholder };
  const onText = (e) => commit(e.target.value);

  switch (field.type) {
    case "textarea":
      return h("textarea", { ...base, rows: field.rows ?? 4, value: value ?? "", oninput: onText });
    case "select":
      return h("select", { ...base, value: value ?? "", onchange: onText },
        field.options.map((o) => h("option", { value: o.value }, o.label)));
    case "lines":
      return h("textarea", {
        ...base, rows: field.rows ?? 4, value: (value ?? []).join("\n"),
        oninput: (e) => commit(splitClean(e.target.value, "\n")),
      });
    case "paragraphs":
      return h("textarea", {
        ...base, rows: field.rows ?? 8, value: (value ?? []).join("\n\n"),
        oninput: (e) => commit(splitClean(e.target.value, /\n\s*\n/)),
      });
    case "tags":
      return h("input", {
        ...base, type: "text", value: (value ?? []).join(", "),
        oninput: (e) => commit(splitClean(e.target.value, ",")),
      });
    case "image":
      return createImageControl(base, value, commit);
    default:
      return h("input", { ...base, type: field.type ?? "text", value: value ?? "", oninput: onText });
  }
}

function createImageControl(base, value, commit) {
  const canUpload = state.mode === "github";
  const thumb = h("div", { className: "thumb" });
  const drawThumb = () => {
    const path = input.value.trim();
    thumb.replaceChildren(path ? h("img", { src: photoPreviews.get(path) ?? path, alt: "" }) : h("span", {}, "없음"));
  };
  const input = h("input", {
    ...base, type: "text", value: value ?? "", placeholder: `${ADMIN_CONFIG.imageDir}/파일명.jpg`,
    oninput: (e) => {
      commit(e.target.value.trim());
      drawThumb();
    },
  });
  const uploadBtn = h("button", {
    type: "button", className: "btn btn-ghost btn-sm", disabled: !canUpload,
    title: canUpload ? null : "GitHub로 로그인하면 사진을 올릴 수 있어요",
    onclick: () => fileInput.click(),
  }, "사진 올리기");
  const fileInput = h("input", {
    type: "file", accept: "image/*", hidden: true,
    onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      uploadBtn.disabled = true;
      uploadBtn.textContent = "올리는 중…";
      try {
        const path = await uploadPhoto(file);
        input.value = path;
        commit(path);
        drawThumb();
        toast("사진을 올렸어요. '저장하기'를 눌러야 사이트에 반영돼요.");
      } catch (err) {
        toast(describeError(err), "error");
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "사진 올리기";
      }
    },
  });
  drawThumb();
  return h("div", { className: "image-control" }, thumb, input, uploadBtn, fileInput);
}

// 정사각형으로 잘라 줄인 뒤 저장소에 바로 올린다
async function uploadPhoto(file) {
  const dataUrl = await resizeImage(file, 480);
  const path = `${ADMIN_CONFIG.imageDir}/${Date.now()}.jpg`;
  await state.client.writeFile(path, { base64: dataUrl.split(",")[1], message: "관리자: 멤버 사진 추가" });
  photoPreviews.set(path, dataUrl);
  return path;
}

function resizeImage(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = h("canvas", { width: size, height: size });
      canvas.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("이미지 파일을 읽을 수 없어요."));
    img.src = URL.createObjectURL(file);
  });
}

/* ─────────────── 목록 ─────────────── */
function renderList(field, path) {
  let items = getPath(state.data, path);
  if (!Array.isArray(items)) {
    items = [];
    setPath(state.data, path, items);
  }

  const add = () => {
    const item = field.newItem();
    if (field.prepend) items.unshift(item);
    else items.push(item);
    openItems.add(item);
    focusItem = item;
    onDataChange();
    renderSection();
  };

  return h("div", { className: "list-field" },
    h("div", { className: "list-head" },
      field.label && h("span", { className: "field-label" }, field.label),
      h("span", { className: "list-count" }, `${items.length}개`),
      h("button", { type: "button", className: "btn btn-ghost btn-sm add-btn", onclick: add }, `+ ${field.addLabel ?? "추가"}`),
    ),
    field.help && h("p", { className: "field-help" }, field.help),
    items.length === 0 && h("p", { className: "list-empty" }, "아직 항목이 없어요."),
    items.map((_, i) => (field.compact ? renderRowItem : renderCardItem)(field, path, items, i)),
  );
}

function renderCardItem(field, path, items, index) {
  const item = items[index];
  const title = h("span", { className: "item-title" });
  const meta = h("span", { className: "item-meta" });
  const refresh = () => {
    title.textContent = field.itemTitle(item);
    meta.textContent = field.itemMeta?.(item) ?? "";
  };
  refresh();

  const details = h("details", {
    className: "item",
    open: openItems.has(item),
    ontoggle: () => (details.open ? openItems.add(item) : openItems.delete(item)),
  },
    h("summary", {}, title, meta, itemActions(items, index)),
    h("div", { className: "item-body" },
      field.fields.map((f) => renderField(f, [...path, index, ...f.key.split(".")], refresh))),
  );
  focusIfNew(item, details);
  return details;
}

function renderRowItem(field, path, items, index) {
  const row = h("div", { className: "row-item" },
    h("div", { className: "row-fields" },
      field.fields.map((f) => renderField(f, [...path, index, ...f.key.split(".")]))),
    itemActions(items, index),
  );
  focusIfNew(items[index], row);
  return row;
}

function focusIfNew(item, el) {
  if (focusItem !== item) return;
  focusItem = null;
  queueMicrotask(() => {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.querySelector("input, textarea")?.focus({ preventScroll: true });
  });
}

function itemActions(items, index) {
  const action = (label, title, run, { disabled = false, danger = false } = {}) =>
    h("button", {
      type: "button", className: `icon-btn${danger ? " danger" : ""}`, title, "aria-label": title, disabled,
      onclick: (e) => {
        e.preventDefault(); // summary 안에서 눌러도 항목이 접히거나 펼쳐지지 않게
        if (run() === false) return;
        onDataChange();
        renderSection();
      },
    }, label);
  const move = (to) => () => items.splice(to, 0, items.splice(index, 1)[0]);

  return h("span", { className: "item-actions" },
    action("↑", "위로", move(index - 1), { disabled: index === 0 }),
    action("↓", "아래로", move(index + 1), { disabled: index === items.length - 1 }),
    action("✕", "삭제", () => {
      if (!confirm("이 항목을 삭제할까요?")) return false;
      items.splice(index, 1);
    }, { danger: true }),
  );
}

/* ─────────────── 화면 ─────────────── */
function renderNav() {
  $("#admin-nav").replaceChildren(...ADMIN_SECTIONS.map((section) =>
    h("button", {
      type: "button", className: "nav-item", "data-section": section.id,
      "aria-current": section.id === state.section ? "page" : null,
      onclick: () => selectSection(section.id),
    }, h("span", {}, section.title), h("span", { className: "nav-dot", title: "저장하지 않은 변경사항", hidden: true }))));
}

function renderSection() {
  const section = sectionById(state.section);
  $("#admin-main").replaceChildren(
    h("header", { className: "panel-head" },
      h("h1", {}, section.title),
      section.desc && h("p", {}, section.desc)),
    h("div", { className: "panel-body" }, section.fields.map((f) => renderField(f, f.key.split(".")))),
  );
}

function selectSection(id) {
  state.section = id;
  history.replaceState(null, "", `#${id}`);
  renderNav();
  renderSection();
  updateStatus();
  window.scrollTo({ top: 0 });
}

function updateStatus() {
  const dirty = isDirty();
  const status = $("#save-status");
  status.classList.toggle("dirty", dirty && !state.saving);
  if (state.saving) status.textContent = "저장하는 중…";
  else if (dirty) status.textContent = "저장하지 않은 변경사항이 있어요";
  else if (state.lastSavedAt) status.textContent = `${state.lastSavedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}에 저장했어요`;
  else status.textContent = "변경사항 없음";

  $("#save-btn").disabled = state.saving || (state.mode === "github" && !dirty);
  $("#revert-btn").disabled = state.saving || !dirty;
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.querySelector(".nav-dot").hidden = !isSectionDirty(sectionById(btn.dataset.section));
  });
}

function openEditor(mode, { data, sha, userLabel }) {
  state.mode = mode;
  state.data = data;
  state.saved = structuredClone(data);
  state.sha = sha;
  restoreDraft();

  const fromHash = location.hash.slice(1);
  if (sectionById(fromHash)) state.section = fromHash;

  $("#login-view").hidden = true;
  $("#app-view").hidden = false;
  $("#admin-user").textContent = userLabel;
  $("#save-btn").textContent = mode === "github" ? "저장하기" : "data.js 다운로드";
  renderNav();
  renderSection();
  updateStatus();
}

/* ─────────────── 저장 ─────────────── */
function markSaved() {
  state.saved = structuredClone(state.data);
  state.lastSavedAt = new Date();
  storage.remove(STORAGE_KEYS.draft);
}

async function commitData(data, sha, message) {
  return state.client.writeFile(ADMIN_CONFIG.dataPath, {
    base64: utf8ToBase64(buildDataFile(data)),
    message,
    sha,
  });
}

async function save() {
  if (state.saving) return;
  const reordered = sortNotices(state.data);

  if (state.mode === "local") {
    downloadFile("data.js", buildDataFile(state.data));
    markSaved();
    updateStatus();
    if (reordered) renderSection();
    toast("data.js를 내려받았어요. 프로젝트의 js 폴더에 있는 파일과 바꿔 주세요.");
    return;
  }

  const message = `관리자: ${dirtySections().map((s) => s.title).join(", ") || "내용"} 수정`;
  state.saving = true;
  updateStatus();
  try {
    state.sha = await commitData(state.data, state.sha, message);
    markSaved();
    toast("저장했어요. 1~2분 뒤 사이트에 반영돼요.");
  } catch (err) {
    if (err.status !== 409) {
      toast(describeError(err), "error", 7000);
      return;
    }
    try {
      await resolveConflict(message);
    } catch (conflictErr) {
      toast(describeError(conflictErr), "error", 7000);
    }
  } finally {
    state.saving = false;
    updateStatus();
    if (reordered) renderSection();
  }
}

// 다른 운영진이 먼저 저장한 경우: 최신 내용에 내가 고친 메뉴만 덮어써서 다시 저장한다
async function resolveConflict(message) {
  const sections = dirtySections();
  const names = sections.map((s) => s.title).join(", ");
  const ok = confirm(
    `다른 운영진이 그사이 먼저 저장했어요.\n\n최신 내용에 내가 고친 메뉴(${names})만 합쳐서 다시 저장할까요?\n같은 메뉴를 함께 고쳤다면 그 메뉴는 내 내용으로 바뀌어요.`
  );
  if (!ok) {
    toast("저장하지 않았어요. 수정한 내용은 그대로 남아 있어요.", "error");
    return;
  }

  const latest = await state.client.readFile(ADMIN_CONFIG.dataPath);
  const merged = parseDataFile(latest.text);
  sections.flatMap(sectionKeys).forEach((key) => {
    merged[key] = structuredClone(state.data[key]);
  });
  sortNotices(merged);

  state.sha = await commitData(merged, latest.sha, message);
  state.data = merged;
  markSaved();
  renderSection();
  toast("최신 내용과 합쳐서 저장했어요. 1~2분 뒤 사이트에 반영돼요.");
}

function revert() {
  if (!confirm("저장하지 않은 수정사항을 모두 되돌릴까요?")) return;
  state.data = structuredClone(state.saved);
  storage.remove(STORAGE_KEYS.draft);
  renderSection();
  updateStatus();
}

function openPreview() {
  storage.set(STORAGE_KEYS.preview, JSON.stringify(state.data));
  window.open("index.html?preview", "qlab-preview");
}

function downloadFile(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
  h("a", { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ─────────────── 로그인 ─────────────── */
// 계정.github.io/저장소/admin.html 형태의 주소에서 저장소를 알아낸다
function detectRepo() {
  const { hostname, pathname } = location;
  if (!hostname.endsWith(".github.io")) return {};
  const first = pathname.split("/").filter(Boolean)[0];
  return {
    owner: hostname.slice(0, -".github.io".length),
    repo: first && !first.endsWith(".html") ? first : hostname,
  };
}

function loadRepoSettings() {
  const saved = readJson(STORAGE_KEYS.repo) ?? {};
  const detected = detectRepo();
  return {
    owner: saved.owner || ADMIN_CONFIG.owner || detected.owner || "",
    repo: saved.repo || ADMIN_CONFIG.repo || detected.repo || "",
    branch: saved.branch || ADMIN_CONFIG.branch || "main",
  };
}

const showLoginError = (message) => {
  $("#login-error").textContent = message;
};

function setLoginBusy(busy) {
  const btn = $("#login-btn");
  btn.disabled = busy;
  btn.textContent = busy ? "확인하는 중…" : "로그인";
  if (busy) showLoginError("");
}

async function loginWithGitHub(repo, token) {
  const client = createGitHubClient({ ...repo, token });
  const user = await client.getUser();
  const { text, sha } = await client.readFile(ADMIN_CONFIG.dataPath);
  state.client = client;
  openEditor("github", { data: parseDataFile(text), sha, userLabel: `@${user.login}` });
}

async function handleLogin(event) {
  event.preventDefault();
  const repo = {
    owner: $("#repo-owner").value.trim(),
    repo: $("#repo-name").value.trim(),
    branch: $("#repo-branch").value.trim() || "main",
  };
  const token = $("#token").value.trim();

  if (!token) {
    showLoginError("GitHub 토큰을 입력해 주세요.");
    return;
  }
  if (!repo.owner || !repo.repo) {
    $("#repo-settings").open = true;
    showLoginError("저장소 설정에 GitHub 계정과 저장소 이름을 적어 주세요.");
    return;
  }

  setLoginBusy(true);
  try {
    await loginWithGitHub(repo, token);
    storage.set(STORAGE_KEYS.repo, JSON.stringify(repo));
    storage.remove(STORAGE_KEYS.token);
    storage.set(STORAGE_KEYS.token, token, $("#remember").checked);
    $("#token").value = "";
  } catch (err) {
    showLoginError(describeError(err, { login: true }));
  } finally {
    setLoginBusy(false);
  }
}

async function openLocalEditor() {
  try {
    const res = await fetch(`${ADMIN_CONFIG.dataPath}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${ADMIN_CONFIG.dataPath}를 불러오지 못했어요.`);
    openEditor("local", { data: parseDataFile(await res.text()), sha: null, userLabel: "로컬 편집 모드" });
  } catch (err) {
    showLoginError(describeError(err));
  }
}

function logout() {
  if (isDirty() && !confirm("저장하지 않은 수정사항이 있어요. 그래도 로그아웃할까요?")) return;
  storage.remove(STORAGE_KEYS.token);
  skipUnloadWarning = true;
  location.reload();
}

async function init() {
  const repo = loadRepoSettings();
  $("#repo-owner").value = repo.owner;
  $("#repo-name").value = repo.repo;
  $("#repo-branch").value = repo.branch;
  if (!repo.owner || !repo.repo) $("#repo-settings").open = true;
  $("#local-btn").hidden = !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

  const token = storage.get(STORAGE_KEYS.token);
  if (!token || !repo.owner || !repo.repo) return;

  setLoginBusy(true);
  try {
    await loginWithGitHub(repo, token);
  } catch (err) {
    if (err.status === 401) storage.remove(STORAGE_KEYS.token);
    showLoginError(describeError(err, { login: true }));
  } finally {
    setLoginBusy(false);
  }
}

/* ─────────────── 이벤트 ─────────────── */
$("#login-form").addEventListener("submit", handleLogin);
$("#local-btn").addEventListener("click", openLocalEditor);
$("#save-btn").addEventListener("click", save);
$("#revert-btn").addEventListener("click", revert);
$("#preview-btn").addEventListener("click", openPreview);
$("#logout-btn").addEventListener("click", logout);
$("#admin-logo").addEventListener("click", (e) => {
  e.preventDefault();
  selectSection(ADMIN_SECTIONS[0].id);
});

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && state.data) {
    e.preventDefault();
    if (!$("#save-btn").disabled) save();
  }
});

window.addEventListener("beforeunload", (e) => {
  if (state.data && isDirty() && !skipUnloadWarning) {
    e.preventDefault();
    e.returnValue = "";
  }
});

init();
