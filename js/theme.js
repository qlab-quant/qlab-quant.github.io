// 화면 모드(시스템 · 라이트 · 다크). 화면이 그려지기 전에 적용되도록 <head>에서 불러옵니다.
// data-theme-toggle 속성이 있는 버튼을 누르면 시스템 → 라이트 → 다크 순서로 바뀝니다.
(function () {
  const KEY = "qlab-theme";
  const MODES = ["system", "light", "dark"];
  const LABELS = { system: "시스템 설정", light: "라이트 모드", dark: "다크 모드" };
  const svg = (body) =>
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const ICONS = {
    system: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>'),
    light: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    dark: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  };

  let mode = "system";
  try {
    mode = localStorage.getItem(KEY) || "system";
  } catch {}

  function apply() {
    if (mode === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = mode;
  }

  function renderButtons() {
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.innerHTML = ICONS[mode];
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
        if (mode === "system") localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, mode);
      } catch {}
      apply();
      renderButtons();
    });
  });
})();
