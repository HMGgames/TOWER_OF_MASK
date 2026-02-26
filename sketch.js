/*  TOWER OF MASKS — Donkey-style Vertical (p5.js)
    WORLD 1080x1920, fit-to-screen (no stretch)

    FINAL (3-level mode):
    ✅ 3 Levels: touching princess advances to next level (new ladder layout)
    ✅ Money accumulates across levels (score = FINAL MONEY after level 3)
    ✅ Leaderboard + name entry ONLY after beating level 3
    ✅ If you lose on any level: TAP TO RESTART (no name form)
    ✅ Projectiles keep Donkey logic + planned random drops across width (incl. edges)
    ✅ Start button preserves aspect ratio (no stretch) + big hitbox (no black plate)
*/

const ASSET_DIR = "assets/";
const GOOGLE_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbwQWs3xvjd7x7cfxTphgA_jB6_lscJ1fPGLzbGjy0MDuHeWlIgN3BSj_HVJA81EYc72og/exec";

const WORLD_W = 1080;
const WORLD_H = 1920;

const STATE = { START:"START", PLAY:"PLAY", WIN:"WIN", LOSE:"LOSE" };
let gameState = STATE.START;

// ---------- LEVELS ----------
const MAX_LEVELS = 3;
let level = 1;             // 1..MAX_LEVELS
const LEVEL_SEED_BASE = 1337;
// difficulty boost per level (subtle)
const LEVEL_DIFFICULTY_BONUS = { 1:0, 2:1, 3:2 };

// Assets
let img = {};
let fontUI;

// Fit render
let lastRender = { dx:0, dy:0, s:1, dw:WORLD_W, dh:WORLD_H };

// World
let platforms = [];
let ladders = [];
let player, villain, princess;
let projectiles = [];

// Money
const START_MONEY = 322000;
let money = START_MONEY;

const HIT_BARREL = 97000;
const HIT_BOMB   = 193000;
const GAIN_COIN  = 129000;

let bestPlatformReached = 0;

// Tutorial
let tutorialSeenThisSession = false;
let showTutorialOverlay = false;

// Timing
let lastMs = 0;
let villainThrowTimer = 0;

// Leaderboard
let globalTop10 = [];
let globalLBLoading = false;
let globalLBLastFetchMs = 0;
let nameOverlay, nameCard, nameInput, submitBtn, overlayMsg;
let pendingSubmit = false;
let submittedThisRun = false;

// AUDIO
let snd = {};
let audioReady = false;
let audioUI, audioUIVisible = false;
let musicNow = null;
let endMusicNow = null;

const VOL_DEFAULTS = {
  master: 1.0,
  music: 0.85,
  sfx: 1.0,
  stingers: 1.0,
  MAIN_MENU: 0.9,
  GameLoop: 0.9,
  Victory: 0.9,
  Defeat: 0.9,
  Game_over_win: 1.0,
  Game_over_loose: 1.0,
  Button: 1.0,
  Climb: 1.0,
  Enemy_Throw: 1.0,
  Barrel: 1.0,
  Bomb: 1.0,
  Coin: 1.0,
};
let vol = { ...VOL_DEFAULTS };

// Feet anchoring
const FOOT_OFFSET_Y = {
  player: -10,
  villain: -24,
  princess: -30,
};

// Ladder draw overlap (nice snug)
const LADDER_OVERLAP_TOP = 14;
const LADDER_OVERLAP_BOTTOM = 16;

// Platform visual offset (base only)
const PLATFORM_DRAW_OFFSET_Y = { base:55, mid:0, top:0 };

// Start button: big hitbox, but image is drawn FIT (NO stretch, NO shadow)
const START_BTN = {
  bw: 980,      // hitbox box (keep sane; image will be fit inside)
  bh: 260,
  byPct: 0.44,
  scale: 2.0,   // HERO scale for the image inside the box (no stretch)
};

// Tutorial UI
const TUTORIAL_UI = {
  cardW: 980,
  cardH: 520,
  titleSize: 44,
  bodySize: 26,
  lineGap: 44,
};

function assetPath(fn){ return encodeURI(ASSET_DIR + fn); }
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

// ----------------------------------------------------
// PRELOAD
// ----------------------------------------------------
function preload(){
  fontUI = loadFont(assetPath("Poppins-Bold.ttf"));

  img.startScreen = loadImage(assetPath("Start_Game.png"));
  img.winScreen   = loadImage(assetPath("Victory_screen.png"));
  img.loseScreen  = loadImage(assetPath("Defeat_screen.png"));
  img.btnStart    = loadImage(assetPath("ui_button_start.png"));

  img.bg = loadImage(assetPath("bg_tower.png"));

  img.platformBase = loadImage(assetPath("platform_base.png"));
  img.platformMid  = loadImage(assetPath("platform_mid_tile.png"));
  img.platformTop  = loadImage(assetPath("platform_top.png"));
  img.ladder       = loadImage(assetPath("ladder.png"));

  img.playerIdle  = loadImage(assetPath("player_idle.png"));
  img.playerRunL  = loadImage(assetPath("player_run_left.png"));
  img.playerRunR  = loadImage(assetPath("player_run_right.png"));
  img.playerClimb = loadImage(assetPath("player_climb.png"));

  img.villainIdleGood  = loadImage(assetPath("villain_idle_good.png"));
  img.villainIdleEvil  = loadImage(assetPath("villain_idle_evil.png"));
  img.villainThrowGood = loadImage(assetPath("villain_throw_good.png"));
  img.villainThrowEvil = loadImage(assetPath("villain_throw_evil.png"));

  img.princess = loadImage(assetPath("princess_idle.png"));

  img.projBarrel = loadImage(assetPath("proj_barrel.png"));
  img.projBomb   = loadImage(assetPath("proj_bomb.png"));
  img.projCoin   = loadImage(assetPath("proj_coin.png"));

  // Sounds (.wav)
  snd.MAIN_MENU       = loadSound(assetPath("MAIN_MENU.wav"));
  snd.GameLoop        = loadSound(assetPath("GameLoop.wav"));
  snd.Victory         = loadSound(assetPath("Victory.wav"));
  snd.Defeat          = loadSound(assetPath("Defeat.wav"));
  snd.Game_over_win   = loadSound(assetPath("Game_over_win.wav"));
  snd.Game_over_loose = loadSound(assetPath("Game_over_loose.wav"));

  snd.Button      = loadSound(assetPath("Button.wav"));
  snd.Climb       = loadSound(assetPath("Climb.wav"));
  snd.Enemy_Throw = loadSound(assetPath("Enemy_Throw.wav"));
  snd.Barrel      = loadSound(assetPath("Barrel.wav"));
  snd.Bomb        = loadSound(assetPath("Bomb.wav"));
  snd.Coin        = loadSound(assetPath("Coin.wav"));
}

// ----------------------------------------------------
// SETUP
// ----------------------------------------------------
function setup(){
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  noSmooth();
  if (fontUI) textFont(fontUI);

  loadVolumePrefs();
  initAudioUI();

  initNameOverlay();

  // Start level 1 layout + fresh run
  buildLevelLayout(LEVEL_SEED_BASE + level);
  resetRun();

  setTimeout(()=>fetchGlobalTop10JSONP(true), 400);
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
}

// ----------------------------------------------------
// AUDIO
// ----------------------------------------------------
function ensureAudioReady(){
  if (audioReady) return;
  try{
    userStartAudio();
    audioReady = true;
    applyAllVolumes();
    if (gameState === STATE.START) playMusic("MAIN_MENU");
  }catch(e){}
}

function getGroupForSound(key){
  if (key === "MAIN_MENU" || key === "GameLoop") return "music";
  if (key === "Victory" || key === "Defeat") return "music";
  if (key.startsWith("Game_over_")) return "stingers";
  return "sfx";
}

function effectiveVolume(key){
  const g = getGroupForSound(key);
  return clamp((vol.master ?? 1) * (vol[g] ?? 1) * (vol[key] ?? 1), 0, 1);
}

function applyAllVolumes(){
  for (const k in snd){
    if (!snd[k]) continue;
    snd[k].setVolume(effectiveVolume(k));
  }
}

function playSFX(key){
  if (!audioReady || !snd[key]) return;
  snd[key].setVolume(effectiveVolume(key));
  snd[key].play();
}

function stopMusic(key){
  if (!snd[key]) return;
  if (snd[key].isPlaying()) snd[key].stop();
}

function playMusic(key){
  if (!audioReady || !snd[key]) return;
  if (musicNow === key && snd[key].isPlaying()) return;

  if (key === "MAIN_MENU" || key === "GameLoop"){
    if (musicNow && musicNow !== key) stopMusic(musicNow);
    musicNow = key;
  }

  snd[key].setVolume(effectiveVolume(key));
  snd[key].loop();
}

function playEndMusic(key){
  if (!audioReady || !snd[key]) return;
  if (endMusicNow && endMusicNow !== key) stopMusic(endMusicNow);
  endMusicNow = key;
  snd[key].setVolume(effectiveVolume(key));
  snd[key].loop();
}

// ----------------------------------------------------
// AUDIO UI (press V)
// ----------------------------------------------------
function initAudioUI(){
  audioUI = createDiv("");
  audioUI.style("position","fixed");
  audioUI.style("left","12px");
  audioUI.style("bottom","12px");
  audioUI.style("width","300px");
  audioUI.style("background","rgba(0,0,0,0.72)");
  audioUI.style("border","1px solid rgba(255,255,255,0.15)");
  audioUI.style("border-radius","14px");
  audioUI.style("padding","12px");
  audioUI.style("color","#fff");
  audioUI.style("font-family","system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif");
  audioUI.style("z-index","99999");
  audioUI.style("display","none");

  const title = createDiv("Audio Mixer (press V)");
  title.parent(audioUI);
  title.style("font-weight","800");
  title.style("margin-bottom","10px");

  const makeSlider = (label,key)=>{
    const row = createDiv("");
    row.parent(audioUI);
    row.style("display","grid");
    row.style("grid-template-columns","120px 1fr");
    row.style("gap","10px");
    row.style("align-items","center");
    row.style("margin","6px 0");

    const l = createDiv(label);
    l.parent(row);
    l.style("font-size","12px");
    l.style("opacity","0.9");

    const s = createSlider(0,100, Math.round((vol[key] ?? 1) * 100), 1);
    s.parent(row);
    s.style("width","100%");
    s.input(()=>{
      vol[key] = s.value()/100;
      saveVolumePrefs();
      applyAllVolumes();
    });
  };

  makeSlider("MASTER","master");
  makeSlider("MUSIC","music");
  makeSlider("SFX","sfx");
  makeSlider("STINGERS","stingers");

  const sep = createDiv("— Individual —");
  sep.parent(audioUI);
  sep.style("margin","10px 0 6px");
  sep.style("font-size","12px");
  sep.style("opacity","0.8");

  makeSlider("MAIN_MENU","MAIN_MENU");
  makeSlider("GameLoop","GameLoop");
  makeSlider("Victory","Victory");
  makeSlider("Defeat","Defeat");
  makeSlider("Game_over_win","Game_over_win");
  makeSlider("Game_over_loose","Game_over_loose");
  makeSlider("Button","Button");
  makeSlider("Climb","Climb");
  makeSlider("Enemy_Throw","Enemy_Throw");
  makeSlider("Barrel","Barrel");
  makeSlider("Bomb","Bomb");
  makeSlider("Coin","Coin");
}

function toggleAudioUI(){
  audioUIVisible = !audioUIVisible;
  audioUI.style("display", audioUIVisible ? "block" : "none");
}

function saveVolumePrefs(){
  try{ localStorage.setItem("tower_masks_vol", JSON.stringify(vol)); }catch(e){}
}
function loadVolumePrefs(){
  try{
    const raw = localStorage.getItem("tower_masks_vol");
    if (raw) vol = { ...VOL_DEFAULTS, ...JSON.parse(raw) };
  }catch(e){
    vol = { ...VOL_DEFAULTS };
  }
}

// ----------------------------------------------------
// LEVEL LAYOUT (seeded ladders per level)
// ----------------------------------------------------
function buildLevelLayout(seed){
  platforms = [];
  ladders = [];

  const BASE_FLOOR_Y = WORLD_H - 150;
  const TOP_FLOOR_Y  = 300;

  const count = 7;
  const gapY = (BASE_FLOOR_Y - TOP_FLOOR_Y) / (count - 1);
  const dirs = [ 1, -1, 1, -1, 1, -1, 1 ];

  for (let i=0;i<count;i++){
    const floorY = BASE_FLOOR_Y - gapY*i;
    const kind = (i===0) ? "base" : (i===count-1) ? "top" : "mid";
    platforms.push({ index:i, kind, dir:dirs[i], floorY, thickness:18 });
  }

  // Seeded ladder positions for this level
  randomSeed(seed);

  const ladderW = 72;
  const safeXs = [
    130,
    WORLD_W - 130 - ladderW,
    Math.floor(WORLD_W * 0.26),
    Math.floor(WORLD_W * 0.40),
    Math.floor(WORLD_W * 0.56),
    Math.floor(WORLD_W * 0.70),
    Math.floor(WORLD_W * 0.48),
  ];

  let prevX = null;

  for (let i=0;i<platforms.length-1;i++){
    const lower = platforms[i];
    const upper = platforms[i+1];

    // pick from safe pool, avoid repeating same area
    let x = random(safeXs);
    if (prevX !== null && Math.abs(x - prevX) < 90){
      x = random(safeXs);
    }
    prevX = x;

    ladders.push({
      id:i,
      x,
      w: ladderW,
      yTop: upper.floorY,
      yBottom: lower.floorY,
      h: lower.floorY - upper.floorY,
      fromIndex:i,
      toIndex:i+1,
    });
  }
}

// ----------------------------------------------------
// ENTITIES / RUN CONTROL
// ----------------------------------------------------
function resetRun(){
  money = START_MONEY;
  level = 1;
  submittedThisRun = false;
  pendingSubmit = false;
  closeNameOverlay();

  // stop end music
  stopMusic("Victory"); stopMusic("Defeat"); endMusicNow = null;

  startLevel(1, true); // fresh run, resets money already done above
}

function startLevel(newLevel, clearProjectiles){
  level = clamp(newLevel, 1, MAX_LEVELS);

  // rebuild ladder layout for this level
  buildLevelLayout(LEVEL_SEED_BASE + level);

  // reset ladder progress per level (difficulty still ramps within the level)
  bestPlatformReached = 0;

  const base = platforms[0];
  const top  = platforms[platforms.length-1];

  // create or re-position player
  if (!player){
    player = {
      x: WORLD_W*0.18,
      footY: base.floorY,
      w:60, h:90,
      vx:0, vy:0,
      speed:340,
      gravity:1600,
      onGround:true,
      onLadder:false,
      ladderId:-1,
      facing:1,
      anim:"idle",
    };
  } else {
    player.x = WORLD_W*0.18;
    player.footY = base.floorY;
    player.vx = 0; player.vy = 0;
    player.onGround = true;
    player.onLadder = false;
    player.ladderId = -1;
    player.facing = 1;
    player.anim = "idle";
  }

  // villain: slightly more left, with tiny per-level variance
  const jitter = (level === 1) ? random(-10, 10) : random(-25, 25);
  if (!villain){
    villain = {
      x: WORLD_W*0.30 + jitter,
      footY: top.floorY,
      w:120, h:150,
      throwing:false,
      throwPoseT:0,
      goodFlashT:0,
      lastThrowWasGood:false,
    };
  } else {
    villain.x = WORLD_W*0.30 + jitter;
    villain.footY = top.floorY;
    villain.throwing = false;
    villain.throwPoseT = 0;
    villain.goodFlashT = 0;
    villain.lastThrowWasGood = false;
  }

  // princess: put LEFT of the top ladder, snug + a bit higher via FOOT_OFFSET_Y
  const topLadder = ladders[ladders.length - 1];
  const princessX = clamp(topLadder.x - 34, 120, WORLD_W - 140);

  if (!princess){
    princess = { x: princessX, footY: top.floorY, w:80, h:120 };
  } else {
    princess.x = princessX;
    princess.footY = top.floorY;
  }

  // projectiles & timers
  if (clearProjectiles) projectiles = [];
  villainThrowTimer = 0;
  lastMs = millis();
}

// ----------------------------------------------------
// DIFFICULTY
// ----------------------------------------------------
function difficultyLevel(){
  const ladderProgress = clamp(bestPlatformReached, 0, platforms.length - 1);
  const bonus = LEVEL_DIFFICULTY_BONUS[level] || 0;
  return clamp(ladderProgress + bonus, 0, (platforms.length - 1) + 3);
}

function throwIntervalMs(){
  const d = difficultyLevel();
  return clamp(1250 - d*140, 500, 1000);
}

function barrelRollSpeed(){
  const d = difficultyLevel();
  return 260 + d*32;
}

function fallSpeed(){
  const d = difficultyLevel();
  return 630 + d*40;
}

function plannedMinRollDist(d){
  const base = 270;
  const dec  = d * 14;
  return clamp(base - dec + random(-70, 110), 160, 380);
}

function projectileRightProbability(){
  const d = difficultyLevel();

  let pRight = 0.78;
  if (d === 1) pRight = 0.72;
  if (d === 2) pRight = 0.66;
  if (d === 3) pRight = 0.60;
  if (d >= 4)  pRight = 0.56;

  pRight += random(-0.07, 0.07);
  return clamp(pRight, 0.52, 0.86);
}

// Type weights: coins drop fast after you climb + after level bonus
function pickProjectileType(){
  const d = difficultyLevel();
  const coinChance = clamp(0.30 - d*0.07, 0.05, 0.30);
  const bombChance = clamp(0.34 + d*0.06, 0.34, 0.75);
  const r = random();
  if (r < coinChance) return "coin";
  if (r < coinChance + bombChance) return "bomb";
  return "barrel";
}

function projectileImage(type){
  if (type === "barrel") return img.projBarrel;
  if (type === "bomb") return img.projBomb;
  return img.projCoin;
}

function assignDropPlan(p){
  const d = difficultyLevel();

  // edge-friendly distribution
  const r = random();
  let dropX;
  if (r < 0.40) dropX = random(80, WORLD_W - 80);
  else if (r < 0.70) dropX = random(80, 260);
  else dropX = random(WORLD_W - 260, WORLD_W - 80);

  p.dropX = dropX;
  p.minRollDist = plannedMinRollDist(d);
  p.rollDist = 0;
  p.canDrop = false;
}

// ----------------------------------------------------
// PROJECTILES (Donkey path, better random drop)
// ----------------------------------------------------
function spawnProjectile(){
  const topIndex = platforms.length - 1;
  const top = platforms[topIndex];

  const type = pickProjectileType();
  const im = projectileImage(type);

  const w = 64, h = 64;

  const pRight = projectileRightProbability();
  const startDir = (random() < pRight) ? 1 : -1;

  const handOffset = (startDir === 1) ? 56 : -96;
  const spawnX = clamp(villain.x + handOffset, 10, WORLD_W - w - 10);

  const p = {
    type,
    img: im,
    w, h,
    x: spawnX,
    y: top.floorY - h,
    state: "ROLL",
    platformIndex: topIndex,
    dir: startDir,
    topDirOverride: true,
    rollSpeed: barrelRollSpeed() * (0.92 + random()*0.22),
    fallV: fallSpeed(),
    alive: true,

    dropX: 0,
    minRollDist: 0,
    rollDist: 0,
    canDrop: false,
  };

  assignDropPlan(p);

  projectiles.push(p);

  playSFX("Enemy_Throw");

  const isGood = (type === "coin");
  villain.throwing = true;
  villain.throwPoseT = 0.22;
  villain.lastThrowWasGood = isGood;
  if (isGood) villain.goodFlashT = 0.42;
}

function updateProjectiles(dt){
  const topIndex = platforms.length - 1;

  for (const p of projectiles){
    if (!p.alive) continue;

    if (p.state === "ROLL"){
      const plat = platforms[p.platformIndex];

      if (!(p.platformIndex === topIndex && p.topDirOverride)) p.dir = plat.dir;

      const prevX = p.x;
      p.x += p.dir * p.rollSpeed * dt;
      p.y = plat.floorY - p.h;

      p.rollDist += Math.abs(p.x - prevX);
      if (!p.canDrop && p.rollDist >= p.minRollDist) p.canDrop = true;

      const atLeft = (p.x <= -10);
      const atRight = (p.x + p.w >= WORLD_W + 10);

      let wantsPlannedDrop = false;
      const cx = p.x + p.w*0.5;
      if (p.canDrop){
        if (p.dir === 1 && cx >= p.dropX) wantsPlannedDrop = true;
        if (p.dir === -1 && cx <= p.dropX) wantsPlannedDrop = true;
      }

      // gentle surprise (only after eligible)
      const surprise = p.canDrop && (random() < 0.012);

      if (atLeft || atRight || wantsPlannedDrop || surprise){
        p.state = "FALL";
        p.topDirOverride = false;
        p.x = clamp(p.x, 10, WORLD_W - p.w - 10);
      }
    }
    else if (p.state === "FALL"){
      p.y += p.fallV * dt;

      const projBottom = p.y + p.h;
      let landingIndex = -1;
      let landingY = Infinity;

      for (let i=0;i<platforms.length;i++){
        const floorY = platforms[i].floorY;
        if (floorY >= projBottom - 2){
          if (floorY < landingY){
            landingY = floorY;
            landingIndex = i;
          }
        }
      }

      if (landingIndex !== -1 && projBottom >= landingY - 2){
        p.platformIndex = landingIndex;
        p.state = "ROLL";
        p.y = platforms[landingIndex].floorY - p.h;
        assignDropPlan(p);
      }

      if (p.y > WORLD_H + 120) p.alive = false;
    }

    // Collision with player
    const pr = rectFromEntity(player);
    if (p.alive && aabb(p.x, p.y, p.w, p.h, pr.x, pr.y, pr.w, pr.h)){
      applyProjectileHit(p);
      p.alive = false;
    }
  }

  projectiles = projectiles.filter(p => p.alive);
}

function applyProjectileHit(p){
  if (p.type === "barrel"){ money -= HIT_BARREL; playSFX("Barrel"); }
  if (p.type === "bomb")  { money -= HIT_BOMB;   playSFX("Bomb"); }
  if (p.type === "coin")  { money += GAIN_COIN;  playSFX("Coin"); }

  if (money <= 0){
    money = 0;
    endGame(false);
  }
}

// ----------------------------------------------------
// PLAYER + LADDER
// ----------------------------------------------------
function updatePlayer(dt){
  const left  = keyIsDown(LEFT_ARROW) || keyIsDown(65);
  const right = keyIsDown(RIGHT_ARROW) || keyIsDown(68);
  const up    = keyIsDown(UP_ARROW) || keyIsDown(87);
  const down  = keyIsDown(DOWN_ARROW) || keyIsDown(83);

  const nearLadder = getNearestLadder(player);

  if (!player.onLadder && nearLadder && (up || down)){
    player.onLadder = true;
    player.ladderId = nearLadder.id;
    player.x = nearLadder.x + nearLadder.w*0.5 - player.w*0.5;
    player.vx = 0;
    player.vy = 0;
    playSFX("Climb"); // one-shot
  }

  if (player.onLadder){
    const L = ladders[player.ladderId];
    player.anim = "climb";

    let v = 0;
    if (up) v = -260;
    if (down) v = 260;

    player.footY += v * dt;
    player.footY = clamp(player.footY, L.yTop, L.yBottom);

    player.x = L.x + L.w*0.5 - player.w*0.5;

    // Exit top
    if (player.footY <= L.yTop + 0.001){
      player.onLadder = false;
      player.ladderId = -1;
      player.footY = platforms[L.toIndex].floorY;
      player.onGround = true;
      player.vy = 0;
      bestPlatformReached = Math.max(bestPlatformReached, L.toIndex);
    }

    // Exit bottom
    if (player.footY >= L.yBottom - 0.001){
      player.onLadder = false;
      player.ladderId = -1;
      player.footY = platforms[L.fromIndex].floorY;
      player.onGround = true;
      player.vy = 0;
    }
    return;
  }

  player.vx = 0;
  if (left){  player.vx = -player.speed; player.facing = -1; }
  if (right){ player.vx =  player.speed; player.facing =  1; }

  player.x += player.vx * dt;
  player.x = clamp(player.x, 0, WORLD_W - player.w);

  player.vy += player.gravity * dt;
  player.footY += player.vy * dt;

  player.onGround = false;

  for (let i=0;i<platforms.length;i++){
    const floorY = platforms[i].floorY;
    const prevFootY = player.footY - player.vy * dt;
    const wasAbove = prevFootY <= floorY;
    const nowBelow = player.footY >= floorY;

    if (player.vy >= 0 && wasAbove && nowBelow){
      player.footY = floorY;
      player.vy = 0;
      player.onGround = true;
      bestPlatformReached = Math.max(bestPlatformReached, i);
      break;
    }
  }

  if (player.onGround){
    if (left) player.anim = "runL";
    else if (right) player.anim = "runR";
    else player.anim = "idle";
  } else {
    player.anim = (player.facing === 1) ? "runR" : "runL";
  }
}

function getNearestLadder(pl){
  const cx = pl.x + pl.w*0.5;
  const footY = pl.footY;

  let best = null;
  let bestDist = 1e9;

  for (const L of ladders){
    const inX = (cx >= L.x - 26) && (cx <= L.x + L.w + 26);
    const inY = (footY >= L.yTop - 160) && (footY <= L.yBottom + 120);
    if (!inX || !inY) continue;

    const dist = Math.abs(cx - (L.x + L.w*0.5));
    if (dist < bestDist){
      bestDist = dist;
      best = L;
    }
  }
  return best;
}

// ----------------------------------------------------
// VILLAIN UPDATE
// ----------------------------------------------------
function updateVillain(dt){
  villainThrowTimer += dt*1000;

  if (villain.throwPoseT > 0){
    villain.throwPoseT -= dt;
    if (villain.throwPoseT <= 0) villain.throwing = false;
  }

  if (villain.goodFlashT > 0){
    villain.goodFlashT -= dt;
    if (villain.goodFlashT <= 0){
      villain.goodFlashT = 0;
      villain.lastThrowWasGood = false;
    }
  }

  if (villainThrowTimer >= throwIntervalMs()){
    villainThrowTimer = 0;
    spawnProjectile();
  }
}

// ----------------------------------------------------
// WIN/LOSE (3 levels)
// ----------------------------------------------------
function updateWinLose(){
  if (gameState !== STATE.PLAY) return;

  const pr = rectFromEntity(player);
  const rr = rectFromEntity(princess);

  if (aabb(pr.x, pr.y, pr.w, pr.h, rr.x, rr.y, rr.w, rr.h)){
    // Advance levels until final win
    if (level < MAX_LEVELS){
      // small reset pressure, keep money
      startLevel(level + 1, true);
      // keep playing (no win screen)
      return;
    }
    endGame(true); // only now show win screen + leaderboard
  }
}

function endGame(isWin){
  gameState = isWin ? STATE.WIN : STATE.LOSE;

  stopMusic("MAIN_MENU");
  stopMusic("GameLoop");
  musicNow = null;

  if (isWin){
    playSFX("Game_over_win");
    playEndMusic("Victory");
    if (!submittedThisRun) openNameOverlay(); // FINAL ONLY
  } else {
    playSFX("Game_over_loose");
    playEndMusic("Defeat");
  }

  fetchGlobalTop10JSONP(true);
}

// ----------------------------------------------------
// DRAW LOOP
// ----------------------------------------------------
function draw(){
  const now = millis();
  const dt = clamp((now - lastMs)/1000, 0, 0.05);
  lastMs = now;

  if (audioReady){
    if (gameState === STATE.START) playMusic("MAIN_MENU");
    else if (gameState === STATE.PLAY) playMusic("GameLoop");
  }

  if (gameState === STATE.PLAY){
    updatePlayer(dt);
    updateVillain(dt);
    updateProjectiles(dt);
    updateWinLose();
  }

  renderWorld();
}

function renderWorld(){
  const sx = width / WORLD_W;
  const sy = height / WORLD_H;
  const s = Math.min(sx, sy);
  const dw = WORLD_W * s;
  const dh = WORLD_H * s;
  const dx = (width - dw)/2;
  const dy = (height - dh)/2;
  lastRender = { dx, dy, s, dw, dh };

  background(0);

  push();
  translate(dx, dy);
  scale(s);

  if (fontUI) textFont(fontUI);
  if (img.bg) image(img.bg, 0, 0, WORLD_W, WORLD_H);

  if (gameState === STATE.START){
    drawStart();
  } else {
    drawLevel();
    drawHUD();

    if (gameState === STATE.WIN){
      drawEndScreen(true);
      drawLeaderboardPanel();
    } else if (gameState === STATE.LOSE){
      drawEndScreen(false);
      drawLeaderboardPanel();
    }
  }

  pop();
}

// ----------------------------------------------------
// START SCREEN (NO shadow, NO stretch, HERO)
// ----------------------------------------------------
function drawStart(){
  if (img.startScreen) image(img.startScreen, 0, 0, WORLD_W, WORLD_H);

  const bw = START_BTN.bw;
  const bh = START_BTN.bh;
  const bx = (WORLD_W - bw)/2;
  const by = WORLD_H * START_BTN.byPct;

  // button image inside the box with extra scale (still no stretch)
  if (img.btnStart){
    const ar = img.btnStart.width / img.btnStart.height;
    let w = bw, h = bh;
    if (w / h > ar) w = h * ar;
    else h = w / ar;

    // hero scale (preserve aspect)
    w *= START_BTN.scale;
    h *= START_BTN.scale;

    // center on the box center
    const cx = bx + bw/2;
    const cy = by + bh/2;
    const x = cx - w/2;
    const y = cy - h/2;

    image(img.btnStart, x, y, w, h);
  } else {
    fill(255,200,0);
    rect(bx, by, bw, bh, 18);
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(80);
    text("START GAME", WORLD_W/2, by + bh/2);
  }

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(30);
  text("Click START", WORLD_W/2, WORLD_H*0.885);

  fill(255,220,0);
  textSize(22);
  text("Arrows to move • Use ladders to climb • Press V for Audio Mixer", WORLD_W/2, WORLD_H*0.925);
}

// ----------------------------------------------------
// LEVEL DRAW
// ----------------------------------------------------
function drawLevel(){
  // ladders first, then platforms (platforms draw over ladders)
  for (const L of ladders) drawLadder(L);
  for (const plat of platforms) drawPlatform(plat);

  drawVillain();
  drawPrincess();

  for (const p of projectiles) drawProjectile(p);

  drawPlayer();

  if (showTutorialOverlay) drawTutorialOverlay();
}

function drawPlatform(plat){
  const y = plat.floorY;

  let im = img.platformMid;
  if (plat.kind === "base") im = img.platformBase;
  if (plat.kind === "top") im = img.platformTop;
  if (!im) return;

  const offset = (plat.kind === "base") ? PLATFORM_DRAW_OFFSET_Y.base
               : (plat.kind === "mid")  ? PLATFORM_DRAW_OFFSET_Y.mid
               : PLATFORM_DRAW_OFFSET_Y.top;

  if (plat.kind === "top"){
    const h = im.height;
    image(im, 0, (y - h) + offset, WORLD_W, h);
    return;
  }

  const tileH = im.height;
  const tileW = im.width;
  for (let x=0; x<WORLD_W; x += tileW){
    image(im, x, (y - tileH) + offset, tileW, tileH);
  }
}

function drawLadder(L){
  if (!img.ladder) return;
  const yDraw = L.yTop - LADDER_OVERLAP_TOP;
  const hDraw = L.h + LADDER_OVERLAP_TOP + LADDER_OVERLAP_BOTTOM;
  image(img.ladder, L.x, yDraw, L.w, hDraw);
}

// ----------------------------------------------------
// DRAW ENTITIES
// ----------------------------------------------------
function drawPlayer(){
  let im = img.playerIdle;
  if (player.anim === "runL") im = img.playerRunL || img.playerIdle;
  if (player.anim === "runR") im = img.playerRunR || img.playerIdle;
  if (player.anim === "climb") im = img.playerClimb || img.playerIdle;
  drawEntitySprite(im, player.x, player.footY, 72, 108, FOOT_OFFSET_Y.player);
}

function drawVillain(){
  const showGood = (villain.goodFlashT > 0) || (villain.throwing && villain.lastThrowWasGood);
  const im = villain.throwing
    ? (showGood ? (img.villainThrowGood || img.villainThrowEvil) : (img.villainThrowEvil || img.villainThrowGood))
    : (showGood ? (img.villainIdleGood || img.villainIdleEvil) : (img.villainIdleEvil || img.villainIdleGood));
  if (!im) return;

  drawEntitySprite(im, villain.x - 120/2, villain.footY, 150, 180, FOOT_OFFSET_Y.villain);
}

function drawPrincess(){
  if (!img.princess) return;
  drawEntitySprite(img.princess, princess.x - 80/2, princess.footY, 90, 140, FOOT_OFFSET_Y.princess);
}

function drawProjectile(p){
  if (!p.img) return;
  drawSpriteFit(p.img, p.x, p.y, p.w, p.h);
}

function drawEntitySprite(im, xLeft, footY, spriteW, spriteH, footOffsetY){
  if (!im) return;
  const yTop = footY - spriteH + (footOffsetY || 0);
  drawSpriteFit(im, xLeft, yTop, spriteW, spriteH);
}

// ----------------------------------------------------
// HUD (money + level)
// ----------------------------------------------------
function drawHUD(){
  fill(0,140);
  noStroke();
  rect(0,0,WORLD_W,70);

  fill(255);
  textAlign(LEFT, CENTER);
  textSize(24);
  text("MONEY:", 40, 35);

  fill(money <= HIT_BARREL ? color(255,90,90) : color(140,255,170));
  text(`${money.toLocaleString("en-US")} FT`, 155, 35);

  fill(255);
  textAlign(RIGHT, CENTER);
  textSize(22);
  text(`LEVEL ${level}/${MAX_LEVELS}`, WORLD_W - 40, 35);
}

// ----------------------------------------------------
// END SCREENS + LB
// ----------------------------------------------------
function drawEndScreen(isWin){
  if (isWin && img.winScreen) image(img.winScreen, 0, 0, WORLD_W, WORLD_H);
  if (!isWin && img.loseScreen) image(img.loseScreen, 0, 0, WORLD_W, WORLD_H);

  fill(0,160);
  rect(0,0,WORLD_W,WORLD_H);

  textAlign(CENTER, CENTER);
  fill(255);
  textSize(46);
  text(isWin ? "VICTORY" : "DEFEAT", WORLD_W/2, WORLD_H*0.20);

  textSize(22);
  text(`FINAL MONEY: ${money.toLocaleString("en-US")} FT`, WORLD_W/2, WORLD_H*0.25);

  if (!isWin){
    textSize(22);
    fill(255,220,0);
    text("TAP TO RESTART", WORLD_W/2, WORLD_H*0.32);
  }
}

function drawLeaderboardPanel(){
  const panelW = 860;
  const panelH = 520;
  const x = (WORLD_W - panelW)/2;
  const y = WORLD_H * 0.36;

  fill(0,200);
  noStroke();
  rect(x,y,panelW,panelH,18);

  fill(255);
  textAlign(LEFT, TOP);
  textSize(22);
  text("LEADERBOARD (Top 10)", x+24, y+20);

  if (globalLBLoading && (!globalTop10 || globalTop10.length===0)){
    textSize(18);
    fill(255,220,0);
    text("Loading…", x+24, y+66);
    return;
  }

  const list = (globalTop10 && globalTop10.length) ? globalTop10 : [];
  if (!list.length){
    textSize(18);
    fill(255,220,0);
    text("No scores yet.", x+24, y+66);
    return;
  }

  const startY = y + 78;
  const rowH = 42;

  textSize(20);
  for (let i=0;i<Math.min(10,list.length);i++){
    const r = list[i];
    const rank = i+1;
    const name = String(r.name || "PLAYER").toUpperCase();
    const score = Number(r.money ?? r.score ?? 0);

    fill(255);
    textAlign(LEFT, CENTER);
    text(`${rank}. ${name}`, x+26, startY + i*rowH + 16);

    fill(255,220,0);
    textAlign(RIGHT, CENTER);
    text(`${score.toLocaleString("en-US")} FT`, x+panelW-26, startY + i*rowH + 16);
  }

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  text("Click to restart", WORLD_W/2, y + panelH - 26);
}

// ----------------------------------------------------
// TUTORIAL OVERLAY
// ----------------------------------------------------
function drawTutorialOverlay(){
  fill(0,210);
  rect(0,0,WORLD_W,WORLD_H);

  const cardW = TUTORIAL_UI.cardW;
  const cardH = TUTORIAL_UI.cardH;
  const x = (WORLD_W - cardW)/2;
  const y = (WORLD_H - cardH)/2;

  fill(0,230);
  rect(x,y,cardW,cardH,22);

  fill(255);
  textAlign(CENTER, TOP);
  textSize(TUTORIAL_UI.titleSize);
  text("HOW TO PLAY", WORLD_W/2, y+30);

  fill(255,220,0);
  textSize(TUTORIAL_UI.bodySize);

  const lines = [
    "LEFT / RIGHT: Move",
    "UP / DOWN: Climb when near a ladder",
    "Avoid barrels and bombs",
    "Collect coins to increase money",
    "Reach the princess to win",
    "",
    "CLICK TO CONTINUE",
  ];

  let yy = y + 120;
  for (const line of lines){
    text(line, WORLD_W/2, yy);
    yy += TUTORIAL_UI.lineGap;
  }
}

// ----------------------------------------------------
// INPUT
// ----------------------------------------------------
function isOverlayOpen(){
  return nameOverlay && nameOverlay.elt && nameOverlay.elt.style.display !== "none";
}

function mousePressed(){
  ensureAudioReady();
  if (isOverlayOpen()) return;

  const w = screenToWorld(mouseX, mouseY);

  if (gameState === STATE.START){
    const bw = START_BTN.bw, bh = START_BTN.bh;
    const bx = (WORLD_W - bw)/2;
    const by = WORLD_H * START_BTN.byPct;

    if (w.x>=bx && w.x<=bx+bw && w.y>=by && w.y<=by+bh){
      playSFX("Button");
      // Fresh run on start
      money = START_MONEY;
      submittedThisRun = false;
      startLevel(1, true);
      gameState = STATE.PLAY;

      if (!tutorialSeenThisSession) showTutorialOverlay = true;
    }
    return;
  }

  if (gameState === STATE.PLAY){
    if (showTutorialOverlay){
      showTutorialOverlay = false;
      tutorialSeenThisSession = true;
    }
    return;
  }

  if (gameState === STATE.WIN || gameState === STATE.LOSE){
    resetRun();
    gameState = STATE.START;
    playSFX("Button");
  }
}

function keyPressed(){
  if (key === "v" || key === "V") toggleAudioUI();
  ensureAudioReady();
  if (isOverlayOpen()) return;

  if ((gameState === STATE.WIN || gameState === STATE.LOSE) && (key === "r" || key === "R")){
    resetRun();
    gameState = STATE.START;
    playSFX("Button");
  }
}

// ----------------------------------------------------
// COLLISION / SPRITES / MAPPING
// ----------------------------------------------------
function aabb(ax,ay,aw,ah, bx,by,bw,bh){
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function rectFromEntity(e){
  return { x:e.x, y:e.footY - e.h, w:e.w, h:e.h };
}

function drawSpriteFit(im, x, y, w, h){
  const ar = im.width / im.height;
  let dw = w, dh = h;
  if (dw/dh > ar) dw = dh*ar;
  else dh = dw/ar;

  const dx = x + (w - dw)/2;
  const dy = y + (h - dh)/2;
  image(im, dx, dy, dw, dh);
}

function screenToWorld(sx, sy){
  const { dx, dy, s } = lastRender;
  const wx = (sx - dx)/s;
  const wy = (sy - dy)/s;
  return { x: clamp(wx, 0, WORLD_W), y: clamp(wy, 0, WORLD_H) };
}

// ----------------------------------------------------
// NAME OVERLAY (WIN only, final level)
// ----------------------------------------------------
function initNameOverlay(){
  nameOverlay = createDiv("");
  nameOverlay.style("position","fixed");
  nameOverlay.style("left","0");
  nameOverlay.style("top","0");
  nameOverlay.style("width","100vw");
  nameOverlay.style("height","100vh");
  nameOverlay.style("display","none");
  nameOverlay.style("align-items","center");
  nameOverlay.style("justify-content","center");
  nameOverlay.style("background","rgba(0,0,0,0.60)");
  nameOverlay.style("z-index","9999");
  nameOverlay.style("pointer-events","auto");

  nameCard = createDiv("");
  nameCard.parent(nameOverlay);
  nameCard.style("width","min(92vw, 520px)");
  nameCard.style("background","rgba(10,10,10,0.92)");
  nameCard.style("border","2px solid rgba(255,255,255,0.14)");
  nameCard.style("border-radius","16px");
  nameCard.style("padding","18px 18px 16px 18px");
  nameCard.style("box-shadow","0 10px 30px rgba(0,0,0,0.45)");
  nameCard.style("color","#fff");
  nameCard.style("font-family","system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif");

  const title = createDiv("Submit your name to the leaderboard");
  title.parent(nameCard);
  title.style("font-weight","700");
  title.style("font-size","18px");
  title.style("margin-bottom","10px");

  const sub = createDiv("Your score is your FINAL MONEY.");
  sub.parent(nameCard);
  sub.style("opacity","0.85");
  sub.style("font-size","14px");
  sub.style("margin-bottom","14px");

  nameInput = createInput("");
  nameInput.parent(nameCard);
  nameInput.attribute("placeholder","Your name (e.g. FRANK)");
  nameInput.style("width","100%");
  nameInput.style("padding","12px 12px");
  nameInput.style("border-radius","12px");
  nameInput.style("border","1px solid rgba(255,255,255,0.18)");
  nameInput.style("background","rgba(255,255,255,0.06)");
  nameInput.style("color","#fff");
  nameInput.style("outline","none");
  nameInput.style("font-size","16px");
  nameInput.style("margin-bottom","12px");

  submitBtn = createButton("SUBMIT");
  submitBtn.parent(nameCard);
  submitBtn.style("width","100%");
  submitBtn.style("padding","12px 12px");
  submitBtn.style("border-radius","12px");
  submitBtn.style("border","none");
  submitBtn.style("background","#ffc400");
  submitBtn.style("color","#111");
  submitBtn.style("font-weight","800");
  submitBtn.style("letter-spacing","0.04em");
  submitBtn.style("cursor","pointer");

  overlayMsg = createDiv("");
  overlayMsg.parent(nameCard);
  overlayMsg.style("margin-top","10px");
  overlayMsg.style("font-size","13px");
  overlayMsg.style("opacity","0.9");

  submitBtn.mousePressed(async ()=>{
    ensureAudioReady();
    if (pendingSubmit) return;

    const nm = (nameInput.value()||"").trim();
    if (!nm){ overlayMsg.html("Please enter a name."); return; }

    pendingSubmit = true;
    overlayMsg.html("Submitting…");
    submitBtn.attribute("disabled","");

    try{
      playSFX("Button");
      await submitGlobalScore(nm, money);
      submittedThisRun = true;
      optimisticInsertIntoGlobalTop10(nm, money);
      fetchGlobalTop10JSONP(true);
      setTimeout(()=>fetchGlobalTop10JSONP(true), 1200);

      overlayMsg.html("Submitted!");
      closeNameOverlay();
    }catch(e){
      overlayMsg.html("Error submitting. Try again.");
      submitBtn.removeAttribute("disabled");
      pendingSubmit = false;
    }
  });
}

function openNameOverlay(){
  nameOverlay.style("display","flex");
  overlayMsg.html("");
  pendingSubmit = false;
  submitBtn.removeAttribute("disabled");
  setTimeout(()=>nameInput.elt && nameInput.elt.focus(), 80);
}
function closeNameOverlay(){
  nameOverlay.style("display","none");
  pendingSubmit = false;
}

// ----------------------------------------------------
// LEADERBOARD (GET submit + JSONP)
// ----------------------------------------------------
async function submitGlobalScore(name, moneyScore){
  const url =
    GOOGLE_ENDPOINT +
    "?action=submit" +
    "&name=" + encodeURIComponent(name) +
    "&money=" + encodeURIComponent(String(moneyScore)) +
    "&_ts=" + Date.now();
  await fetch(url, { method:"GET", mode:"no-cors" });
}

function optimisticInsertIntoGlobalTop10(name, moneyScore){
  const entry = { ts:new Date().toISOString(), name, money:Number(moneyScore||0) };
  const merged = Array.isArray(globalTop10) ? globalTop10.slice() : [];

  const key = name.trim().toUpperCase();
  let replaced = false;

  for (let i=0;i<merged.length;i++){
    const e = merged[i];
    const en = String(e.name||"").trim().toUpperCase();
    const eMoney = Number(e.money ?? e.score ?? 0);
    if (en === key){
      if (entry.money > eMoney) merged[i] = entry;
      replaced = true;
      break;
    }
  }
  if (!replaced) merged.push(entry);

  merged.sort((a,b)=>Number(b.money ?? b.score ?? 0) - Number(a.money ?? a.score ?? 0));
  globalTop10 = merged.slice(0,10);
}

function fetchGlobalTop10JSONP(force=false){
  const now = Date.now();
  if (globalLBLoading) return;
  if (!force && (now - globalLBLastFetchMs < 6000)) return;

  globalLBLoading = true;
  globalLBLastFetchMs = now;

  const cbName = "__towerMasksLB_" + Math.floor(Math.random()*1e9);

  window[cbName] = function(payload){
    try{
      if (payload && Array.isArray(payload.items)) globalTop10 = payload.items.slice(0,10);
      else if (Array.isArray(payload)) globalTop10 = payload.slice(0,10);
      else if (payload && payload.ok && Array.isArray(payload.items)) globalTop10 = payload.items.slice(0,10);
    } finally {
      globalLBLoading = false;
      try{ delete window[cbName]; }catch(e){ window[cbName] = undefined; }
    }
  };

  const url =
    GOOGLE_ENDPOINT +
    "?action=leaderboard&limit=10" +
    "&callback=" + encodeURIComponent(cbName) +
    "&_ts=" + now;

  const s = document.createElement("script");
  s.src = url;
  s.async = true;
  s.onerror = ()=>{
    globalLBLoading = false;
    try{ delete window[cbName]; }catch(e){ window[cbName] = undefined; }
  };
  document.body.appendChild(s);
  setTimeout(()=>{ try{ s.remove(); }catch(e){} }, 8000);
}
