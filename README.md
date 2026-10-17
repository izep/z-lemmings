# Lemmings Cavern Rescue

A web-based clone of the classic Lemmings puzzle game — guide your lemmings
through 5 original cavern levels using 8 classic skills (climber, floater,
bomber, blocker, builder, basher, miner, digger).

## Play

The game is deployed with GitHub Pages — just open the site URL.

On iPhone: open the URL in Safari, tap Share, then **Add to Home Screen**
to install it as a standalone app (works offline after the first visit).

## Controls

- **Tap a skill** in the skill bar, then **tap a lemming** to assign it.
- **Pinch / two-finger drag** to zoom and pan, double-tap to reset the view.
- HUD: release rate +/−, pause, 2× fast-forward, restart, nuke.

## Develop

No build step — plain HTML5 Canvas + JavaScript.

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

Headless test suite (engine simulation, all 5 levels proven beatable):

```sh
node tests/headless-verify.js
```

All levels are original designs in a classic style.
