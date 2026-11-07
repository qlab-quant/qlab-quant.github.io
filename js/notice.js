// 공지 페이지. 공지는 관리 페이지의 '공지' 메뉴(또는 js/data.js의 notices)에서 씁니다.

const NOTICE_PAGE = 10;

function renderNotices(data) {
  const list = $("#notice-list");
  const moreBtn = $("#notice-more");
  const sorted = [...(data.notices ?? [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
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

QLab.start(renderNotices).catch((err) => console.error(err));
