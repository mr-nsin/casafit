# First-run and onboarding

## Why
Every user becomes a known, verified account from the first tap so the lifetime free form-check quota and the plan built from onboarding answers can be tied to that identity (PRD §5, §6, §14).

## Done when
- [ ] A new user can go from the welcome screen through phone or email verification, two onboarding pages and a week-one plan preview to "Start today's session" in under 90 seconds median.
- [ ] A returning verified user who reinstalls lands on home with their plan, logs, free credits and Pro status restored, skipping onboarding.
- [ ] The sixth code request in an hour for the same number or email is refused with a clear message on the verify screen.
- [ ] Normalised email aliases ("name+1@gmail.com", "n.a.me@gmail.com") resolve to the same account as "name@gmail.com".
- [ ] Health flags (heart or blood pressure, pregnancy or postpartum, recent surgery) route the generated plan to the gentler variant without blocking the user.
- [ ] Going back from the about page to the goals page keeps every answer.
- [ ] With no network, a first-run user sees the offline screen; an already-verified user can still start a downloaded session.
- [ ] A new account on a device that has already spent its two free form checks shows the "device has used its free checks" line and offers sign-in to the original account.

## Tasks
| # | Agent | Task | Depends on |
|---|---|---|---|
| 1 | ux-designer | Add the "code sent, resend in 30s" state and the "5 sends per hour reached" state to m3-verify.dc.html, and the matching error copy variants on m3-otperror.dc.html (onboarding lane) | – |
| 2 | ux-designer | Add the "no network on first run" state to m3-offline.dc.html and the "returning user, plan restored" state to m3-welcomeback.dc.html (onboarding lane) | – |
| 3 | ux-designer | Add the "1 of 2" progress indicator and the body-parts multi-select (shown only when "specific" is picked) to m3-goals.dc.html, and the "all three styles picked, opens customise" state to m3-mix.dc.html (onboarding lane) | – |
| 4 | ux-designer | Add the skip paths on height and weight to m3-about.dc.html, and the gentler-plan recommendation line plus the separate health-consent tick to m3-health.dc.html (onboarding lane) | – |
| 5 | ux-designer | Add the "building your plan" progress state to m3-building.dc.html and the week-one preview with the single "Start today's session" button to m3-weekone.dc.html, with the welcome entry state on m3-welcome.dc.html and the self-declared age field on m3-age.dc.html (onboarding lane) | – |
| 6 | content-writer | Write the privacy notice line above the verify button, the resend and lockout error copy, the "why we ask" lines on each onboarding question, the health-consent sentence, and the week-one preview explanations across welcome, verify, otperror, offline, welcomeback, age, goals, mix, about, health, building and weekone (onboarding lane) | 1, 2, 3, 4, 5 |
| 7 | backend-engineer | Prisma migration for Account (normalised phone and email, plan, free-check balance seeded at 2, Pro status) and OtpAttempt; implement POST /v1/auth/code (6-digit code, 5-minute validity, 30-second resend, 5-sends-per-hour, Play Integrity and App Attest check, DLT template) and POST /v1/auth/verify (returns signed session, Pro status and free-check balance) | – |
| 8 | backend-engineer | Implement PUT /v1/me/plan to persist the onboarding answers (goal, body parts, style mix, age, sex, height, weight, experience, days per week, pain flags, health flags) and return the generated week-one plan, with the gentler-plan route when a health flag is set | 7 |
| 9 | mobile-engineer | React Native screens and navigation for welcome, verify, otperror, offline and welcomeback, with the useAuth hook calling POST /v1/auth/code and POST /v1/auth/verify, Android auto-read of the SMS code, Google one-tap for email, and the 7-day offline grace on the cached session | 7 |
| 10 | mobile-engineer | React Native screens and navigation for age, goals, mix, about, health, building and weekone, with the usePlan hook calling PUT /v1/me/plan, back-navigation that preserves every answer, skip paths on height and weight, and the "Start today's session" hand-off to the home screen | 8, 9 |
| 11 | qa-engineer | Jest unit tests for identifier normalisation (phone, email plus-tags, Gmail dots, disposable domains) and the resend and send-per-hour limits; Supertest tests for POST /v1/auth/code, POST /v1/auth/verify and PUT /v1/me/plan; Maestro flow covering welcome → verify → age → goals → mix → about → health → building → weekone, the returning-user welcomeback path, and the no-network offline path | 9, 10 |

## Open questions
- Q10: Run the A/B test of verify-first vs verify-at-"save your plan" in the beta, or ship verify-first only?
- Q11: Keep both phone and email on the welcome screen for launch, or phone only with email as a later fallback?
- Q12: Does one form-check credit cover one exercise through one set, or a whole session?
- Q13: What else, besides unlimited form checks, does Pro include at launch (yoga and dance libraries, customised nutrition plan, price and trial length)?
- Q14: On account deletion, reset the free-check balance or keep a salted hash of the identifier and balance for a stated period?
- Q15: When Pro lapses, does the user return to the free balance they had before Pro, or to zero?
- Q16: Add a third free credit, or let users earn credits, to cover setup-problem burns?
- Q18: Is self-declared age at onboarding enough for the 18+ gate, or is a stronger check needed?
