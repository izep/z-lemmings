'use strict';
// Solver for Level 5: "The Gauntlet" (quota 83% = 10/12)
// Route:
//   1. Assign CLIMBER to pioneer (lem #1) so it climbs over the Earth Retaining Curb
//      (x=330..365, y=215..260) while the rest of the crowd stays penned safely behind it.
//   2. Pioneer chains 2 BUILDER bridges from (505, 260) and (565, 236) across the
//      lava chasm (x=510..610) onto the Central Bastion (y=240).
//   3. At (670, 240), pioneer becomes BASHER #1 to tunnel through Earth Wall #1
//      (x=675..745, y=150..240) so non-climber crowd lemmings can pass.
//   4. After dropping onto the Gauntlet Hallway floor (y=310), pioneer becomes DIGGER
//      at (810, 310) before Crusher #1 (x=850), digging down to the steel sub-floor (y=375).
//   5. On hitting steel at (810, 375), pioneer becomes BASHER #2 to carve a horizontal
//      tunnel (x=810..1070, y=375) beneath both crushers and Earth Wall #2 to the exit (1100, 375).
//   6. Assign BASHER #3 to a right-walking crowd lemming at (326, 260) to breach the
//      Earth Retaining Curb and release the remaining 11 lemmings along the prepared route.
const { LemmingsEngine } = require('../game.js');
const LEVELS = require('../levels.js');

const eng = new LemmingsEngine({ headless: true });
eng.loadLevel(LEVELS[4], 4);

let pioneer = null;
let bridge1 = false;
let bridge2 = false;
let bastionBash = false;
let hallwayDig = false;
let crusherBash = false;
let curbBash = false;
let ticks = 0;

while (!eng.finished && ticks < 20000) {
  for (const l of eng.lemmings) {
    if (l.removed) continue;

    // 1. Climber pioneer over the retaining curb
    if (!pioneer && l.id === 1 && l.state === 'WALKING' && l.dir === 1 && l.x === 250) {
      if (eng.assignSkill(l, 'climber')) {
        pioneer = l;
        console.log(`tick ${ticks}: climber -> lem #${l.id} at (${l.x}, ${l.y})`);
      }
    }

    if (l === pioneer) {
      // 2a. First bridge from chasm edge
      if (!bridge1 && l.state === 'WALKING' && l.dir === 1 && l.x === 505 && l.y === 260) {
        if (eng.assignSkill(l, 'builder')) {
          bridge1 = true;
          console.log(`tick ${ticks}: builder #1 -> lem #${l.id} at (${l.x}, ${l.y})`);
        }
      }

      // 2b. Second chained bridge to reach Central Bastion (x=610, y=240)
      if (bridge1 && !bridge2 && l.state === 'WALKING' && l.dir === 1 && l.x >= 560) {
        if (eng.assignSkill(l, 'builder')) {
          bridge2 = true;
          console.log(`tick ${ticks}: builder #2 -> lem #${l.id} at (${l.x}, ${l.y})`);
        }
      }

      // 3. Bash through Earth Wall #1 on the Central Bastion (x=675..745, y=240)
      if (bridge2 && !bastionBash && l.state === 'WALKING' && l.dir === 1 && l.x === 670 && l.y === 240) {
        if (eng.assignSkill(l, 'basher')) {
          bastionBash = true;
          console.log(`tick ${ticks}: basher #1 (bastion wall) -> lem #${l.id} at (${l.x}, ${l.y})`);
        }
      }

      // 4. Dig down to the steel sub-floor (y=375) before Crusher #1 (x=850)
      if (bastionBash && !hallwayDig && l.state === 'WALKING' && l.dir === 1 && l.x === 810 && l.y === 310) {
        if (eng.assignSkill(l, 'digger')) {
          hallwayDig = true;
          console.log(`tick ${ticks}: digger -> lem #${l.id} at (${l.x}, ${l.y})`);
        }
      }

      // 5. Bash horizontally under both crushers along the steel sub-floor (y=375)
      if (hallwayDig && !crusherBash && l.state === 'WALKING' && l.dir === 1 && l.y === 375) {
        if (eng.assignSkill(l, 'basher')) {
          crusherBash = true;
          console.log(`tick ${ticks}: basher #2 (under crushers) -> lem #${l.id} at (${l.x}, ${l.y})`);
        }
      }
    }

    // 6. Breach the Earth Retaining Curb (x=330..365) to release the crowd
    if (crusherBash && !curbBash && l !== pioneer && l.state === 'WALKING' && l.dir === 1 && l.x === 326 && l.y === 260) {
      if (eng.assignSkill(l, 'basher')) {
        curbBash = true;
        console.log(`tick ${ticks}: basher #3 (release curb) -> lem #${l.id} at (${l.x}, ${l.y})`);
      }
    }
  }

  eng.step();
  ticks++;
}

console.log(
  `L5 result: ticks=${ticks} saved=${eng.savedCount}/${LEVELS[4].lemmingCount} lost=${eng.lostCount} won=${eng.won} finished=${eng.finished}`
);
process.exit(eng.won ? 0 : 1);
