(function (root) {
  'use strict';

  const LEVELS = [
    // =========================================================================
    // LEVEL 1: "First Steps"
    // Gentle tutorial: one water gap to bridge with builders. Quota 50%.
    // =========================================================================
    {
      id: 1,
      name: 'First Steps',
      subtitle: 'Bridge the emerald chasm to reach the ancient portal.',
      hint: 'Select BUILDER and tap a lemming near the chasm edge. Two bridges will span the gap!',
      lemmingCount: 10,
      saveQuota: 50,
      releaseRate: 40,
      minReleaseRate: 20,
      timeLimit: 180,
      theme: {
        bgTop: '#0d1520',
        bgBottom: '#182638',
        dirtMain: '#7c5333',
        dirtDark: '#56371e',
        dirtLight: '#9e6d47',
        crustTop: '#3ca352',
        crustHighlight: '#63cc78',
        rockAccent: '#3f4d5e'
      },
      trapdoor: { x: 250, y: 340, dir: 1 },
      exit: { x: 980, y: 400 },
      skills: {
        climber: 2,
        floater: 2,
        bomber: 2,
        blocker: 2,
        builder: 6,
        basher: 2,
        miner: 2,
        digger: 2
      },
      terrain: [
        // Ceiling cavern arches
        { type: 'rect', x: 0, y: 0, w: 1280, h: 70, style: 'rock', crust: false },
        { type: 'circle', cx: 180, cy: 70, r: 45, style: 'rock' },
        { type: 'circle', cx: 590, cy: 65, r: 55, style: 'rock' },
        { type: 'circle', cx: 1020, cy: 70, r: 50, style: 'rock' },

        // Left starting plateau (top at y = 420)
        { type: 'rect', x: 100, y: 420, w: 440, h: 240, style: 'dirt', crust: true },
        // Decorative stepped terrace on far left
        { type: 'rect', x: 100, y: 340, w: 70, h: 85, style: 'dirt', crust: true },

        // Central basin floor beneath the water hazard
        { type: 'rect', x: 490, y: 590, w: 200, h: 90, style: 'rock', crust: false },

        // Right exit plateau (top at y = 400)
        { type: 'rect', x: 640, y: 400, w: 510, h: 260, style: 'dirt', crust: true },
        // Decorative pillar behind exit
        { type: 'rect', x: 1090, y: 310, w: 60, h: 95, style: 'dirt', crust: true }
      ],
      steel: [
        // Left containment bumper so walkers turn right
        { x: 100, y: 260, w: 40, h: 160 },
        // Right containment bumper
        { x: 1110, y: 250, w: 40, h: 150 },
        // Chasm basin walls
        { x: 510, y: 550, w: 30, h: 80 },
        { x: 640, y: 550, w: 30, h: 80 }
      ],
      hazards: [
        { type: 'water', x: 540, y: 560, w: 100, h: 45 }
      ]
    },

    // =========================================================================
    // LEVEL 2: "Down Under"
    // Digger + basher through thick earth strata to the underground exit.
    // =========================================================================
    {
      id: 2,
      name: 'Down Under',
      subtitle: 'Dig through the strata and bash across subterranean walls.',
      hint: 'Steel blocks stop diggers automatically! Dig down to each steel floor, then BASH right.',
      lemmingCount: 15,
      saveQuota: 66,
      releaseRate: 45,
      minReleaseRate: 25,
      timeLimit: 210,
      theme: {
        bgTop: '#19120c',
        bgBottom: '#2b1d12',
        dirtMain: '#9c6234',
        dirtDark: '#6e411d',
        dirtLight: '#c2834f',
        crustTop: '#d49b4b',
        crustHighlight: '#ecc078',
        rockAccent: '#543d2b'
      },
      trapdoor: { x: 240, y: 220, dir: 1 },
      exit: { x: 1030, y: 470 },
      skills: {
        climber: 0,
        floater: 0,
        bomber: 3,
        blocker: 2,
        builder: 3,
        basher: 5,
        miner: 2,
        digger: 5
      },
      terrain: [
        // Cavern roof
        { type: 'rect', x: 0, y: 0, w: 1280, h: 80, style: 'rock', crust: false },

        // Massive subterranean earth block spanning the whole middle of the level
        { type: 'rect', x: 140, y: 300, w: 1000, h: 280, style: 'dirt', crust: true },
        // Upper right overburden
        { type: 'rect', x: 520, y: 170, w: 620, h: 135, style: 'dirt', crust: true },

        // Carve out Tier 1 Lower Gallery beneath the 35px diggable floor (x: 180..480, y: 335..385)
        { type: 'carveRect', x: 180, y: 335, w: 300, h: 50 },

        // Carve out Tier 2 Middle Chamber (x: 610..770, floor at y = 385)
        { type: 'carveRect', x: 610, y: 270, w: 160, h: 115 },

        // Carve out Tier 2 Lower Gallery beneath the 35px diggable floor (x: 610..770, y: 420..470)
        { type: 'carveRect', x: 610, y: 420, w: 160, h: 50 },

        // Carve out Tier 3 Exit Cavern (x: 890..1110, floor at y = 470)
        { type: 'carveRect', x: 890, y: 330, w: 220, h: 140 }
      ],
      steel: [
        // Left outer wall
        { x: 140, y: 150, w: 40, h: 410 },
        // Tier 1 right steel barrier (forces player to dig down from y=300 first)
        { x: 480, y: 150, w: 40, h: 155 },
        // Tier 2 steel floor plate (stops Digger #1 cleanly at y=385)
        { x: 180, y: 385, w: 340, h: 30 },
        // Tier 2 right steel barrier (forces player to dig down from y=385)
        { x: 770, y: 230, w: 40, h: 160 },
        // Tier 3 steel floor plate (stops Digger #2 cleanly at y=470 and forms cavern floor)
        { x: 580, y: 470, w: 540, h: 35 },
        // Far right steel wall behind exit
        { x: 1110, y: 330, w: 35, h: 210 }
      ],
      hazards: [
        // Decorative sealed magma pocket on far left & right abyss
        { type: 'lava', x: 1145, y: 535, w: 110, h: 55 }
      ]
    },

    // =========================================================================
    // LEVEL 3: "High Dive"
    // Floaters over a chasm; climbers up a wall. No spare margin (100% quota).
    // =========================================================================
    {
      id: 3,
      name: 'High Dive',
      subtitle: 'Float down the abyssal drop and scale the sheer cliff.',
      hint: 'Every lemming counts (100% quota)! Give each lemming a FLOATER on the dive and a CLIMBER at the cliff.',
      lemmingCount: 6,
      saveQuota: 100,
      releaseRate: 20,
      minReleaseRate: 15,
      timeLimit: 210,
      theme: {
        bgTop: '#0b1929',
        bgBottom: '#132d46',
        dirtMain: '#4b6b8a',
        dirtDark: '#314961',
        dirtLight: '#6b90b3',
        crustTop: '#8ad4eb',
        crustHighlight: '#c6f1ff',
        rockAccent: '#263a4d'
      },
      trapdoor: { x: 220, y: 105, dir: 1 },
      exit: { x: 1000, y: 330 },
      skills: {
        climber: 6,
        floater: 6,
        bomber: 0,
        blocker: 0,
        builder: 2,
        basher: 1,
        miner: 0,
        digger: 0
      },
      terrain: [
        // High Dive cliff tower on left (top at y = 170)
        { type: 'rect', x: 140, y: 170, w: 280, h: 40, style: 'dirt', crust: true },
        { type: 'rect', x: 140, y: 210, w: 170, h: 370, style: 'rock', crust: false },

        // Valley Landing Pad at bottom (top at y = 500, x: 340..740)
        { type: 'rect', x: 340, y: 500, w: 400, h: 140, style: 'dirt', crust: true },

        // Sheer Vertical Climb Wall at x = 740 (rises from y = 500 up to y = 330, zero overhang!)
        { type: 'rect', x: 740, y: 330, w: 400, h: 310, style: 'dirt', crust: true }
      ],
      steel: [
        // Left wall on High Dive boardwalk
        { x: 140, y: 80, w: 35, h: 95 },
        // Left retaining curb on Valley Landing Pad so walkers bounce safely back toward the climb wall
        { x: 340, y: 455, w: 30, h: 50 },
        // Right wall behind Exit Plateau
        { x: 1105, y: 220, w: 35, h: 115 }
      ],
      hazards: [
        // Deep water lakes flanking the valley landing pad
        { type: 'water', x: 310, y: 565, w: 30, h: 65 },
        { type: 'water', x: 1140, y: 565, w: 120, h: 65 }
      ]
    },

    // =========================================================================
    // LEVEL 4: "Hold the Line"
    // Blockers to contain the crowd while miners dig the escape. Includes Crusher!
    // =========================================================================
    {
      id: 4,
      name: 'Hold the Line',
      subtitle: 'Hold the crowd back from the lava cauldron while miners tunnel below.',
      hint: 'Place a BLOCKER near the right edge before the lava, then assign a MINER to tunnel diagonally under the cauldron!',
      lemmingCount: 15,
      saveQuota: 80,
      releaseRate: 58,
      minReleaseRate: 40,
      timeLimit: 210,
      theme: {
        bgTop: '#161421',
        bgBottom: '#262138',
        dirtMain: '#6e5c7a',
        dirtDark: '#483b52',
        dirtLight: '#8e799c',
        crustTop: '#b88648',
        crustHighlight: '#deb06d',
        rockAccent: '#352d3d'
      },
      trapdoor: { x: 240, y: 185, dir: 1 },
      exit: { x: 1060, y: 465 },
      skills: {
        climber: 1,
        floater: 1,
        bomber: 2,
        blocker: 4,
        builder: 3,
        basher: 2,
        miner: 5,
        digger: 2
      },
      terrain: [
        // Ceiling structure
        { type: 'rect', x: 0, y: 0, w: 1280, h: 75, style: 'rock', crust: false },

        // Main earth massif (top at y = 260)
        { type: 'rect', x: 140, y: 260, w: 640, h: 270, style: 'dirt', crust: true },

        // Carve out the Lava Cauldron notch on top-right of the massif (x: 570..780, y: 255..310)
        { type: 'carveRect', x: 570, y: 250, w: 215, h: 60 },

        // Lower Escape Gallery roof & floor extension (x: 640..1150)
        { type: 'rect', x: 640, y: 260, w: 510, h: 95, style: 'rock', crust: false },
        { type: 'rect', x: 640, y: 430, w: 220, h: 35, style: 'dirt', crust: true },
        { type: 'rect', x: 640, y: 465, w: 510, h: 95, style: 'dirt', crust: true },

        // Carve out the Lower Escape Gallery interior (x: 650..860 at y=355..430, and x: 860..1130 down to y=465)
        { type: 'carveRect', x: 650, y: 355, w: 480, h: 75 },
        { type: 'carveRect', x: 860, y: 425, w: 270, h: 40 }
      ],
      steel: [
        // Left containment wall on upper deck
        { x: 140, y: 130, w: 40, h: 140 },
        // Steel tray beneath the Lava Cauldron (bottom at y = 320, so Miners starting at x <= 440 pass cleanly underneath!)
        { x: 570, y: 305, w: 210, h: 15 },
        { x: 765, y: 265, w: 15, h: 55 },
        // Steel landing pad for Miner #1 (x: 640..795, stops Miner #1 at y = 430)
        { x: 640, y: 430, w: 155, h: 25 },
        // Steel floor of the Final Exit Gallery (at y = 465, stops Miner #2 under the crusher cleanly!)
        { x: 795, y: 465, w: 350, h: 30 },
        // Right backstop wall behind exit
        { x: 1120, y: 350, w: 30, h: 120 }
      ],
      hazards: [
        // Bubbling Lava Cauldron just off the upper deck's right cliff
        { type: 'lava', x: 575, y: 275, w: 190, h: 30 },
        // Timed Crusher Trap in the Lower Escape Gallery
        {
          type: 'crusher',
          x: 825,
          y: 355,
          w: 28,
          h: 18,
          range: 57,
          cycleTicks: 300,
          offsetTicks: 40
        }
      ]
    },

    // =========================================================================
    // LEVEL 5: "The Gauntlet"
    // Everything at once: crusher traps, lava chasm, tight quota, limited skills.
    // =========================================================================
    {
      id: 5,
      name: 'The Gauntlet',
      subtitle: 'Cross the volcanic chasm and outsmart the twin iron crushers.',
      hint: 'Send a CLIMBER pioneer over the dirt curb to BUILD across the lava, then DIG + BASH under the crushers before bashing the curb!',
      lemmingCount: 12,
      saveQuota: 83,
      releaseRate: 50,
      minReleaseRate: 35,
      timeLimit: 240,
      theme: {
        bgTop: '#1c0b0e',
        bgBottom: '#331217',
        dirtMain: '#70393f',
        dirtDark: '#4a2126',
        dirtLight: '#945057',
        crustTop: '#d9534f',
        crustHighlight: '#ff857a',
        rockAccent: '#3d1e24'
      },
      trapdoor: { x: 210, y: 185, dir: 1 },
      exit: { x: 1100, y: 375 },
      skills: {
        climber: 2,
        floater: 2,
        bomber: 2,
        blocker: 2,
        builder: 5,
        basher: 3,
        miner: 2,
        digger: 2
      },
      terrain: [
        // Volcanic ceiling
        { type: 'rect', x: 0, y: 0, w: 1280, h: 70, style: 'rock', crust: false },

        // Stage 1: Spawn Platform (x: 100..510, top at y = 260)
        { type: 'rect', x: 100, y: 260, w: 410, h: 320, style: 'dirt', crust: true },
        // Earth Retaining Curb (x: 330..365, y: 215..260 - holds crowd safely until bashed!)
        { type: 'rect', x: 330, y: 215, w: 35, h: 45, style: 'dirt', crust: true },

        // Stage 2: Lava Chasm basin (x: 510..610)
        { type: 'rect', x: 480, y: 555, w: 160, h: 80, style: 'rock', crust: false },

        // Stage 3: Central Bastion (x: 610..790, top at y = 240)
        { type: 'rect', x: 610, y: 240, w: 180, h: 340, style: 'dirt', crust: true },
        // Earth Wall #1 on Bastion (x: 675..745, y: 150..240)
        { type: 'rect', x: 675, y: 150, w: 70, h: 90, style: 'dirt', crust: true },

        // Stage 4: Gauntlet Hallway & Under-Crusher Earth Bed (x: 790..1070, top at y = 310, down to y = 375)
        { type: 'rect', x: 790, y: 310, w: 280, h: 65, style: 'dirt', crust: true },
        // Ceiling mount for Twin Crushers (x: 820..1060, y: 140..235)
        { type: 'rect', x: 820, y: 140, w: 240, h: 95, style: 'rock', crust: false },
        // Earth Wall #2 between Crushers (x: 915..980, y: 235..310)
        { type: 'rect', x: 915, y: 235, w: 65, h: 75, style: 'dirt', crust: false },

        // Stage 5: Final Exit Floor (x: 790..1170, top at y = 375)
        { type: 'rect', x: 790, y: 375, w: 380, h: 205, style: 'dirt', crust: true }
      ],
      steel: [
        // Left containment wall at spawn
        { x: 100, y: 120, w: 35, h: 145 },
        // Lava chasm side walls
        { x: 485, y: 500, w: 25, h: 80 },
        { x: 610, y: 500, w: 25, h: 80 },
        // Steel Sub-Floor under the Gauntlet Hallway (at y = 375, stops Digger cleanly at y = 375!)
        { x: 785, y: 375, w: 365, h: 30 },
        // Right containment wall behind Exit
        { x: 1145, y: 260, w: 30, h: 145 }
      ],
      hazards: [
        // Volcanic Lava Chasm
        { type: 'lava', x: 510, y: 520, w: 100, h: 45 },
        // Twin Timed Crusher Traps in the Gauntlet Hallway
        {
          type: 'crusher',
          x: 850,
          y: 235,
          w: 28,
          h: 18,
          range: 57,
          cycleTicks: 240,
          offsetTicks: 0
        },
        {
          type: 'crusher',
          x: 1005,
          y: 235,
          w: 28,
          h: 18,
          range: 57,
          cycleTicks: 240,
          offsetTicks: 120
        }
      ]
    }
  ];

  root.LEMMINGS_LEVELS = LEVELS;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LEVELS;
  }
})(typeof window !== 'undefined' ? window : globalThis);
