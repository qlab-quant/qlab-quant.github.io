// 갤러리와 Supabase 사이의 연결. 화면(gallery.js)은 여기 있는 함수만 씁니다.
// 같은 모양의 함수를 가진 gallery-mock.js로 바꿔 끼우면 Supabase 없이도 화면을 확인할 수 있어요.
// 권한(누가 무엇을 쓰고 지울 수 있는지)은 supabase/schema.sql 의 보안 정책이 지킵니다.

const GALLERY_BUCKET = "gallery";

// Supabase 오류를 사람이 읽을 수 있는 말로 바꾼다
function galleryError(error) {
  const message = error?.message ?? String(error);
  const known = [
    [/invalid login credentials/i, "이메일이나 비밀번호가 맞지 않아요."],
    [/email not confirmed/i, "메일함에서 인증 링크를 먼저 눌러 주세요."],
    [/user already registered/i, "이미 가입한 이메일이에요. 로그인해 주세요."],
    [/password should be at least/i, "비밀번호는 8자 이상이어야 해요."],
    [/rate limit|too many/i, "요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요."],
    [/row-level security|permission denied|violates/i, "권한이 없어요. 운영진 승인을 받았는지 확인해 주세요."],
    [/failed to fetch|network/i, "네트워크 오류가 났어요. 인터넷 연결을 확인해 주세요."],
  ];
  const hit = known.find(([pattern]) => pattern.test(message));
  return new Error(hit ? hit[1] : `오류가 났어요: ${message}`);
}

async function unwrap(promise) {
  const { data, error, count } = await promise;
  if (error) throw galleryError(error);
  return count == null ? data : { data, count };
}

const one = (value) => (Array.isArray(value) ? value[0] : value) ?? null;

function createGalleryApi({ url, anonKey }) {
  const sb = window.supabase.createClient(url, anonKey);
  let uid = null;

  return {
    async session() {
      const { data } = await sb.auth.getSession();
      uid = data.session?.user.id ?? null;
      return data.session;
    },

    onAuthChange(callback) {
      sb.auth.onAuthStateChange((_event, session) => {
        uid = session?.user.id ?? null;
        callback(session);
      });
    },

    async me() {
      if (!uid) return null;
      return unwrap(sb.from("profiles").select("id, nickname, status, role").eq("id", uid).maybeSingle());
    },

    async nicknameAvailable(name) {
      return unwrap(sb.rpc("nickname_available", { name }));
    },

    // 가입하면 profiles에 '승인 대기'로 들어가고, 운영진이 승인해야 글을 쓸 수 있다
    async signUp({ email, password, nickname, message }) {
      if (!(await this.nicknameAvailable(nickname))) throw new Error("이미 쓰는 닉네임이에요.");
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { nickname, message } } });
      if (error) throw galleryError(error);
      return { needsConfirm: !data.session };
    },

    async signIn({ email, password }) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw galleryError(error);
    },

    async signOut() {
      await sb.auth.signOut();
    },

    // 목록은 schema.sql의 post_list 뷰에서 댓글 수 · 추천 수까지 한 번에 읽는다
    async listPosts({ page, pageSize, query }) {
      let q = sb
        .from("post_list")
        .select("*", { count: "exact" })
        .order("id", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (query) q = q.ilike("title", `%${query.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
      const { data, count } = await unwrap(q);
      return {
        total: count ?? 0,
        rows: data.map((p) => ({
          id: p.id,
          title: p.title,
          created_at: p.created_at,
          author: { id: p.author_id, nickname: p.author_nickname },
          has_images: p.has_images,
          comment_count: Number(p.comment_count),
          like_count: Number(p.like_count),
        })),
      };
    },

    async getPost(id) {
      const [post, likes] = await Promise.all([
        unwrap(
          sb.from("posts")
            .select("id, title, body, images, created_at, updated_at, author:profiles(id, nickname)")
            .eq("id", id)
            .maybeSingle()
        ),
        unwrap(sb.from("post_likes").select("post_id", { count: "exact", head: true }).eq("post_id", id)),
      ]);
      return post && { ...post, author: one(post.author), like_count: likes.count ?? 0 };
    },

    async createPost({ title, body, images }) {
      const row = await unwrap(sb.from("posts").insert({ title, body, images }).select("id").single());
      return row.id;
    },

    async updatePost(id, { title, body, images }) {
      await unwrap(sb.from("posts").update({ title, body, images }).eq("id", id));
    },

    async deletePost(id) {
      await unwrap(sb.from("posts").delete().eq("id", id));
    },

    async listComments(postId) {
      const rows = await unwrap(
        sb.from("comments").select("id, body, created_at, author:profiles(id, nickname)").eq("post_id", postId).order("id")
      );
      return rows.map((c) => ({ ...c, author: one(c.author) }));
    },

    async addComment(postId, body) {
      await unwrap(sb.from("comments").insert({ post_id: postId, body }));
    },

    async deleteComment(id) {
      await unwrap(sb.from("comments").delete().eq("id", id));
    },

    async hasLiked(postId) {
      if (!uid) return false;
      const row = await unwrap(sb.from("post_likes").select("post_id").eq("post_id", postId).eq("user_id", uid).maybeSingle());
      return Boolean(row);
    },

    async setLike(postId, on) {
      if (on) await unwrap(sb.from("post_likes").insert({ post_id: postId }));
      else await unwrap(sb.from("post_likes").delete().eq("post_id", postId).eq("user_id", uid));
    },

    // 사진은 '내 아이디/시각.jpg'로 올린다 (보안 정책이 본인 폴더에만 올릴 수 있게 막는다)
    async uploadImage(blob) {
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      await unwrap(sb.storage.from(GALLERY_BUCKET).upload(path, blob, { contentType: "image/jpeg" }));
      return sb.storage.from(GALLERY_BUCKET).getPublicUrl(path).data.publicUrl;
    },

    async listMembers() {
      const rows = await unwrap(
        sb.from("profiles").select("id, nickname, status, role, created_at, join_requests(message)").order("created_at", { ascending: false })
      );
      return rows.map((m) => ({ ...m, message: one(m.join_requests)?.message ?? "" }));
    },

    async setMemberStatus(id, status) {
      await unwrap(sb.from("profiles").update({ status }).eq("id", id));
    },

    async setMemberRole(id, role) {
      await unwrap(sb.from("profiles").update({ role }).eq("id", id));
    },
  };
}
