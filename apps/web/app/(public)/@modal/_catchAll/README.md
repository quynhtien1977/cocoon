This former catch-all is intentionally kept in a private folder, so Next.js does
not register it as a route. A catch-all in this public parallel slot also matched
customer/admin/staff/manager URLs, making them incomplete routes under strict dev
route matching and returning 404.

AuthDialogs already owns dialog visibility based on the current pathname; the
intercepted pages render null. The slot's default.tsx handles unmatched routes.
Keep this folder private unless the parallel-route structure is redesigned.
