# Backend API Handoff

> Machine-readable handoff for the frontend agent. Source of truth: backend controllers, DTOs, services, and `test/api-compatibility.e2e-spec.ts`. Do not infer routes from the Postman collection when it conflicts with this file.

## Contract

- Production base URL: `https://melodies.studio/api`
- Local base URL: `http://localhost:3000/api`
- Transport: JSON over HTTP.
- Auth header: `Authorization: Bearer <accessToken>`.
- Access token lifetime: 15 minutes.
- Refresh token lifetime: 7 days; refresh is one-time rotation.
- Global validation: unknown body/query fields are rejected (`400`); send only documented fields.
- Success envelope: `{ statusCode, message, data?, meta? }`.
- Error envelope: Nest default `{ statusCode, message, error }`; `message` can be a string or validation-message array.
- Money: JSON numbers in response; request money fields are numbers.
- Dates: ISO-8601 strings in JSON responses/requests.
- IDs: UUID strings unless stated otherwise.
- No upload endpoint exists. Send pre-hosted asset URLs; `mediaGallery` is stored as JSON.

## Shared Shapes

```ts
type ApiSuccess<T, M = undefined> = {
  statusCode: number;
  message: string;
  data?: T;
  meta?: M;
};

type ProductListMeta = {
  currentPage: number;
  totalPages: number;
  limit: number;
  totalItems: number;
};

type OrderListMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  productType: 'music' | 'merch' | string;
  status: string | null;
  minPrice: number;
  maxPrice: number;
  mediaGallery: unknown;
  artists: Array<{ id: string; stageName: string; avatarUrl: string | null }>;
  variants: Array<{
    id: string;
    name: string;
    originalPrice: number;
    discountPercent: number;
    stockQuantity: number;
    isPreorder: boolean;
    attributes: Array<{ key: string; value: string }>;
  }>;
  category: { name: string; slug: string } | null;
};

type Order = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | string;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  appliedVoucher: string | null;
  paymentMethod: 'COD' | 'MOMO' | string;
  shippingAddress: string;
  note: string | null;
  createdAt: string;
  orderItems: Array<{
    id: string;
    productId: string;
    productVariantId: string;
    productName: string;
    variantName: string;
    quantity: number;
    price: number;
    originalPrice: number;
    discountPercentage: number;
    totalLinePrice: number;
  }>;
};
```

## Endpoint Index

| Area | Method | Path | Auth | Permission |
| --- | --- | --- | --- | --- |
| Auth | POST | `/auth/register` | none | - |
| Auth | POST | `/auth/login` | none | - |
| Auth | POST | `/auth/logout` | bearer | - |
| Auth | POST | `/auth/refresh` | none | - |
| Auth | POST | `/auth/forgot-password` | none | - |
| Auth | POST | `/auth/reset-password` | none | - |
| Account | GET | `/user/me` | bearer | - |
| Account | PATCH | `/user/profile` | bearer | - |
| Account | PATCH | `/user/change-password` | bearer | - |
| Account | GET | `/user/request-verification-email` | bearer | - |
| Account | POST | `/user/verify-account` | none | - |
| Catalog | GET | `/products` | none | - |
| Catalog | GET | `/products/:slug` | none | - |
| Catalog | GET | `/artists` | none | - |
| Catalog | GET | `/artists/:slug` | none | - |
| Catalog | GET | `/categories` | none | - |
| Catalog | GET | `/categories/:slug` | none | - |
| Cart | GET | `/cart` | bearer | - |
| Cart | POST | `/cart` | bearer | - |
| Cart | PATCH | `/cart/:cartItemId` | bearer | - |
| Cart | DELETE | `/cart/:cartItemId` | bearer | - |
| Order | GET | `/order` | bearer | - |
| Order | GET | `/order/:id` | bearer | - |
| Order | POST | `/order/preview` | none | - |
| Order | POST | `/order` | optional bearer | - |
| Order | PATCH | `/order/:id` | bearer | - |
| Admin catalog | GET | `/admin/products` | bearer | `PRODUCT_VIEW` |
| Admin catalog | GET | `/admin/products/:slug` | bearer | `PRODUCT_VIEW` |
| Admin catalog | POST | `/admin/products` | bearer | `PRODUCT_CREATE` |
| Admin catalog | PATCH | `/admin/products/:id` | bearer | `PRODUCT_UPDATE` |
| Admin catalog | DELETE | `/admin/products/:id` | bearer | `PRODUCT_DELETE` |
| Admin catalog | POST | `/admin/categories` | bearer | `CATEGORY_MANAGE` |
| Admin catalog | PATCH | `/admin/categories/:id` | bearer | `CATEGORY_MANAGE` |
| Admin catalog | DELETE | `/admin/categories/:id` | bearer | `CATEGORY_MANAGE` |
| Admin catalog | POST | `/admin/artists` | bearer | `BRAND_MANAGE` |
| Admin catalog | PATCH | `/admin/artists/:id` | bearer | `BRAND_MANAGE` |
| Admin catalog | DELETE | `/admin/artists/:id` | bearer | `BRAND_MANAGE` |
| Admin orders | GET | `/admin/order` | bearer | `ORDER_VIEW` |
| Admin orders | GET | `/admin/order/:id` | bearer | `ORDER_VIEW` |
| Admin orders | PATCH | `/admin/order/:id` | bearer | `ORDER_UPDATE_STATUS` |
| Admin marketing | GET | `/admin/promotion` | bearer | `PROMOTION_MANAGE` |
| Admin marketing | POST | `/admin/promotion` | bearer | `PROMOTION_MANAGE` |
| Admin marketing | PATCH | `/admin/promotion/:id` | bearer | `PROMOTION_MANAGE` |
| Admin marketing | DELETE | `/admin/promotion/:id` | bearer | `PROMOTION_MANAGE` |
| Admin RBAC | GET | `/permissions` | none | - |
| Admin RBAC | GET | `/admin/roles` | bearer | `ROLE_MANAGE` |
| Admin RBAC | POST | `/admin/roles` | bearer | `ROLE_MANAGE` |
| Admin RBAC | PATCH | `/admin/roles/:id` | bearer | `ROLE_MANAGE` |
| Admin RBAC | DELETE | `/admin/roles/:id` | bearer | `ROLE_MANAGE` |
| Admin RBAC | GET | `/admin/staff` | bearer | `STAFF_MANAGE` |
| Admin RBAC | POST | `/admin/staff` | bearer | `STAFF_MANAGE` |
| Admin RBAC | PATCH | `/admin/staff/:id` | bearer | `STAFF_MANAGE` |
| Admin RBAC | DELETE | `/admin/staff/:id` | bearer | `STAFF_MANAGE` |

## Auth and Account

### `POST /auth/register`

Request:

```json
{ "email": "user@example.com", "password": "secret6", "fullName": "User Name" }
```

- `email`: required, valid email.
- `password`: required, minimum 6 characters.
- `fullName`: required, non-empty.
- `phone` is not accepted here; update it through `/user/profile`.
- `201`, message `User registered successfully`, data is a user object without `passwordHash`.
- Duplicate email: `409`.

### `POST /auth/login`

Request: `{ "email": string, "password": string }`.

- Uses local strategy; invalid credentials: `401`, message `Invalid email or password`.
- `200`, message `Login successful`.
- Data: `{ accessToken, refreshToken, user }`.
- Store both tokens. Send only `accessToken` to protected API calls.

### `POST /auth/logout`

Auth: bearer. Request: `{ "refreshToken": string }`.

- `200`, message `Logout successful`.
- Invalid refresh token or token belonging to another user: `400`.
- Logout deletes only the submitted refresh-token whitelist entry.

### `POST /auth/refresh`

Request: `{ "refreshToken": string }`.

- `200`, message `Tokens refreshed successfully`, data `{ accessToken, refreshToken }`.
- Rotation: old refresh token becomes invalid immediately; replace stored tokens atomically.
- Invalid/expired token: normally `400`; replayed token can return `403` and revoke all user tokens.

### `POST /auth/forgot-password`

Request: `{ "email": string }`.

- Valid email required.
- Existing user: sends reset email; token expires in 15 minutes.
- Unknown email: still `200`, message `Password reset email sent successfully`.
- Same-user resend throttle: 60 seconds; throttled request is `400`.

### `POST /auth/reset-password`

Request: `{ "token": string, "newPassword": string }`.

- `newPassword`: minimum 6 characters.
- Token is single-use; success revokes all existing access/refresh tokens.
- Invalid/expired token: `400`, message `Invalid or expired password reset token`.
- `200`, message `Password reset successfully`.

### `GET /user/me`

Auth: bearer. `200`, message `User profile fetched successfully`, data:

```ts
{
  id: string; email: string; fullName: string | null; phone: string | null;
  avatarUrl: string | null; provider: string | null; isVerified: boolean | null;
  status: string | null; createdAt: string; updatedAt: string; deletedAt: string | null;
}
```

### `PATCH /user/profile`

Auth: bearer. All fields optional; send only fields being changed:

```ts
{ email?: string; fullName?: string; phone?: string; avatarUrl?: string }
```

- `email`: valid email.
- `fullName`: max 100 characters.
- `phone`: max 20 characters; field name is `phone`, not `phoneNumber`.
- `avatarUrl`: valid URL.
- `200`, message `Update profile info successfully`, data updated user.

### `PATCH /user/change-password`

Auth: bearer. Request `{ oldPassword: string, newPassword: string }`.

- Both passwords: 6-30 characters.
- New password must differ from old password.
- Old password mismatch: `400`.
- Success revokes all tokens; current session must log in again or use a newly issued token.
- `200`, message `Password changed successfully`.

### `GET /user/request-verification-email`

Auth: bearer.

- Sends a verification email with a 15-minute, single-use token.
- Already verified: `400`, message `User is already verified`.
- Resend throttle: 60 seconds.
- `200`, message `Verification email sent successfully`.

### `POST /user/verify-account`

Request: `{ "token": string }`.

- This is `POST`, not `GET`; token is in JSON body.
- Invalid/expired token: `400`, message `Invalid or expired verification token`.
- `200`, message `Account verified successfully`.

## Public Catalog

### `GET /products`

Query:

```ts
{
  artistId?: string | string[]; // repeated query key supported
  keyword?: string;
  limit?: number;               // default 20, min 1
  page?: number;                // default 1, min 1
  price_min?: number;
  price_max?: number;
  sort?: string;
  stock_status?: boolean;
  type?: string | string[];     // repeated query key supported
}
```

- Public results are restricted to `status = published` and non-deleted products.
- `artistId` and `type` can be sent as repeated keys: `?artistId=id1&artistId=id2&type=music&type=merch`.
- Supported effective sort behavior: `price_asc` => ascending `minPrice`; `oldest` => ascending `createdAt`; every other value/default => descending `createdAt`. Do not expose arbitrary sort values in UI.
- `price_min`/`price_max` filter variant `originalPrice`, not discounted price.
- `stock_status=true` keeps products with at least one in-stock variant. `false` does not apply an out-of-stock filter.
- `200`, message `Products fetched successfully`, data `Product[]`, meta `ProductListMeta`.
- `description`, variant `sku`, and product/category IDs inside `category` are not exposed by `ProductResponseDto`.

### `GET /products/:slug`

- Public, published product only.
- `200`, message `Product detail fetched successfully`, data `Product`.
- Missing product: `404`, message `Product not found`.

### `GET /artists`

Query: `{ limit?: number; page?: number }`, defaults `20` and `1`, both min `1`.

- `200`, message `Artists fetched successfully`, data `Artist[]`, meta `ProductListMeta` shape.
- List items include `id`, `stageName`, `slug`, `bio`, `avatarUrl`, `metadata`; products are not loaded for the list.

### `GET /artists/:slug`

- `200`, message `Artist detail fetched successfully`, data:

```ts
{
  id: string; stageName: string; slug: string; bio: string | null;
  avatarUrl: string | null; metadata: object; products: Product[];
}
```

- `products` includes only non-deleted products with `status = published`.
- Missing artist: `404`, message `Artist not found`.

### `GET /categories`

- `200`, message `Category tree fetched successfully`.
- Actual implementation currently returns a flat `CategoryEntity[]` from `find()`; do not assume `children` is present.
- Practical item shape: `{ id, name, slug, parentId }`.

### `GET /categories/:slug`

Query: `{ limit?: number; page?: number }`, defaults `20` and `1`, both min `1`.

- Returns only published products in the category, newest first.
- `200`, message `Products fetched successfully for the category`, data `Product[]`, meta `ProductListMeta`.
- No matching products: `404`, message `Products not found for this category`.

## Cart

### `GET /cart`

Auth: bearer.

- Creates an empty cart automatically if the user has none.
- `200`, message `Cart fetched successfully`, data `{ id, userId, cartItems }`.
- `cartItems[]` exposes `{ id, cartId, quantity, product }`.
- The selected variant is injected into `product.variants` by the response mapper. Normalize defensively: treat a non-array variant value as a one-item array.

### `POST /cart`

Auth: bearer. Request:

```json
{ "productId": "uuid", "productVariantId": "uuid", "quantity": 1 }
```

- `quantity`: integer, min 1.
- Adding an existing variant increments current quantity; it does not replace it.
- Total quantity cannot exceed current stock.
- `productVariantId` must exist and not be deleted. Send its matching `productId`; backend does not independently verify the pair.
- `201`, message `Item added to cart successfully`, data cart.
- Missing variant: `404`, message `Product variant not found`.
- Stock failure: `400`, message `Requested quantity exceeds available stock`.

### `PATCH /cart/:cartItemId`

Auth: bearer. Body must contain raw `quantity`:

```json
{ "quantity": 2 }
```

- `cartItemId` must be UUID.
- `quantity <= 0` deletes the item.
- Positive quantity cannot exceed stock.
- `200`, message `Cart item quantity updated successfully`, data cart.
- Missing item or item owned by another user: `404`, message `Cart item not found`.

### `DELETE /cart/:cartItemId`

Auth: bearer.

- Correct path is `/cart/:cartItemId`; `/cart/items/:cartItemId` is stale Postman documentation.
- `200`, message `Cart item removed successfully`, data cart.
- Missing item or item owned by another user: `404`.

## Orders

### Common order request shapes

```ts
type OrderItemInput = { productVariantId: string; quantity: number };

type CreateOrderInput = {
  fullName: string;
  email: string;
  phone: string;
  items: OrderItemInput[];
  appliedVoucher?: string;
  shippingAddress: string;
  paymentMethod: 'COD' | 'MOMO';
  note?: string;
};

type PreviewOrderInput = {
  items: OrderItemInput[];
  appliedVoucher?: string;
  shippingAddress: string;
};
```

- `fullName`, `email`, `phone`, `shippingAddress`, and `paymentMethod` are required for create.
- `email` must be valid; item quantities are integers >= 1; variant IDs are UUIDs.
- Use one item per variant. Duplicate variant IDs cause variant lookup mismatch; merge quantities client-side.
- Only published, non-deleted variants are orderable.
- Effective unit price = `originalPrice * (1 - discountPercent / 100)`.
- `shippingFee` is always `0`; no shipping-rate endpoint exists.
- Voucher discount: `fixed` subtracts value; `percentage` subtracts percentage of subtotal; discount is capped at subtotal.
- Order creation decrements stock atomically and increments voucher usage atomically.
- No payment initiation/callback endpoint exists. `MOMO` is only stored as `paymentMethod`.

### `POST /order/preview`

Auth: none. Request: `PreviewOrderInput`.

- Does not create an order, decrement stock, or consume voucher usage.
- Validates stock and voucher status/date/usage limit.
- `200`, message `Order preview generated successfully`.
- Data is a partial `Order`: `{ subtotal, shippingFee, discountAmount, totalAmount, appliedVoucher, shippingAddress, orderItems }`.
- Invalid variant: `400`, message `One or more product variants are invalid`.
- Insufficient stock: `400`, message includes `Insufficient stock for product variant ID`.
- Voucher errors: `Invalid voucher code`, `Voucher code is not valid at this time`, or `Voucher code usage limit has been reached`.

### `POST /order`

Auth: optional bearer. Guest checkout is supported.

- If bearer is valid, order stores `userId`; without bearer, order is a guest order.
- `201`, message `Order created successfully`, data `Order`.
- Stock is rechecked inside the transaction; refresh preview on failure.
- Customer cannot set order status.
- Backend currently rechecks voucher active/usage during creation but does not recheck voucher date window in the transaction; frontend must still rely on preview and final error handling.

### `GET /order`

Auth: bearer. Query:

```ts
{
  page?: number;       // default 1, min 1
  limit?: number;      // default 20, min 1
  startDate?: string;  // ISO date
  endDate?: string;    // ISO date
  status?: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
}
```

- Returns only orders belonging to the authenticated user.
- `200`, message `Orders retrieved successfully`, data `Order[]`, meta `OrderListMeta`.

### `GET /order/:id`

Auth: bearer.

- Returns only the authenticated user's order.
- `200`, message `Order retrieved successfully`, data `Order`.
- Missing order or another user's order: `400`, message `Order not found`.

### `PATCH /order/:id`

Auth: bearer. Body is ignored; route means customer cancellation.

- Only `PENDING` orders can be cancelled.
- `200`, message `Order cancelled successfully`.
- Missing order: `400`, message `Order not found`.
- Non-pending order: `400`, message `Only pending orders can be cancelled`.
- Cancellation does not restore stock.

### `GET /admin/order`

Auth: bearer + `ORDER_VIEW`. Same query and response as `GET /order`, but no user filter.

### `GET /admin/order/:id`

Auth: bearer + `ORDER_VIEW`.

- `200`, message `Order detail retrieved successfully`, data `Order`.
- Missing order: `400`, message `Order not found`.

### `PATCH /admin/order/:id`

Auth: bearer + `ORDER_UPDATE_STATUS`. Body:

```json
{ "status": "PROCESSING" }
```

- Allowed enum values are uppercase: `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`.
- `200`, message `Order status updated successfully`, data `Order`.
- Same current status: `400`, message `Order is already in the desired status`.
- Backend validates enum values but does not enforce transition ordering. UI may enforce a stricter workflow if desired.

## Admin Catalog

### Products

`GET /admin/products` and `GET /admin/products/:slug` require `PRODUCT_VIEW`. List query is the same as public products plus `status?: string`. Admin list excludes deleted rows but can filter any stored status, commonly `draft` or `published`.

`POST /admin/products` requires `PRODUCT_CREATE`.

```ts
{
  name: string;
  description?: string;
  shortDescription?: string;
  categoryId?: string;
  productType: 'music' | 'merch';
  mediaGallery?: string[]; // intended shape; backend stores JSON as-is
  artistIds?: string[];
  variants: Array<{
    sku: string;
    name: string;
    originalPrice: number;       // >= 0
    discountPercent?: number;   // 0..100
    stockQuantity: number;      // >= 0
    attributes?: Array<{
      key: 'Size' | 'Color' | 'Material' | 'Edition' | 'Format' | 'Speed';
      value: string;
    }>;
    isPreorder?: boolean;
  }>;
}
```

- `variants` is required; each variant requires `sku`, `name`, `originalPrice`, and `stockQuantity`.
- SKU must be globally unique. Duplicate SKU: `400`.
- Unknown attribute keys are rejected; supported keys are exactly `Size`, `Color`, `Material`, `Edition`, `Format`, `Speed`.
- Missing category: `404`; missing artist IDs: `400`.
- New product defaults to database status `draft`; there is no status field in create/update DTO, so no publish endpoint exists.
- Slug is generated from name. Collision gets a random suffix.
- `201`, message `Product created successfully`, data `Product`.

`PATCH /admin/products/:id` requires `PRODUCT_UPDATE`.

- All product fields are optional.
- If `variants` is supplied, it is a replacement set: omitted existing variants are removed or soft-deleted. Send complete intended variant list.
- Each supplied variant requires `sku`, `name`, `originalPrice`, `discountPercent`, `stockQuantity`, and `attributes`; `id` is optional for a new variant.
- If `artistIds` is supplied, it replaces all product-artist links; `[]` clears artists.
- Existing variant IDs must belong to the product.
- `200`, message `Product updated successfully`, data `Product`.

`DELETE /admin/products/:id` requires `PRODUCT_DELETE`.

- Hard-deletes products without order history; soft-deletes products referenced by orders and changes status to `deleted`.
- `200`, message `Product removed successfully`; no `data`.

Important response limitations for all product endpoints:

- `description` is accepted on write but omitted from `ProductResponseDto`.
- Variant `sku` is accepted on write but omitted from `ProductResponseDto`.
- `category` exposes only `{ name, slug }`.
- `mediaGallery` is returned from JSON storage unchanged. Runtime data may be URL strings or objects such as `{ url, type }`; do not assume one shape without normalization.

### Categories

All admin category routes require `CATEGORY_MANAGE`.

```ts
type CategoryWrite = { name: string; parentId?: string };
type CategoryPatch = { name?: string; parentId?: string };
```

- `POST /admin/categories`: `201`, message `Category created successfully`, data category.
- `PATCH /admin/categories/:id`: `200`, message `Category updated successfully`, data category.
- `DELETE /admin/categories/:id`: `200`, message `Category deleted successfully`.
- Names generate lowercase strict slugs using Vietnamese locale.
- Duplicate name/slug: `409`.
- Parent must exist: `404`.
- Self-parent or circular hierarchy: `400`.
- Category with children cannot be deleted: `400`.
- No admin category-list endpoint; use public `GET /categories`.

### Artists

All admin artist routes require `BRAND_MANAGE`.

```ts
type ArtistWrite = {
  stageName: string;       // required on create, max 255
  bio?: string;
  avatarUrl?: string;      // string only; no URL validator
  metadata?: object;
  status?: string;         // max 20
};
```

- `POST /admin/artists`: `201`, message `Artist created successfully`, data artist.
- `PATCH /admin/artists/:id`: partial `ArtistWrite`, `200`, message `Artist updated successfully`, data artist.
- `DELETE /admin/artists/:id`: `200`, message `Artist deleted successfully`.
- Stage name generates slug; duplicate stage name/slug: `409`.
- Artists referenced by orders are soft-deleted (`status = deleted`); otherwise deletion is hard.
- No admin artist-list endpoint; use public `GET /artists`.

## Admin Promotions

All routes require `PROMOTION_MANAGE`.

```ts
type PromotionWrite = {
  code: string;
  type: 'percentage' | 'fixed';
  description?: string;
  value: number;            // >= 0; percentage additionally <= 100
  startDate?: string;       // ISO date
  endDate?: string;         // ISO date
  usageLimit?: number;      // >= 1
};
```

- `GET /admin/promotion`: `200`, message `Promotions fetched successfully`, data `Promotion[]`.
- `POST /admin/promotion`: `201`, message `Promotion created successfully`, data `Promotion`.
- `PATCH /admin/promotion/:id`: partial write, `200`, message `Promotion updated successfully`, data `Promotion`.
- `DELETE /admin/promotion/:id`: `200`, message `Promotion deleted successfully`.
- Codes are exact-match; backend does not normalize case or whitespace.
- Duplicate code: `409`; missing promotion: `404`.
- `appliesTo` is response-only/defaulted to `all`; frontend cannot configure it.
- `usedCount`, `isActive`, timestamps are response fields; `isActive` has no admin update field.

## Admin RBAC

### `GET /permissions`

Public endpoint. `200`, message `Permissions fetched successfully`, data:

```ts
Array<{ id: string; name: string; resource: string | null; action: string | null }>
```

No permissions: `404`.

Canonical permission names:

```text
PRODUCT_VIEW PRODUCT_CREATE PRODUCT_UPDATE PRODUCT_DELETE
CATEGORY_MANAGE BRAND_MANAGE
ORDER_VIEW ORDER_UPDATE_STATUS ORDER_EXPORT
PROMOTION_MANAGE CONTENT_MANAGE
CUSTOMER_VIEW CUSTOMER_BAN
STAFF_MANAGE ROLE_MANAGE
REPORT_VIEW_REVENUE REPORT_VIEW_GENERAL
```

### Roles

All `/admin/roles` routes require `ROLE_MANAGE`.

```ts
type RoleWrite = {
  name: string;
  description?: string;
  permissionIds: string[];
};
type Role = {
  id: string; name: string; description: string | null;
  createdAt: string; updatedAt: string; deletedAt: string | null;
  permissions: string[]; // permission names, e.g. PRODUCT_VIEW
};
```

- `GET`: `200`, `Roles fetched successfully`, data `Role[]`.
- `POST`: `201`, `Role created successfully`, data `Role`.
- `PATCH`: `200`, `Role updated successfully`, data `Role`.
- `DELETE`: `200`, `Role deleted successfully`.
- Role names are unique; duplicate: `409`; missing role/permission: `404`/`400`.
- On update, omitted `permissionIds` keeps current assignments; `permissionIds: []` clears them.
- Duplicate permission IDs are deduplicated by service.
- Delete is a soft delete and immediately removes user-role assignments.

### Staff

All `/admin/staff` routes require `STAFF_MANAGE`.

```ts
type StaffCreate = {
  email: string;
  fullName: string;
  password: string;       // min 6
  roleIds: string[];      // required, non-empty
};
type StaffPatch = {
  fullName?: string;
  avatarUrl?: string;
  password?: string;     // min 6
  roleIds?: string[];
};
type Staff = {
  id: string; email: string; fullName: string; phone: string | null;
  avatarUrl: string | null; status: string; createdAt: string;
  roles: Array<{ id: string; name: string; permissions: string[] }>;
};
```

- `GET`: `200`, `Staff retrieved successfully`, data `Staff[]`.
- `POST`: `201`, `Staff registered successfully`, data `Staff`.
- `PATCH`: `200`, `Staff updated successfully`, data `Staff`.
- `DELETE`: `200`, `Account deleted successfully`.
- `phone` is present in the response entity but currently has no validator in either staff write DTO; with global whitelist validation, do not send `phone` in create/update requests.
- Duplicate email: `409`; missing role IDs: `400`; missing staff: `404`.
- On update, omitted `roleIds` keeps current roles; `roleIds: []` clears roles.
- Delete is a soft delete: status becomes `deleted`, email is prefixed with `deleted_`.
- Staff response permissions use dotted strings such as `PRODUCT.VIEW`; role response permissions use underscored names such as `PRODUCT_VIEW`. Normalize before permission checks.

## Frontend Rules

1. Use an API client with one base URL and one bearer-token interceptor.
2. On `401`, attempt exactly one `/auth/refresh` using the current refresh token, replace both tokens, retry the original request once; clear auth on refresh failure.
3. Never refresh on `400`, `403`, `404`, or `409`.
4. Treat `403` as authenticated-but-not-authorized; hide admin actions by permission but still handle server `403`.
5. Treat validation `message` as `string | string[]`.
6. Use server totals/prices/stock as authoritative. Never calculate final order total as the source of truth.
7. Preview before create; still handle final stock/voucher failure because stock can change after preview.
8. Merge duplicate variant IDs before sending order items.
9. Use uppercase order statuses and `COD`/`MOMO` exactly.
10. Use `phone`, not `phoneNumber`; use `/user/verify-account` `POST`; use `/cart/:cartItemId` for delete.
11. Normalize `mediaGallery` and cart selected-variant shape at the API boundary.
12. Do not build UI dependencies on product `description` or variant `sku` from read responses; backend currently omits both.

## Known Backend Contract Gaps

- No product publish/status update endpoint.
- No media upload endpoint.
- No payment gateway endpoint/webhook.
- No shipping-fee/rate endpoint; shipping fee is always zero.
- Public category endpoint is named/tree-described but currently returns a flat list.
- Product response omits fields accepted by write DTOs (`description`, variant `sku`).
- `mediaGallery` is untyped JSON at runtime.
- Cart add validates variant existence/stock but not that request `productId` matches `productVariantId`.
- Customer cancellation does not restore stock.
- Admin order status enum validation exists, but transition order is not enforced.
- Postman collection contains stale paths/body examples; this document follows executable source and e2e compatibility tests.
