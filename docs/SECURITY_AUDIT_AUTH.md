# Security Audit: LoraField Authentication Flow

**Date:** 2026-06-30  
**Scope:** Frontend + Backend Auth endpoints  
**Status:** Findings 1, 2, and 4 fixed on 2026-09-27. Finding 5 partly fixed on 2026-09-28 (register). Finding 3 is still open.  
**Updated:** 2026-09-24. Code references now point to `backend/app/routers/auth.py` (the backend was split into routers). All findings below are still open. The Cloudflare rate limiting rule that was the only mitigation has been removed.  
**Updated:** 2026-09-27. Fixes for findings 1, 2, and 4 are described in each section. Code snippets below show the code as it was before the fix.

## Executive Summary

The LoraField authentication system has **3 critical security flaws** and **1 moderate issue**:

1. **No rate limiting on password reset OTP** (6-digit brute force)
2. **No rate limiting on login** (credential brute force)
3. **Dev token exposure in forgot-password response** (config dependent)
4. **No brute-force attack detection or lockout** (missing)

These vulnerabilities allow attackers to brute-force passwords, OTP codes, and compromise accounts without detection.

## Critical Issues

### 1. OTP Brute-Force Vulnerability (CRITICAL)

**Location:** `POST /api/auth/reset-password/verify` and `POST /api/auth/reset-password`

**Problem:**
- OTP is 6 digits (000000–999999 = 1,000,000 combinations)
- **No rate limiting** on verification attempts
- **No lockout after failed attempts**
- **No IP-based throttling**
- Attacker can try all 1M combinations in minutes

**Code Reference:**
```python
# backend/app/routers/auth.py:298
@router.post("/api/auth/reset-password/verify")
def verify_reset_code(payload: ResetCodeVerifyRequest) -> dict:
    token = payload.token.strip()
    with get_connection() as connection:
        get_active_reset_row(connection, token)  # ← No limit check
    return {"message": "Kode reset valid."}
```

**Impact (corrected 2026-09-27):** The earlier text said the attacker needs to know the email. That was wrong: the OTP was not tied to an email at all. `get_active_reset_row` matched the token across every user, so an attacker could try 000000–999999 without knowing any email and reset the password of whichever account had an active code.

**Status: FIXED (2026-09-27).** Verify and reset-password now require `email` + `token`, and only the latest active code of that user is checked (`check_reset_code`). Every wrong code increments `password_resets.attempts`; the 5th wrong try burns the code (`used = 1`). The check runs inside `BEGIN IMMEDIATE`, so parallel guesses queue up and cannot slip past the count. Together with the forgot-password cap (5 per day, finding 4), an attacker gets at most 25 guesses per account per day.

**Fix Required (original recommendation):**
- Implement rate limiting: max 5 attempts per 15 minutes per email
- Return 429 after limit exceeded
- Consider: exponential backoff, IP-based tracking, CAPTCHA after 3 failed

### 2. Login Brute-Force Vulnerability (CRITICAL)

**Location:** `POST /api/auth/login`

**Problem:**
- **No rate limiting** on login attempts
- **No lockout after N failed attempts**
- No tracking of failed login attempts by IP or email
- Attacker can try password combinations at full speed

**Code Reference:**
```python
# backend/app/routers/auth.py:104
@router.post("/api/auth/login", response_model=TokenResponse)
def login(payload: UserLogin, request: Request) -> dict:
    # ← No rate limit middleware
    email = payload.email.lower().strip()
    ip = client_ip(request)
    # Logging is present but not enforced
    if not user or not verify_password(payload.password, user["password_hash"]):
        logger.warning("login | failed | ip=%s email=%s", ip, email)
        # ← Returns immediately, no throttle
        raise HTTPException(status_code=401, detail="Email atau password salah.")
```

**Impact:** Attacker brute-forces any account's password.

**Status: FIXED (2026-09-27).** 5 login attempts that fail within 15 minutes lock that account: further attempts return 429, even with the correct password. The attempt slot is taken under a lock before the password is checked, so parallel attempts are counted too. A successful login clears the count.

**Fix Required (original recommendation):**
- Rate limit: max 5 failed attempts per 15 minutes per email + IP
- Lock account temporarily after 5–10 failed attempts
- Return 429 with retry-after header
- Log all failed attempts for audit trail

### 3. Dev Token Exposure in Forgot-Password (CRITICAL)

**Location:** `POST /api/auth/forgot-password`

**Problem:**
- `expose_dev_tokens: bool` setting returns OTP in response body when True
- If accidentally enabled in production, all reset codes leak to frontend
- Default is False (good), but no validation preventing production deployment with this enabled

**Code Reference:**
```python
# backend/app/routers/auth.py:273
if not email_sent and settings.expose_dev_tokens:
    response["reset_token"] = reset_token  # ← Token exposed!
    response["note"] = "Email provider belum aktif..."
```

**Config File:**
```python
# backend/app/config.py:31
# WAJIB False di production — default False untuk fail-secure.
expose_dev_tokens: bool = False
```

**Impact:** If mistakenly set to True in production, all password reset codes visible to client and network.

**Status: STILL OPEN (2026-09-27).** The default is False, and it MUST stay False in production. No startup check exists yet.

**Fix Required:**
- Add startup validation: raise error if `expose_dev_tokens=True` and not localhost
- Never return reset_token in production response
- Add monitoring alert if this setting is enabled

## Moderate Issues

### 4. No Rate Limiting Infrastructure

**Problem:**
- Backend has NO rate limiting library (no slowapi, no custom middleware)
- CLAUDE.md lists "Endpoint Belum Ada" noting rate limiting is not implemented
- All auth endpoints are vulnerable to automated attack

**Status:** Expected missing feature (documented), but should be implemented before production.

**Status: FIXED (2026-09-27), without a new library.** `routers/auth.py` keeps an in-memory limiter: login 5 failures per 15 minutes, forgot-password 5 requests per day, both per account. It lives per process and resets when the server restarts; it must move to a DB table if the backend ever runs with more than one worker.

**Design notes:**
- The limiter is keyed by user id, not by IP: `client_ip` reads `X-Forwarded-For`, which a client can forge.
- Unknown emails are never recorded, so flooding with random emails cannot grow the limiter's memory.
- Trade-off: anyone who knows an email can lock that account out of login for 15 minutes, or use up its 5 reset requests for the day.

**Fix Required (original recommendation):**
- Add `slowapi` library
- Implement rate limiting middleware for all /api/auth endpoints
- Configure per-endpoint limits:
  - POST /auth/login: 5 attempts / 15 min per IP+email
  - POST /auth/forgot-password: 3 requests / 15 min per email
  - POST /auth/reset-password/verify: 5 attempts / 15 min per token
  - POST /auth/reset-password: 5 attempts / 15 min per token

### 5. Registered Email Disclosure (MODERATE, OPEN, found 2026-09-27)

**Location:** `POST /api/auth/register`, plus the 429 responses of login and forgot-password

**Problem:**
- Register returns 409 "Email sudah terdaftar." for an existing email, so anyone can check whether an email has an account.
- The new 429 responses only appear for registered emails, which is the same leak.

**Status: PARTLY FIXED (2026-09-28).** Register now answers 202 with the same message for every email and proves ownership with a 6-digit code (`POST /api/auth/register/verify`). A new email gets an unverified account and a code; an unverified email gets a new code (same 5 per day cap as forgot-password, never 429); a verified email gets nothing and its account is untouched. The password is hashed on every path and the email is sent in the background, so response time does not reveal the difference. Name and password are saved at the verify step, so whoever registers an email first cannot pre-set the password of someone else's account. Unverified accounts cannot log in (403, checked after the password). Accounts that existed before were marked verified once, when the column was added.

Still open:
- The 429 responses of login and forgot-password only appear for registered emails.
- Small timing differences remain (a new email writes rows, a verified one does not).
- Register can send a code email to any address, and unverified accounts are never removed. Rate limit registration at the reverse proxy before going public.
- Anyone who knows an unverified email can use up its 5 codes per day.

## Frontend Security Status

### What's Good ✅
- Token stored securely via `lib/token.ts` (not direct localStorage access)
- Password input has show/hide toggle (UX + security)
- Form validation on client side (email format, password length)
- No hardcoded secrets in code
- No API calls from components (centralized via `api.ts`)

### What's Missing ❌
- No rate limiting feedback to user (should show countdown after failed attempts)
- No CAPTCHA or challenge after N failed login attempts
- No account lockout warning in UI
- Login response doesn't expose rate-limit headers to client

## Attack Scenarios

### Scenario 1: Password Reset Brute Force
```
Attacker:
1. Calls POST /auth/forgot-password with email@example.com → gets message (no feedback on success/failure)
2. Calls POST /auth/reset-password/verify with token=000000 → tries 1M codes
3. After ~30 minutes, finds valid code
4. Calls POST /auth/reset-password with valid token + new password
5. Gains account access

Time to compromise: ~30 minutes
Detection: None (no alerts, no logs checked)
```

### Scenario 2: Username Enumeration via Forgot-Password
```
Attacker:
1. Calls POST /auth/forgot-password with john@company.com
2. Response: "Jika email terdaftar, tautan reset password akan dikirim."
   (same message for unknown emails — good)
3. BUT: attacker can measure response time or email delivery
   to infer which emails exist
```

### Scenario 3: Credential Stuffing (leaked password lists)
```
Attacker:
1. Has list of 10M email:password pairs from previous breaches
2. Calls POST /auth/login with each pair, unlimited speed
3. No rate limiting → completes in hours
4. Finds matches in LoraField database
5. Compresses to list of valid LoraField accounts

Time to test 10M credentials: ~5–10 hours
Detection: None (logs exist but not monitored)
```

## Recommendations (Priority Order)

Update 2026-09-27: the OTP brute force, login brute force, and rate limit rows are done, without `slowapi` (see findings 1, 2, and 4).

| Priority | Issue | Fix | Effort | Impact |
|----------|-------|-----|--------|--------|
| 🔴 P0 | OTP brute force | Add rate limiting + lockout | 2–3 hrs | Critical |
| 🔴 P0 | Login brute force | Add rate limiting + lockout | 2–3 hrs | Critical |
| 🔴 P0 | Dev token exposure | Add startup validation | 30 min | Critical |
| 🟡 P1 | No rate limit lib | Install `slowapi` + middleware | 1–2 hrs | High |
| 🟡 P1 | Account lockout UX | Show cooldown timer in UI | 1 hr | High |
| 🟢 P2 | Failed login logging | Implement log aggregation | 4–6 hrs | Medium |
| 🟢 P2 | CAPTCHA support | Add reCAPTCHA v3 option | 2–3 hrs | Medium |

## Implementation Checklist

### Backend (Python/FastAPI)
- [ ] Install `slowapi==0.1.9`
- [ ] Add rate limit middleware to FastAPI app
- [ ] Configure limits per endpoint
- [ ] Add 429 response handlers
- [ ] Log all rate limit hits
- [ ] Add startup check for `expose_dev_tokens`
- [ ] Test brute force with ApacheBench/wrk

### Frontend (React/TypeScript)
- [ ] Handle 429 responses (show cooldown message + timer)
- [ ] Disable form during cooldown
- [ ] Display remaining attempts before lockout
- [ ] Add accessibility labels for timers

### Infrastructure
- [ ] Monitor /api/auth endpoints for 429 spike
- [ ] Set alert threshold (>50 429s in 5 min)
- [ ] Review auth logs daily during beta

## Testing the Fixes

### Brute Force Test (after fix)
```bash
# Should block after 5 attempts
for i in {1..10}; do
  curl -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong'$i'"}'
  echo "Attempt $i"
  sleep 1
done
# Expected: attempts 1–5 return 401, attempts 6–10 return 429
```

### Dev Token Exposure Test
```bash
# Set expose_dev_tokens=True, restart server
# Should fail startup in production mode
python backend/app/main.py  # Should raise error if not localhost
```

## References

- OWASP: [Credential Stuffing](https://owasp.org/www-community/attacks/Credential_stuffing)
- OWASP: [Brute Force Attack](https://owasp.org/www-community/attacks/Brute_force_attack)
- slowapi docs: [https://github.com/laurentS/slowapi](https://github.com/laurentS/slowapi)
- NIST: [Digital Identity Guidelines - Authentication](https://pages.nist.gov/800-63-3/sp800-63b.html)

## Questions for Team

1. Is the backend currently exposed to the internet, or behind a WAF/load balancer with rate limiting?
2. Are auth logs being monitored by security team?
3. What's the production timeline? Should these fixes be blocking?
4. Do we have a Security Contact email for external researchers to report vulnerabilities?

