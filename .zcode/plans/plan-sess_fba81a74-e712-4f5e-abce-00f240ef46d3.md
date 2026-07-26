## Cookie-based auth, same-origin in dev via proxy

**Decision (confirmed):** httpOnly session cookie model, no JS-side token. Same-origin in dev (keep the Next.js rewrite proxy so cookies stay first-party on localhost:3001). In production, deploy frontend + backend under one domain (also same-origin, cookies first-party).

### Why this is the right call
- **Most secure**: the session token never touches JS, so an XSS cannot exfiltrate it. `localStorage` Bearer tokens are XSS-exfiltrable.
- **No SameSite/HTTPS complexity**: same-origin means `SameSite=Lax` (the backend default) works fine. `SameSite=None;Secure` (which requires HTTPS even in dev) is *not* needed.
- **No backend changes**: CORS is already configured, cookies are already set with `X-Requested-With` present, CSRF fallback already works. The backend is correct as-is.
- **Simpler frontend**: removes the confused dual-auth model.

### What's wrong today (the cleanup target)
The current code runs a confused hybrid that's the source of past bugs:
1. Login sets a cookie (correct) **and** the code also captures a `token` response header into `localStorage` as a "cross-origin fallback" — but we're same-origin via the proxy, so the fallback is dead weight that adds XSS surface.
2. Every request sends **both** the cookie (`credentials: 'include'`) **and** `Authorization: Bearer <localStorage token>`. The backend reads the cookie first, so the Bearer header is redundant.
3. CSRF is satisfied via `X-Requested-With: XMLHttpRequest` on data calls (works because `ExperimentalStrictCSRFEnforcement=false`), but the code is inconsistent — only some calls send it.
4. There are scattered `getStoredToken`/`setStoredToken`/`clearStoredToken` helpers and a `vmg-auth-token` localStorage key that exist only to support the redundant Bearer path.

### The refactor (frontend-only)

#### 1. `src/lib/api.ts` — drop the Bearer-token model, standardize on cookies + CSRF header
- **Remove** `getStoredToken` / `setStoredToken` / `clearStoredToken` and the `vmg-auth-token` localStorage key.
- **Remove** the `Authorization: Bearer` header from `apiFetch`, `apiFetchList`, `apiSearchPaginated`, and `getMe` — auth is now exclusively via the cookie.
- **Standardize `X-Requested-With: XMLHttpRequest`** on every API call (auth + data + public-where-relevant) in one shared helper, so CSRF is satisfied consistently. Currently it's on login/logout but inconsistently on data calls. Centralize it.
- `loginWithMattermost`: keep sending `X-Requested-With` (so the backend attaches cookies), but **stop reading the `token` response header** into localStorage — it's no longer needed. The cookie is the credential.
- `getMe`: relies on the cookie (`credentials: 'include'`); no Bearer header. Keep returning `null` on 401.
- 401 handling unchanged: dispatch `auth:expired` → store logs out → redirect to /login (the reactive gate we added earlier).

#### 2. `src/store/lms-store.ts` — drop token plumbing
- `logout`: remove `clearStoredToken()` call (no longer exists). Keep the `apiLogout()` POST (clears the server cookie) and the state reset.
- The `auth:expired` listener stays (still the right behavior).

#### 3. `next.config.ts` — keep the proxy (this IS the same-origin mechanism)
- No change. The `/api/v4/:path*` rewrite to `localhost:8065` is what makes the cookie first-party. Document *why* it must stay (one comment) so it doesn't get removed thinking it's optional.
- `.env.local` stays `NEXT_PUBLIC_API_URL=http://localhost:8065`.

#### 4. Documentation comment
- Add a clear comment at the top of `api.ts` explaining the auth model: *"Auth is via the httpOnly MMAUTHTOKEN cookie set at login. All requests use credentials:'include' and send X-Requested-With: XMLHttpRequest to satisfy the backend's CSRF check. No JS-side token is stored."* — so the next person doesn't re-introduce the Bearer/localStorage path.

### What is NOT changing
- Backend code: untouched (cookies, CORS, CSRF all correct for this model).
- The proxy: stays (it's the same-origin mechanism, not optional).
- `NEXT_PUBLIC_API_URL`: used only for absolute public URLs (images), not for authed fetches.
- The auth flow (hydrate/getMe → redirect), query mechanism, pagination — all the prior work stands.

### Verification
- `npx tsc --noEmit` — no new errors after removing the token helpers (need to confirm nothing else imports them).
- Trace: login → cookie set → reload → getMe reads cookie → dashboard; POST data → cookie + X-Requested-With → CSRF passes → 200.

### Files
1. `src/lib/api.ts` — remove token helpers + Bearer headers, standardize X-Requested-With, clean up login/getMe.
2. `src/store/lms-store.ts` — remove `clearStoredToken` import/call in logout.
3. `next.config.ts` — comment only.

### Out of scope / flagged
- If you ever want truly direct browser→backend (no proxy) cross-origin, that needs `SameSite=None;Secure` + HTTPS — a separate, larger change. The cookie model chosen today is forward-compatible with that future move.