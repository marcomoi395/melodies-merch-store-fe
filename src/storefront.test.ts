import { describe, expect, it } from "vitest";
import { mergeOrderItems, normalizeCartVariants, normalizeGallery } from "./storefront";

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
});
