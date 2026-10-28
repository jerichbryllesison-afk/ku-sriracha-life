# Economy System

## Current values (from `shared/catalog.js`, `shared/economy.js`)
- Start money ฿2,000 · daily allowance ฿300 (once per game day = 48 real minutes) · scooter rental ฿150 · fuel ฿36/L.
- Services: hotel ฿450, condo night ฿650, gym ฿80, pool ฿30, clinic ฿300, futsal ฿40, hair colour ฿60.
- 12 jobs, pay ฿60–400 per shift (cafeteria, cashier, library, banquet, KU Eats rider, motorbike taxi, fuel, lab, TA,
  lifeguard, farm, barista), level / skill gated. Main quests 15, side quests 6 (daily), daily tasks 3 of 6 per day.
- Items 34 (food/drink/snacks/books), clothes 46, vehicles 8: bicycle ฿3,500 · Wave ฿39,000 · Click ฿56,000 ·
  CBR250 ฿145,000 · hatch ฿420,000 · pickup ฿690,000 · sedan ฿1.25 M · supercar ฿6.5 M.

## Fixed in Milestone 2 (tested by `npm run test:db`)
- ✅ Wages are computed by the server from a single-use shift ticket; the old client-amount `earn` RPC is rejected.
- ✅ Every money movement is a `ledger` row (delta, balance_after ≥ 0, kind, ref, counterparty); the ledger sums to the balance.
- ✅ Idempotency keys (`rid`) on purchases, claims, item use, transfers; job finish keyed by its ticket.
- ✅ One-time rewards are DB rows (PRIMARY KEY) — duplicate / replayed / concurrent claims cannot pay twice.
- ✅ XP and level are server-side: rewards grant XP with the payment; activity XP is whitelisted with caps, gaps, daily
  limits and a 5,000 XP / 10 min ceiling; level bonuses (level × ฿100) are paid by the server once per level.
- ✅ Daily tasks must be one of the server's 3 for the day; main quests must be claimed in order (money/level/purchase
  objectives verified server-side); flowers 0–24 only.
- ✅ Transfers are one transaction for both players and unlock at level 3 or 30 min playtime.

## Still open
- Prices are flat; no quality tiers; no selling back; no shop stock or opening hours (Milestone 5).
- Minigame scores are client-reported (clamped); visit/eat/study objectives are client events (bounded by one-time rewards).

## Target rules
- ✅ Every money movement is a server ledger entry; idempotency key per request (done in M2).
- Income bands (per real hour of focused play): starter jobs ≈ ฿3–5k, mid ≈ ฿6–9k, delivery/taxi with own vehicle ≈ ฿8–12k.
  → first scooter (≈฿40–60k) after ~2–4 h, mid car after ~1–2 days of play, luxury car is a long-term goal.
- Recurring costs keep money meaningful: food, fuel, housing tier, maintenance; never so high that a new player cannot
  afford food and transport from starter jobs.
- Player-to-player commerce (shops, deliveries) settles through server escrow: buyer pays on order, shop paid on pickup,
  rider paid on verified delivery, refund on cancel / timeout.

## Living campus additions (round 1, server-computed)
- Homes: dorm free (starter) · PT House ฿18,000 (Lv 3) · AA Residence ฿26,000 (Lv 4) · Kensington ฿95,000 (Lv 7) ·
  Notting Hill ฿120,000 (Lv 9) · Laemchabang Tower penthouse ฿280,000 (Lv 12). One-time lease; moving frees the old room.
- Own business: fried-snack stall ฿15,000 (Lv 2, margin 55 %) · rice kitchen ฿32,000 (Lv 4, margin 50 %). Order value is
  written by the server; pay = value × margin + tip (time + cooking score), capped.
- KU Ride: ride fare 35 + 0.17/m (+30 on time, cap ฿630) · NPC hail 30 + 0.11/m (cap ฿450) · player food-order fee
  20 + 0.06/m (฿20–180) held in escrow with the food price.

## Rounds 2–3 additions (server-computed)
- Vehicles (approx. Thai list prices, level-gated): Click ฿62,000 (Lv 3) · PCX ฿95,000 (Lv 4) · Vespa ฿125,000 (Lv 5) ·
  Forza ฿189,000 (Lv 7) · Civic e:HEV ฿1.19 M (Lv 10) · Camry HEV ฿1.55 M (Lv 12) · BMW 330e ฿2.99 M (Lv 18) ·
  AMG GT 63 ฿15.9 M (Lv 30).
- Tuning (at the garage only): part price = base[class][part] × next level; paint = base paint; repair = max(฿50,
  (1 − condition) × base repair).
- KU Shop: catalog prices, ≤ 12 items per order, ฿40 shipping under ฿1,000; parcel delivered by the server timer.
- Fishing: weighted catch table, 18 s cooldown, 40 casts/day; sale only near the market/seafood stall.
- Campus events: ฿150 + 80 XP once per event (claim row `event:<id>`).
- Player rides: fare 35 + 0.16/m (฿40–600) escrowed from the passenger; paid to the driver at the destination, refunded
  on cancel/expiry.
