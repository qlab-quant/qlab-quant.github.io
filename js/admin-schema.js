/*
 * 관리 페이지에 보여줄 메뉴와 입력칸 정의
 * data.js에 새 항목을 추가하면 여기에도 입력칸을 추가해 주세요.
 *
 * key   : data.js 안의 위치 (점으로 구분, 예: "site.contact.email")
 * type  : text(기본) | textarea | url | email | date | select | image
 *         lines      → 한 줄에 하나씩 적는 목록
 *         paragraphs → 빈 줄로 구분하는 문단 목록
 *         tags       → 쉼표로 구분하는 태그
 *         list       → 항목을 추가·삭제·순서 변경할 수 있는 목록 (fields에 항목의 입력칸 정의)
 *         markdown-file → 저장소의 .md 파일 본문을 고치는 큰 입력칸 (값은 파일 경로)
 *         pdf-file      → PDF를 저장소에 올리는 칸 (값은 파일 경로)
 * half  : true면 두 칸 중 한 칸 너비
 * showIf: (항목) => true일 때만 보이는 칸,  rerender: 값이 바뀌면 화면을 다시 그린다
 */

const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ADMIN_SECTIONS = [
  {
    id: "notices",
    title: "공지",
    desc: "새 공지를 쓰거나 기존 공지를 고칠 수 있어요. 사이트에는 날짜가 최신인 순서로 보여요.",
    fields: [
      {
        key: "notices",
        type: "list",
        addLabel: "새 공지",
        prepend: true,
        itemTitle: (n) => n.title || "(제목 없음)",
        itemMeta: (n) => [n.category, n.date].filter(Boolean).join(" · "),
        newItem: () => ({ date: todayString(), category: "공지", title: "", body: "" }),
        fields: [
          { key: "title", label: "제목" },
          { key: "date", label: "날짜", type: "date", half: true },
          { key: "category", label: "분류", half: true, placeholder: "공지, 세미나, 모집 등" },
          { key: "body", label: "내용", type: "textarea", rows: 8 },
        ],
      },
    ],
  },
  {
    id: "research",
    title: "리서치",
    desc: "리서치 페이지에 올라가는 글이에요. 사이트에서 바로 읽는 글(마크다운)이나 PDF로 올릴 수 있어요.",
    fields: [
      {
        key: "research",
        type: "list",
        addLabel: "새 리서치",
        prepend: true,
        itemTitle: (r) => r.title || "(제목 없음)",
        itemMeta: (r) => [r.format === "pdf" ? "PDF" : "글", r.date].filter(Boolean).join(" · "),
        newItem: () => {
          const id = `r${Date.now().toString(36)}`;
          return { id, title: "", date: todayString(), authors: [], summary: "", tags: [], format: "article", file: `research/${id}.md`, pdf: "", repo: "" };
        },
        fields: [
          { key: "title", label: "제목" },
          { key: "date", label: "발행일", type: "date", half: true },
          {
            key: "format",
            label: "형식",
            type: "select",
            half: true,
            rerender: true,
            options: [
              { value: "article", label: "사이트에서 읽는 글" },
              { value: "pdf", label: "PDF 파일" },
            ],
          },
          { key: "authors", label: "저자", type: "tags", help: "쉼표로 구분해 주세요. 예: 박OO, 최OO" },
          { key: "summary", label: "요약", type: "textarea", rows: 3, help: "목록과 글 맨 위에 보이는 두세 문장이에요." },
          { key: "tags", label: "태그", type: "tags", help: "쉼표로 구분해 주세요. 리서치 페이지에서 태그로 거를 수 있어요." },
          {
            key: "repo",
            label: "코드 저장소 (선택)",
            placeholder: "qlab-quant/momentum-backtest",
            help: "GitHub 저장소 이름이나 주소를 넣으면 설명, 별, 언어, 업데이트 날짜가 자동으로 보여요.",
          },
          { key: "file", label: "본문 (마크다운)", type: "markdown-file", showIf: (r) => r.format !== "pdf" },
          { key: "pdf", label: "PDF 파일", type: "pdf-file", showIf: (r) => r.format === "pdf" },
        ],
      },
    ],
  },
  {
    id: "videos",
    title: "영상",
    desc: "홈페이지 '영상' 섹션에 보이는 유튜브 영상이에요. 채널 주소는 '기본 정보'에 넣어 주세요.",
    fields: [
      {
        key: "videos",
        type: "list",
        addLabel: "영상 추가",
        prepend: true,
        itemTitle: (v) => v.title || "(제목 없음)",
        newItem: () => ({ title: "", url: "" }),
        fields: [
          { key: "title", label: "제목", placeholder: "OO주차 정기 세미나: 팩터 투자 입문" },
          { key: "url", label: "유튜브 주소", type: "url", placeholder: "https://www.youtube.com/watch?v=...", help: "영상 페이지 주소를 그대로 붙여 넣으면 돼요. 공유 주소(youtu.be)도 괜찮아요." },
        ],
      },
    ],
  },
  {
    id: "recruit",
    title: "모집",
    desc: "모집을 시작할 때 상태를 '모집 중'으로 바꾸고 지원서 링크를 넣어 주세요.",
    fields: [
      {
        key: "recruit.status",
        label: "모집 상태",
        type: "select",
        half: true,
        options: [
          { value: "open", label: "모집 중" },
          { value: "upcoming", label: "모집 예정" },
          { value: "closed", label: "모집 마감" },
        ],
      },
      { key: "recruit.period", label: "지원 기간", half: true, placeholder: "2027.03.02(화) ~ 2027.03.12(금)" },
      { key: "recruit.title", label: "모집 제목", placeholder: "2027년 1학기 신입 부원 모집" },
      {
        key: "recruit.applyUrl",
        label: "지원서 링크",
        type: "url",
        placeholder: "https://forms.gle/...",
        help: "모집 상태가 '모집 중'일 때만 사이트의 지원하기 버튼이 켜져요.",
      },
      { key: "recruit.target", label: "이런 분을 찾습니다", type: "lines", rows: 5, help: "한 줄에 하나씩 적어 주세요." },
      {
        key: "recruit.steps",
        label: "선발 절차",
        type: "list",
        compact: true,
        addLabel: "단계 추가",
        newItem: () => ({ title: "", date: "" }),
        fields: [
          { key: "title", label: "단계", half: true, placeholder: "서류 접수" },
          { key: "date", label: "날짜", half: true, placeholder: "03.02 ~ 03.12" },
        ],
      },
      {
        key: "recruit.faq",
        label: "자주 묻는 질문",
        type: "list",
        addLabel: "질문 추가",
        itemTitle: (f) => f.q || "(질문 없음)",
        newItem: () => ({ q: "", a: "" }),
        fields: [
          { key: "q", label: "질문" },
          { key: "a", label: "답변", type: "textarea", rows: 3 },
        ],
      },
    ],
  },
  {
    id: "members",
    title: "멤버",
    desc: "운영진 목록을 관리해요. 사진이 없으면 이름 첫 글자가 대신 보여요.",
    fields: [
      { key: "membersTerm", label: "멤버 섹션 부제목", placeholder: "2027년 운영진" },
      {
        key: "members",
        label: "멤버 목록",
        type: "list",
        addLabel: "멤버 추가",
        itemTitle: (m) => m.name || "(이름 없음)",
        itemMeta: (m) => m.role,
        newItem: () => ({ name: "", role: "", major: "", intro: "", photo: "" }),
        fields: [
          { key: "name", label: "이름", half: true },
          { key: "role", label: "직책", half: true, placeholder: "회장" },
          { key: "major", label: "학과 · 학번", placeholder: "경영학과 26학번" },
          { key: "intro", label: "한 줄 소개" },
          { key: "photo", label: "사진", type: "image" },
        ],
      },
    ],
  },
  {
    id: "projects",
    title: "프로젝트",
    desc: "리서치 프로젝트 목록이에요. 위에 있는 항목이 사이트에서도 먼저 보여요.",
    fields: [
      {
        key: "projects",
        type: "list",
        addLabel: "프로젝트 추가",
        prepend: true,
        itemTitle: (p) => p.title || "(제목 없음)",
        itemMeta: (p) => p.period,
        newItem: () => ({ title: "", period: "", summary: "", tags: [], link: "" }),
        fields: [
          { key: "title", label: "제목" },
          { key: "period", label: "학기", half: true, placeholder: "2026-2" },
          { key: "link", label: "링크 (선택)", type: "url", half: true, placeholder: "https://github.com/..." },
          { key: "summary", label: "요약", type: "textarea", rows: 3 },
          { key: "tags", label: "태그", type: "tags", help: "쉼표로 구분해 주세요. 예: Python, 팩터 투자" },
        ],
      },
    ],
  },
  {
    id: "activities",
    title: "활동",
    desc: "활동 섹션에 보이는 카드예요.",
    fields: [
      {
        key: "activities",
        type: "list",
        addLabel: "활동 추가",
        itemTitle: (a) => a.title || "(제목 없음)",
        itemMeta: (a) => a.cycle,
        newItem: () => ({ title: "", cycle: "", desc: "" }),
        fields: [
          { key: "title", label: "활동 이름", half: true },
          { key: "cycle", label: "주기", half: true, placeholder: "매주, 학기별 등" },
          { key: "desc", label: "설명", type: "textarea", rows: 3 },
        ],
      },
    ],
  },
  {
    id: "about",
    title: "소개",
    desc: "소개 섹션의 본문과 핵심 가치예요.",
    fields: [
      { key: "about.paragraphs", label: "소개 글", type: "paragraphs", rows: 8, help: "문단 사이는 빈 줄로 구분해 주세요." },
      {
        key: "about.values",
        label: "핵심 가치",
        type: "list",
        addLabel: "가치 추가",
        itemTitle: (v) => v.title || "(제목 없음)",
        newItem: () => ({ title: "", desc: "" }),
        fields: [
          { key: "title", label: "제목" },
          { key: "desc", label: "설명" },
        ],
      },
    ],
  },
  {
    id: "site",
    title: "기본 정보",
    desc: "동아리 이름, 첫 화면 문구, 숫자, 연락처예요.",
    fields: [
      { key: "site.name", label: "짧은 이름", half: true },
      { key: "site.fullName", label: "전체 이름", half: true },
      { key: "site.university", label: "소속", placeholder: "OO대학교 중앙동아리" },
      { key: "site.tagline", label: "첫 화면 큰 문구", type: "textarea", rows: 2, help: "줄바꿈이 사이트에도 그대로 반영돼요." },
      { key: "site.description", label: "첫 화면 소개 문장", type: "textarea", rows: 3 },
      {
        key: "site.manifesto",
        label: "큰 문구 섹션",
        type: "textarea",
        rows: 3,
        help: "첫 화면 아래에 크게 보이고, 스크롤하면 단어가 하나씩 켜져요. 줄바꿈 그대로 두세 줄로 써 주세요.",
      },
      {
        key: "site.stats",
        label: "숫자 통계",
        type: "list",
        compact: true,
        addLabel: "숫자 추가",
        newItem: () => ({ value: "", label: "" }),
        fields: [
          { key: "value", label: "숫자", half: true, placeholder: "120명" },
          { key: "label", label: "설명", half: true, placeholder: "누적 부원" },
        ],
      },
      { key: "site.contact.email", label: "이메일", type: "email" },
      { key: "site.contact.instagram", label: "인스타그램 주소", type: "url", half: true, placeholder: "https://instagram.com/..." },
      { key: "site.contact.youtube", label: "유튜브 채널 주소", type: "url", half: true, placeholder: "https://www.youtube.com/@..." },
      { key: "site.contact.github", label: "GitHub 주소", type: "url", half: true, placeholder: "https://github.com/..." },
      {
        key: "site.githubOrg",
        label: "GitHub 조직 이름",
        half: true,
        placeholder: "qlab-quant",
        help: "리서치 페이지에 이 조직의 공개 저장소가 자동으로 보여요.",
      },
    ],
  },
];
