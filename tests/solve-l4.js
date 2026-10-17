'use strict';
// Solver for Level 4: "Hold the Line" (quota 80% = 12/15)
// Route:
//   1. Lead lemming (#1) becomes BLOCKER at (545, 260) before the lava cauldron (x=570).
//   2. Next right-walking lemming (#4) becomes MINER at (380, 260), tunneling diagonally
//      under the cauldron's steel tray (bottom y=320) into the Lower Escape Gallery (y=430).
//      Lemmings that bounced off the blocker walk back to the left steel wall (x=180) and
//      descend straight into the miner tunnel.
//   3. At the end of the Miner #1 steel landing pad (x=796, y=430), assign MINER #2 to
//      tunnel beneath the timed gallery crusher (x=825..853, headBottom=430) down to the
//      Final Exit Gallery steel floor (y=465), leading straight to the exit at (1060, 465).
//   4. Once all 14 other lemmings have entered the tunnel, assign BOMBER to the lone
//      blocker at (545, 260) so the level resolves immediately with 14/15 saved (93%).
const { LemmingsEngine } = require('../game.js');
const LEVELS = require('../levels.js');

const eng = new LemmingsEngine({ headless: true });
eng.loadLevel(LEVELS[3], 3);

let blockerLem = null;
let miner1Assigned = false;
let miner2Assigned = false;
let blockerBombed = false;
let ticks = 0;

while (!eng.finished && ticks < 20000) {
  for (const l of eng.lemmings) {
    if (l.removed) continue;

    // 1. Hold the line before the lava cauldron (x=570)
    if (!blockerLem && l.state === 'WALKING' && l.dir === 1 && l.x === 545 && l.y === 260) {
      if (eng.assignSkill(l, 'blocker')) {
        blockerLem = l;
        console.log(`tick ${ticks}: blocker -> lem #${l.id} at (${l.x}, ${l.y})`);
      }
    }

    // 2. Tunnel diagonally under the lava cauldron (x <= 440 clears steel tray at y=320)
    if (blockerLem && !miner1Assigned && l.state === 'WALKING' && l.dir === 1 && l.x === 380 && l.y === 260) {
      if (eng.assignSkill(l, 'miner')) {
        miner1Assigned = true;
        console.log(`tick ${ticks}: miner #1 -> lem #${l.id} at (${l.x}, ${l.y})`);
      }
    }

    // 3. Tunnel under the gallery crusher starting just past the steel pad (x=795, y=430)
    if (!miner2Assigned && l.state === 'WALKING' && l.dir === 1 && l.x === 796 && l.y === 430) {
      if (eng.assignSkill(l, 'miner')) {
        miner2Assigned = true;
        console.log(`tick ${ticks}: miner #2 -> lem #${l.id} at (${l.x}, ${l.y})`);
      }
    }
  }

  // 4. Dismiss the upper-deck blocker once all other lemmings are inside the tunnel
  if (blockerLem && !blockerBombed && eng.spawnedCount === LEVELS[3].lemmingCount) {
    const othersOnUpperDeck = eng.lemmings.some(
      (l) => !l.removed && l !== blockerLem && l.y <= 265
    );
    if (!othersOnUpperDeck && eng.assignSkill(blockerLem, 'bomber')) {
      blockerBombed = true;
      console.log(`tick ${ticks}: bomber -> blocker lem #${blockerLem.id} at (${blockerLem.x}, ${blockerLem.y})`);
    }
  }

  eng.step();
  ticks++;
}

console.log(
  `L4 result: ticks=${ticks} saved=${eng.savedCount}/${LEVELS[3].lemmingCount} lost=${eng.lostCount} won=${eng.won} finished=${eng.finished}`
);
process.exit(eng.won ? 0 : 1);
