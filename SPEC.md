# Lemmings Clone — Build Spec (v1)

## Goal
A web-based clone of the classic Lemmings game, playable on iPhone and
installable as a home-screen web app (PWA). All levels, art, and sound must
be ORIGINAL — do not copy DMA Design's levels, sprites, or music.

## Deliverables (all inside ~/workspace/game/)
- `index.html` — page shell, canvas, HUD/skill bar UI, PWA meta tags, manifest link
- `game.js` — engine + all game logic (may split into `engine.js`, `levels.js` if cleaner)
- `manifest.webmanifest` — PWA manifest
- `sw.js` — service worker, offline-first, caches every local file (version the cache)
- Icon files are referenced but will be provided separately — reference
  `icon-192.png`, `icon-512.png` (maskable), and `apple-touch-icon.png`.
  Do NOT hotlink any external assets. The game must work fully offline and
  from `file://` as well as `http://`.

## Tech approach
- Vanilla HTML5 Canvas + plain JavaScript. No frameworks, no build step,
  no external network dependencies.
- Fixed-timestep game loop (e.g. 60 Hz logic), render each rAF.
- Destructible terrain: keep terrain on an offscreen canvas; erase with
  `destination-out` for basher/miner/digger/bomber/builder-bricks.
  Collision: sample alpha of terrain canvas (plus a steel layer).
- Steel (indestructible) blocks: separate offscreen canvas or flagged rect
  list — basher/miner/digger/bomber cannot destroy steel.
- All art drawn procedurally on canvas in a chunky pixel-art style
  (blocky lemmings with colored hair, textured dirt, riveted steel,
  animated water/lava, trapdoor, exit portal). No image files.
- Sound: tiny WebAudio oscillator bleeps (assign, splat, explosion,
  save, win jingle, background tick optional). Mute toggle. No audio files.
- Handle `devicePixelRatio` for crisp rendering. Prevent page scroll/zoom
  gestures on the canvas; support pinch-zoom and drag-pan on the level,
  double-tap to reset view. Landscape-first layout with a polite
  "rotate your phone" hint in portrait.

## Core mechanics (classic rules)
- Lemmings spawn from the trapdoor at the release-rate interval, walk in
  their facing direction, turn around at walls, blockers, and level edges.
- Step down small drops; bigger drops become falls. Falls beyond the fatal
  distance splat — unless the lemming is a Floater (umbrella opens, drifts
  down safely).
- The 8 skills, with classic behavior:
  - Climber: climbs vertical walls; falls off if there's an overhang.
  - Floater: survives any fall via umbrella.
  - Bomber: 5-second "Oh no!" countdown, then explodes — carves terrain
    in a radius and removes lemmings caught in the blast.
  - Blocker: stands still; other walkers turn around on contact.
  - Builder: lays a 12-brick staircase upward-forward; stops if head is blocked.
  - Basher: tunnels horizontally; stops at steel or open air.
  - Miner: tunnels diagonally downward; stops at steel or open air.
  - Digger: digs straight down; stops at steel, falls through openings.
- Skill assignment: tap a skill in the skill bar (shows remaining count),
  then tap a lemming. Classic assignment restrictions apply (e.g. no
  re-assigning an active skill; bomber works on almost anyone).
- HUD: skill bar with counts, release-rate -/+, pause, fast-forward toggle
  (2x), restart level, nuke (kill all, classic!), timer, saved count /
  quota, lemmings remaining to spawn.
- Win a level by saving at least the quota % before time runs out.
  Win screen shows % saved and best %; unlocks the next level.
  Progress, best scores, and settings persist in localStorage.
- Hazards: water (drown) and lava (burn) zones; simple timed crusher traps
  in at least two levels.

## Levels (5, original designs, escalating difficulty)
Author levels in a fixed logical coordinate space (e.g. 1280x720 units).
Define terrain from rect/circle/polygon primitives plus steel rects,
trapdoor position, exit position, lemming count, spawn interval,
skill counts, save quota, time limit, and hazard zones.
- L1 "First Steps" — gentle tutorial: one gap to bridge with builders. Quota ~50%.
- L2 "Down Under" — digger + basher through thick earth to the exit.
- L3 "High Dive" — floaters over a chasm; climbers up a wall. No spare margin.
- L4 "Hold the Line" — blockers to contain the crowd while miners dig the escape.
- L5 "The Gauntlet" — everything at once: traps, lava, tight quota, limited skills.

## iPhone / PWA requirements
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`,
  `apple-touch-icon` (180px), `theme-color`.
- Manifest: name, short_name, start_url ".", display "standalone",
  orientation "landscape", theme/background colors, icons 192 + 512 (maskable).
- Touch-first: big tap targets in the skill bar, tap-tap assignment,
  no hover-dependent mechanics.

## Acceptance criteria
- Page loads with zero console errors; all 5 levels start, play, and are
  completable with the given skills (sanity-check each level's solution path).
- Installable: manifest + service worker valid, works offline after first load.
- 60fps-ish on a phone; no external requests.
