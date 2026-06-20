process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export interface ObsidianConfig {
  host: string;
  port: number;
  apiKey: string;
  ssl: boolean;
}

export interface NoteContent {
  content: string;
  frontmatter: Record<string, unknown>;
  path: string;
  stat: { ctime: number; mtime: number; size: number };
  tags: string[];
}

export interface SearchMatch {
  context: string;
  match: { start: number; end: number };
}

export interface SearchResult {
  filename: string;
  score: number;
  matches: SearchMatch[];
}

export class ObsidianConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObsidianConnectionError";
  }
}

export class ObsidianNotFoundError extends Error {
  constructor(path: string) {
    super(`Note not found: ${path}`);
    this.name = "ObsidianNotFoundError";
  }
}

export class ObsidianAuthError extends Error {
  constructor() {
    super("Invalid Obsidian API key");
    this.name = "ObsidianAuthError";
  }
}

export class ObsidianClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(private config: ObsidianConfig) {
    const protocol = config.ssl ? "https" : "http";
    this.baseUrl = `${protocol}://${config.host}:${config.port}`;
    this.headers = {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.obsidian.v1+json",
    };
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    contentType?: string,
    extraHeaders?: Record<string, string>
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = { ...this.headers };
    if (contentType) headers["Content-Type"] = contentType;
    if (extraHeaders) Object.assign(headers, extraHeaders);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body:
          body !== undefined
            ? typeof body === "string"
              ? body
              : JSON.stringify(body)
            : undefined,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      throw new ObsidianConnectionError(
        `Cannot reach Obsidian at ${this.baseUrl}: ${(err as Error).message}`
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new ObsidianAuthError();
    }

    return response;
  }

  async getNote(notePath: string): Promise<NoteContent> {
    const res = await this.request("GET", `/vault/${encodeURIPath(notePath)}`);
    if (res.status === 404) throw new ObsidianNotFoundError(notePath);
    if (!res.ok) throw new ObsidianConnectionError(`GET /vault/${notePath} failed: ${res.status}`);
    
    const text = await res.text();
    try {
      return JSON.parse(text) as NoteContent;
    } catch (e) {
      // If the API returns raw markdown instead of JSON, wrap it in NoteContent
      return {
        content: text,
        frontmatter: {},
        path: notePath,
        stat: { ctime: 0, mtime: 0, size: text.length },
        tags: []
      };
    }
  }

  async putNote(notePath: string, content: string): Promise<void> {
    const res = await this.request(
      "PUT",
      `/vault/${encodeURIPath(notePath)}`,
      content,
      "text/markdown"
    );
    if (!res.ok) throw new ObsidianConnectionError(`PUT /vault/${notePath} failed: ${res.status}`);
  }

  async appendNote(notePath: string, content: string): Promise<void> {
    const res = await this.request(
      "POST",
      `/vault/${encodeURIPath(notePath)}`,
      content,
      "text/markdown"
    );
    if (res.status === 404) throw new ObsidianNotFoundError(notePath);
    if (!res.ok) throw new ObsidianConnectionError(`POST /vault/${notePath} failed: ${res.status}`);
  }

  async deleteNote(notePath: string): Promise<void> {
    const res = await this.request("DELETE", `/vault/${encodeURIPath(notePath)}`);
    if (res.status === 404) throw new ObsidianNotFoundError(notePath);
    if (!res.ok) throw new ObsidianConnectionError(`DELETE /vault/${notePath} failed: ${res.status}`);
  }

  async listFolder(folderPath: string): Promise<string[]> {
    const path = folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
    const res = await this.request("GET", `/vault/${encodeURIPath(path)}`);
    if (res.status === 404) throw new ObsidianNotFoundError(folderPath);
    if (!res.ok) throw new ObsidianConnectionError(`GET /vault/${path} failed: ${res.status}`);
    const data = (await res.json()) as { files: string[] };
    return data.files ?? [];
  }

  async searchSimple(query: string, contextLength = 100): Promise<SearchResult[]> {
    const res = await this.request(
      "POST",
      `/search/simple/?query=${encodeURIComponent(query)}&contextLength=${contextLength}`
    );
    if (!res.ok) throw new ObsidianConnectionError(`POST /search/simple/ failed: ${res.status}`);
    return res.json() as Promise<SearchResult[]>;
  }

  async searchJsonLogic(logic: object): Promise<SearchResult[]> {
    const res = await this.request("POST", "/search/", logic);
    if (!res.ok) throw new ObsidianConnectionError(`POST /search/ failed: ${res.status}`);
    return res.json() as Promise<SearchResult[]>;
  }

  async executeCommand(commandId: string): Promise<void> {
    const res = await this.request("POST", `/commands/${encodeURIComponent(commandId)}/`);
    if (!res.ok) throw new ObsidianConnectionError(`POST /commands/${commandId}/ failed: ${res.status}`);
  }

  async getActiveNote(): Promise<NoteContent | null> {
    const res = await this.request("GET", "/active/");
    if (res.status === 404) return null;
    if (!res.ok) throw new ObsidianConnectionError(`GET /active/ failed: ${res.status}`);
    return res.json() as Promise<NoteContent>;
  }

  async openNote(notePath: string): Promise<void> {
    const res = await this.request("PUT", "/active/", { path: notePath });
    if (!res.ok) throw new ObsidianConnectionError(`PUT /active/ failed: ${res.status}`);
  }

  async isReachable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/vault/`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(2_000),
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }
}

function encodeURIPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
