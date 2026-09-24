Status: ready-for-agent

# Phase 1 Storefront

## Problem Statement

The project is currently a static 099 Supply mockup. It does not let a visitor browse the seeded Melodies catalog, choose a product variant, authenticate, manage an authenticated cart, or place a COD order. The personal-project demo needs one credible customer purchase journey against the documented backend contract in both local and production environments.

## Solution

Replace the mockup gallery with a responsive Vietnamese Melodies customer storefront. The storefront exposes a deliberately small purchase funnel: public catalog and product detail, complete authentication, authenticated server cart, guest Buy Now, COD checkout with server preview, real order creation, and a receipt. It keeps the established monochrome catalog visual language.

The feature has one primary test seam: observable browser journeys at the frontend-to-HTTP boundary. Tests and manual checks exercise screens, user input, rendered server data, and requests/responses; they do not test component internals.

## User Stories

1. As a visitor, I want to open the storefront and see published products, so that I can begin browsing the catalog.
2. As a visitor, I want to see product name, image, type, starting price, and sale information, so that I can compare products quickly.
3. As a visitor, I want the catalog displayed in the established monochrome gallery style, so that the demo retains its visual identity.
4. As a visitor, I want to search products by keyword, so that I can find a known product.
5. As a visitor, I want to filter products by music or merch, so that I can browse a relevant product type.
6. As a visitor, I want to sort products by newest or price ascending, so that I can choose an appropriate catalog order.
7. As a visitor, I want to paginate catalog results, so that I can browse beyond the first page.
8. As a visitor, I want to open a product by slug, so that I can inspect its purchasable variants.
9. As a visitor, I want to see normalized product media even when the API returns either URL strings or media objects, so that product imagery remains usable.
10. As a visitor, I want a clear fallback when product media cannot render, so that a broken asset does not break product browsing.
11. As a visitor, I want to select a product variant and its available attributes, so that the chosen item is unambiguous.
12. As a visitor, I want price, discount, preorder state, and stock to update for the selected variant, so that I can make an informed purchase decision.
13. As a visitor, I want unavailable variants prevented from purchase, so that I do not submit an impossible order.
14. As a visitor, I want to register with valid identity details, so that I can create a customer account.
15. As a customer, I want to log in and remain signed in across a browser refresh, so that I can use the protected cart without repeated login.
16. As a customer, I want to log out, so that the current browser no longer uses my session.
17. As a customer, I want the application to refresh an expired access token once, so that a normal session continues without interrupting a protected action.
18. As a customer, I want to request and complete a password reset, so that I can regain account access.
19. As a customer, I want to request account verification and redeem its email token, so that I can verify my account.
20. As a signed-in customer, I want to add a selected variant to my server cart, so that I can purchase multiple variants together.
21. As a signed-in customer, I want to change cart quantities or remove an item, so that the cart matches my intended order.
22. As a signed-in customer, I want cart controls to surface stock failures, so that I can correct my order before checkout.
23. As a guest, I want to use Buy Now for one selected variant, so that I can checkout without an account or guest-cart synchronization.
24. As a signed-in customer, I want to use either Buy Now or cart checkout, so that I can choose a one-item or multi-item purchase flow.
25. As a checkout customer, I want a Vietnamese form for name, email, phone, shipping address, and optional note, so that the backend receives a valid order request.
26. As a checkout customer, I want COD as the only payment option, so that the UI never implies that an unsupported payment gateway has charged me.
27. As a checkout customer, I want a server-generated order preview before submitting, so that server-authoritative totals and stock validation are visible.
28. As a checkout customer, I want duplicate variants merged before preview and creation, so that the backend receives a valid item list.
29. As a checkout customer, I want final stock errors shown after order creation too, so that a concurrent stock change is explained.
30. As a checkout customer, I want a receipt after a successful real order, so that I can see its ID, line items, delivery data, status, and final totals.
31. As a mobile visitor, I want every catalog, form, cart, and checkout control usable on a narrow viewport, so that the demo works on a phone.
32. As a visitor, I want loading, empty, not-found, validation, authorization, and request-failure states with retry where applicable, so that API failures are understandable.
33. As a deployer, I want the same frontend build to target local or production API URLs through environment configuration, so that the demo works in both environments.

## Implementation Decisions

- The current static mockup/Framer-component content is replaced by customer storefront views. The visual system remains white, black, gray hairlines, mono typography, flat cards, no shadows, and responsive catalog grids.
- Supported client routes are home/catalog, product detail by slug, login, register, forgot password, reset password, verify account, cart, checkout, and order success. Direct URL entry and browser refresh must work for all of them.
- The catalog only exposes documented, effective controls: keyword, one product type, newest/default, price ascending, and pagination. Artist filters, price-range inputs, category browsing, stock filters, and arbitrary sort strings are omitted.
- Product detail reads public product data only. It does not rely on response fields that the backend omits, including full description and variant SKU.
- Media is normalized at the API boundary from untyped gallery JSON into renderable asset URLs. Failed or absent media renders a monochrome fallback.
- Variant selection is required before either cart addition or Buy Now. Client display price may calculate the variant discount, but server data is authoritative for stock, preview, and final totals.
- Authentication includes registration, login, logout, token refresh, forgot-password, reset-password, verification-email request, and verify-account. Profile editing and password change are excluded.
- The frontend stores access and refresh tokens because the documented backend login and refresh contracts return/accept JSON tokens. Protected requests send only `Authorization: Bearer <accessToken>`.
- A single API client owns base URL selection, success/error-envelope parsing, bearer injection, and one refresh-and-retry attempt for `401`. It never refreshes for `400`, `403`, `404`, or `409`. Refresh rotation replaces both stored tokens atomically. Any refresh failure clears the session and returns the customer to login.
- Error messages accept either a string or an array. `403` means authenticated but unauthorized; Phase 1 has no admin UI.
- Cart is server-side and requires authentication. It uses the documented cart routes, including the direct item delete route. The cart response boundary normalizes its selected-variant shape because `product.variants` can be a singleton rather than an array.
- Guest users do not receive a persistent cart. They may Buy Now a single selected variant. Signed-in users may Buy Now or checkout the server cart.
- Checkout sends only documented fields. Its address is one free-form shipping-address field. It merges duplicate variant IDs before calling preview or create.
- Checkout calls preview before create, renders server totals, uses COD only, and performs real order creation. It handles a final create failure by keeping checkout data and requiring a fresh preview before retry.
- The UI displays money with `vi-VN` and VND. The backend has no currency field; Phase 1 deliberately supports one currency only.
- Voucher input, voucher validation, and voucher rendering are omitted despite backend preview support.
- API base URL comes from a Vite environment value. Development defaults to the local API contract; the production deployment supplies the production API value. No mocked production fallback is built.
- Catalog data already exists as seeded published data. The frontend does not seed or reset products, variants, stock, users, or media.
- Forms validate required documented fields before request submission and preserve server validation feedback. All interactive controls expose accessible labels, keyboard operation, focus visibility, disabled submitting states, and meaningful loading/error status.

## Testing Decisions

- A good test proves a customer-observable outcome: rendered catalog data, route navigation, selected variant behavior, emitted HTTP request shape, recovery from a documented API error, or receipt rendering. It does not assert component structure, hook calls, CSS class names, or local implementation details.
- The primary seam is a browser customer journey with the HTTP boundary intercepted or pointed at the compatible backend. This is the highest existing product seam because the app currently has one React entry point and no domain module/test seam.
- Cover catalog request serialization for keyword/type/sort/page; product media normalization and unavailable variants; all auth form outcomes; one refresh/retry and refresh-failure logout; authenticated cart mutations; guest Buy Now; cart checkout; preview-before-create; duplicate-item merging; final stock failure; and receipt rendering.
- Cover loading, empty, 404, validation-array, 401, 403, and retry states at the visible UI boundary.
- Verify responsive behavior at a phone-width viewport for catalog, product detail, cart, authentication, checkout, and receipt.
- The repository has no automated-test package, configuration, or similar test prior art. Establish only the browser/UI journey seam required for this feature; do not introduce component-level test suites or duplicate tests for the same behavior.
- Run the production build as a baseline verification. Manually verify against the local backend and the configured production API using seeded published catalog data.

## Out of Scope

- Admin catalog, category, artist, promotion, order-management, roles, permissions, and staff modules.
- Publishing products, changing product status, seeding/resetting data, media upload, or media administration.
- Customer profile editing, password change, order history, order detail retrieval, and customer order cancellation.
- Guest cart persistence or synchronization with an authenticated cart.
- Voucher UX, voucher discovery, or promotion management.
- MoMo initiation, QR/payment UI, callbacks, webhook handling, payment confirmation, or any payment method other than COD.
- Shipping-rate calculation; shipping remains server-defined at zero.
- Artist/category detail pages, price range, stock availability filters, and unsupported product sort choices.
- Reviews, wishlists, recommendations, analytics, and internationalization beyond Vietnamese/VND.
- Backend changes, including HttpOnly refresh-cookie support.

## Further Notes

- The backend handoff is the API source of truth. Do not use stale Postman examples when they differ.
- Public products must already be `published`; product administration cannot publish because no publish/status API exists.
- `POST /order` is intentionally real and decrements stock. Use the existing seeded inventory; do not add a frontend reset mechanism.
- The documented API has no payment gateway. Rendering `MOMO` as an actionable payment option would misrepresent the system.
- Runtime gallery JSON and cart variant shape are known contract irregularities; normalization belongs at the HTTP boundary, not throughout views.
