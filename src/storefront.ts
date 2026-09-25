export type OrderItemInput = { productVariantId: string; quantity: number };

export type BrowserCartItem = {
  product: { id: string; name: string; mediaGallery: string[] };
  variant: {
    id: string;
    name: string;
    originalPrice: number;
    discountPercent: number;
    stockQuantity: number;
  };
  quantity: number;
};

const CART_KEY = "melodies.cart";

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

function asNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function parseBrowserCartItem(value: unknown): BrowserCartItem | null {
  if (!value || typeof value !== "object") return null;

  const item = value as { product?: unknown; variant?: unknown; quantity?: unknown };
  if (!item.product || typeof item.product !== "object" || !item.variant || typeof item.variant !== "object") return null;

  const product = item.product as { id?: unknown; name?: unknown; mediaGallery?: unknown };
  const variant = item.variant as { id?: unknown; name?: unknown; originalPrice?: unknown; discountPercent?: unknown; stockQuantity?: unknown };
  const originalPrice = asNumber(variant.originalPrice);
  const discountPercent = asNumber(variant.discountPercent);
  const stockQuantity = asNumber(variant.stockQuantity);
  const quantity = asNumber(item.quantity);

  if (typeof product.id !== "string" || typeof product.name !== "string" || typeof variant.id !== "string" || typeof variant.name !== "string"
    || originalPrice === null || discountPercent === null || stockQuantity === null || quantity === null || !Number.isInteger(quantity) || quantity <= 0) return null;

  return {
    product: { id: product.id, name: product.name, mediaGallery: normalizeGallery(product.mediaGallery) },
    variant: { id: variant.id, name: variant.name, originalPrice, discountPercent, stockQuantity },
    quantity,
  };
}

function readBrowserCart(): BrowserCartItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.flatMap((item) => {
      const cartItem = parseBrowserCartItem(item);
      return cartItem ? [cartItem] : [];
    }) : [];
  } catch {
    localStorage.removeItem(CART_KEY);
    return [];
  }
}

function writeBrowserCart(items: BrowserCartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("melodies-cart-change"));
  return items;
}

export const browserCart = {
  read: readBrowserCart,
  add(item: Omit<BrowserCartItem, "quantity">) {
    const items = readBrowserCart();
    const existing = items.find((candidate) => candidate.variant.id === item.variant.id);
    if (existing) existing.quantity += 1;
    else items.push({ ...item, quantity: 1 });
    return writeBrowserCart(items);
  },
  update(variantId: string, quantity: number) {
    const items = readBrowserCart().flatMap((item) => item.variant.id === variantId
      ? quantity > 0 ? [{ ...item, quantity }] : []
      : [item]);
    return writeBrowserCart(items);
  },
  clear() {
    localStorage.removeItem(CART_KEY);
  },
};
