const FOODS = [
  { name:'Lettuce', e:'🥬', herb:true,  fat:false, prot:false, highNut:true,  microFriend:true  },
  { name:'Carrot',  e:'🥕', herb:true,  fat:false, prot:false, highNut:true,  microFriend:true  },
  { name:'Apple',   e:'🍎', herb:true,  fat:false, prot:false, highNut:true,  microFriend:true  },
  { name:'Spinach', e:'🍃', herb:true,  fat:false, prot:false, highNut:true,  microFriend:true  },
  { name:'Avocado', e:'🥑', herb:true,  fat:true,  prot:false, highNut:true,  microFriend:true  },
  { name:'Nuts',    e:'🥜', herb:true,  fat:true,  prot:true,  highNut:true,  microFriend:true  },
  { name:'Rice',    e:'🍚', herb:true,  fat:false, prot:true,  highNut:true,  microFriend:true  },
  { name:'Beans',   e:'🫘', herb:true,  fat:false, prot:true,  highNut:true,  microFriend:true  },
  { name:'Beef',    e:'🥩', herb:false, fat:true,  prot:true,  highNut:true,  microFriend:false },
  { name:'Chicken', e:'🍗', herb:false, fat:false, prot:true,  highNut:true,  microFriend:true  },
  { name:'Fish',    e:'🐟', herb:false, fat:true,  prot:true,  highNut:true,  microFriend:true  },
  { name:'Pork',    e:'🥓', herb:false, fat:true,  prot:true,  highNut:true,  microFriend:false },
  { name:'Egg',     e:'🥚', herb:false, fat:false, prot:true,  highNut:true,  microFriend:true  },
];

let mode = 'herbivore';

function setMode(m) {
  mode = m;
  document.getElementById('sw-carn').classList.toggle('active', m==='carnivore');
  document.getElementById('sw-herb').classList.toggle('active', m==='herbivore');
  addLog(`CON SWITCH → ${m.toUpperCase()}`, m==='carnivore'?'lc-red':'lc-green');
}

// Build food grid
(function() {
  const grid = document.getElementById('food-grid');
  FOODS.forEach(f => {
    const el = document.createElement('div');
    el.className='food-item'; el.draggable=true;
    el.innerHTML=`<span class="fi-emoji">${f.e}</span><span class="fi-name">${f.name.toUpperCase()}</span>`;
    el.addEventListener('dragstart', ev => { ev.dataTransfer.setData('food', f.name); ev.dataTransfer.effectAllowed='copy'; });
    grid.appendChild(el);
  });
})();

const overlay = document.getElementById('drop-overlay');
overlay.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect='copy'; });
overlay.addEventListener('drop', e => {
  e.preventDefault();
  const food = FOODS.find(f=>f.name===e.dataTransfer.getData('food'));
  if (food) launchFood(food, e.clientX, e.clientY);
});

function addLog(msg, cls='lc-muted') {
  const log = document.getElementById('log');
  const d = document.createElement('div');
  d.className=`log-line ${cls}`; d.textContent=`> ${msg}`;
  log.appendChild(d); log.scrollTop=log.scrollHeight;
}

function addChip(id, emoji) {
  const row = document.getElementById(id);
  if (!row) return;
  const c = document.createElement('span');
  c.className='chip'; c.textContent=emoji; row.appendChild(c);
}

function pulse(id) {
  const n = document.getElementById(id);
  if (!n) return;
  n.classList.add('active');
  setTimeout(()=>n.classList.remove('active'), 700);
}

// ════════════════════════════════════════════════════════
//  TUBE-FLOW ENGINE
//  Bubbles follow the exact same L-shaped waypoint sequences
//  used to draw the SVG tubes. Movement is constant-speed
//  path-following — no gravity, no spring, just smooth flow
//  through each segment, with a brief pause at each node.
// ════════════════════════════════════════════════════════

const R          = 16;    // bubble radius px
const TUBE_SPEED = 1.8;   // px per frame along tube (slow, viscous feel)
const CORNER_R   = 12;    // px — arrival threshold at each waypoint corner

// ── Helpers ──────────────────────────────────────────────

// Screen-space coords of a node's centre (respects scroll)
function nodeScreen(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Screen-space coords of a pipeline element, relative to pipeline div
function pipelinePos(id) {
  const pip = document.getElementById('pipeline');
  const el  = document.getElementById(id);
  if (!pip || !el) return null;
  const pr = pip.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  return {
    x: er.left - pr.left + er.width  / 2,
    y: er.top  - pr.top  + er.height / 2,
    t: er.top  - pr.top,
    b: er.top  - pr.top  + er.height,
    l: er.left - pr.left,
    r: er.left - pr.left + er.width,
  };
}

// Convert screen-space coords to pipeline-relative coords
function screenToPipeline(sx, sy) {
  const pip = document.getElementById('pipeline');
  const pr  = pip.getBoundingClientRect();
  return { x: sx - pr.left, y: sy - pr.top };
}

// Trail particle (pipeline-relative)
function spawnTrail(x, y, color) {
  const d = document.createElement('div');
  d.className = 'trail-dot';
  d.style.cssText = `left:${x-2.5}px;top:${y-2.5}px;background:${color};opacity:0.55;`;
  document.getElementById('pipeline').appendChild(d);
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 300); }, 90);
}

// ── TubeBubble class ──────────────────────────────────────
// Walks a queue of {x,y} screen-space waypoints at constant speed.
// When the queue empties, fires onDone().
class TubeBubble {
  constructor(el, startX, startY, color) {
    this.el        = el;
    this.x         = startX;
    this.y         = startY;
    this.color     = color || '#1db87e';
    this.alive     = true;
    this.queue     = [];          // [{x,y}] waypoints in screen coords
    this.onDone    = null;        // fired when queue exhausted
    this.wobble    = Math.random() * Math.PI * 2;
    this.angle     = 0;
    this.trailTick = 0;
    this._raf      = null;
    this._loop     = this._loop.bind(this);
    // position element immediately
    this._applyPos();
    this._raf = requestAnimationFrame(this._loop);
  }

  _applyPos() {
    this.el.style.left      = (this.x - R) + 'px';
    this.el.style.top       = (this.y - R) + 'px';
    this.el.style.transform = `rotate(${this.angle}deg)`;
  }

  _loop() {
    if (!this.alive) return;

    if (this.queue.length === 0) {
      // Nothing to do — idle in place with gentle wobble
      this.wobble += 0.04;
      this.angle  += Math.sin(this.wobble) * 0.3;
      this._applyPos();
      this._raf = requestAnimationFrame(this._loop);
      return;
    }

    const target = this.queue[0];
    const dx     = target.x - this.x;
    const dy     = target.y - this.y;
    const dist   = Math.sqrt(dx * dx + dy * dy);

    if (dist < CORNER_R) {
      // Snap to waypoint, advance queue
      this.x = target.x;
      this.y = target.y;
      this.queue.shift();

      if (this.queue.length === 0 && this.onDone) {
        const cb   = this.onDone;
        this.onDone = null;
        this._applyPos();
        cb();
      } else {
        this._applyPos();
      }
      this._raf = requestAnimationFrame(this._loop);
      return;
    }

    // Move TUBE_SPEED px toward next waypoint
    const step = Math.min(TUBE_SPEED, dist);
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;

    // Gentle wobble perpendicular to direction of travel
    this.wobble += 0.09;
    const perpX = -(dy / dist);
    const perpY =  (dx / dist);
    this.x += perpX * Math.sin(this.wobble) * 0.7;
    this.y += perpY * Math.sin(this.wobble) * 0.7;

    // Rotation tracks travel direction
    const travelAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    this.angle += (travelAngle - this.angle) * 0.15;

    this._applyPos();

    // Trail
    this.trailTick++;
    if (this.trailTick % 4 === 0) spawnTrail(this.x, this.y, this.color);

    this._raf = requestAnimationFrame(this._loop);
  }

  // Enqueue a list of screen-space {x,y} waypoints, fire cb at end
  followPath(points, cb) {
    this.queue  = [...points];
    this.onDone = cb || null;
  }

  recolor(cssColor) {
    this.color = cssColor;
    this.el.style.borderColor = cssColor;
    this.el.style.boxShadow   = `0 0 14px ${cssColor}77`;
  }

  // Pulse the node and do a brief colour flash
  arrive(nodeId) {
    pulse(nodeId);
  }

  shakeRed() {
    this.recolor('#e84040');
    // Wiggle in place briefly
    let t = 0;
    const shake = () => {
      if (!this.alive || t > 8) return;
      this.x += (Math.random() - 0.5) * 5;
      this.y += (Math.random() - 0.5) * 3;
      this._applyPos();
      t++;
      setTimeout(shake, 70);
    };
    shake();
  }

  fadeOut(delay) {
    setTimeout(() => {
      this.alive = false;
      cancelAnimationFrame(this._raf);
      this.el.style.transition = 'opacity 0.5s';
      this.el.style.opacity    = '0';
      setTimeout(() => this.el.remove(), 520);
    }, delay || 0);
  }
}

// ── Path builder ─────────────────────────────────────────
// Converts pipeline-relative L-path coords → {x,y} objects.
// Returns an array of pipeline-relative waypoints.

function buildPath(points_pipRel) {
  // points_pipRel: array of [px, py] in pipeline-div coordinates
  return points_pipRel.map(([px, py]) => ({ x: px, y: py }));
}

// Ensure the pipeline is scrolled so a pipeline-y coord is visible,
// then call cb. Adjusts for the canvas-wrap scroll offset.
function ensureVisible(pipelineY, cb) {
  cb();
}

// ── Main route builder ────────────────────────────────────
// Each doXXX function:
//  1. Calls ensureVisible so next node is on screen
//  2. Builds the exact tube waypoints matching the SVG path
//  3. Calls pb.followPath(waypoints, cb)

function launchFood(food, cx, cy) {
  const pip = document.getElementById('pipeline');
  const start = screenToPipeline(cx, cy);
  const el = document.createElement('div');
  el.className   = 'food-bubble';
  el.textContent = food.e;
  el.style.left  = (start.x - R) + 'px';
  el.style.top   = (start.y - R) + 'px';
  pip.appendChild(el);

  const pb = new TubeBubble(el, start.x, start.y, '#1db87e');
  addLog(`[IN] ${food.e} ${food.name.toUpperCase()}`, 'lc-muted');

  const modeIsHerb = mode === 'herbivore';
  const matches    = modeIsHerb ? food.herb : !food.herb;
  const s1id       = modeIsHerb ? 'n-s1-herb' : 'n-s1-carn';
  const chipS1     = modeIsHerb ? 'chips-s1-herb' : 'chips-s1-carn';

  // Brief pause then flow from drop point straight into S1 node
  setTimeout(() => {
    const ns = pipelinePos(s1id);
    if (!ns) return;
    // Drop point → S1 center (straight line, not a tube segment — just entry)
    pb.followPath([{ x: ns.x, y: ns.y }], () => {
      pb.arrive(s1id);
      addChip(chipS1, food.e);

      if (!matches) {
        addLog(`[S1] ${food.e} MISMATCH — ejected`, 'lc-red');
        pb.shakeRed();
        pb.fadeOut(900);
        return;
      }
      addLog(`[S1] ${food.e} → ${mode.toUpperCase()} path`, modeIsHerb ? 'lc-green' : 'lc-red');
      pb.recolor(modeIsHerb ? '#1db87e' : '#e84040');

      if (modeIsHerb) {
        setTimeout(() => flowS1hToS7(pb, food), 200);
      } else {
        setTimeout(() => flowS1cToS3(pb, food), 200);
      }
    });
  }, 80);
}

// S1-herb → S7  (path: s1h.x,s1h.b → s1h.x,mid → s7.x,mid → s7.x,s7.t → s7.center)
function flowS1hToS7(pb, food) {
  const s1h = pipelinePos('n-s1-herb');
  const s7  = pipelinePos('n-s7');
  if (!s1h || !s7) return;
  const mid = (s1h.b + s7.t) / 2;
  ensureVisible(s7.t, () => {
    pb.followPath(buildPath([
      [s1h.x, s1h.b],
      [s1h.x, mid],
      [s7.x,  mid],
      [s7.x,  s7.t],
      [s7.x,  s7.y],
    ]), () => {
      pb.arrive('n-s7');
      addChip('chips-s7', food.e);
      pb.recolor('#f0a500');
      addLog(`[S7] ${food.e} gizzard grinding`, 'lc-orange');
      setTimeout(() => flowToS3(pb, food), 200);
    });
  });
}

// S1-carn → S3  (bypass S7: s1c.x,s1c.b → s1c.x,s3.t-14 → s3.x-8,s3.t-14 → s3.x-8,s3.t → s3.center)
function flowS1cToS3(pb, food) {
  const s1c = pipelinePos('n-s1-carn');
  const s3  = pipelinePos('n-s3');
  if (!s1c || !s3) return;
  ensureVisible(s3.t, () => {
    pb.followPath(buildPath([
      [s1c.x,   s1c.b],
      [s1c.x,   s3.t - 14],
      [s3.x - 8, s3.t - 14],
      [s3.x - 8, s3.t],
      [s3.x,    s3.y],
    ]), () => {
      pb.arrive('n-s3');
      runS3(pb, food);
    });
  });
}

// S7 → S3
function flowToS3(pb, food) {
  const s7 = pipelinePos('n-s7');
  const s3 = pipelinePos('n-s3');
  if (!s7 || !s3) return;
  const mid = (s7.b + s3.t) / 2;
  ensureVisible(s3.t, () => {
    pb.followPath(buildPath([
      [s7.x, s7.b],
      [s7.x, mid],
      [s3.x, mid],
      [s3.x, s3.t],
      [s3.x, s3.y],
    ]), () => {
      pb.arrive('n-s3');
      runS3(pb, food);
    });
  });
}

// ── S3 BATCH GATE ────────────────────────────────────────
// Holds qualifying bubbles until 3 have accumulated, then releases all at once.
// Rejected (low-nutrition) items bypass immediately.
const S3_THRESHOLD = 3;
let s3Queue = [];   // [{pb, food}] — waiting for batch release
let s3Collapsed = false; // phosphorus pillar removed?

function removePhosphorusPillar() {
  if (s3Collapsed) return;
  s3Collapsed = true;
  addLog('[S3] ⚠ PHOSPHORUS PILLAR REMOVED — skeletal integrity lost!', 'lc-red');
  addLog('[S3] STATION COLLAPSED — system offline. Reset to restore.', 'lc-red');
  pulse('n-s3');
  // Hide the pillar
  const pillar = document.getElementById('phosphorus-pillar');
  if (pillar) { pillar.classList.add('pillar-removed'); }
  // Shake the entire S3 node
  const node = document.getElementById('n-s3');
  if (node) { node.classList.add('s3-collapsed'); }
  // Show collapsed message
  const msg = document.getElementById('s3-collapsed-msg');
  if (msg) msg.classList.remove('s3-hidden');
  // Update badge
  const badge = document.querySelector('#n-s3 .node-badge');
  if (badge) { badge.textContent = 'S3 — COLLAPSED'; badge.style.color = 'var(--red)'; }
  // Kill any queued bubbles
  s3Queue.forEach(({ pb }) => { pb.shakeRed(); pb.fadeOut(600); });
  s3Queue = [];
}

function runS3(pb, food) {
  if (s3Collapsed) {
    addLog(`[S3] ${food.e} REJECTED — station collapsed`, 'lc-red');
    pb.shakeRed();
    pb.fadeOut(800);
    return;
  }

  if (!food.highNut) {
    // Immediate reject bypass
    addLog(`[S3] ${food.e} BLOCKED — low nutrition`, 'lc-red');
    pb.shakeRed();
    setTimeout(() => flowS3RejectToWaste(pb, food), 300);
    return;
  }

  // Queue this bubble at S3
  addChip('chips-s3', food.e);
  s3Queue.push({ pb, food });
  const count = s3Queue.length;
  addLog(`[S3] ${food.e} queued — ${count}/${S3_THRESHOLD} loaded`, 'lc-orange');

  // Pulse S3 gate bar fill to show it's loading
  const gateBarFill = document.querySelector('#n-s3 .gate-bar-fill');
  if (gateBarFill) gateBarFill.style.width = `${(count / S3_THRESHOLD) * 100}%`;

  // Update S3 node badge to show fill count
  const badge = document.querySelector('#n-s3 .node-badge');
  if (badge) badge.textContent = `S3 — ${count}/${S3_THRESHOLD} QUEUED`;

  if (count >= S3_THRESHOLD) {
    // Release the whole batch
    const batch = s3Queue.splice(0, S3_THRESHOLD);
    addLog(`[S3] GATE OPEN — releasing batch of ${S3_THRESHOLD}`, 'lc-green');
    pulse('n-s3');

    // Show gate-open image
    const s3Closed = document.getElementById('s3-img-closed');
    const s3Open   = document.getElementById('s3-img-open');
    if (s3Closed) s3Closed.classList.add('s3-hidden');
    if (s3Open)   s3Open.classList.remove('s3-hidden');

    // Reset gate visual
    const gateBarFill = document.querySelector('#n-s3 .gate-bar-fill');
    if (gateBarFill) gateBarFill.style.width = '0%';
    if (badge) badge.textContent = 'S3 — 0/3 QUEUED';

    // Stagger each bubble out with a small delay
    const totalDelay = batch.length * 220 + 600;
    batch.forEach(({ pb: bpb, food: bf }, i) => {
      bpb.recolor('#1db87e');
      setTimeout(() => flowS3ToS4(bpb, bf), i * 220);
    });

    // Revert to gate-closed image after batch finishes leaving
    setTimeout(() => {
      if (s3Closed) s3Closed.classList.remove('s3-hidden');
      if (s3Open)   s3Open.classList.add('s3-hidden');
    }, totalDelay);
  }
}

// S3 reject → waste bot (right bypass: s3.r,s3.y → s3.r+18,s3.y → … → wb.center)
function flowS3RejectToWaste(pb, food) {
  const s3 = pipelinePos('n-s3');
  const wb = pipelinePos('n-waste-bot');
  if (!s3 || !wb) return;
  ensureVisible(wb.t, () => {
    pb.followPath(buildPath([
      [s3.r,      s3.y],
      [s3.r + 18, s3.y],
      [s3.r + 18, wb.y],
      [wb.r + 8,  wb.y],
      [wb.r + 8,  wb.t + 10],
      [wb.r,      wb.t + 10],
      [wb.x,      wb.y],
    ]), () => {
      pb.arrive('n-waste-bot');
      addChip('chips-waste-bot', food.e);
      addLog(`[OUT] ${food.e} → rejected / waste`, 'lc-red');
      pb.fadeOut(350);
    });
  });
}

// ── S4 ACID TILT GATE ─────────────────────────────────
// Food arrives at S4 (stomach) and is HELD until the user
// manually triggers the "high-acid tilt" button.
let s4Queue = [];   // [{pb, food}] — held in stomach

function updateS4Status() {
  const status = document.getElementById('s4-status');
  const btn    = document.getElementById('acid-tilt-btn');
  if (status) {
    const n = s4Queue.length;
    status.textContent = n === 0
      ? 'STOMACH IDLE — 0 HELD'
      : `STOMACH HOLDING — ${n} SAMPLE${n > 1 ? 'S' : ''} WAITING`;
    status.style.color = n > 0 ? 'var(--orange)' : 'var(--muted)';
  }
  if (btn) {
    btn.classList.toggle('ready', s4Queue.length > 0);
  }
}

function triggerAcidTilt() {
  if (s4Queue.length === 0) {
    addLog('[S4] No samples in stomach to release', 'lc-muted');
    return;
  }
  const batch = s4Queue.splice(0);
  addLog(`[S4] ⚗ HIGH-ACID TILT ACTIVATED — releasing ${batch.length} sample${batch.length > 1 ? 's' : ''}`, 'lc-green');
  pulse('n-s4');
  // Flash the button
  const btn = document.getElementById('acid-tilt-btn');
  if (btn) { btn.classList.add('firing'); setTimeout(() => btn.classList.remove('firing'), 600); }
  updateS4Status();
  batch.forEach(({ pb: bpb, food: bf }, i) => {
    setTimeout(() => releaseFromS4(bpb, bf), i * 250);
  });
}

function releaseFromS4(pb, food) {
  const isLipidOnly = food.fat && !food.prot;
  addLog(`[S4] ${food.e} acid tilt — ${isLipidOnly ? 'LIPID→S2' : 'PROT/CARB→S5'}`, isLipidOnly ? 'lc-blue' : 'lc-green');
  if (isLipidOnly) {
    pb.recolor('#3a8ef6');
    setTimeout(() => flowS4ToS2(pb, food), 200);
  } else {
    pb.recolor('#1db87e');
    setTimeout(() => flowS4ToS5(pb, food), 200);
  }
}

// S3 → S4
function flowS3ToS4(pb, food) {
  const s3 = pipelinePos('n-s3');
  const s4 = pipelinePos('n-s4');
  if (!s3 || !s4) return;
  const mid = (s3.b + s4.t) / 2;
  ensureVisible(s4.t, () => {
    pb.followPath(buildPath([
      [s3.x, s3.b],
      [s3.x, mid],
      [s4.x, mid],
      [s4.x, s4.t],
      [s4.x, s4.y],
    ]), () => {
      pb.arrive('n-s4');
      addChip('chips-s4', food.e);
      addLog(`[S4] ${food.e} held in stomach — activate HIGH-ACID TILT to release`, 'lc-orange');
      s4Queue.push({ pb, food });
      updateS4Status();
    });
  });
}

// S4 → S2 (lipid left fork)
function flowS4ToS2(pb, food) {
  const s4 = pipelinePos('n-s4');
  const s2 = pipelinePos('n-s2');
  if (!s4 || !s2) return;
  ensureVisible(s2.t, () => {
    pb.followPath(buildPath([
      [s4.l + 40, s4.b],
      [s4.l + 40, s4.b + 20],
      [s2.x,      s4.b + 20],
      [s2.x,      s2.t],
      [s2.x,      s2.y],
    ]), () => {
      pb.arrive('n-s2');
      addChip('chips-s2', food.e);
      addLog(`[S2] ${food.e} vitamin/lipid sort`, 'lc-blue');
      if (food.prot) {
        pb.recolor('#e84040');
        addLog(`[S2] ${food.e} → excess waste`, 'lc-red');
        setTimeout(() => flowS2ToWasteLeft(pb, food), 200);
      } else {
        pb.recolor('#3a8ef6');
        addLog(`[S2] ${food.e} → lipid reserve`, 'lc-blue');
        setTimeout(() => flowS2ToStorage(pb, food), 200);
      }
    });
  });
}

// S2 → Waste Left
function flowS2ToWasteLeft(pb, food) {
  const s2 = pipelinePos('n-s2');
  const wl = pipelinePos('n-waste-left');
  if (!s2 || !wl) return;
  ensureVisible(wl.t, () => {
    pb.followPath(buildPath([
      [s2.r - 18, s2.b],
      [s2.r - 18, wl.t - 8],
      [wl.x,      wl.t - 8],
      [wl.x,      wl.t],
      [wl.x,      wl.y],
    ]), () => {
      pb.arrive('n-waste-left');
      addChip('chips-waste-left', food.e);
      addLog(`[OUT] ${food.e} → lipid excess / waste`, 'lc-red');
      pb.fadeOut(350);
    });
  });
}

// S2 → Storage
function flowS2ToStorage(pb, food) {
  const s2  = pipelinePos('n-s2');
  const sto = pipelinePos('n-storage');
  if (!s2 || !sto) return;
  const mid = (s2.b + sto.t) / 2;
  ensureVisible(sto.t, () => {
    pb.followPath(buildPath([
      [s2.x,  s2.b],
      [s2.x,  mid],
      [sto.x, mid],
      [sto.x, sto.t],
      [sto.x, sto.y],
    ]), () => {
      pb.arrive('n-storage');
      addChip('chips-storage', food.e);
      addLog(`[OUT] ${food.e} → stored`, 'lc-blue');
      pb.fadeOut(400);
    });
  });
}

// S4 → S5 (protein/carb right fork)
function flowS4ToS5(pb, food) {
  const s4 = pipelinePos('n-s4');
  const s5 = pipelinePos('n-s5');
  if (!s4 || !s5) return;
  ensureVisible(s5.t, () => {
    pb.followPath(buildPath([
      [s4.r - 50, s4.b],
      [s4.r - 50, s4.b + 20],
      [s5.x,      s4.b + 20],
      [s5.x,      s5.t],
      [s5.x,      s5.y],
    ]), () => {
      pb.arrive('n-s5');
      addChip('chips-s5', food.e);
      addLog(`[S5] ${food.e} small intestine — sorting`, 'lc-blue');
      // S5 splits: lipid → Lymph, protein → Capillary, rest → S6 Large Intestine
      if (food.fat) {
        pb.recolor('#a855f7');
        addLog(`[S5] ${food.e} lipid → LYMPH`, 'lc-blue');
        setTimeout(() => flowS5ToLymph(pb, food), 200);
      } else if (food.prot) {
        pb.recolor('#06b6d4');
        addLog(`[S5] ${food.e} protein → CAPILLARY`, 'lc-blue');
        setTimeout(() => flowS5ToCapillary(pb, food), 200);
      } else {
        pb.recolor('#f0a500');
        addLog(`[S5] ${food.e} no fat/protein → LARGE INTESTINE`, 'lc-orange');
        setTimeout(() => flowS5ToS6(pb, food), 200);
      }
    });
  });
}

// S5 → Lymph (lipid path — tube goes right to circle)
function flowS5ToLymph(pb, food) {
  const s5  = pipelinePos('n-s5');
  const lym = pipelinePos('n-lymph');
  if (!s5 || !lym) return;
  ensureVisible(lym.t, () => {
    pb.followPath(buildPath([
      [s5.r,       s5.y - 15],
      [s5.r + 40,  s5.y - 15],
      [lym.l,      lym.y],
      [lym.x,      lym.y],
    ]), () => {
      pb.arrive('n-lymph');
      addChip('chips-lymph', food.e);
      addLog(`[OUT] ${food.e} → lymph / chylomicrons`, 'lc-blue');
      pb.fadeOut(400);
    });
  });
}

// S5 → Capillary Pipe (protein/carb — tube goes right-down to circle)
function flowS5ToCapillary(pb, food) {
  const s5  = pipelinePos('n-s5');
  const cap = pipelinePos('n-capillary');
  if (!s5 || !cap) return;
  ensureVisible(cap.t, () => {
    pb.followPath(buildPath([
      [s5.r,       s5.y + 15],
      [s5.r + 40,  s5.y + 15],
      [cap.l,      cap.y],
      [cap.x,      cap.y],
    ]), () => {
      pb.arrive('n-capillary');
      addChip('chips-capillary', food.e);
      addLog(`[OUT] ${food.e} → capillary / portal vein`, 'lc-blue');
      pb.fadeOut(400);
    });
  });
}

// S5 → S6 (residue / fiber straight down)
function flowS5ToS6(pb, food) {
  const s5 = pipelinePos('n-s5');
  const s6 = pipelinePos('n-s6');
  if (!s5 || !s6) return;
  const mid = (s5.b + s6.t) / 2;
  ensureVisible(s6.t, () => {
    pb.followPath(buildPath([
      [s5.x, s5.b],
      [s5.x, mid],
      [s6.x, mid],
      [s6.x, s6.t],
      [s6.x, s6.y],
    ]), () => {
      pb.arrive('n-s6');
      addChip('chips-s6', food.e);
      if (floraAlive) {
        const friendly = food.microFriend;
        addLog(`[S6] ${food.e} bacterial filter — ${friendly ? 'CLEAR' : 'DISRUPTS FLORA'}`, friendly ? 'lc-green' : 'lc-orange');
        pb.recolor(friendly ? '#1db87e' : '#f0a500');
      } else {
        addLog(`[S6] ${food.e} — flora DEAD, no fermentation`, 'lc-red');
        pb.recolor('#e84040');
      }
      setTimeout(() => flowS6ToWaste(pb, food), 200);
    });
  });
}

// S6 → Waste Bot
function flowS6ToWaste(pb, food) {
  const s6 = pipelinePos('n-s6');
  const wb = pipelinePos('n-waste-bot');
  if (!s6 || !wb) return;
  const mid = (s6.b + wb.t) / 2;
  ensureVisible(wb.t, () => {
    pb.followPath(buildPath([
      [s6.x, s6.b],
      [s6.x, mid],
      [wb.x, mid],
      [wb.x, wb.t],
      [wb.x, wb.y],
    ]), () => {
      pb.arrive('n-waste-bot');
      addChip('chips-waste-bot', food.e);
      addLog(`[OUT] ${food.e} → excretion`, 'lc-muted');
      pb.fadeOut(350);
    });
  });
}

// ── S6 FLORA TOGGLE ─────────────────────────────────────
let floraAlive = true;

function toggleFlora() {
  floraAlive = !floraAlive;
  const aliveImg  = document.getElementById('s6-flora-alive');
  const deadImg   = document.getElementById('s6-flora-dead');
  const btn       = document.getElementById('flora-toggle-btn');
  const status    = document.getElementById('s6-flora-status');
  if (aliveImg) aliveImg.classList.toggle('s6-hidden', !floraAlive);
  if (deadImg)  deadImg.classList.toggle('s6-hidden', floraAlive);
  if (btn) {
    btn.textContent = floraAlive ? '☠ KILL FLORA' : '🌿 REVIVE FLORA';
    btn.classList.toggle('flora-dead', !floraAlive);
  }
  if (status) {
    status.textContent = floraAlive ? 'FLORA STATUS: ALIVE' : 'FLORA STATUS: DEAD';
    status.style.color = floraAlive ? 'var(--green)' : 'var(--red)';
  }
  addLog(`[S6] Flora ${floraAlive ? 'REVIVED — fermentation restored' : 'KILLED — no bacterial processing'}`, floraAlive ? 'lc-green' : 'lc-red');
  pulse('n-s6');
}

/* ── SVG PIPES ── */
function getCenter(id) {
  const pip = document.getElementById('pipeline');
  const pr = pip.getBoundingClientRect();
  const el = document.getElementById(id);
  const r = el.getBoundingClientRect();
  return {
    x:  r.left - pr.left + r.width/2,
    y:  r.top  - pr.top  + r.height/2,
    t:  r.top  - pr.top,
    b:  r.top  - pr.top + r.height,
    l:  r.left - pr.left,
    r:  r.left - pr.left + r.width,
  };
}

function drawPipes() {
  const svg = document.getElementById('pipes-svg');
  const en  = getCenter('n-entry');
  const s1c = getCenter('n-s1-carn');
  const s1h = getCenter('n-s1-herb');
  const s7  = getCenter('n-s7');
  const s3  = getCenter('n-s3');
  const s4  = getCenter('n-s4');
  const s2  = getCenter('n-s2');
  const sto = getCenter('n-storage');
  const wl  = getCenter('n-waste-left');
  const s5  = getCenter('n-s5');
  const lym = getCenter('n-lymph');
  const cap = getCenter('n-capillary');
  const s6  = getCenter('n-s6');
  const wb  = getCenter('n-waste-bot');

  const tubes = [
    // Entry → S1-herb (green, main)
    { d:`M${en.x},${en.b} L${en.x},${en.b+12} L${s1h.x},${en.b+12} L${s1h.x},${s1h.t}`,
      wall:'#0d2018', fill:'#1a3d28', dashed:false },
    // Entry → S1-carn (red, dashed)
    { d:`M${en.x},${en.b} L${en.x},${en.b+12} L${s1c.x},${en.b+12} L${s1c.x},${s1c.t}`,
      wall:'#200d0d', fill:'#3d1a1a', dashed:true },
    // S1-herb → S7
    { d:`M${s1h.x},${s1h.b} L${s1h.x},${(s1h.b+s7.t)/2} L${s7.x},${(s1h.b+s7.t)/2} L${s7.x},${s7.t}`,
      wall:'#0d2018', fill:'#1a3d28', dashed:false },
    // S7 → S3
    { d:`M${s7.x},${s7.b} L${s7.x},${(s7.b+s3.t)/2} L${s3.x},${(s7.b+s3.t)/2} L${s3.x},${s3.t}`,
      wall:'#0d2018', fill:'#1a3d28', dashed:false },
    // S1-carn → S3 bypass (red dashed)
    { d:`M${s1c.x},${s1c.b} L${s1c.x},${s3.t-18} L${s3.l-12},${s3.t-18} L${s3.l-12},${s3.y}`,
      wall:'#200d0d', fill:'#3d1a1a', dashed:true },
    // S3 → S4
    { d:`M${s3.x},${s3.b} L${s3.x},${(s3.b+s4.t)/2} L${s4.x},${(s3.b+s4.t)/2} L${s4.x},${s4.t}`,
      wall:'#0d2018', fill:'#1a3d28', dashed:false },
    // S3 reject bypass → waste-bot (right side)
    { d:`M${s3.r},${s3.y} L${s3.r+22},${s3.y} L${s3.r+22},${wb.y} L${wb.r+10},${wb.y} L${wb.r+10},${wb.t+12} L${wb.r},${wb.t+12}`,
      wall:'#200d0d', fill:'#3d1a1a', dashed:true },
    // S4 → S2 (lipid, left fork)
    { d:`M${s4.l+50},${s4.b} L${s4.l+50},${s4.b+22} L${s2.x},${s4.b+22} L${s2.x},${s2.t}`,
      wall:'#0d1828', fill:'#1a2840', dashed:false },
    // S2 → Storage
    { d:`M${s2.x},${s2.b} L${s2.x},${(s2.b+sto.t)/2} L${sto.x},${(s2.b+sto.t)/2} L${sto.x},${sto.t}`,
      wall:'#0d1828', fill:'#1a2840', dashed:false },
    // S2 → Waste Left
    { d:`M${s2.r-20},${s2.b} L${s2.r-20},${wl.t-10} L${wl.x},${wl.t-10} L${wl.x},${wl.t}`,
      wall:'#200d0d', fill:'#3d1a1a', dashed:true },
    // S4 → S5 (protein/carb, right fork)
    { d:`M${s4.r-50},${s4.b} L${s4.r-50},${s4.b+22} L${s5.x},${s4.b+22} L${s5.x},${s5.t}`,
      wall:'#0d2840', fill:'#1a3d55', dashed:false },
    // S5 → Lymph (lipid branch, horizontal right to circle — upper)
    { d:`M${s5.r},${s5.y-18} L${s5.r+40},${s5.y-18} L${lym.l},${lym.y}`,
      wall:'#1a0d28', fill:'#2d1a45', dashed:false },
    // S5 → Capillary Pipe (protein/carb branch, horizontal right — lower)
    { d:`M${s5.r},${s5.y+18} L${s5.r+40},${s5.y+18} L${cap.l},${cap.y}`,
      wall:'#0d2430', fill:'#1a3840', dashed:false },
    // S5 → S6 (residue, straight down)
    { d:`M${s5.x},${s5.b} L${s5.x},${(s5.b+s6.t)/2} L${s6.x},${(s5.b+s6.t)/2} L${s6.x},${s6.t}`,
      wall:'#1a1a0d', fill:'#2a2810', dashed:false },
    // S6 → Waste Bot
    { d:`M${s6.x},${s6.b} L${s6.x},${(s6.b+wb.t)/2} L${wb.x},${(s6.b+wb.t)/2} L${wb.x},${wb.t}`,
      wall:'#200d0d', fill:'#3d1a1a', dashed:false },
  ];

  // Tube rendering: 3 concentric strokes give a 3D pipe illusion
  const strokeCap = 'stroke-linecap="round" stroke-linejoin="round"';
  const dash = (t) => t.dashed ? 'stroke-dasharray="10,5"' : '';

  svg.innerHTML = `
    <defs>
      <filter id="tube-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
  ` + tubes.map((t, i) => `
    <g>
      <path d="${t.d}" fill="none" stroke="${t.wall}" stroke-width="11" ${strokeCap} ${dash(t)} opacity="0.95"/>
      <path d="${t.d}" fill="none" stroke="${t.fill}" stroke-width="7" ${strokeCap} ${dash(t)}/>
      <path d="${t.d}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="2.5" ${strokeCap} ${dash(t)}/>
      <path d="${t.d}" fill="none" stroke="${t.fill}" stroke-width="3" ${strokeCap} ${dash(t)} opacity="0.5" filter="url(#tube-glow)"/>
    </g>
  `).join('');
}

function clearAll() {
  ['chips-s1-carn','chips-s1-herb','chips-s7','chips-s3','chips-s4',
   'chips-s2','chips-storage','chips-waste-left','chips-s5','chips-lymph',
   'chips-capillary','chips-s6','chips-waste-bot'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
  document.getElementById('log').innerHTML = '<span class="lc-muted">// cleared</span>';
}

function enterLab() {
  const ss = document.getElementById('start-screen');
  ss.classList.add('hiding');
  setTimeout(() => { ss.style.display = 'none'; }, 650);
  setTimeout(drawPipes, 750);
}

function resetLab() {
  clearAll();
  setMode('herbivore');
  document.querySelectorAll('.food-bubble, .trail-dot').forEach(b => b.remove());
  // Reset S3 gate state
  s3Queue = [];
  s3Collapsed = false;
  const gateBarFill = document.querySelector('#n-s3 .gate-bar-fill');
  if (gateBarFill) gateBarFill.style.width = '0%';
  const badge = document.querySelector('#n-s3 .node-badge');
  if (badge) { badge.textContent = 'S3 — 0/3 QUEUED'; badge.style.color = ''; }
  // Reset S3 collapse visuals
  const s3Node = document.getElementById('n-s3');
  if (s3Node) s3Node.classList.remove('s3-collapsed');
  const pillar = document.getElementById('phosphorus-pillar');
  if (pillar) pillar.classList.remove('pillar-removed');
  const collapseMsg = document.getElementById('s3-collapsed-msg');
  if (collapseMsg) collapseMsg.classList.add('s3-hidden');
  // Reset S3 image to gate-closed
  const s3Closed = document.getElementById('s3-img-closed');
  const s3Open   = document.getElementById('s3-img-open');
  if (s3Closed) s3Closed.classList.remove('s3-hidden');
  if (s3Open)   s3Open.classList.add('s3-hidden');
  // Reset S4 acid tilt state
  s4Queue = [];
  updateS4Status();
  // Reset S6 flora state
  floraAlive = true;
  const aliveImg = document.getElementById('s6-flora-alive');
  const deadImg  = document.getElementById('s6-flora-dead');
  if (aliveImg) aliveImg.classList.remove('s6-hidden');
  if (deadImg)  deadImg.classList.add('s6-hidden');
  const floraBtn = document.getElementById('flora-toggle-btn');
  if (floraBtn) { floraBtn.textContent = '☠ KILL FLORA'; floraBtn.classList.remove('flora-dead'); }
  const floraStatus = document.getElementById('s6-flora-status');
  if (floraStatus) { floraStatus.textContent = 'FLORA STATUS: ALIVE'; floraStatus.style.color = 'var(--green)'; }
  addLog('// LAB RESET', 'lc-muted');
}

// Pipes are drawn when enterLab() is called (after start screen dismisses)
window.addEventListener('resize', drawPipes);
