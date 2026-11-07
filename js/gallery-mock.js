// 개발용 가짜 갤러리 서버. 내 컴퓨터(localhost)에서 gallery.html?mock 으로 열 때만 쓰입니다.
// 브라우저에만 저장되고, 실제 사이트에는 영향이 없어요. 테스트 계정 비밀번호는 아무 값이나 됩니다.
// 콘솔에서 __galleryMock.loginAs("운영진") 처럼 바로 로그인해 볼 수 있어요.

function createMockGalleryApi() {
  const KEY = "qlab-gallery-mock";
  const now = Date.now();
  const iso = (minutesAgo) => new Date(now - minutesAgo * 60000).toISOString();

  const seed = () => ({
    session: null,
    nextId: 4,
    users: [
      { id: "u-admin", email: "admin@qlab.test", nickname: "운영진", status: "approved", role: "admin", created_at: iso(9000), message: "회장" },
      { id: "u-member", email: "member@qlab.test", nickname: "퀀트새내기", status: "approved", role: "member", created_at: iso(5000), message: "경영 26 김OO" },
      { id: "u-pending", email: "pending@qlab.test", nickname: "가입대기", status: "pending", role: "member", created_at: iso(30), message: "통계 25 이OO입니다. 세미나 듣고 가입 신청해요." },
    ],
    posts: [
      { id: 1, author_id: "u-admin", title: "갤러리를 열었어요", body: "승인된 부원이라면 누구나 글을 쓸 수 있어요.\n스터디 자료, 후기, 질문 모두 환영해요.", images: [], created_at: iso(3000), updated_at: null },
      { id: 2, author_id: "u-member", title: "모멘텀 스터디 1주차 후기", body: "pandas로 수익률 계산하는 법을 배웠어요.\n참고 자료: https://pandas.pydata.org", images: [], created_at: iso(600), updated_at: null },
      { id: 3, author_id: "u-member", title: "백테스트 결과가 이상하게 좋을 때", body: "미래 데이터를 쓰고 있지 않은지 먼저 확인해 보세요.", images: [], created_at: iso(45), updated_at: null },
    ],
    comments: [
      { id: 1, post_id: 2, author_id: "u-admin", body: "다음 주에는 거래비용도 넣어 봐요.", created_at: iso(500) },
    ],
    likes: [{ post_id: 2, user_id: "u-admin" }],
  });

  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) ?? seed();
    } catch {
      return seed();
    }
  };
  let db = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const listeners = [];
  const wait = () => new Promise((r) => setTimeout(r, 120));

  const me = () => db.users.find((u) => u.id === db.session);
  const approved = () => me()?.status === "approved";
  const admin = () => approved() && me()?.role === "admin";
  const deny = () => {
    throw new Error("권한이 없어요. 운영진 승인을 받았는지 확인해 주세요.");
  };
  const author = (id) => {
    const u = db.users.find((x) => x.id === id);
    return u ? { id: u.id, nickname: u.nickname } : null;
  };
  const setSession = (id) => {
    db.session = id;
    save();
    const session = id ? { user: { id } } : null;
    listeners.forEach((cb) => cb(session));
  };

  const api = {
    async session() {
      return db.session ? { user: { id: db.session } } : null;
    },
    onAuthChange(cb) {
      listeners.push(cb);
    },
    async me() {
      const u = me();
      return u ? { id: u.id, nickname: u.nickname, status: u.status, role: u.role } : null;
    },
    async nicknameAvailable(name) {
      return !db.users.some((u) => u.nickname.toLowerCase() === name.trim().toLowerCase());
    },
    async signUp({ email, nickname, message }) {
      await wait();
      if (db.users.some((u) => u.email === email)) throw new Error("이미 가입한 이메일이에요. 로그인해 주세요.");
      if (!(await api.nicknameAvailable(nickname))) throw new Error("이미 쓰는 닉네임이에요.");
      const id = `u-${Date.now()}`;
      db.users.push({ id, email, nickname, status: "pending", role: "member", created_at: new Date().toISOString(), message });
      setSession(id);
      return { needsConfirm: false };
    },
    async signIn({ email }) {
      await wait();
      const u = db.users.find((x) => x.email === email);
      if (!u) throw new Error("이메일이나 비밀번호가 맞지 않아요.");
      setSession(u.id);
    },
    async signOut() {
      setSession(null);
    },
    async listPosts({ page, pageSize, query }) {
      await wait();
      const rows = db.posts
        .filter((p) => !query || p.title.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => b.id - a.id);
      return {
        total: rows.length,
        rows: rows.slice((page - 1) * pageSize, page * pageSize).map((p) => ({
          id: p.id,
          title: p.title,
          created_at: p.created_at,
          author: author(p.author_id),
          has_images: p.images.length > 0,
          comment_count: db.comments.filter((c) => c.post_id === p.id).length,
          like_count: db.likes.filter((l) => l.post_id === p.id).length,
        })),
      };
    },
    async getPost(id) {
      await wait();
      const p = db.posts.find((x) => x.id === Number(id));
      return p && { ...p, author: author(p.author_id), like_count: db.likes.filter((l) => l.post_id === p.id).length };
    },
    async createPost({ title, body, images }) {
      if (!approved()) deny();
      const id = db.nextId++;
      db.posts.push({ id, author_id: db.session, title, body, images, created_at: new Date().toISOString(), updated_at: null });
      save();
      return id;
    },
    async updatePost(id, { title, body, images }) {
      const p = db.posts.find((x) => x.id === Number(id));
      if (!p || p.author_id !== db.session || !approved()) deny();
      Object.assign(p, { title, body, images, updated_at: new Date().toISOString() });
      save();
    },
    async deletePost(id) {
      const p = db.posts.find((x) => x.id === Number(id));
      if (!p || (p.author_id !== db.session && !admin())) deny();
      db.posts = db.posts.filter((x) => x !== p);
      db.comments = db.comments.filter((c) => c.post_id !== p.id);
      save();
    },
    async listComments(postId) {
      return db.comments
        .filter((c) => c.post_id === Number(postId))
        .map((c) => ({ id: c.id, body: c.body, created_at: c.created_at, author: author(c.author_id) }));
    },
    async addComment(postId, body) {
      if (!approved()) deny();
      db.comments.push({ id: Date.now(), post_id: Number(postId), author_id: db.session, body, created_at: new Date().toISOString() });
      save();
    },
    async deleteComment(id) {
      const c = db.comments.find((x) => x.id === id);
      if (!c || (c.author_id !== db.session && !admin())) deny();
      db.comments = db.comments.filter((x) => x !== c);
      save();
    },
    async hasLiked(postId) {
      return db.likes.some((l) => l.post_id === Number(postId) && l.user_id === db.session);
    },
    async setLike(postId, on) {
      if (!approved()) deny();
      db.likes = db.likes.filter((l) => !(l.post_id === Number(postId) && l.user_id === db.session));
      if (on) db.likes.push({ post_id: Number(postId), user_id: db.session });
      save();
    },
    async uploadImage(blob) {
      if (!approved()) deny();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    },
    async listMembers() {
      if (!admin()) deny();
      return [...db.users]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(({ id, nickname, status, role, created_at, message }) => ({ id, nickname, status, role, created_at, message }));
    },
    async setMemberStatus(id, status) {
      if (!admin()) deny();
      db.users.find((u) => u.id === id).status = status;
      save();
    },
    async setMemberRole(id, role) {
      if (!admin()) deny();
      db.users.find((u) => u.id === id).role = role;
      save();
    },
  };

  window.__galleryMock = {
    loginAs(nickname) {
      const u = db.users.find((x) => x.nickname === nickname);
      setSession(u?.id ?? null);
    },
    reset() {
      db = seed();
      save();
      location.reload();
    },
  };
  return api;
}
