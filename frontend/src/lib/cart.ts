// Anonymous cart identified by an opaque token stored in this cookie (no user
// accounts yet). Shared between the cart API routes and the cart page.
export const CART_COOKIE = "cart_token";
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 days
