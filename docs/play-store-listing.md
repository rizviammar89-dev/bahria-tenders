# Google Play — Store Listing & Data Safety (Bahria Tenders)

Draft content to paste into Play Console once the developer account is verified.
Fill anything in **[brackets]**.

---

## 1. App details

- **App name (30 chars max):** `Bahria Tenders`
- **Default language:** English (United States) — or Urdu (Pakistan) if you prefer
- **App or game:** App
- **Free or paid:** Free (subscription is in-app, so the app is "Free" with in-app purchases later; for launch with no live payments, it's simply Free)
- **Category:** Business  *(alternatives: Lifestyle, or House & Home)*
- **Tags:** services, home services, trades, local

## 2. Short description (80 chars max)
```
Hire trusted local tradespeople, or offer your services — plumbers, electricians & more.
```
*(That's 88 chars — trim to ≤80, e.g.:)*
```
Hire trusted local tradespeople — or offer your services in your area.
```

## 3. Full description (4000 chars max)
```
Bahria Tenders connects residents with reliable local service providers — plumbers,
electricians, welders, and more — right in your neighbourhood.

FOR RESIDENTS
• Post a job in seconds: describe the problem, add photos, and set your location.
• See available providers near you on a live map.
• Chat directly with providers by text or voice message to agree on the work.
• Review providers after the job so the community knows who to trust.

FOR SERVICE PROVIDERS
• Create a profile with your trade, photos of your work, and reviews.
• Go "Available" to appear on the map for nearby residents looking for your trade.
• Get alerts for new jobs in your area and respond fast.
• Start with a 2-month free trial.

Bahria Tenders is built for local communities in Pakistan. Sign in with Google, set up your
profile, and get started in minutes.
```

## 4. Graphic assets you must provide
- **App icon:** 512 × 512 PNG (32-bit, with alpha). *(You have `assets/images/icon.png` — export at 512².)*
- **Feature graphic:** 1024 × 500 PNG/JPG (shown at top of listing). **Required.**
- **Phone screenshots:** 2–8, PNG/JPG, 16:9 or 9:16, min 320px side. Capture: the map, post-a-job, a provider profile, chat.
- *(Optional)* 7-inch / 10-inch tablet screenshots.

## 5. Content rating
Complete the **content rating questionnaire** in Play Console (IARC). For this app answer honestly:
- No violence, sexual content, gambling, or drugs.
- Has **user-generated content / user communication** (chat) → declare it.
- Expected rating: **Everyone / PEGI 3**-ish, but the questionnaire decides.

## 6. Data Safety form (maps to the privacy policy)
Declare **data collected**, all **linked to the user**, used for **App functionality** (and Account
management / Communications where noted). You are **not** selling data and **not** using it for ads.

| Data type | Collected | Purpose | Notes |
|---|---|---|---|
| Name | Yes | Account management, App functionality | From Google sign-in |
| Email address | Yes | Account management | From Google sign-in |
| Phone number | Yes | App functionality (contact between users) | Entered at profile setup |
| Precise location | Yes | App functionality (map, matching) | Providers while "Available"; residents for job matching |
| Photos | Yes | App functionality | Job/profile photos the user adds |
| Voice / audio | Yes | App functionality (voice messages) | Only when user records a message |
| Messages (in-app) | Yes | App functionality (chat) | Text + voice between resident & provider |
| Purchase history | Yes* | App functionality | *Only once subscriptions go live |
| Push token / Device IDs | Yes | App functionality (notifications) | FCM |

**Security answers:**
- **Data encrypted in transit:** Yes (HTTPS/TLS to Supabase & Google).
- **Users can request data deletion:** Yes — via the contact email in the privacy policy.

## 7. Store settings you'll also fill
- **Privacy Policy URL:** [hosted privacy-policy URL — see docs/privacy-policy.md]
- **Contact email:** [your public contact email]
- **App access:** the reviewer signs in with Google — provide **test instructions** and, since sign-in is Google-only, either a **test Google account** or note that any Google account works once the consent screen is published.
- **Ads:** No ads → declare "No".

## 8. Target audience & content
- **Target age:** 18+ (or 13+). Avoid designating children as a target audience (you collect location + chat).
- **News app:** No. **COVID app:** No.

---

### Assets checklist before submission
- [ ] 512² icon
- [ ] 1024×500 feature graphic
- [ ] 2–8 phone screenshots
- [ ] Privacy policy hosted at a public URL
- [ ] Public contact email
- [ ] Content rating questionnaire completed
- [ ] Data Safety form completed
