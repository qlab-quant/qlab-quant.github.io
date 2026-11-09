// 화면 모드(다크 · 라이트 · 시스템). 화면이 그려지기 전에 적용되도록 <head>에서 불러옵니다.
// 브랜드 기본은 다크. data-theme-toggle 버튼을 누르면 다크 → 라이트 → 시스템 순서로 바뀝니다.
(function () {
  const KEY = "qlab-theme";
  const MODES = ["dark", "light", "system"];
  const LABELS = { system: "시스템 설정", light: "라이트 모드", dark: "다크 모드" };
  const ICONS = { system: "circle-half", light: "sun", dark: "moon" };

  // 스크롤 등장 효과처럼 JS가 있어야 하는 스타일은 이 클래스가 있을 때만 켠다
  document.documentElement.classList.add("js");

  let mode = "dark";
  try {
    mode = localStorage.getItem(KEY) || "dark";
  } catch {}

  function apply() {
    if (mode === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = mode;
  }

  function renderButtons() {
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.innerHTML = window.qlabIcon?.(ICONS[mode]) ?? "";
      btn.title = `화면 모드: ${LABELS[mode]}`;
      btn.setAttribute("aria-label", `화면 모드 바꾸기 (지금: ${LABELS[mode]})`);
    });
  }

  apply();

  document.addEventListener("DOMContentLoaded", () => {
    renderButtons();
    document.addEventListener("click", (e) => {
      if (!e.target.closest("[data-theme-toggle]")) return;
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      try {
        if (mode === "dark") localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, mode);
      } catch {}
      apply();
      renderButtons();
    });
  });
})();
