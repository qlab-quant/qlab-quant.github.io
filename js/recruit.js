// 모집 페이지. 내용은 관리 페이지의 '모집' 메뉴(또는 js/data.js의 recruit)에서 고칩니다.

function renderRecruit(data) {
  const recruit = data.recruit;
  const status = recruitStatus(data);
  const applyUrl = safeUrl(recruit.applyUrl);

  const badge = $("#recruit-badge");
  badge.textContent = status.label;
  badge.dataset.status = recruit.status;
  $("#recruit-title").textContent = recruit.title;
  $("#recruit-period").textContent = recruit.period;

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

QLab.start(renderRecruit).catch((err) => console.error(err));
