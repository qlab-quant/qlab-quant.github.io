# Q-Lab 웹사이트

퀀트 투자 동아리 Q-Lab의 홈페이지입니다. 빌드 도구 없이 HTML/CSS/JS만으로 만들어져 있고, GitHub Pages로 무료 배포합니다.

- 사이트: https://qlab-quant.github.io/
- 관리 페이지: https://qlab-quant.github.io/admin.html
- 저장소: https://github.com/qlab-quant/qlab-quant.github.io

## 폴더 구조

```
index.html            홈페이지
research.html         리서치 페이지 (목록 · 글 · 코드 저장소)
gallery.html          갤러리 (회원 게시판)
admin.html            관리 페이지 (운영진 전용)
404.html              없는 주소로 들어왔을 때 보이는 페이지
css/style.css         사이트 디자인 (모든 페이지 공통)
css/admin.css         관리 페이지 디자인
js/data.js            ← 사이트에 들어가는 모든 내용
js/common.js          모든 페이지 공통: 내비게이션, 푸터, 내용 불러오기
js/main.js            홈페이지 그리기
js/research.js        리서치 페이지 그리기 (마크다운 · 수식 · GitHub 저장소 정보)
js/gallery.js         갤러리 화면
js/gallery-api.js     갤러리 ↔ Supabase 연결
js/gallery-config.js  갤러리가 쓰는 Supabase 주소와 공개 키
js/gallery-mock.js    내 컴퓨터에서 갤러리를 시험해 보는 가짜 서버 (gallery.html?mock)
js/effects.js         마우스 효과 (돋보기, 점 격자, 카드 빛, 기울기, 자석 버튼)
js/theme.js           화면 모드(시스템 · 라이트 · 다크) 전환
js/admin*.js          관리 페이지 동작 · 메뉴 정의 · GitHub 저장
research/             리서치 본문(.md), PDF, 그림(images/)
supabase/schema.sql   갤러리 데이터베이스와 보안 규칙
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

## 리서치

관리 페이지 **리서치** 메뉴에서 올립니다. 리서치 페이지 주소: https://qlab-quant.github.io/research.html

- **형식**: '사이트에서 읽는 글'(마크다운)이나 'PDF 파일' 중 고릅니다.
- **글**: 본문 칸에 마크다운으로 씁니다. 제목은 `##`, 수식은 `$r_t$`나 `$$ ... $$`, 표와 코드 블록도 됩니다. **그림 넣기** 버튼으로 그림을 올리면 커서 자리에 들어갑니다. 예시는 `research/sample-momentum.md`를 보세요.
- **PDF**: **PDF 올리기**로 20MB 이하 파일을 올립니다.
- **코드 저장소**: `qlab-quant/저장소이름`이나 GitHub 주소를 넣으면 설명, 별, 언어, 업데이트 날짜가 자동으로 보입니다.
- 리서치 페이지 아래에는 `qlab-quant` 조직의 공개 저장소가 자동으로 나옵니다(사이트 저장소 제외). 조직 이름은 **기본 정보 → GitHub 조직 이름**에서 바꿉니다.

## 영상 (유튜브)

**기본 정보 → 유튜브 채널 주소**에 채널 주소를 넣으면 푸터에 유튜브 링크가 생기고, **영상** 메뉴에 영상을 추가하면 홈페이지에 '영상' 섹션이 나타납니다. 둘 다 비어 있으면 섹션은 숨겨집니다.

## 갤러리 (회원 게시판)

회원가입 → 운영진 승인 → 승인된 회원만 글 · 댓글 · 추천 · 사진을 올리는 게시판입니다. 읽기는 누구나 할 수 있습니다. 로그인과 데이터 저장은 [Supabase](https://supabase.com)(무료)를 씁니다.

### 처음 설정 (한 번만)

1. 동아리 공용 계정으로 https://supabase.com 에 가입하고 **New project**를 만듭니다. Region은 `Northeast Asia (Seoul)`, 데이터베이스 비밀번호는 따로 보관합니다.
2. **SQL Editor**에 `supabase/schema.sql` 내용을 통째로 붙여 넣고 **Run** 합니다.
3. **Authentication → Sign In / Providers → Email**에서 **Confirm email**을 끕니다. 가입은 운영진 승인으로 걸러지고, 무료 메일 발송은 시간당 몇 통으로 제한되어 있어서 켜 두면 가입이 막힙니다.
4. **Authentication → URL Configuration**의 Site URL을 `https://qlab-quant.github.io`로 바꿉니다.
5. **Project Settings → API**의 `Project URL`과 `anon public` 키를 `js/gallery-config.js`에 넣고 push 합니다. anon 키는 공개용이라 괜찮지만, **`service_role` 키는 절대 넣거나 공유하지 마세요.**
6. 사이트 갤러리에서 회원가입을 한 뒤, SQL Editor에서 아래 한 줄로 첫 운영진을 지정합니다.
   ```sql
   update public.profiles set status = 'approved', role = 'admin' where nickname = '내닉네임';
   ```

### 운영

- 가입 신청은 갤러리의 **회원 관리**(`gallery.html#/members`)에서 승인하거나 거절합니다. 관리 페이지 위쪽 **갤러리 회원** 링크로도 갈 수 있습니다.
- 회원을 **운영진으로** 바꾸면 그 사람도 승인과 글 삭제를 할 수 있습니다. 문제가 있는 회원은 **이용 제한**으로 바꾸면 글을 쓸 수 없습니다.
- 무료 Supabase 프로젝트는 1주일 동안 요청이 없으면 멈춥니다. 저장소의 GitHub Actions(**Supabase 깨우기**)가 사흘마다 깨워 줍니다.
- 비밀번호 찾기는 메일 발송 설정이 필요해 아직 없습니다. 회원이 비밀번호를 잊으면 Supabase **Authentication → Users**에서 계정을 지우고 다시 가입하게 해 주세요.
- 내 컴퓨터에서 `gallery.html?mock`으로 열면 Supabase 없이 가짜 데이터로 화면을 시험해 볼 수 있습니다.

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
