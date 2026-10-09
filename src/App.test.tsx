// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  vi.unstubAllGlobals();
  vi.resetModules();
  window.history.replaceState({}, "", "/");
  localStorage.clear();
  sessionStorage.clear();
});

it("shows filtered catalog results from the HTTP boundary", async () => {
  window.history.replaceState({}, "", "/?type=music");
  window.scrollTo = vi.fn();
  const product = {
    id: "product-1",
    name: "Album One",
    slug: "album-one",
    shortDescription: null,
    productType: "music",
    minPrice: 100000,
    maxPrice: 100000,
    mediaGallery: [],
    artists: [],
    variants: [
      {
        id: "variant-1",
        name: "Vinyl",
        originalPrice: 120000,
        discountPercent: 20,
        stockQuantity: 3,
        isPreorder: false,
        attributes: [],
      },
    ],
    category: null,
  };
  const fetchFn = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        statusCode: 200,
        message: "Products fetched successfully",
        data: [product],
        meta: { currentPage: 1, totalPages: 1, limit: 20, totalItems: 1 },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        statusCode: 200,
        message: "Artists fetched",
        data: [
          { id: "artist-1", stageName: "Billy Joel" },
          { id: "artist-2", stageName: "Ella Fitzgerald" },
        ],
        meta: { currentPage: 1, totalPages: 1, limit: 100, totalItems: 2 },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        statusCode: 200,
        message: "Product fetched",
        data: product,
      }),
    });
  vi.stubGlobal("fetch", fetchFn);
  const { default: App } = await import("./App");
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(<App />);
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(container.textContent).toContain("Album One");
  expect(container.textContent).toContain("SALE");
  await act(async () => {
    (container.querySelector(".artist-picker-trigger") as HTMLButtonElement).click();
  });
  expect(container.textContent).toContain("Billy Joel");
  const artistSearch = container.querySelector(
    'input[aria-label="Tìm nghệ sĩ"]',
  ) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(artistSearch, "Ella");
    artistSearch.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.textContent).toContain("Ella Fitzgerald");
  expect(container.textContent).not.toContain("Billy Joel");
  await act(async () => {
    document.dispatchEvent(new Event("pointerdown"));
  });
  expect(container.querySelector(".artist-picker-menu")).toBeNull();
  expect(fetchFn).toHaveBeenCalledWith(
    "http://localhost:3000/api/products?type=music",
    expect.objectContaining({ method: "GET" }),
  );

  await act(async () => {
    (
      container.querySelector(
        'a[href="/products/album-one"]',
      ) as HTMLAnchorElement
    ).click();
    await Promise.resolve();
    await Promise.resolve();
  });

  const buyNow = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "MUA NGAY",
  ) as HTMLButtonElement;
  expect(buyNow.disabled).toBe(true);
  await act(async () => {
    (
      [...container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Vinyl"),
      ) as HTMLButtonElement
    ).click();
  });
  expect(buyNow.disabled).toBe(false);
});

it("keeps a guest item in the browser cart without redirecting after add", async () => {
  window.history.replaceState({}, "", "/products/album-one");
  window.scrollTo = vi.fn();
  const product = {
    id: "product-1",
    name: "Album One",
    slug: "album-one",
    shortDescription: null,
    productType: "music",
    minPrice: 100000,
    maxPrice: 100000,
    mediaGallery: [],
    artists: [],
    variants: [
      {
        id: "variant-1",
        name: "Vinyl",
        originalPrice: 120000,
        discountPercent: 20,
        stockQuantity: 10,
        isPreorder: false,
        attributes: [],
      },
    ],
    category: null,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        statusCode: 200,
        message: "Product fetched",
        data: product,
      }),
    }),
  );
  const { default: App } = await import("./App");
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(<App />);
    await Promise.resolve();
    await Promise.resolve();
  });
  const variantButton = [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.includes("Vinyl"),
  ) as HTMLButtonElement;
  const addButton = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "THÊM GIỎ",
  ) as HTMLButtonElement;
  await act(async () => {
    variantButton.click();
  });
  await act(async () => {
    const increase = container.querySelector(
      'button[aria-label="Tăng số lượng"]',
    ) as HTMLButtonElement;
    for (let index = 0; index < 5; index += 1) increase.click();
  });
  expect(container.querySelector(".detail-quantity output")?.textContent).toBe("4");
  await act(async () => {
    addButton.click();
  });
  expect(window.location.pathname).toBe("/products/album-one");
  expect(container.textContent).toContain("Đã thêm vào giỏ hàng.");
  await act(async () => {
    (container.querySelector('a[href="/cart"]') as HTMLAnchorElement).click();
  });

  expect(container.textContent).toContain("Album One");
  expect(container.textContent).toContain("Vinyl");
  expect(JSON.parse(localStorage.getItem("melodies.cart") ?? "[]")[0].quantity).toBe(4);
});

it("tracks a guest order by email without showing private order fields", async () => {
  window.history.replaceState({}, "", "/track");
  window.scrollTo = vi.fn();
  const fetchFn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      statusCode: 200,
      message: "Order tracking retrieved successfully",
      data: [
        {
          id: "order-1",
          createdAt: "2026-09-25T00:00:00Z",
          status: "PENDING",
          trackingCode: null,
          paymentMethod: "COD",
          subtotal: 100,
          shippingFee: 0,
          discountAmount: 0,
          totalAmount: 100,
        },
      ],
    }),
  });
  vi.stubGlobal("fetch", fetchFn);
  const { default: App } = await import("./App");
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(<App />);
  });
  const email = container.querySelector(
    'input[name="email"]',
  ) as HTMLInputElement;
  email.value = "guest@example.com";
  await act(async () => {
    (container.querySelector("form") as HTMLFormElement).requestSubmit();
    await Promise.resolve();
  });

  expect(fetchFn).toHaveBeenCalledWith(
    "http://localhost:3000/api/order/track",
    expect.objectContaining({
      body: JSON.stringify({ email: "guest@example.com" }),
    }),
  );
  expect(container.textContent).toContain("order-1");
  expect(container.textContent).not.toContain("guest@example.com");
});

it("loads the persisted cart on a direct cart URL", async () => {
  localStorage.setItem(
    "melodies.cart",
    JSON.stringify([
      {
        product: { id: "product-1", name: "Album One", mediaGallery: [] },
        variant: {
          id: "variant-1",
          name: "Vinyl",
          originalPrice: 120000,
          discountPercent: 20,
          stockQuantity: 3,
        },
        quantity: 1,
      },
    ]),
  );
  window.history.replaceState({}, "", "/cart");
  window.scrollTo = vi.fn();
  const { default: App } = await import("./App");
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(<App />);
    await Promise.resolve();
  });

  expect(container.textContent).toContain("Album One");
  expect(container.textContent).toContain("Vinyl");
});

it("refreshes an already-open cart when another tab adds an item", async () => {
  window.history.replaceState({}, "", "/cart");
  window.scrollTo = vi.fn();
  const { default: App } = await import("./App");
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(<App />);
    await Promise.resolve();
  });
  expect(container.textContent).toContain("Giỏ hàng đang trống.");

  localStorage.setItem(
    "melodies.cart",
    JSON.stringify([
      {
        product: { id: "product-1", name: "Album One", mediaGallery: [] },
        variant: {
          id: "variant-1",
          name: "Vinyl",
          originalPrice: 120000,
          discountPercent: 20,
          stockQuantity: 3,
        },
        quantity: 1,
      },
    ]),
  );
  await act(async () => {
    window.dispatchEvent(new StorageEvent("storage", { key: "melodies.cart" }));
  });

  expect(container.textContent).toContain("Album One");
});

it("refreshes the cart after same-tab storage changes", async () => {
  window.history.replaceState({}, "", "/cart");
  window.scrollTo = vi.fn();
  const { default: App } = await import("./App");
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<App />);
    await Promise.resolve();
  });

  localStorage.setItem(
    "melodies.cart",
    JSON.stringify([
      {
        product: { id: "product-1", name: "Album One", mediaGallery: [] },
        variant: {
          id: "variant-1",
          name: "Vinyl",
          originalPrice: 120000,
          discountPercent: 20,
          stockQuantity: 3,
        },
        quantity: 1,
      },
    ]),
  );
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });

  expect(container.textContent).toContain("Album One");
});

it("shows a multi-image gallery and related products on product detail", async () => {
  window.history.replaceState({}, "", "/products/album-one");
  window.scrollTo = vi.fn();
  const product = {
    id: "product-1",
    name: "Album One",
    slug: "album-one",
    shortDescription: null,
    productType: "music",
    minPrice: 100000,
    maxPrice: 100000,
    mediaGallery: ["/album-front.jpg", "/album-back.jpg"],
    artists: [{ id: "artist-1", stageName: "Artist One" }],
    variants: [],
    category: null,
  };
  const related = {
    ...product,
    id: "product-2",
    name: "Album Two",
    slug: "album-two",
    mediaGallery: ["/album-two.jpg"],
  };
  const fallbackProducts = Array.from({ length: 8 }, (_, index) => ({
    ...related,
    id: `product-${index + 2}`,
    name: `Album ${index + 2}`,
    slug: `album-${index + 2}`,
    artists: index === 0 ? product.artists : [],
  }));
  const fetchFn = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ statusCode: 200, data: product }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        statusCode: 200,
        data: [],
        meta: { currentPage: 1, totalPages: 1, limit: 5, totalItems: 0 },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        statusCode: 200,
        data: fallbackProducts,
        meta: { currentPage: 1, totalPages: 1, limit: 20, totalItems: 8 },
      }),
    });
  vi.stubGlobal("fetch", fetchFn);
  const { default: App } = await import("./App");
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(<App />);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(container.querySelectorAll(".gallery-thumb")).toHaveLength(2);
  expect(container.textContent).toContain("SẢN PHẨM LIÊN QUAN");
  expect(container.textContent).toContain("Album 2");
  expect(container.querySelectorAll(".related-track .product-card")).toHaveLength(8);
  expect(container.querySelector(".related-track")).not.toBeNull();
  expect(
    container.querySelector('button[aria-label="Sản phẩm tiếp theo"]'),
  ).not.toBeNull();
  const track = container.querySelector(".related-track") as HTMLDivElement;
  const scrollBy = vi.fn();
  Object.defineProperty(track, "clientWidth", { value: 1000 });
  Object.defineProperty(track, "scrollBy", { value: scrollBy });
  await act(async () => {
    (
      container.querySelector(
        'button[aria-label="Sản phẩm tiếp theo"]',
      ) as HTMLButtonElement
    ).click();
  });
  expect(scrollBy).toHaveBeenCalledWith({ left: 850, behavior: "smooth" });

  await act(async () => {
    (container.querySelectorAll(".gallery-thumb")[1] as HTMLButtonElement).click();
  });
  expect(
    (container.querySelector(".gallery-main img") as HTMLImageElement).src,
  ).toContain("/album-back.jpg");
});

it("does not expose removed category and artist pages", async () => {
  window.history.replaceState({}, "", "/categories");
  window.scrollTo = vi.fn();
  const { default: App } = await import("./App");
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(<App />);
  });

  expect(container.textContent).toContain("Không tìm thấy trang.");
  expect(container.textContent).not.toContain("DANH MỤC");
});

it.each(["COD", "MOMO"] as const)(
  "submits the selected %s payment method",
  async (method) => {
    window.history.replaceState(
      {},
      "",
      "/checkout?variant=variant-1&quantity=1",
    );
    window.scrollTo = vi.fn();
    const redirect = vi.fn();
    const realWindow = window;
    vi.stubGlobal(
      "window",
      new Proxy(realWindow, {
        get(target, key) {
          if (key === "location")
            return {
              pathname: realWindow.location.pathname,
              search: realWindow.location.search,
              assign: redirect,
            };
          const value = Reflect.get(target, key, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }),
    );
    const preview = {
      subtotal: 150000,
      shippingFee: 0,
      discountAmount: 0,
      totalAmount: 150000,
      appliedVoucher: null,
      orderItems: [],
    };
    const fetchFn = vi.fn(async (url, _options: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({
        statusCode: 200,
        data: String(url).endsWith("/preview")
          ? preview
          : {
              ...preview,
              id: "order",
              fullName: "Guest",
              phone: "0901234567",
              shippingAddress: "123 Street",
              status: "PENDING",
              paymentMethod: method,
              paymentId: "payment",
              paymentUrl:
                method === "MOMO"
                  ? "https://test-payment.momo.vn/pay"
                  : undefined,
            },
      }),
    }));
    vi.stubGlobal("fetch", fetchFn);
    const { default: App } = await import("./App");
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<App />);
    });
    expect(
      container.querySelectorAll('input[name="paymentMethod"]'),
    ).toHaveLength(2);
    const fields = [
      ...container.querySelectorAll(
        ".checkout-form input, .checkout-form textarea",
      ),
    ];
    for (const [index, value] of [
      "Guest",
      "guest@example.com",
      "0901234567",
      "123 Street",
    ].entries()) {
      const field = fields[index] as HTMLInputElement | HTMLTextAreaElement;
      const prototype =
        field.tagName === "TEXTAREA"
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      await act(async () => {
        Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
          field,
          value,
        );
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    await act(async () => {
      (
        container.querySelector(`input[value="${method}"]`) as HTMLInputElement
      ).click();
    });
    await act(async () => {
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "XEM TỔNG TIỀN")!
        .click();
    });
    await act(async () => {
      [...container.querySelectorAll("button")]
        .find(
          (button) =>
            button.textContent ===
            (method === "COD" ? "ĐẶT HÀNG COD" : "THANH TOÁN MOMO"),
        )!
        .click();
    });
    const call = fetchFn.mock.calls.find(([url]) =>
      String(url).endsWith("/order"),
    );
    expect(call).toBeDefined();
    expect(
      JSON.parse((call![1] as RequestInit).body as string).paymentMethod,
    ).toBe(method);
    if (method === "MOMO")
      expect(redirect).toHaveBeenCalledWith("https://test-payment.momo.vn/pay");
    else expect(realWindow.location.pathname).toBe("/order/success");
  },
);

it.each(["SUCCESS", "FAILED", "PENDING"])(
  "shows verified %s status after returning from MoMo",
  async (status) => {
    const paymentId = "123e4567-e89b-42d3-a456-426614174000";
    window.history.replaceState(
      {},
      "",
      `/payment/result?payment=${paymentId}&resultCode=0`,
    );
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        statusCode: 200,
        data: {
          paymentId,
          orderId: "order-1",
          status,
          amount: 150000,
          requiresReview: false,
          paymentUrl: "https://test-payment.momo.vn/pay",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchFn);
    const { default: App } = await import("./App");
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<App />);
    });
    const expected =
      status === "SUCCESS"
        ? "THANH TOÁN THÀNH CÔNG"
        : status === "FAILED"
          ? "THANH TOÁN KHÔNG THÀNH CÔNG"
          : "ĐANG XÁC NHẬN THANH TOÁN";
    expect(container.querySelector("h1")?.textContent).toBe(expected);
    expect(fetchFn).toHaveBeenCalledWith(
      `http://localhost:3000/api/payment/momo/${paymentId}/status`,
      expect.anything(),
    );
    if (status !== "PENDING")
      expect(
        container.querySelector('a[href="https://test-payment.momo.vn/pay"]'),
      ).toBeNull();
  },
);
