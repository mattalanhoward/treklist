# GDPR / Security / Privacy Audit — Handoff

**Prepared:** 2026-06-19
**Operator:** Tall Joe Hikes (eenmanszaak, NL, KvK 98785419)
**Scope:** TrekList web app (`client/` React/Vite), API (`server/` Express/MongoDB), marketing site (`web/`, separate Next.js).
**Hosting (from project context):** Netlify (frontends). API + MongoDB host to be confirmed by operator.

> ⚠️ This is an engineering-prepared inventory to brief an auditor (legal/DPO/security). It is **not** a legal opinion. Findings marked severity are best-effort, not a certification.

---

## 1. Personal data inventory

### 1.1 Account data — `server/src/models/user.js`
| Field | Notes |
|---|---|
| `email` | Required, unique. Primary identifier. |
| `passwordHash` | bcrypt, 10 rounds (`setPassword`). Optional (OAuth users). |
| `trailname` | User-chosen display name (may be a real name). |
| `authProviders[]` | `provider` (`google`/`email`) + `providerId` (Google user ID). |
| `marketing.{optedIn,optedInAt,optedInSource}` | Consent record for marketing email. |
| `onboarding.*`, `notifications.emailEnabled`, `*OptOut` | Email/tour preferences. |
| `lastLoginAt`, `lastActiveAt` | Activity timestamps. |
| `region`, `locale`, `language` | `region` derived from **IP** (see 1.3). |
| `verifyEmailToken`, `resetPasswordToken` (+ expiries) | **Stored plaintext** (see Finding F1). |
| `refreshTokens[]` | Array of raw refresh tokens, **plaintext** (Finding F1). |
| `isAdmin`, `isDisabled`, `isVerified`, `favoriteCommunities` | Account state. |

### 1.2 User-generated content (may contain personal data in free text)
- Gear lists / items / notes — `gearList.js`, `gearItem.js`, `category.js`, `globalItem.js`
- Community posts / comments / upvotes / flags — `post.js`, `comment.js`, `community.js`, `upvote.js`, `flag.js`
- Notifications — `notification.js`
- Share tokens — `shareToken.js` (public read-only list exposure)

### 1.3 IP addresses — `server/src/utils/regionDetection.js`
- Reads `x-forwarded-for` / `x-real-ip` / `cf-connecting-ip`; resolved via **`geoip-lite`** (local DB, **no external call** — good).
- IP is personal data; confirm it is **not persisted** (only `region` string is). Verify logs don't retain raw IPs.

---

## 2. Sub-processors / third-party data flows
| Processor | Purpose | Data sent | Location | File |
|---|---|---|---|---|
| MongoDB (host TBC) | Primary datastore | All of §1 | TBC | — |
| SMTP provider (env `SMTP_*`) | Transactional email | email, name, list content in reminders | TBC | `server/src/utils/mailer.js` |
| **Kit / ConvertKit** (`api.kit.com`) | Marketing email | **email + first name** | **US** | `server/src/utils/kitSubscribe.js` |
| Anthropic (Claude Haiku) | Catalog description copy | Catalog/product text only — **no user PII observed** | US | `server/src/services/anthropicService.js` |
| OpenAI (gpt-4o-mini) | Catalog description copy | Catalog/product text only — **no user PII observed** | US | `server/src/services/openaiService.js` |
| Amazon Creators API / Awin | Affiliate offers/snapshots | Product queries | US/EU | `server/src/services/amazonCreatorsApi.js`, `adminAwinImport.js` |
| Cloudinary | Image hosting/uploads | Uploaded images | US/EU | `server/src/routes/uploads.js` |
| Google | OAuth + GTM/Analytics | email/profile (OAuth); analytics events (consented) | US | `server/src/routes/auth.js`, `client/src/utils/analytics.js` |
| Netlify | Frontend hosting/CDN | Request metadata | US/EU | — |

**Action for auditor:** confirm a Records of Processing (Art. 30), Data Processing Agreements with each, and **transfer mechanism (SCCs)** for US processors (Kit, OpenAI, Anthropic, Google, Cloudinary).

---

## 3. Current controls (what's already in place)

**Auth & secrets** — `server/src/routes/auth.js`, `server/src/middleware/`
- Passwords bcrypt (10 rounds).
- Refresh token in **httpOnly** cookie; `SameSite=None; Secure` in prod; 7-day expiry.
- Access JWT expiry `JWT_EXP` default **7 days** (long — Finding F2).
- HMAC-signed codes for some flows (`createHmac` w/ `JWT_SECRET`).

**Transport / app hardening** — `server/src/app.js`
- `helmet()` enabled.
- CORS allow-list (env-driven), rejects unknown origins.
- `express.json({ limit: "10mb" })`.
- `trust proxy = 1` in prod.
- Rate limiters — `server/src/middleware/rateLimiters.js` (e.g. `publicShareLimiter`).

**Consent / cookies** — `client/src/utils/analytics.js`, `cookieConsent.js`, `components/CookieBanner.jsx`
- Google **Consent Mode**: default **denied**; GTM only injected after analytics consent.
- Consent stored in `localStorage`; banner suppressed on cookie-settings page and **inside embeds** (`App.jsx` `isEmbedded`).
- Legal pages exist: Privacy, Cookies, Cookie Settings, Terms, Affiliate Disclosure, Imprint (`client/src/pages/legal/`, `components/legal/`).

**Erasure (manual)** — `server/src/routes/adminUsers.js:289` ("GDPR-style delete for support requests"), `deleteOne` at ~336.

---

## 4. Findings / gaps (ranked)

| # | Severity | Finding | Where | Suggested fix |
|---|---|---|---|---|
| **F1** | High | `resetPasswordToken`, `verifyEmailToken`, and `refreshTokens[]` stored **plaintext** in DB. DB read = account takeover. | `models/user.js`, `routes/auth.js:283,426,180` | Store **SHA-256 hashes**; compare hashed. Short TTL on reset/verify. |
| **F2** | Medium | Access JWT default **7 days** — long-lived bearer token, no server-side revocation. | `auth.js` `JWT_EXP` | Shorten to ~15–60 min; rely on refresh rotation. |
| **F3** | High (compliance) | **No self-service data export (portability) or deletion (erasure).** Deletion is admin-only/manual. | `routes/settings.js` (none), `adminUsers.js` | Add self-serve "Delete my account" + data export; document SLA in Privacy Policy. |
| **F4** | Medium | Cookie-based refresh endpoint with `SameSite=None` — confirm **CSRF** protection on refresh/state-changing cookie routes. | `auth.js:590+` | Verify CSRF token or origin check; no `csrf` middleware seen. |
| **F5** | Medium | **International transfer** to US processors (Kit/OpenAI/Anthropic/Google/Cloudinary) — confirm SCCs + disclosure in Privacy Policy. | §2 | DPAs + SCCs; list sub-processors publicly. |
| **F6** | Medium | Confirm **raw IPs are not logged/persisted** anywhere (region detection reads them). | `regionDetection.js`, logging | Mask/drop IPs in logs; document retention. |
| **F7** | Low | Refresh token rotation/invalidation on logout/password-change — verify old tokens are pruned from `refreshTokens[]`. | `auth.js` logout (~615) | Ensure rotation + server-side revoke. |
| **F8** | Low | Privacy Policy alignment: verify it accurately lists every §2 processor, the IP/region processing, retention periods, and lawful bases. | `components/legal/PrivacyContent.jsx` | Reconcile policy ↔ code. |
| **F9** | Low | Data retention: no documented retention/auto-purge for inactive accounts, notifications, snapshots. | DB models | Define + implement retention. |
| **F10** | Info | Verify `client.zip` / `server.zip` in repo root aren't shipped/committed with secrets. | repo root | Remove archives; check `.gitignore` & secret scanning. |

---

## 5. What the auditor should verify (checklist)
- [ ] **Art. 30** Records of Processing exists and matches §1–§2.
- [ ] **Lawful basis** per processing purpose (contract for account; consent for marketing/analytics; legit. interest for security).
- [ ] **DPAs + SCCs** for every §2 sub-processor; public sub-processor list.
- [ ] **DSAR flow**: access, export (portability), erasure, rectification — with response SLA.
- [ ] **Consent**: analytics gated (verified in code) — confirm marketing opt-in is granular and logged (it is: `marketing.optedInAt/Source`).
- [ ] **Breach process**: 72-hour notification plan; who is responsible.
- [ ] **Security**: F1–F7 remediated or risk-accepted in writing.
- [ ] **Retention schedule** documented and enforced (F9).
- [ ] **Privacy/Cookie policy** reconciled with actual code (F8); cookie list accurate.
- [ ] **Backups** location/encryption and their transfer/retention.
- [ ] **Logs** scrubbed of PII/IPs (F6).

## 6. Open questions for the operator

### Operator answers (recorded 2026-06-19)
1. **MongoDB:** MongoDB Atlas, **EU region**, **encryption-at-rest enabled**. → Keeps primary datastore in the EU (good; no transfer issue for the DB itself).
2. **API:** **Render, Frankfurt (EU)** region. → API processing stays in the EU.
3. **SMTP:** **Unconfirmed.** Provider is fully env-driven (`SMTP_HOST/USER/PASS/FROM` in `mailer.js`); `.env.example` defaults to `smtp.gmail.com`. **Action:** operator to confirm the live `SMTP_HOST` value set on Render, and whether it's an EU or US provider (affects §2/F5). If Gmail/Google Workspace, it's the same Google sub-processor already listed.
4. **DPAs signed:** **Kit/ConvertKit, Cloudinary, Google, OpenAI/Anthropic** — operator confirms DPAs in place. **Still to confirm:** Amazon Creators / Awin (affiliate), and **SCCs** (transfer mechanism) for each US processor — DPA ≠ SCCs (see F5).
5. **Server logging of IPs / request bodies:** **Unknown — needs verification.** Keeps **F6 open** until the app's logging (and Render's platform log retention) is inspected. Mongo + API both EU reduces but does not eliminate the IP-in-logs concern.
6. **Backups:** **Atlas automated backups** (default retention, encrypted, same EU region). **Action:** document the exact retention window and confirm backup encryption + that snapshots stay in-EU.

### Original questions (for reference)
1. Where is **MongoDB** hosted (Atlas region?) and is encryption-at-rest on?
2. Where is the **API** hosted (Render/Fly/VPS?) — region matters for transfers.
3. Which **SMTP** provider (the `from`/host)?
4. Do you have **DPAs** signed with Kit, Cloudinary, Google, OpenAI, Anthropic, Amazon/Awin?
5. Is there any **server logging** that captures IPs or request bodies (and where do logs live)?
6. Backup strategy + retention?

## 7. Key file map (for the reviewer)
- Data model: `server/src/models/` (start `user.js`)
- Auth/tokens/cookies: `server/src/routes/auth.js`, `server/src/middleware/auth.js`, `optionalAuth.js`
- App hardening: `server/src/app.js`, `server/src/middleware/rateLimiters.js`
- Email: `server/src/utils/mailer.js`, `kitSubscribe.js`, `jobs/welcomeEmailJob.js`, `jobs/tripReminderEmailJob.js`
- IP/region: `server/src/utils/regionDetection.js`
- AI: `server/src/services/{anthropicService,openaiService}.js`
- Public exposure: `server/src/routes/publicShare.js`, `models/shareToken.js`
- Admin/erasure: `server/src/routes/adminUsers.js`
- Consent/analytics: `client/src/utils/{analytics,cookieConsent}.js`, `components/CookieBanner.jsx`, `App.jsx`
- Legal copy: `client/src/components/legal/`, `client/src/pages/legal/`
