# Q-Lab 웹사이트

퀀트 투자 동아리 Q-Lab의 홈페이지입니다. 빌드 도구 없이 HTML/CSS/JS만으로 만들어져 있고, GitHub Pages로 무료 배포합니다.

- 사이트: https://qlab-quant.github.io/
- 관리 페이지: https://qlab-quant.github.io/admin.html
- 저장소: https://github.com/qlab-quant/qlab-quant.github.io

## 폴더 구조

```
index.html            홈페이지
admin.html            관리 페이지 (운영진 전용)
css/style.css         홈페이지 디자인
css/admin.css         관리 페이지 디자인
js/data.js            ← 사이트에 들어가는 모든 내용
js/main.js            data.js 내용을 홈페이지에 그려 주는 코드
js/admin.js           관리 페이지 동작
js/admin-schema.js    관리 페이지에 보여줄 메뉴와 입력칸 정의
js/admin-github.js    GitHub 저장소 읽기·쓰기
js/theme.js           화면 모드(시스템 · 라이트 · 다크) 전환
404.html              없는 주소로 들어왔을 때 보이는 페이지
images/members/       멤버 사진 (관리 페이지에서 올리면 여기에 저장됨)
favicon.svg           브라우저 탭 아이콘
```

## 디자인 규칙

디자인은 [elayadesign/ai-design-skills](https://github.com/elayadesign/ai-design-skills)의 `landing-page-design` 시각 규칙을 따릅니다. 색 · 글자 크기 · 간격 · 곡률 · 움직임 값은 `css/style.css` 맨 위 토큰에만 정의되어 있으니, 새 스타일을 만들 때도 숫자를 직접 쓰지 말고 토큰(`var(--s-300)`, `var(--heading-3)` 등)을 써 주세요.

```
글꼴     Geist (한글은 Pretendard), 숫자는 Geist Mono
아이콘   Phosphor Icons
간격     2 · 4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 · 64 · 80 · 96px 만 사용
```

## 내용 수정하기

내용은 전부 `js/data.js`에 있고, 보통은 **관리 페이지**에서 고칩니다.

| 관리 페이지 메뉴 | 수정할 수 있는 것 |
| --- | --- |
| 공지 | 공지 작성·수정·삭제 (날짜순 자동 정렬) |
| 모집 | 모집 상태(모집 중/예정/마감), 기간, 지원서 링크, 지원 대상, 선발 절차, FAQ |
| 멤버 | 운영진 목록과 사진 |
| 프로젝트 | 프로젝트 목록 |
| 활동 | 활동 카드 |
| 소개 | 소개 글과 핵심 가치 |
| 기본 정보 | 동아리 이름, 첫 화면 문구, 숫자 통계, 연락처 |

- **모집 시작할 때**: 모집 메뉴에서 상태를 `모집 중`으로 바꾸고 지원서 링크를 넣으면 지원 버튼이 켜집니다.
- **미리보기**: 저장하기 전에 `미리보기`를 누르면 수정한 내용이 반영된 홈페이지를 새 탭에서 볼 수 있습니다.
- **임시 저장**: 저장하지 않고 창을 닫아도 같은 브라우저에서 다시 열면 이어서 편집할지 물어봅니다.

`js/data.js`를 직접 고쳐도 되지만, JSON 형식(큰따옴표 사용, 마지막 항목 뒤 쉼표 금지)을 지켜야 관리 페이지에서 다시 읽을 수 있습니다.

## 관리 페이지

주소: https://qlab-quant.github.io/admin.html

관리 페이지에서 `저장하기`를 누르면 GitHub 저장소의 `js/data.js`가 바로 수정(커밋)되고, 1~2분 뒤 사이트에 반영됩니다. 서버가 따로 없기 때문에 **GitHub 토큰**이 로그인 역할을 합니다.

### 운영진 준비 (사람마다 한 번)

1. 조직 Owner가 [qlab-quant 조직](https://github.com/orgs/qlab-quant/people)의 **People → Invite member**로 운영진의 GitHub 계정을 초대하고, 저장소 `qlab-quant.github.io`에 Write 권한을 줍니다.
2. 운영진은 [토큰 만들기](https://github.com/settings/personal-access-tokens/new) 페이지에서 **Fine-grained token**을 만듭니다.
   - **Token name**: `Q-Lab 관리자` 등 알아보기 쉬운 이름
   - **Expiration**: 임기가 끝나는 날짜 정도로 설정
   - **Resource owner**: `qlab-quant`
   - **Repository access**: `Only select repositories` → `qlab-quant.github.io`만 선택
   - **Permissions → Repository permissions → Contents**: `Read and write`
3. 만들어진 토큰(`github_pat_...`)을 복사해 관리 페이지에 붙여 넣고 로그인합니다.

조직 설정에서 fine-grained token 승인을 켜 두었다면, 토큰을 만든 뒤 조직 Owner가 **Settings → Personal access tokens → Pending requests**에서 승인해야 합니다.

### 보안 수칙

- 토큰은 비밀번호와 같습니다. 단톡방이나 문서에 공유하지 말고 각자 자기 토큰을 만드세요.
- 공용 PC에서는 `로그인 유지`를 체크하지 마세요. 체크하지 않으면 브라우저 탭을 닫을 때 로그인이 풀립니다.
- 운영진이 바뀌면 저장소 Collaborators에서 이전 운영진을 빼고, 본인도 [토큰 목록](https://github.com/settings/personal-access-tokens)에서 토큰을 삭제하세요.
- `admin.html`은 누구나 열 수 있지만, 저장소 쓰기 권한이 있는 토큰이 없으면 아무것도 바꿀 수 없습니다.

### 여러 명이 동시에 고쳤을 때

다른 운영진이 먼저 저장했다면 관리 페이지가 알려 주고, 최신 내용에 **내가 고친 메뉴만** 합쳐서 다시 저장할지 물어봅니다. 같은 메뉴(예: 둘 다 공지)를 동시에 고쳤다면 그 메뉴는 나중에 저장한 사람의 내용이 됩니다.

### 도메인을 붙이거나 저장소를 옮겼다면

관리 페이지가 저장할 저장소는 `js/admin.js` 맨 위 `ADMIN_CONFIG`에 적혀 있습니다(`qlab-quant` / `qlab-quant.github.io`). 도메인을 새로 붙이는 것만으로는 바꿀 필요가 없고, 저장소 이름이나 조직을 바꿨을 때만 고쳐 주세요.

도메인을 붙였다면 `index.html` 위쪽의 `canonical`, `og:url` 주소도 새 도메인으로 바꿔 주세요. 검색 엔진과 카카오톡·인스타그램 링크 미리보기가 이 주소를 씁니다.

## 로컬에서 보기

```bash
python3 -m http.server 8000
```

그다음 http://localhost:8000 으로 접속합니다. `index.html`을 파일로 바로 열어도 홈페이지는 보입니다.

로컬 서버(localhost)에서 `admin.html`을 열면 **로그인 없이 로컬에서 편집하기**를 쓸 수 있습니다. 이때는 저장 대신 수정된 `data.js`를 내려받으니, `js/data.js`와 바꿔 주세요.

## 배포 (GitHub Pages)

`main` 브랜치에 push 하거나 관리 페이지에서 저장하면 1~2분 뒤 https://qlab-quant.github.io/ 에 자동으로 반영됩니다. 배포 설정은 저장소 **Settings → Pages**에서 볼 수 있습니다(Source: `main` 브랜치 `/ (root)`).
