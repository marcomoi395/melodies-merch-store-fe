// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { browserCart, mergeOrderItems, normalizeCartVariants, normalizeGallery } from "./storefront";

afterEach(() => localStorage.clear());

describe("storefront boundary helpers", () => {
  it("normalizes media URL strings and media objects", () => {
    expect(normalizeGallery(["https://cdn.test/cover.jpg", { url: "https://cdn.test/back.jpg" }, { type: "video" }, null])).toEqual([
      "https://cdn.test/cover.jpg",
      "https://cdn.test/back.jpg",
    ]);
  });

  it("merges duplicate variant quantities before checkout", () => {
    expect(mergeOrderItems([
      { productVariantId: "variant-a", quantity: 1 },
      { productVariantId: "variant-b", quantity: 2 },
      { productVariantId: "variant-a", quantity: 3 },
    ])).toEqual([
      { productVariantId: "variant-a", quantity: 4 },
      { productVariantId: "variant-b", quantity: 2 },
    ]);
  });

  it("normalizes the cart selected variant before views receive it", () => {
    expect(normalizeCartVariants({ cartItems: [{ product: { mediaGallery: [], variants: { id: "variant-a" } } }] }).cartItems[0].product.variants).toEqual([{ id: "variant-a" }]);
  });

  it("persists a browser cart without an account and clears it after checkout", () => {
    const item = { product: { id: "product-a", name: "Album", mediaGallery: [] }, variant: { id: "variant-a", name: "Vinyl", originalPrice: 100000, discountPercent: 0, stockQuantity: 2 } };
    browserCart.add(item);
    browserCart.add(item);
    expect(browserCart.read()).toEqual([{ ...item, quantity: 2 }]);
    browserCart.clear();
    expect(browserCart.read()).toEqual([]);
  });

  it("normalizes numeric strings returned by the product API", () => {
    localStorage.setItem("melodies.cart", JSON.stringify([{
      product: { id: "product-a", name: "Album", mediaGallery: [] },
      variant: { id: "variant-a", name: "Vinyl", originalPrice: "850000", discountPercent: "0", stockQuantity: 1 },
      quantity: 1,
    }]));

    expect(browserCart.read()).toEqual([{
      product: { id: "product-a", name: "Album", mediaGallery: [] },
      variant: { id: "variant-a", name: "Vinyl", originalPrice: 850000, discountPercent: 0, stockQuantity: 1 },
      quantity: 1,
    }]);
  });
});
