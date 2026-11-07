// GitHub 저장소의 파일을 읽고 쓰는 최소한의 API 래퍼 (관리 페이지 전용)

class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToUtf8(base64) {
  const binary = atob(base64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

function createGitHubClient({ owner, repo, branch, token }) {
  const repoUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const encodePath = (path) => path.split("/").map(encodeURIComponent).join("/");

  async function request(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body && { "Content-Type": "application/json" }),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new GitHubError(res.status, body.message || res.statusText);
    return body;
  }

  return {
    getUser: () => request("https://api.github.com/user"),

    async readFile(path) {
      const file = await request(`${repoUrl}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`);
      return { text: base64ToUtf8(file.content), sha: file.sha };
    },

    // sha는 기존 파일을 덮어쓸 때 필요하다. 그사이 다른 사람이 저장했다면 409가 난다.
    async writeFile(path, { base64, message, sha }) {
      const result = await request(`${repoUrl}/contents/${encodePath(path)}`, {
        method: "PUT",
        body: JSON.stringify({ message, content: base64, branch, ...(sha && { sha }) }),
      });
      return result.content.sha;
    },
  };
}
