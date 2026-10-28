# Gameplay Systems & Milestone Plan

## Time
Daytime only (no night, by design): game day 06:45 → 17:36 in 48 real minutes (`DAY_HOURS`, `gameTime`).
Phases (`dayPhase`): morning < 10:30 · midday < 13:30 · afternoon < 16:00 · evening ≤ 17:36. NPC director, ambience and
activities key off these phases.

## Existing systems (verified working in earlier passes)
Character creator (Thai/English) · onboarding intro + faculty tutorial + smart advisor (`coach.js`) · main/daily/side quests ·
12 part-time jobs with mini-games · classes with GPA · clubs · 10 shops, clothes, barber · vehicles (bicycle share, rental,
8 buyable types) with fuel · phone (chat, map/GPS, jobs, quests, bank, profile, bag, wardrobe, garage, KU Eats, camera,
radio, players, flowers, settings, help) · life simulation · traffic · 3-D audio · 25 collectible flowers.

## Milestones and dependencies
| # | Milestone | Depends on | Notes |
|---|---|---|---|
| 0 | Protection & architecture audit | — | done 2026-10-28 (backups, audit, docs, graphics lock) |
| 1 | Immediate audio fixes | 0 | done 2026-10-28 (bicycle, phase ambience, place sounds, music sets) |
| 2 | Persistence, profiles, sessions, playtime | 0 | ✅ embedded SQLite, server economy, sessions, owner trainer — `docs/DATABASE.md` (70/70 automated checks) |
| 3 | Housing & vehicle ownership, safe spawns | 2 | room instances per building, parking anchors |
| 4 | Smartphone social (contacts, friends, DMs, feed) | 2 | ✅ round 1: NPC circle, friends, DMs, invites, KU Feed + photos, report/block |
| 5 ✅ | Economy & business (catalog ≥ 50 SKUs) | 2 | ledger + server wages already done in M2 |
| 6 ✅ | Delivery, ride hailing, GPS verification | 5, 3 | server-side job state machine |
| 7 ✅ | Vehicle catalog (Camry Hybrid, Civic, 3 Series, AMG GT; Click, Vespa 150i, Forza, PCX) + tuning | 3, 5 | original models, specs verified |
| 8 | NPC network, memory, dialogue | 2, 4 | see SOCIAL_SIMULATION.md |
| 9 ✅ | Recreation & environment life (football, basketball, fishing, animals, aircraft) | 1 | shared sessions need 2 |
| 10 | Full integration (activity director, achievements, events) | 2–9 | |
| 11 | Proximity voice & device validation | 2, TURN infra | iPhone/Android/iPad on real devices |

## Acceptance (per feature)
Works · integrated with existing systems · multiplayer where relevant · persisted · secure · desktop + mobile · sound ·
graphics baseline unchanged · no performance regression · loading/error/success states · edge cases · tests documented ·
docs updated. Never "production ready" without evidence.
