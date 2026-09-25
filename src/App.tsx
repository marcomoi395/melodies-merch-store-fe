import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "./api";
import {
  browserCart,
  discountedPrice,
  formatMoney,
  mergeOrderItems,
  normalizeProductMedia,
  type OrderItemInput,
} from "./storefront";

type Variant = {
  id: string;
  name: string;
  originalPrice: number;
  discountPercent: number;
  stockQuantity: number;
  isPreorder: boolean;
  attributes: Array<{ key: string; value: string }>;
};
type Product = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  productType: string;
  minPrice: number;
  maxPrice: number;
  mediaGallery: string[];
  artists: Array<{ id: string; stageName: string }>;
  variants: Variant[];
  category: { name: string; slug: string } | null;
};
type Meta = {
  currentPage: number;
  totalPages: number;
  limit: number;
  totalItems: number;
};
type Line = {
  id?: string;
  productName: string;
  variantName: string;
  quantity: number;
  totalLinePrice: number;
};
type Preview = {
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  appliedVoucher: string | null;
  orderItems: Line[];
};
type Order = Preview & {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  trackingCode?: string | null;
};
type TrackedOrder = {
  id: string;
  createdAt: string;
  status: string;
  trackingCode: string | null;
  paymentMethod: string;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
};
type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
};
type Artist = {
  id: string;
  stageName: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
  products?: Product[];
};

const message = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : "Không thể kết nối máy chủ.";

function useRoute() {
  const [route, setRoute] = useState(
    () => `${window.location.pathname}${window.location.search}`,
  );
  useEffect(() => {
    const sync = () =>
      setRoute(`${window.location.pathname}${window.location.search}`);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    setRoute(to);
    window.scrollTo({ top: 0 });
  };
  const [pathname, search = ""] = route.split("?");
  return { navigate, pathname, search: search ? `?${search}` : "" };
}

function Link({
  children,
  navigate,
  to,
  className,
}: {
  children: ReactNode;
  navigate: (to: string) => void;
  to: string;
  className?: string;
}) {
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <p
      className={`notice${error ? " error" : ""}`}
      role={error ? "alert" : undefined}
    >
      {children}
    </p>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
function Media({ media, name }: { media: string[]; name: string }) {
  const [failed, setFailed] = useState(false);
  const src = media[0];
  return src && !failed ? (
    <img
      className="product-image"
      src={src}
      alt={name}
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="image-fallback" aria-label={`Không có ảnh cho ${name}`}>
      MEL
    </div>
  );
}

function Shell({
  children,
  navigate,
}: {
  children: ReactNode;
  navigate: (to: string) => void;
}) {
  return (
    <main className="page-shell">
      <header className="site-header">
        <Link navigate={navigate} to="/" className="brand">
          MELODIES / 099
        </Link>
        <nav aria-label="Điều hướng chính">
          <Link navigate={navigate} to="/">
            CỬA HÀNG
          </Link>
          <Link navigate={navigate} to="/categories">
            DANH MỤC
          </Link>
          <Link navigate={navigate} to="/artists">
            NGHỆ SĨ
          </Link>
          <Link navigate={navigate} to="/track">
            TRA CỨU ĐƠN
          </Link>
          <Link navigate={navigate} to="/cart">
            GIỎ HÀNG
          </Link>
        </nav>
      </header>
      {children}
      <footer className="site-footer">
        <span>© 2026 MELODIES</span>
        <span>COD / VI-VN</span>
      </footer>
    </main>
  );
}

function ProductCard({
  product,
  navigate,
}: {
  product: Product;
  navigate: (to: string) => void;
}) {
  return (
    <article className="product-card">
      <Link navigate={navigate} to={`/products/${product.slug}`}>
        <div className="product-art">
          <Media media={product.mediaGallery} name={product.name} />
        </div>
        <footer className="product-meta">
          <span>{product.productType}</span>
          <strong>{product.name}</strong>
          <span>
            {product.variants.some((variant) => variant.discountPercent > 0) &&
              "SALE"}
          </span>
          <span>
            {product.minPrice === product.maxPrice
              ? formatMoney(product.minPrice)
              : `${formatMoney(product.minPrice)} - ${formatMoney(product.maxPrice)}`}
          </span>
        </footer>
      </Link>
    </article>
  );
}
function ProductGrid({
  products,
  navigate,
}: {
  products: Product[];
  navigate: (to: string) => void;
}) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} navigate={navigate} />
      ))}
    </div>
  );
}

function Catalog({
  navigate,
  search,
}: {
  navigate: (to: string) => void;
  search: string;
}) {
  const query = useMemo(() => new URLSearchParams(search), [search]);
  const keyword = query.get("keyword") ?? "";
  const type = query.get("type") ?? "";
  const sort = query.get("sort") ?? "";
  const page = Math.max(1, Number(query.get("page") ?? "1"));
  const selectedArtists = query.getAll("artistId");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [error, setError] = useState("");
  const load = () => {
    setProducts(null);
    setError("");
    api
      .getProductsPage<Product, Meta>(`/products${search}`)
      .then((result) => {
        setProducts(result.data);
        setMeta(result.meta);
      })
      .catch((reason) => setError(message(reason)));
  };
  useEffect(load, [search]);
  useEffect(() => {
    api
      .getPage<Artist[], Meta>("/artists?limit=100")
      .then((result) => setArtists(result.data))
      .catch(() => setArtists([]));
  }, []);
  const apply = (next: Record<string, string>) => {
    const values = {
      keyword,
      type,
      sort,
      artistId: selectedArtists.join(","),
      price_min: query.get("price_min") ?? "",
      price_max: query.get("price_max") ?? "",
      stock_status: query.get("stock_status") ?? "",
      ...next,
    };
    const params = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      if (!value) return;
      if (key === "artistId")
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) => params.append(key, item));
      else params.set(key, value);
    });
    params.set("page", next.page ?? "1");
    navigate(`/?${params}`);
  };
  return (
    <>
      <section className="hero">
        <span className="hero-kicker">MEL / 099</span>
        <h1>MELODIES</h1>
        <p>OBJECTS FOR EVERYDAY LISTENING</p>
      </section>
      <section className="catalog-section">
        <h2>CATALOG</h2>
        <form
          className="catalog-controls"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            apply({
              keyword: String(data.get("keyword") ?? ""),
              artistId: data.getAll("artistId").join(","),
              price_min: String(data.get("price_min") ?? ""),
              price_max: String(data.get("price_max") ?? ""),
              stock_status: data.get("stock_status") ? "true" : "",
            });
          }}
        >
          <label>
            TÌM KIẾM
            <input
              name="keyword"
              defaultValue={keyword}
              placeholder="Tên sản phẩm"
            />
          </label>
          <label>
            NGHỆ SĨ
            <select
              name="artistId"
              multiple
              size={Math.min(4, Math.max(2, artists.length))}
              defaultValue={selectedArtists}
            >
              {artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.stageName}
                </option>
              ))}
            </select>
          </label>
          <label>
            GIÁ GỐC TỪ
            <input
              name="price_min"
              type="number"
              min="0"
              defaultValue={query.get("price_min") ?? ""}
            />
          </label>
          <label>
            GIÁ GỐC ĐẾN
            <input
              name="price_max"
              type="number"
              min="0"
              defaultValue={query.get("price_max") ?? ""}
            />
          </label>
          <label>
            LOẠI
            <select
              value={type}
              onChange={(event) => apply({ type: event.target.value })}
            >
              <option value="">TẤT CẢ</option>
              <option value="music">MUSIC</option>
              <option value="merch">MERCH</option>
            </select>
          </label>
          <label>
            SẮP XẾP
            <select
              value={sort}
              onChange={(event) => apply({ sort: event.target.value })}
            >
              <option value="">MỚI NHẤT</option>
              <option value="oldest">CŨ NHẤT</option>
              <option value="price_asc">GIÁ TĂNG</option>
            </select>
          </label>
          <label className="check-control">
            <input
              name="stock_status"
              type="checkbox"
              defaultChecked={query.get("stock_status") === "true"}
            />{" "}
            CÒN HÀNG
          </label>
          <button className="button ghost">TÌM</button>
        </form>
        {!products && !error && <Empty>Đang tải catalog...</Empty>}
        {error && (
          <>
            <Notice error>{error}</Notice>
            <button className="button ghost" onClick={load}>
              THỬ LẠI
            </button>
          </>
        )}
        {products?.length === 0 && (
          <Empty>Không tìm thấy sản phẩm phù hợp.</Empty>
        )}
        {products && products.length > 0 && (
          <ProductGrid products={products} navigate={navigate} />
        )}
        {meta && meta.totalPages > 1 && (
          <nav className="pagination" aria-label="Phân trang">
            <button
              className="button ghost"
              disabled={page <= 1}
              onClick={() => apply({ page: String(page - 1) })}
            >
              TRƯỚC
            </button>
            <span>
              {page} / {meta.totalPages}
            </span>
            <button
              className="button ghost"
              disabled={page >= meta.totalPages}
              onClick={() => apply({ page: String(page + 1) })}
            >
              SAU
            </button>
          </nav>
        )}
      </section>
    </>
  );
}

function CategoryIndex({ navigate }: { navigate: (to: string) => void }) {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .get<Category[]>("/categories")
      .then(setCategories)
      .catch((reason) => setError(message(reason)));
  }, []);
  return (
    <section className="content-section">
      <h1>DANH MỤC</h1>
      {!categories && !error && <Empty>Đang tải danh mục...</Empty>}
      {error && (
        <>
          <Notice error>{error}</Notice>
          <button
            className="button ghost"
            onClick={() => window.location.reload()}
          >
            THỬ LẠI
          </button>
        </>
      )}
      {categories?.length === 0 && <Empty>Chưa có danh mục.</Empty>}
      {categories && categories.length > 0 && (
        <div className="link-grid">
          {categories.map((category) => (
            <Link
              key={category.id}
              navigate={navigate}
              to={`/categories/${category.slug}`}
              className="browse-link"
            >
              <strong>{category.name}</strong>
              <small>
                {category.parentId ? "DANH MỤC CON" : "DANH MỤC GỐC"}
              </small>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryDetail({
  navigate,
  slug,
}: {
  navigate: (to: string) => void;
  slug: string;
}) {
  const [result, setResult] = useState<{ data: Product[]; meta: Meta } | null>(
    null,
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      api.getProductsPage<Product, Meta>(
        `/categories/${encodeURIComponent(slug)}`,
      ),
      api.get<Category[]>("/categories"),
    ])
      .then(([page, list]) => {
        setResult(page);
        setCategories(list);
      })
      .catch((reason) => setError(message(reason)));
  }, [slug]);
  const category = categories.find((item) => item.slug === slug);
  if (error)
    return (
      <section className="content-section">
        <Notice error>
          {error.includes("Category not found")
            ? "Không tìm thấy danh mục."
            : error}
        </Notice>
        <Link navigate={navigate} to="/categories" className="button ghost">
          VỀ DANH MỤC
        </Link>
      </section>
    );
  if (!result) return <Empty>Đang tải danh mục...</Empty>;
  return (
    <section className="content-section">
      <p className="breadcrumbs">
        <Link navigate={navigate} to="/categories">
          DANH MỤC
        </Link>{" "}
        / {category?.name ?? slug}
      </p>
      <h1>{category?.name ?? slug}</h1>
      {result.data.length === 0 ? (
        <Empty>Danh mục chưa có sản phẩm.</Empty>
      ) : (
        <ProductGrid products={result.data} navigate={navigate} />
      )}
    </section>
  );
}

function ArtistList({ navigate }: { navigate: (to: string) => void }) {
  const [artists, setArtists] = useState<Artist[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .getPage<Artist[], Meta>("/artists?limit=100")
      .then((result) => setArtists(result.data))
      .catch((reason) => setError(message(reason)));
  }, []);
  return (
    <section className="content-section">
      <h1>NGHỆ SĨ</h1>
      {!artists && !error && <Empty>Đang tải nghệ sĩ...</Empty>}
      {error && <Notice error>{error}</Notice>}
      {artists?.length === 0 && <Empty>Chưa có nghệ sĩ.</Empty>}
      {artists && artists.length > 0 && (
        <div className="link-grid">
          {artists.map((artist) => (
            <Link
              key={artist.id}
              navigate={navigate}
              to={`/artists/${artist.slug}`}
              className="browse-link"
            >
              <strong>{artist.stageName}</strong>
              <small>{artist.bio ?? "XEM CATALOG"}</small>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function ArtistDetail({
  navigate,
  slug,
}: {
  navigate: (to: string) => void;
  slug: string;
}) {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .get<Artist>(`/artists/${encodeURIComponent(slug)}`)
      .then((value) =>
        setArtist({
          ...value,
          products: value.products?.map(normalizeProductMedia),
        }),
      )
      .catch((reason) => setError(message(reason)));
  }, [slug]);
  if (error)
    return (
      <section className="content-section">
        <Notice error>
          {error.includes("Artist not found")
            ? "Không tìm thấy nghệ sĩ."
            : error}
        </Notice>
        <Link navigate={navigate} to="/artists" className="button ghost">
          VỀ NGHỆ SĨ
        </Link>
      </section>
    );
  if (!artist) return <Empty>Đang tải nghệ sĩ...</Empty>;
  return (
    <section className="content-section">
      <p className="breadcrumbs">
        <Link navigate={navigate} to="/artists">
          NGHỆ SĨ
        </Link>{" "}
        / {artist.stageName}
      </p>
      <h1>{artist.stageName}</h1>
      {artist.bio && <p className="detail-text">{artist.bio}</p>}
      {!artist.products?.length ? (
        <Empty>Nghệ sĩ chưa có sản phẩm.</Empty>
      ) : (
        <ProductGrid products={artist.products} navigate={navigate} />
      )}
    </section>
  );
}

function Detail({
  navigate,
  slug,
}: {
  navigate: (to: string) => void;
  slug: string;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    api
      .getProduct<Product>(`/products/${encodeURIComponent(slug)}`)
      .then((data) => {
        setProduct(data);
        setSelectedId("");
      })
      .catch((reason) => setError(message(reason)));
  }, [slug]);
  if (error && !product)
    return (
      <section className="content-section">
        <Notice error>
          {error.includes("Product not found")
            ? "Không tìm thấy sản phẩm."
            : error}
        </Notice>
        <Link navigate={navigate} to="/" className="button ghost">
          VỀ CATALOG
        </Link>
      </section>
    );
  if (!product) return <Empty>Đang tải sản phẩm...</Empty>;
  const selected = product.variants.find(
    (variant) => variant.id === selectedId,
  );
  const inStock = Boolean(selected && selected.stockQuantity > 0);
  const add = () => {
    if (!selected) return;
    const quantityInCart =
      browserCart.read().find((item) => item.variant.id === selected.id)
        ?.quantity ?? 0;
    if (quantityInCart >= selected.stockQuantity)
      return setError("Số lượng trong giỏ đã đạt tồn kho hiện có.");
    browserCart.add({
      product: {
        id: product.id,
        name: product.name,
        mediaGallery: product.mediaGallery,
      },
      variant: {
        id: selected.id,
        name: selected.name,
        originalPrice: selected.originalPrice,
        discountPercent: selected.discountPercent,
        stockQuantity: selected.stockQuantity,
      },
    });
    setError("");
    setNotice("Đã thêm vào giỏ hàng.");
  };
  return (
    <section className="product-detail content-section">
      <div className="detail-media">
        <Media media={product.mediaGallery} name={product.name} />
      </div>
      <div className="detail-copy">
        <p className="eyebrow">
          {product.productType}
          {product.category ? ` / ${product.category.name}` : ""}
        </p>
        <h1>{product.name}</h1>
        {product.shortDescription && <p>{product.shortDescription}</p>}
        <fieldset>
          <legend>PHIÊN BẢN</legend>
          <div className="variant-list">
            {product.variants.map((variant) => (
              <button
                key={variant.id}
                className={`variant${variant.id === selectedId ? " selected" : ""}`}
                onClick={() => setSelectedId(variant.id)}
              >
                <strong>{variant.name}</strong>
                <span>
                  {formatMoney(
                    discountedPrice(
                      variant.originalPrice,
                      variant.discountPercent,
                    ),
                  )}
                </span>
                <small>
                  {variant.attributes
                    .map((attribute) => `${attribute.key}: ${attribute.value}`)
                    .join(" / ") || "Tiêu chuẩn"}
                </small>
                <small>
                  {variant.stockQuantity
                    ? `${variant.stockQuantity} còn lại`
                    : "Hết hàng"}
                  {variant.isPreorder ? " / Preorder" : ""}
                </small>
              </button>
            ))}
          </div>
        </fieldset>
        {selected && (
          <p className="price-block">
            <strong>
              {formatMoney(
                discountedPrice(
                  selected.originalPrice,
                  selected.discountPercent,
                ),
              )}
            </strong>
            {selected.discountPercent > 0 && (
              <del>{formatMoney(selected.originalPrice)}</del>
            )}
          </p>
        )}
        {error && <Notice error>{error}</Notice>}
        {notice && <Notice>{notice}</Notice>}
        <div className="action-row">
          <button className="button ghost" disabled={!inStock} onClick={add}>
            THÊM GIỎ
          </button>
          <button
            className="button"
            disabled={!inStock}
            onClick={() =>
              selected &&
              navigate(`/checkout?variant=${selected.id}&quantity=1`)
            }
          >
            MUA NGAY
          </button>
        </div>
      </div>
    </section>
  );
}

function CartPage({ navigate }: { navigate: (to: string) => void }) {
  const [items, setItems] = useState(browserCart.read);
  useEffect(() => {
    const sync = () => setItems(browserCart.read());
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("melodies-cart-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("melodies-cart-change", sync);
    };
  }, []);
  const change = (variantId: string, quantity: number) =>
    setItems(browserCart.update(variantId, quantity));
  return (
    <section className="content-section">
      <h1>GIỎ HÀNG</h1>
      {items.length === 0 ? (
        <Empty>Giỏ hàng đang trống.</Empty>
      ) : (
        <>
          <div className="cart-list">
            {items.map((item) => (
              <article key={item.variant.id} className="cart-item">
                <Media
                  media={item.product.mediaGallery}
                  name={item.product.name}
                />
                <div>
                  <strong>{item.product.name}</strong>
                  <p>{item.variant.name}</p>
                  <p>
                    {formatMoney(
                      discountedPrice(
                        item.variant.originalPrice,
                        item.variant.discountPercent,
                      ),
                    )}
                  </p>
                </div>
                <div className="quantity">
                  <button
                    aria-label="Giảm số lượng"
                    onClick={() => change(item.variant.id, item.quantity - 1)}
                  >
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    aria-label="Tăng số lượng"
                    disabled={item.quantity >= item.variant.stockQuantity}
                    onClick={() => change(item.variant.id, item.quantity + 1)}
                  >
                    +
                  </button>
                  <button
                    className="text-action"
                    onClick={() => change(item.variant.id, 0)}
                  >
                    XÓA
                  </button>
                </div>
              </article>
            ))}
          </div>
          <button
            className="button"
            onClick={() => navigate("/checkout?cart=1")}
          >
            THANH TOÁN COD
          </button>
        </>
      )}
    </section>
  );
}

function Totals({ order }: { order: Preview | Order }) {
  return (
    <div className="totals">
      <div className="order-lines">
        {order.orderItems.map((line, index) => (
          <p key={line.id ?? `${line.productName}-${index}`}>
            <span>
              {line.productName} / {line.variantName} x{line.quantity}
            </span>
            <strong>{formatMoney(line.totalLinePrice)}</strong>
          </p>
        ))}
      </div>
      <p>
        <span>TẠM TÍNH</span>
        <strong>{formatMoney(order.subtotal)}</strong>
      </p>
      {order.discountAmount > 0 && (
        <p>
          <span>
            GIẢM GIÁ{order.appliedVoucher ? ` (${order.appliedVoucher})` : ""}
          </span>
          <strong>-{formatMoney(order.discountAmount)}</strong>
        </p>
      )}
      <p>
        <span>GIAO HÀNG</span>
        <strong>{formatMoney(order.shippingFee)}</strong>
      </p>
      <p className="total">
        <span>TỔNG</span>
        <strong>{formatMoney(order.totalAmount)}</strong>
      </p>
    </div>
  );
}

function Checkout({
  navigate,
  search,
}: {
  navigate: (to: string) => void;
  search: string;
}) {
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [items, setItems] = useState<OrderItemInput[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    shippingAddress: "",
    note: "",
    appliedVoucher: "",
  });
  const cartCheckout = params.get("cart") === "1";
  useEffect(() => {
    if (cartCheckout)
      setItems(
        browserCart.read().map((item) => ({
          productVariantId: item.variant.id,
          quantity: item.quantity,
        })),
      );
    else {
      const variant = params.get("variant");
      setItems(
        variant
          ? [
              {
                productVariantId: variant,
                quantity: Math.max(1, Number(params.get("quantity") ?? "1")),
              },
            ]
          : [],
      );
    }
    setLoading(false);
  }, [cartCheckout, params]);
  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setPreview(null);
  };
  const getPreview = async () => {
    if (!form.shippingAddress || items.length === 0)
      return setError("Hãy nhập địa chỉ giao hàng và chọn sản phẩm.");
    try {
      setError("");
      const body = {
        items: mergeOrderItems(items),
        shippingAddress: form.shippingAddress,
        ...(form.appliedVoucher.trim()
          ? { appliedVoucher: form.appliedVoucher.trim() }
          : {}),
      };
      setPreview(await api.post<Preview>("/order/preview", body));
    } catch (reason) {
      setPreview(null);
      setError(message(reason));
    }
  };
  const create = async () => {
    if (!preview) return getPreview();
    if (
      !form.fullName.trim() ||
      !/^\S+@\S+\.\S+$/.test(form.email) ||
      !form.phone.trim()
    )
      return setError("Hãy nhập họ tên, email hợp lệ và số điện thoại.");
    try {
      const order = await api.post<Order>("/order", {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        shippingAddress: form.shippingAddress,
        note: form.note || undefined,
        items: mergeOrderItems(items),
        paymentMethod: "COD",
        ...(preview.appliedVoucher
          ? { appliedVoucher: preview.appliedVoucher }
          : {}),
      });
      if (cartCheckout) browserCart.clear();
      sessionStorage.setItem("melodies.last-order", JSON.stringify(order));
      navigate("/order/success");
    } catch (reason) {
      setPreview(null);
      setError(`${message(reason)}. Vui lòng xem lại đơn hàng.`);
    }
  };
  if (loading) return <Empty>Đang chuẩn bị thanh toán...</Empty>;
  if (!items.length)
    return (
      <section className="content-section">
        <Empty>Không có sản phẩm để thanh toán.</Empty>
        <Link navigate={navigate} to="/" className="button ghost">
          VỀ CATALOG
        </Link>
      </section>
    );
  return (
    <section className="checkout content-section">
      <div>
        <h1>THANH TOÁN</h1>
        <p className="muted">
          Mua hàng không cần đăng nhập. Chỉ nhận thanh toán khi giao hàng (COD).
        </p>
        <div className="checkout-form">
          <label>
            HỌ VÀ TÊN
            <input
              required
              value={form.fullName}
              onChange={(event) => update("fullName", event.target.value)}
            />
          </label>
          <label>
            EMAIL
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
            />
          </label>
          <label>
            SỐ ĐIỆN THOẠI
            <input
              required
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
            />
          </label>
          <label>
            ĐỊA CHỈ GIAO HÀNG
            <textarea
              required
              value={form.shippingAddress}
              onChange={(event) =>
                update("shippingAddress", event.target.value)
              }
            />
          </label>
          <label>
            MÃ VOUCHER
            <input
              value={form.appliedVoucher}
              placeholder="Nhập nếu có"
              onChange={(event) => update("appliedVoucher", event.target.value)}
            />
          </label>
          <label>
            GHI CHÚ
            <textarea
              value={form.note}
              onChange={(event) => update("note", event.target.value)}
            />
          </label>
        </div>
      </div>
      <aside className="order-summary">
        <h2>ĐƠN HÀNG</h2>
        <p>{items.length} phiên bản</p>
        {error && <Notice error>{error}</Notice>}
        {preview && <Totals order={preview} />}
        {preview ? (
          <button className="button" onClick={create}>
            ĐẶT HÀNG COD
          </button>
        ) : (
          <button className="button" onClick={getPreview}>
            XEM TỔNG TIỀN
          </button>
        )}
      </aside>
    </section>
  );
}

function Tracking({ navigate }: { navigate: (to: string) => void }) {
  const [orders, setOrders] = useState<TrackedOrder[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const email = String(data.email ?? "").trim();
    const phone = String(data.phone ?? "").trim();
    if (!email && !phone) return setError("Nhập email hoặc số điện thoại.");
    if (email && !/^\S+@\S+\.\S+$/.test(email))
      return setError("Email không đúng định dạng.");
    setLoading(true);
    setError("");
    try {
      setOrders(
        await api.post<TrackedOrder[]>(
          "/order/track",
          email ? { email } : { phone },
        ),
      );
    } catch (reason) {
      setOrders(null);
      setError(message(reason));
    } finally {
      setLoading(false);
    }
  };
  return (
    <section className="content-section tracking">
      <h1>TRA CỨU ĐƠN HÀNG</h1>
      <p className="muted">
        Nhập email hoặc số điện thoại đã dùng khi đặt hàng.
      </p>
      <form className="tracking-form" onSubmit={submit}>
        <label>
          EMAIL
          <input name="email" type="email" placeholder="email@example.com" />
        </label>
        <span className="muted">HOẶC</span>
        <label>
          SỐ ĐIỆN THOẠI
          <input name="phone" placeholder="090..." />
        </label>
        <button className="button" disabled={loading}>
          {loading ? "ĐANG TÌM" : "TRA CỨU"}
        </button>
      </form>
      {error && <Notice error>{error}</Notice>}
      {orders && orders.length === 0 && (
        <Empty>Không tìm thấy đơn hàng phù hợp.</Empty>
      )}
      {orders && orders.length > 0 && (
        <div className="tracking-list">
          {orders.map((order) => (
            <article className="tracking-card" key={order.id}>
              <div>
                <span className="eyebrow">{order.status}</span>
                <h2>{order.id}</h2>
                <p>{new Date(order.createdAt).toLocaleString("vi-VN")}</p>
              </div>
              <div>
                <p>
                  TỔNG <strong>{formatMoney(order.totalAmount)}</strong>
                </p>
                <p>
                  {order.trackingCode
                    ? `Mã vận đơn: ${order.trackingCode}`
                    : "Chưa có mã vận đơn"}
                </p>
                <p>{order.paymentMethod}</p>
              </div>
            </article>
          ))}
        </div>
      )}
      <p>
        <Link navigate={navigate} to="/" className="button ghost">
          VỀ CATALOG
        </Link>
      </p>
    </section>
  );
}

function Receipt({ navigate }: { navigate: (to: string) => void }) {
  const [order] = useState<Order | null>(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("melodies.last-order") ?? "null",
      ) as Order | null;
    } catch {
      return null;
    }
  });
  if (!order)
    return (
      <section className="content-section">
        <Empty>Không có đơn hàng gần đây trong phiên này.</Empty>
        <Link navigate={navigate} to="/" className="button ghost">
          VỀ CATALOG
        </Link>
      </section>
    );
  return (
    <section className="receipt content-section">
      <p className="eyebrow">ĐẶT HÀNG THÀNH CÔNG</p>
      <h1>CẢM ƠN BẠN</h1>
      <p>
        Mã đơn: <strong>{order.id}</strong>
      </p>
      <p>
        {order.fullName} / {order.phone}
        <br />
        {order.shippingAddress}
      </p>
      <Totals order={order} />
      <Notice>
        Trạng thái: {order.status} / {order.paymentMethod}
      </Notice>
      <Link navigate={navigate} to="/track" className="button ghost">
        TRA CỨU ĐƠN
      </Link>{" "}
      <Link navigate={navigate} to="/" className="button">
        TIẾP TỤC MUA
      </Link>
    </section>
  );
}

function App() {
  const { navigate, pathname, search } = useRoute();
  let page: ReactNode;
  if (pathname === "/") page = <Catalog navigate={navigate} search={search} />;
  else if (pathname === "/categories")
    page = <CategoryIndex navigate={navigate} />;
  else if (pathname.startsWith("/categories/"))
    page = (
      <CategoryDetail
        navigate={navigate}
        slug={decodeURIComponent(pathname.slice(12))}
      />
    );
  else if (pathname === "/artists") page = <ArtistList navigate={navigate} />;
  else if (pathname.startsWith("/artists/"))
    page = (
      <ArtistDetail
        navigate={navigate}
        slug={decodeURIComponent(pathname.slice(9))}
      />
    );
  else if (pathname.startsWith("/products/"))
    page = (
      <Detail
        navigate={navigate}
        slug={decodeURIComponent(pathname.slice(10))}
      />
    );
  else if (pathname === "/cart") page = <CartPage navigate={navigate} />;
  else if (pathname === "/checkout")
    page = <Checkout navigate={navigate} search={search} />;
  else if (pathname === "/track") page = <Tracking navigate={navigate} />;
  else if (pathname === "/order/success")
    page = <Receipt navigate={navigate} />;
  else
    page = (
      <section className="content-section">
        <Empty>Không tìm thấy trang.</Empty>
        <Link navigate={navigate} to="/" className="button ghost">
          VỀ CATALOG
        </Link>
      </section>
    );
  return <Shell navigate={navigate}>{page}</Shell>;
}

export default App;
