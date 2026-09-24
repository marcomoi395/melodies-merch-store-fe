export type OrderItemInput = { productVariantId: string; quantity: number };

type CartWithUnknownVariants = {
  cartItems: Array<{ product: { mediaGallery: unknown; variants: unknown } }>;
};

type ProductWithUnknownMedia = { mediaGallery: unknown };

export function normalizeProductMedia<T extends ProductWithUnknownMedia>(product: T): T {
  return { ...product, mediaGallery: normalizeGallery(product.mediaGallery) };
}

export function normalizeCartVariants<T extends CartWithUnknownVariants>(cart: T): T {
  return {
    ...cart,
    cartItems: cart.cartItems.map((item) => ({
      ...item,
      product: {
        ...normalizeProductMedia(item.product),
        variants: Array.isArray(item.product.variants) ? item.product.variants : [item.product.variants],
      },
    })),
  };
}

export function normalizeGallery(mediaGallery: unknown): string[] {
  if (!Array.isArray(mediaGallery)) return [];

  return mediaGallery.flatMap((media) => {
    if (typeof media === "string") return [media];
    if (media && typeof media === "object" && "url" in media && typeof media.url === "string") return [media.url];
    return [];
  });
}

export function mergeOrderItems(items: OrderItemInput[]): OrderItemInput[] {
  const quantities = new Map<string, number>();
  for (const item of items) quantities.set(item.productVariantId, (quantities.get(item.productVariantId) ?? 0) + item.quantity);
  return [...quantities].map(([productVariantId, quantity]) => ({ productVariantId, quantity }));
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN", { currency: "VND", style: "currency", maximumFractionDigits: 0 }).format(value);
}

export function discountedPrice(originalPrice: number, discountPercent: number): number {
  return originalPrice * (1 - discountPercent / 100);
}
