# CasaFit · Overview

CasaFit is a 15-minute home-workout app for Indian adults, with food logging and step counting. The main spec is `fitness-app-prd.html` (the PRD). This file is a short pointer for agents.

## What it is in 10 lines

1. A phone app. India first, Android first.
2. Every session is 2 min warm-up, 11 min work, 2 min cool-down.
3. The plan is built on the phone from onboarding answers. No AI at build time.
4. Three session styles: normal, yoga, dance. Users can mix them.
5. A free account gets 2 form-camera checks for life. Pro is unlimited.
6. Camera analysis runs on the phone. No video leaves the device.
7. Food log uses Indian portions (katori, roti, chamach) and can hide calories.
8. Step counting uses the phone sensor or Health Connect. No GPS.
9. Account identity is a verified phone number or email. The quota lives on the server.
10. The first release is adults 18+.

## Current state

- **Spec and screens:** done. The PRD, the earlier spec, and 71 Material 3 screens are in the repo.
- **Architecture and stack:** the proposal is in `architecture.md` and `tech-stack.md`. Nothing is built.
- **Code:** none yet.

## Who to design for

- **Primary user:** a 26-year-old in a Jaipur flat with two dumbbells, or a 40-year-old new to exercise. Short on time, trains at home with little equipment.
- **Non-users for v1:** gym machines, under-18s, pure outdoor runners.

## Non-goals for the first release

- Gym mode and machine logging.
- Social feeds, leaderboards, avatars, body scans.
- Server-side video analysis.
- A live coach or general-purpose AI chat.

See `decisions.md` for the reasons behind the big calls.
