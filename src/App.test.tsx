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
        data: [],
        meta: { currentPage: 1, totalPages: 1, limit: 100, totalItems: 0 },
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
        stockQuantity: 3,
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
    addButton.click();
  });
  expect(window.location.pathname).toBe("/products/album-one");
  expect(container.textContent).toContain("Đã thêm vào giỏ hàng.");
  await act(async () => {
    (container.querySelector('a[href="/cart"]') as HTMLAnchorElement).click();
  });

  expect(container.textContent).toContain("Album One");
  expect(container.textContent).toContain("Vinyl");
  expect(localStorage.getItem("melodies.cart")).toContain("variant-1");
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
        data: [related],
        meta: { currentPage: 1, totalPages: 1, limit: 4, totalItems: 1 },
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
  expect(container.textContent).toContain("Album Two");

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
