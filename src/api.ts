import { normalizeCartVariants, normalizeProductMedia } from "./storefront";

export type ApiSuccess<T> = {
  statusCode: number;
  message: string;
  data?: T;
  meta?: unknown;
};

export type TokenPair = { accessToken: string; refreshToken: string };

export type TokenStore = {
  clear(): void;
  read(): TokenPair | null;
  write(tokens: TokenPair): void;
};

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string | string[],
  ) {
    super(Array.isArray(message) ? message.join(". ") : message);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: Record<string, string>;
};

type AuthOption = { authenticated?: boolean };

type ClientOptions = {
  baseUrl: string;
  fetchFn?: typeof fetch;
  tokens: TokenStore;
  onAuthFailure?: () => void;
};

function asError(payload: unknown, statusCode: number): ApiError {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message: unknown }).message;
    if (typeof message === "string" || (Array.isArray(message) && message.every((item) => typeof item === "string"))) {
      return new ApiError(statusCode, message);
    }
  }

  return new ApiError(statusCode, "Yeu cau khong thanh cong");
}

async function readPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return { message: response.statusText || "Yeu cau khong thanh cong" };
  }
}

function requestInit(options: RequestOptions, token?: string): RequestInit {
  const headers = { ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  return {
    ...options,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
  };
}

export function createApiClient({ baseUrl, fetchFn = fetch, tokens, onAuthFailure }: ClientOptions) {
  const base = baseUrl.replace(/\/$/, "");

  async function send<T>(path: string, options: RequestOptions = {}, protectedRequest = false, retry = true): Promise<ApiSuccess<T>> {
    const response = await fetchFn(`${base}${path}`, requestInit(options, protectedRequest ? tokens.read()?.accessToken : undefined));
    const payload = await readPayload(response);

    if (response.status === 401 && protectedRequest && retry && (await refresh())) {
      return send<T>(path, options, true, false);
    }

    if (!response.ok) throw asError(payload, response.status);
    return payload as ApiSuccess<T>;
  }

  async function refresh(): Promise<boolean> {
    const current = tokens.read();
    if (!current) {
      tokens.clear();
      onAuthFailure?.();
      return false;
    }

    try {
      const response = await fetchFn(`${base}/auth/refresh`, requestInit({ method: "POST", body: { refreshToken: current.refreshToken } }));
      const payload = await readPayload(response);
      const next = response.ok ? (payload as ApiSuccess<TokenPair>).data : undefined;
      if (next?.accessToken && next.refreshToken) {
        tokens.write(next);
        return true;
      }
    } catch {
      // A failed refresh invalidates this browser session just like a rejected token.
    }

    tokens.clear();
    onAuthFailure?.();
    return false;
  }

  return {
    get: async <T>(path: string, { authenticated = false }: AuthOption = {}) => (await send<T>(path, { method: "GET" }, authenticated)).data as T,
    getPage: async <T, M>(path: string, { authenticated = false }: AuthOption = {}) => {
      const response = await send<T>(path, { method: "GET" }, authenticated);
      return { data: response.data as T, meta: response.meta as M };
    },
    getProduct: async <T extends { mediaGallery: unknown }>(path: string) => {
      const response = await send<T>(path, { method: "GET" });
      return normalizeProductMedia(response.data as T);
    },
    getProductsPage: async <T extends { mediaGallery: unknown }, M>(path: string) => {
      const response = await send<T[]>(path, { method: "GET" });
      return { data: (response.data as T[]).map(normalizeProductMedia), meta: response.meta as M };
    },
    patch: async <T>(path: string, body: unknown, { authenticated = false }: AuthOption = {}) => (await send<T>(path, { method: "PATCH", body }, authenticated)).data as T,
    post: async <T>(path: string, body: unknown, { authenticated = false }: AuthOption = {}) => (await send<T>(path, { method: "POST", body }, authenticated)).data as T,
    remove: async <T>(path: string, { authenticated = false }: AuthOption = {}) => (await send<T>(path, { method: "DELETE" }, authenticated)).data as T,
    getCart: async <T extends { cartItems: Array<{ product: { mediaGallery: unknown; variants: unknown } }> }>() => {
      const response = await send<T>("/cart", { method: "GET" }, true);
      return normalizeCartVariants(response.data as T);
    },
    patchCart: async <T extends { cartItems: Array<{ product: { mediaGallery: unknown; variants: unknown } }> }>(itemId: string, quantity: number) => {
      const response = await send<T>(`/cart/${itemId}`, { method: "PATCH", body: { quantity } }, true);
      return normalizeCartVariants(response.data as T);
    },
    removeCart: async <T extends { cartItems: Array<{ product: { mediaGallery: unknown; variants: unknown } }> }>(itemId: string) => {
      const response = await send<T>(`/cart/${itemId}`, { method: "DELETE" }, true);
      return normalizeCartVariants(response.data as T);
    },
  };
}

const TOKEN_KEY = "melodies.tokens";

export function createBrowserTokenStore(): TokenStore {
  return {
    clear() {
      localStorage.removeItem(TOKEN_KEY);
    },
    read() {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return null;

      try {
        const parsed = JSON.parse(raw) as Partial<TokenPair>;
        return typeof parsed.accessToken === "string" && typeof parsed.refreshToken === "string" ? parsed as TokenPair : null;
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        return null;
      }
    },
    write(tokens) {
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    },
  };
}

export const browserTokens = createBrowserTokenStore();
let sessionFailureHandler: (() => void) | undefined;

export function setSessionFailureHandler(handler: (() => void) | undefined) {
  sessionFailureHandler = handler;
}

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000/api",
  tokens: browserTokens,
  onAuthFailure: () => sessionFailureHandler?.(),
});
