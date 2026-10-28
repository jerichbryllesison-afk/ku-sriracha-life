# Social Simulation (NPCs, dialogue, relationships)

## Current
- `life.js` LifeSim: up to 64 local agents spawned by a time-of-day director (students walking to classes, eating at food
  courts, chatting in pairs on benches, football / takraw, joggers, vendors with queues, motorbike-taxi stand, guard),
  A* on the walkway graph, animation LOD, despawn > 200 m. Agents are anonymous (random name/look each spawn), no memory.
- `npcs.js`: quest givers for 6 side quests at fixed buildings.
- Dialogue: short random lines per context (`LINES[kind]`), speech bubbles; audio murmur with turn-taking (soundworld.js).
- Phone: global chat only; no contacts, DMs, NPC messages, family.

## Target (Milestone 8)
- Persistent named NPC network per player, generated deterministically from the player id (seeded) + stored state:
  roommate, 2–3 faculty classmates, a senior (P'), a junior (N'), sports friend, work colleague, shop owner, family
  (structure varies: parents / guardian / siblings / relatives).
- Each NPC: personality (5–6 traits), interests, schedule (by day phase), role, speech style (politeness particles,
  slang level), phone habits (message frequency cap), relationship score with the player, structured memory
  (met, activities done together, favours, promises, last topics — bounded list).
- Dialogue: authored Thai lines with variables and conditions (relationship, place, time, recent memory), choices that
  change relationship / create appointments; no generic AI-sounding text; cooldowns and a global notification budget.
- Life agents near the player can be "promoted" to known NPCs when they are part of the player's network
  (e.g. a classmate walks to the same lecture).

## Personal circle (implemented, round 1)
`public/js/society.js` builds, from the player's own seed, a family (mom, dad, older/younger sibling with hometown and jobs)
and six friends (classmate, dorm neighbour, faculty senior, club friend, work buddy, high-school best friend), each with a
role, faculty/year, side job and personality. A scheduler (70–140 s) picks a situation that fits the hour, weather and the
player's state (money, hunger, energy, level-up, just worked); at most one message per contact per 4 min, one call per 6 min.
Replies change closeness (0–100, stored in the client-owned `social` blob, capped at 16 KB server-side), mood and give a
little server-validated "talk" XP. "Meet" invites set GPS; arriving within 22 m gives mood + activity XP. NPC friends post
on KU Feed's NPC tab. All text is hand-written (Thai + English); no generated dialogue at runtime.

## Rounds 2–3
- Greeter (`greet.js`): every 65–130 s a nearby walking student/local/athlete may walk up, wave and say a time-of-day line
  (hand-written Thai/English), then resume their route.
- Campus events (`server/events.js`): shared server events every 5–10 min; everyone online gets a notification with GPS.
- Proximity voice (`voice.js`): opt-in, P2P, speaking players are listed on screen.
