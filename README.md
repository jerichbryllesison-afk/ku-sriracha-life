# KU Sriracha Life — Online 🎓🌼

An online, GTA-style student life simulator on the **real map of Kasetsart University Sriracha** (built from your `campus_light.glb` map data, at true 1:1 scale — about 2.6 km × 1.9 km).
One shared world, **max 100 players**, chat, money, jobs, classes, clothes, motorbikes & cars.

## Play on your PC
1. Install **Node.js 18+** (https://nodejs.org).
2. Double-click **`start.bat`** (Windows) — or run:
   ```
   npm install
   npm start
   ```
3. Open **http://localhost:3000** in Chrome/Edge.
   Friends on the same Wi-Fi can join with `http://YOUR-PC-IP:3000`.

## Put it on a website (free)
Any Node host works (Render, Railway, Fly.io, a VPS):
- Build command: `npm install`  ·  Start command: `npm start`
- The server reads `PORT` automatically. Saves go to `data/players.json` (set `DATA_DIR` to a persistent disk on your host).
- Open the site URL — that's it. The client also runs **offline (single-player)** if no server is reachable.

## Controls
| Key | Action |
|---|---|
| WASD | Move / drive |
| Shift / C | Sprint / walk |
| Space | Jump · handbrake drift |
| E | Interact (doors, shops, NPCs, benches) |
| F | Enter / exit vehicle |
| P | Phone (Jobs, GPS, Bank, Garage, Quests, Chat, Camera, Radio, Settings) |
| M | Full map + GPS waypoint |
| T / Enter | Chat |
| G | Emotes · V first-person · H horn/help · Mouse wheel zoom |

## What's inside
- Real map: Sukhumvit Road, the KU campus, the forest hill with the **KU SRIRACHA** viewpoint, housing estates, the railway, plus the **Ao Udom** beach & pier.
- Official KU Sriracha building names (Library, Central Cafeteria, Lecture Centers, Faculty of Engineering/Science/Management Sciences/Economics/Maritime, dorms, gym, pool, stadium…).
- Needs (health, energy, hunger, mood), XP & levels (60), skills (INT/FIT/CHA/DRV), GPA & credits.
- 12 part-time jobs with mini-games (cafeteria, 24 Mart cashier, library, banquet staff, KU Eats delivery, motorbike taxi, lab/TA, lifeguard, barista, farm, fuel).
- Classes with quizzes (real RASE course names), clubs, 15-step main story, side tasks, daily quests, 25 hidden golden Nonsi flowers.
- Shops: cafeteria Thai food, 24 Mart, café, food street, moo kata, seafood, Co-op uniforms, fashion, barber, bank, gas station, KU Moto & Siam Motors (bicycle → supercar), scooter rental, free campus bike share.
- Traffic (keep-left), pedestrians, day/night cycle synced for everyone, weather (rain, thunder), procedural audio & lo-fi radio.
- Graphics presets (Low → Ultra) with FPS locked to 60.

## Project layout
```
server.js            online server (socket.io, saves, economy, chat)
public/index.html    game client
public/js/*.js       game code (three.js, no build step)
public/shared/*.js   catalog + economy rules (shared with the server)
public/data/*        real map data generated from campus_light.glb
tools/build_map.py   regenerates public/data from the GLB (python + opencv + scipy + scikit-image)
```

## Play online with friends (free)
- Quick: double-click `share.bat` → copy the `https://….trycloudflare.com` link it prints and send it. Your PC must stay on; the link changes every time.
- 24/7: deploy to Render (free web service, `npm start`). It sleeps after 15 min idle and its disk is wiped on restart, so saves reset.
