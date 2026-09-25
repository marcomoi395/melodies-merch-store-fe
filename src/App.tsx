import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { api, ApiError, browserTokens, setSessionFailureHandler } from "./api";
import { browserCart, discountedPrice, formatMoney, mergeOrderItems, type OrderItemInput } from "./storefront";

type User = { id: string; email: string; fullName: string | null; phone: string | null; isVerified: boolean | null };
type Variant = { id: string; name: string; originalPrice: number; discountPercent: number; stockQuantity: number; isPreorder: boolean; attributes: Array<{ key: string; value: string }> };
type Product = { id: string; name: string; slug: string; shortDescription: string | null; productType: string; minPrice: number; maxPrice: number; mediaGallery: string[]; artists: Array<{ id: string; stageName: string }>; variants: Variant[]; category: { name: string; slug: string } | null };
type Meta = { currentPage: number; totalPages: number; limit: number; totalItems: number };
type Line = { id: string; productName: string; variantName: string; quantity: number; totalLinePrice: number };
type Preview = { subtotal: number; shippingFee: number; discountAmount: number; totalAmount: number; orderItems: Line[] };
type Order = Preview & { id: string; fullName: string; phone: string; shippingAddress: string; status: string; paymentMethod: string };
type Login = { accessToken: string; refreshToken: string; user: User };

const message = (error: unknown) => error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Không thể kết nối máy chủ.";

function useRoute() {
  const [route, setRoute] = useState(() => `${window.location.pathname}${window.location.search}`);
  useEffect(() => { const sync = () => setRoute(`${window.location.pathname}${window.location.search}`); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync); }, []);
  const navigate = (to: string) => { window.history.pushState({}, "", to); setRoute(to); window.scrollTo({ top: 0 }); };
  const [pathname, search = ""] = route.split("?");
  return { navigate, pathname, search: search ? `?${search}` : "" };
}

function Link({ children, navigate, to, className }: { children: ReactNode; navigate: (to: string) => void; to: string; className?: string }) {
  return <a href={to} className={className} onClick={(event) => { event.preventDefault(); navigate(to); }}>{children}</a>;
}

function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) { return <p className={`notice${error ? " error" : ""}`} role={error ? "alert" : undefined}>{children}</p>; }
function Empty({ children }: { children: ReactNode }) { return <div className="empty-state">{children}</div>; }
function Media({ media, name }: { media: string[]; name: string }) { const [failed, setFailed] = useState(false); const src = media[0]; return src && !failed ? <img className="product-image" src={src} alt={name} onError={() => setFailed(true)} /> : <div className="image-fallback" aria-label={`Không có ảnh cho ${name}`}>MEL</div>; }
function Shell({ children, navigate, user, logout }: { children: ReactNode; navigate: (to: string) => void; user: User | null; logout: () => void }) {
  return <main className="page-shell"><header className="site-header"><Link navigate={navigate} to="/" className="brand">MELODIES / 099</Link><nav aria-label="Điều hướng chính"><Link navigate={navigate} to="/">CỬA HÀNG</Link><Link navigate={navigate} to="/cart">GIỎ HÀNG</Link>{user ? <><Link navigate={navigate} to="/verify-account">XÁC THỰC</Link><button className="link-button" onClick={logout}>ĐĂNG XUẤT</button></> : <Link navigate={navigate} to="/login">ĐĂNG NHẬP</Link>}</nav></header>{children}<footer className="site-footer"><span>© 2026 MELODIES</span><span>COD / VI-VN</span></footer></main>;
}

function Catalog({ navigate, search }: { navigate: (to: string) => void; search: string }) {
  const query = useMemo(() => new URLSearchParams(search), [search]);
  const keyword = query.get("keyword") ?? ""; const type = query.get("type") ?? ""; const sort = query.get("sort") ?? ""; const page = Math.max(1, Number(query.get("page") ?? "1"));
  const [products, setProducts] = useState<Product[] | null>(null); const [meta, setMeta] = useState<Meta | null>(null); const [error, setError] = useState("");
  const load = () => { setProducts(null); setError(""); api.getProductsPage<Product, Meta>(`/products${search}`).then((result) => { setProducts(result.data); setMeta(result.meta); }).catch((reason) => setError(message(reason))); };
  useEffect(load, [search]);
  const apply = (next: Record<string, string>) => { const values = { keyword, type, sort, ...next }; const params = new URLSearchParams(); if (values.keyword) params.set("keyword", values.keyword); if (values.type) params.set("type", values.type); if (values.sort) params.set("sort", values.sort); params.set("page", next.page ?? "1"); navigate(`/?${params}`); };
  return <><section className="hero"><span className="hero-kicker">MEL / 099</span><h1>MELODIES</h1><p>OBJECTS FOR EVERYDAY LISTENING</p></section><section className="catalog-section"><h2>CATALOG</h2><form className="catalog-controls" onSubmit={(event) => { event.preventDefault(); apply({ keyword: String(new FormData(event.currentTarget).get("keyword") ?? "") }); }}><label>TÌM KIẾM<input name="keyword" defaultValue={keyword} placeholder="Tên sản phẩm" /></label><label>LOẠI<select value={type} onChange={(event) => apply({ type: event.target.value })}><option value="">TẤT CẢ</option><option value="music">MUSIC</option><option value="merch">MERCH</option></select></label><label>SẮP XẾP<select value={sort} onChange={(event) => apply({ sort: event.target.value })}><option value="">MỚI NHẤT</option><option value="price_asc">GIÁ TĂNG</option></select></label><button className="button ghost">TÌM</button></form>{!products && !error && <Empty>Đang tải catalog...</Empty>}{error && <><Notice error>{error}</Notice><button className="button ghost" onClick={load}>THỬ LẠI</button></>}{products?.length === 0 && <Empty>Không tìm thấy sản phẩm phù hợp.</Empty>}{products && products.length > 0 && <div className="product-grid">{products.map((product) => <article key={product.id} className="product-card"><Link navigate={navigate} to={`/products/${product.slug}`}><div className="product-art"><Media media={product.mediaGallery} name={product.name} /></div><footer className="product-meta"><span>{product.productType}</span><strong>{product.name}</strong><span>{product.variants.some((variant) => variant.discountPercent > 0) && "SALE"}</span><span>{product.minPrice === product.maxPrice ? formatMoney(product.minPrice) : `${formatMoney(product.minPrice)} - ${formatMoney(product.maxPrice)}`}</span></footer></Link></article>)}</div>}{meta && meta.totalPages > 1 && <nav className="pagination" aria-label="Phân trang"><button className="button ghost" disabled={page <= 1} onClick={() => apply({ page: String(page - 1) })}>TRƯỚC</button><span>{page} / {meta.totalPages}</span><button className="button ghost" disabled={page >= meta.totalPages} onClick={() => apply({ page: String(page + 1) })}>SAU</button></nav>}</section></>;
}

function Detail({ navigate, slug }: { navigate: (to: string) => void; slug: string }) {
  const [product, setProduct] = useState<Product | null>(null); const [selectedId, setSelectedId] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  useEffect(() => { api.getProduct<Product>(`/products/${encodeURIComponent(slug)}`).then((data) => { setProduct(data); setSelectedId(""); }).catch((reason) => setError(message(reason))); }, [slug]);
  if (error && !product) return <section className="content-section"><Notice error>{error}</Notice><Link navigate={navigate} to="/" className="button ghost">VỀ CATALOG</Link></section>;
  if (!product) return <Empty>Đang tải sản phẩm...</Empty>;
  const selected = product.variants.find((variant) => variant.id === selectedId); const inStock = Boolean(selected && selected.stockQuantity > 0);
  const add = () => { if (!selected) return; const quantityInCart = browserCart.read().find((item) => item.variant.id === selected.id)?.quantity ?? 0; if (quantityInCart >= selected.stockQuantity) return setError("Số lượng trong giỏ đã đạt tồn kho hiện có."); browserCart.add({ product: { id: product.id, name: product.name, mediaGallery: product.mediaGallery }, variant: { id: selected.id, name: selected.name, originalPrice: selected.originalPrice, discountPercent: selected.discountPercent, stockQuantity: selected.stockQuantity } }); setError(""); setNotice("Đã thêm vào giỏ hàng."); };
  return <section className="product-detail content-section"><div className="detail-media"><Media media={product.mediaGallery} name={product.name} /></div><div className="detail-copy"><p className="eyebrow">{product.productType}{product.category ? ` / ${product.category.name}` : ""}</p><h1>{product.name}</h1>{product.shortDescription && <p>{product.shortDescription}</p>}<fieldset><legend>PHIÊN BẢN</legend><div className="variant-list">{product.variants.map((variant) => <button key={variant.id} className={`variant${variant.id === selectedId ? " selected" : ""}`} onClick={() => setSelectedId(variant.id)}><strong>{variant.name}</strong><span>{formatMoney(discountedPrice(variant.originalPrice, variant.discountPercent))}</span><small>{variant.attributes.map((attribute) => `${attribute.key}: ${attribute.value}`).join(" / ") || "Tiêu chuẩn"}</small><small>{variant.stockQuantity ? `${variant.stockQuantity} còn lại` : "Hết hàng"}{variant.isPreorder ? " / Preorder" : ""}</small></button>)}</div></fieldset>{selected && <p className="price-block"><strong>{formatMoney(discountedPrice(selected.originalPrice, selected.discountPercent))}</strong>{selected.discountPercent > 0 && <del>{formatMoney(selected.originalPrice)}</del>}</p>}{error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}<div className="action-row"><button className="button ghost" disabled={!inStock} onClick={add}>THÊM GIỎ</button><button className="button" disabled={!inStock} onClick={() => selected && navigate(`/checkout?variant=${selected.id}&quantity=1`)}>MUA NGAY</button></div></div></section>;
}

function Auth({ navigate, onLogin, pathname, search, user }: { navigate: (to: string) => void; onLogin: (user: User) => void; pathname: string; search: string; user: User | null }) {
  const params = new URLSearchParams(search); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(""); setNotice(""); setLoading(true); const data = Object.fromEntries(new FormData(event.currentTarget)); try {
    if (pathname === "/login") { const login = await api.post<Login>("/auth/login", { email: data.email, password: data.password }); browserTokens.write({ accessToken: login.accessToken, refreshToken: login.refreshToken }); onLogin(login.user); navigate(params.get("next") || "/"); }
    if (pathname === "/register") { await api.post("/auth/register", { email: data.email, password: data.password, fullName: data.fullName }); setNotice("Đăng ký thành công. Hãy đăng nhập."); }
    if (pathname === "/forgot-password") { await api.post("/auth/forgot-password", { email: data.email }); setNotice("Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi."); }
    if (pathname === "/reset-password") { const token = params.get("token"); if (!token) throw new Error("Thiếu token đặt lại mật khẩu."); await api.post("/auth/reset-password", { token, newPassword: data.newPassword }); setNotice("Đặt lại mật khẩu thành công. Hãy đăng nhập."); }
    if (pathname === "/verify-account") { const token = params.get("token"); if (token) { await api.post("/user/verify-account", { token }); setNotice("Tài khoản đã được xác thực."); } else if (user) { await api.get("/user/request-verification-email", { authenticated: true }); setNotice("Email xác thực đã được gửi."); } else navigate("/login?next=%2Fverify-account"); }
  } catch (reason) { setError(message(reason)); } finally { setLoading(false); } };
  const title = pathname === "/login" ? "ĐĂNG NHẬP" : pathname === "/register" ? "TẠO TÀI KHOẢN" : pathname === "/forgot-password" ? "QUÊN MẬT KHẨU" : pathname === "/reset-password" ? "ĐẶT LẠI MẬT KHẨU" : "XÁC THỰC TÀI KHOẢN";
  const action = pathname === "/verify-account" ? (params.get("token") ? "XÁC THỰC" : "GỬI EMAIL") : pathname === "/forgot-password" ? "GỬI LIÊN KẾT" : pathname === "/reset-password" ? "ĐỔI MẬT KHẨU" : pathname === "/register" ? "ĐĂNG KÝ" : "ĐĂNG NHẬP";
  return <section className="auth-panel"><h1>{title}</h1><form onSubmit={submit}>{pathname === "/register" && <label>HỌ VÀ TÊN<input required name="fullName" maxLength={100} /></label>}{["/login", "/register", "/forgot-password"].includes(pathname) && <label>EMAIL<input required name="email" type="email" /></label>}{["/login", "/register"].includes(pathname) && <label>MẬT KHẨU<input required name="password" type="password" minLength={6} /></label>}{pathname === "/reset-password" && <label>MẬT KHẨU MỚI<input required name="newPassword" type="password" minLength={6} /></label>}{error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}<button className="button" disabled={loading}>{loading ? "ĐANG XỬ LÝ" : action}</button></form>{pathname === "/login" && <p className="auth-links"><Link navigate={navigate} to="/register">TẠO TÀI KHOẢN</Link><Link navigate={navigate} to="/forgot-password">QUÊN MẬT KHẨU</Link></p>}</section>;
}

function CartPage({ navigate }: { navigate: (to: string) => void }) {
  const [items, setItems] = useState(browserCart.read);
  useEffect(() => {
    const sync = () => setItems(browserCart.read());
    sync();
    window.addEventListener("pageshow", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("melodies-cart-change", sync);
    return () => {
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("melodies-cart-change", sync);
    };
  }, []);
  const change = (variantId: string, quantity: number) => setItems(browserCart.update(variantId, quantity));
  return <section className="content-section"><h1>GIỎ HÀNG</h1>{items.length === 0 ? <Empty>Giỏ hàng đang trống.</Empty> : <><div className="cart-list">{items.map((item) => <article key={item.variant.id} className="cart-item"><Media media={item.product.mediaGallery} name={item.product.name} /><div><strong>{item.product.name}</strong><p>{item.variant.name}</p><p>{formatMoney(discountedPrice(item.variant.originalPrice, item.variant.discountPercent))}</p></div><div className="quantity"><button aria-label="Giảm số lượng" onClick={() => change(item.variant.id, item.quantity - 1)}>-</button><span>{item.quantity}</span><button aria-label="Tăng số lượng" disabled={item.quantity >= item.variant.stockQuantity} onClick={() => change(item.variant.id, item.quantity + 1)}>+</button><button className="text-action" onClick={() => change(item.variant.id, 0)}>XÓA</button></div></article>)}</div><button className="button" onClick={() => navigate("/checkout?cart=1")}>THANH TOÁN COD</button></>}</section>;
}

function Totals({ order }: { order: Preview | Order }) { return <div className="totals"><div className="order-lines">{order.orderItems.map((line) => <p key={line.id}><span>{line.productName} / {line.variantName} x{line.quantity}</span><strong>{formatMoney(line.totalLinePrice)}</strong></p>)}</div><p><span>TẠM TÍNH</span><strong>{formatMoney(order.subtotal)}</strong></p><p><span>GIAO HÀNG</span><strong>{formatMoney(order.shippingFee)}</strong></p><p className="total"><span>TỔNG</span><strong>{formatMoney(order.totalAmount)}</strong></p></div>; }

function Checkout({ navigate, search, user }: { navigate: (to: string) => void; search: string; user: User | null }) {
  const params = useMemo(() => new URLSearchParams(search), [search]); const [items, setItems] = useState<OrderItemInput[]>([]); const [preview, setPreview] = useState<Preview | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ fullName: user?.fullName ?? "", email: user?.email ?? "", phone: user?.phone ?? "", shippingAddress: "", note: "" });
  const cartCheckout = params.get("cart") === "1";
  useEffect(() => { if (cartCheckout) setItems(browserCart.read().map((item) => ({ productVariantId: item.variant.id, quantity: item.quantity }))); else { const variant = params.get("variant"); setItems(variant ? [{ productVariantId: variant, quantity: Math.max(1, Number(params.get("quantity") ?? "1")) }] : []); } setLoading(false); }, [cartCheckout, params]);
  const update = (key: keyof typeof form, value: string) => { setForm({ ...form, [key]: value }); setPreview(null); };
  const getPreview = async () => { if (!form.shippingAddress || items.length === 0) return setError("Hãy nhập địa chỉ giao hàng và chọn sản phẩm."); try { setError(""); setPreview(await api.post<Preview>("/order/preview", { items: mergeOrderItems(items), shippingAddress: form.shippingAddress })); } catch (reason) { setError(message(reason)); } };
  const create = async () => { if (!preview) return getPreview(); if (!form.fullName.trim() || !/^\S+@\S+\.\S+$/.test(form.email) || !form.phone.trim()) return setError("Hãy nhập họ tên, email hợp lệ và số điện thoại."); try { const order = await api.post<Order>("/order", { ...form, note: form.note || undefined, items: mergeOrderItems(items), paymentMethod: "COD" }, { authenticated: Boolean(browserTokens.read()) }); if (cartCheckout) browserCart.clear(); sessionStorage.setItem("melodies.last-order", JSON.stringify(order)); navigate("/order/success"); } catch (reason) { setPreview(null); setError(`${message(reason)}. Vui lòng xem lại đơn hàng.`); } };
  if (loading) return <Empty>Đang chuẩn bị thanh toán...</Empty>;
  if (!items.length) return <section className="content-section"><Empty>Không có sản phẩm để thanh toán.</Empty><Link navigate={navigate} to="/" className="button ghost">VỀ CATALOG</Link></section>;
  return <section className="checkout content-section"><div><h1>THANH TOÁN</h1><p className="muted">Chỉ nhận thanh toán khi giao hàng (COD).</p><div className="checkout-form"><label>HỌ VÀ TÊN<input required value={form.fullName} onChange={(event) => update("fullName", event.target.value)} /></label><label>EMAIL<input required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label><label>SỐ ĐIỆN THOẠI<input required value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label><label>ĐỊA CHỈ GIAO HÀNG<textarea required value={form.shippingAddress} onChange={(event) => update("shippingAddress", event.target.value)} /></label><label>GHI CHÚ<textarea value={form.note} onChange={(event) => update("note", event.target.value)} /></label></div></div><aside className="order-summary"><h2>ĐƠN HÀNG</h2><p>{items.length} phiên bản</p>{error && <Notice error>{error}</Notice>}{preview && <Totals order={preview} />}{preview ? <button className="button" onClick={create}>ĐẶT HÀNG COD</button> : <button className="button" onClick={getPreview}>XEM TỔNG TIỀN</button>}</aside></section>;
}

function Receipt({ navigate }: { navigate: (to: string) => void }) {
  const [order] = useState<Order | null>(() => { try { return JSON.parse(sessionStorage.getItem("melodies.last-order") ?? "null") as Order | null; } catch { return null; } });
  if (!order) return <section className="content-section"><Empty>Không có đơn hàng gần đây trong phiên này.</Empty><Link navigate={navigate} to="/" className="button ghost">VỀ CATALOG</Link></section>;
  return <section className="receipt content-section"><p className="eyebrow">ĐẶT HÀNG THÀNH CÔNG</p><h1>CẢM ƠN BẠN</h1><p>Mã đơn: <strong>{order.id}</strong></p><p>{order.fullName} / {order.phone}<br />{order.shippingAddress}</p><Totals order={order} /><Notice>Trạng thái: {order.status} / {order.paymentMethod}</Notice><Link navigate={navigate} to="/" className="button">TIẾP TỤC MUA</Link></section>;
}

function App() {
  const { navigate, pathname, search } = useRoute(); const [user, setUser] = useState<User | null>(null);
  useEffect(() => { if (!browserTokens.read()) return; api.get<User>("/user/me", { authenticated: true }).then(setUser).catch(() => { browserTokens.clear(); setUser(null); }); }, []);
  useEffect(() => { setSessionFailureHandler(() => { setUser(null); navigate("/login"); }); return () => setSessionFailureHandler(undefined); }, [navigate]);
  const logout = async () => { const refreshToken = browserTokens.read()?.refreshToken; try { if (refreshToken) await api.post("/auth/logout", { refreshToken }, { authenticated: true }); } catch { /* Local logout still clears the browser session. */ } finally { browserTokens.clear(); setUser(null); navigate("/"); } };
  let page: ReactNode;
  if (pathname === "/") page = <Catalog navigate={navigate} search={search} />;
  else if (pathname.startsWith("/products/")) page = <Detail navigate={navigate} slug={decodeURIComponent(pathname.slice(10))} />;
  else if (["/login", "/register", "/forgot-password", "/reset-password", "/verify-account"].includes(pathname)) page = <Auth navigate={navigate} onLogin={setUser} pathname={pathname} search={search} user={user} />;
  else if (pathname === "/cart") page = <CartPage navigate={navigate} />;
  else if (pathname === "/checkout") page = <Checkout navigate={navigate} search={search} user={user} />;
  else if (pathname === "/order/success") page = <Receipt navigate={navigate} />;
  else page = <section className="content-section"><Empty>Không tìm thấy trang.</Empty><Link navigate={navigate} to="/" className="button ghost">VỀ CATALOG</Link></section>;
  return <Shell navigate={navigate} user={user} logout={logout}>{page}</Shell>;
}

export default App;
