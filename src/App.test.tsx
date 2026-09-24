// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
  localStorage.clear();
});

it("shows filtered catalog results from the HTTP boundary", async () => {
  window.history.replaceState({}, "", "/?type=music");
  window.scrollTo = vi.fn();
  const product = {
    id: "product-1", name: "Album One", slug: "album-one", shortDescription: null,
    productType: "music", minPrice: 100000, maxPrice: 100000, mediaGallery: [], artists: [],
    variants: [{ id: "variant-1", name: "Vinyl", originalPrice: 120000, discountPercent: 20, stockQuantity: 3, isPreorder: false, attributes: [] }], category: null,
  };
  const fetchFn = vi.fn().mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      statusCode: 200,
      message: "Products fetched successfully",
      data: [product],
      meta: { currentPage: 1, totalPages: 1, limit: 20, totalItems: 1 },
    }),
  }).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ statusCode: 200, message: "Product fetched", data: product }) });
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
  expect(fetchFn).toHaveBeenCalledWith("http://localhost:3000/api/products?type=music", expect.objectContaining({ method: "GET" }));

  await act(async () => {
    (container.querySelector('a[href="/products/album-one"]') as HTMLAnchorElement).click();
    await Promise.resolve();
    await Promise.resolve();
  });

  const buyNow = [...container.querySelectorAll("button")].find((button) => button.textContent === "MUA NGAY") as HTMLButtonElement;
  expect(buyNow.disabled).toBe(true);
  await act(async () => { ([...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Vinyl")) as HTMLButtonElement).click(); });
  expect(buyNow.disabled).toBe(false);
});
