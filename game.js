(() => {
  const canvas = document.getElementById("gameCanvas");
  const canvasShell = document.querySelector(".canvas-shell");
  const playfieldFrame = document.querySelector(".playfield-frame");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const overlayTag = document.getElementById("overlayTag");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const stageBanner = document.getElementById("stageBanner");
  const toolbarStageLabel = document.getElementById("toolbarStageLabel");

  const infoModal = document.getElementById("infoModal");
  const infoTitle = document.getElementById("infoTitle");
  const infoBody = document.getElementById("infoBody");
  const controlsTemplate = document.getElementById("controlsTemplate");
  const rulesTemplate = document.getElementById("rulesTemplate");
  const closeInfoBtn = document.getElementById("closeInfoBtn");
  const infoBackdrop = document.getElementById("infoBackdrop");
  const helpButtons = document.querySelectorAll("[data-help]");

  const W = canvas.width;
  const H = canvas.height;
  const keys = Object.create(null);
  const enemyId = { value: 0 };
  const PI = Math.PI;
  const PLAYER_COLOR = "#77f4ff";
  const PLAYER_HIT_COLOR = "#ffffff";
  const MAX_DT = 1 / 30;
  const layoutState = {
    width: 0,
    height: 0,
    scale: 0
  };

  const BUFFS = {
    scatter: { label: "散射", duration: 12, color: "#76f0ff" },
    invincible: { label: "无敌", duration: 8, color: "#ffd46d" },
    ricochet: { label: "反弹", duration: 12, color: "#ff8c8c" }
  };

  const STAGES = [
    {
      name: "第 1 关 · 边境哨戒",
      enemyMix: ["scout"],
      featuredEnemy: "棱蜂侦察机",
      targetScore: 1800,
      minTime: 22,
      bossName: "蜂群女王"
    },
    {
      name: "第 2 关 · 烈流阵线",
      enemyMix: ["scout", "lancer"],
      featuredEnemy: "裂枪突击艇",
      targetScore: 5200,
      minTime: 28,
      bossName: "钢翼魔鬼鱼"
    },
    {
      name: "第 3 关 · 蚀日回廊",
      enemyMix: ["scout", "lancer", "orbiter"],
      featuredEnemy: "轨环浮游核",
      targetScore: 9200,
      minTime: 35,
      bossName: "蚀光核心"
    },
    {
      name: "第 4 关 · 钢铁坠带",
      enemyMix: ["scout", "lancer", "orbiter", "fortress"],
      featuredEnemy: "堡垒重装舰",
      targetScore: 14200,
      minTime: 42,
      bossName: "泰坦母舰"
    },
    {
      name: "第 5 关 · 虚空之门",
      enemyMix: ["scout", "lancer", "orbiter", "fortress", "phantom"],
      featuredEnemy: "幻影折跃机",
      targetScore: 19800,
      minTime: 50,
      bossName: "虚空炽天使"
    }
  ];

  const BOSS_ORDER = ["hornet", "manta", "core", "carrier", "seraph"];

  function loadHighScore() {
    try {
      const raw = window.localStorage.getItem("star-sky-plane-war-high-score");
      return raw ? Number(raw) || 0 : 0;
    } catch (error) {
      return 0;
    }
  }

  function saveHighScore(value) {
    try {
      window.localStorage.setItem("star-sky-plane-war-high-score", String(value));
    } catch (error) {
      return;
    }
  }

  function formatScore(value) {
    return Math.floor(value).toLocaleString("zh-CN");
  }

  function isInfoOpen() {
    return infoModal.classList.contains("visible");
  }

  function openInfoModal(kind) {
    for (const code of Object.keys(keys)) {
      keys[code] = false;
    }
    const isRules = kind === "rules";
    if (game.state === "running") {
      game.infoResumeState = "running";
      game.state = "paused";
    } else {
      game.infoResumeState = "";
    }
    infoTitle.textContent = isRules ? "玩法规则" : "操作";
    infoBody.innerHTML = (isRules ? rulesTemplate : controlsTemplate).innerHTML;
    infoModal.classList.add("visible");
    infoModal.setAttribute("aria-hidden", "false");
    syncModeText();
    updateSidebar();
  }

  function closeInfoModal() {
    infoModal.classList.remove("visible");
    infoModal.setAttribute("aria-hidden", "true");
    if (game.infoResumeState === "running") {
      game.state = "running";
      game.lastFrame = performance.now();
    }
    game.infoResumeState = "";
    syncModeText();
    updateSidebar();
  }

  const game = {
    state: "menu",
    infoResumeState: "",
    time: 0,
    lastFrame: 0,
    score: 0,
    highScore: loadHighScore(),
    stageIndex: 0,
    stageTimer: 0,
    endless: false,
    spawnTimer: 0,
    bossMinionTimer: 0,
    endlessBossWaveActive: false,
    nextEndlessBossScore: 23800,
    currentBossLabel: "",
    stars: createStars(),
    player: null,
    enemies: [],
    bosses: [],
    playerBullets: [],
    enemyBullets: [],
    pickups: [],
    particles: [],
    floatingTexts: []
  };

  function layoutCanvas(force = false) {
    const styles = window.getComputedStyle(playfieldFrame);
    const availableWidth =
      playfieldFrame.clientWidth -
      parseFloat(styles.paddingLeft) -
      parseFloat(styles.paddingRight);
    const availableHeight =
      playfieldFrame.clientHeight -
      parseFloat(styles.paddingTop) -
      parseFloat(styles.paddingBottom);

    if (availableWidth <= 0 || availableHeight <= 0) {
      if (force) {
        window.requestAnimationFrame(() => layoutCanvas(false));
      }
      return;
    }

    const scale = Math.min(availableWidth / W, availableHeight / H);
    const targetWidth = Math.max(1, Math.floor(W * scale));
    const targetHeight = Math.max(1, Math.floor(H * scale));

    if (
      !force &&
      layoutState.width === targetWidth &&
      layoutState.height === targetHeight &&
      Math.abs(layoutState.scale - scale) < 0.0001
    ) {
      return;
    }

    layoutState.width = targetWidth;
    layoutState.height = targetHeight;
    layoutState.scale = scale;
    canvasShell.style.width = `${targetWidth}px`;
    canvasShell.style.height = `${targetHeight}px`;
  }

  function createStars() {
    return Array.from({ length: 96 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 1 + Math.random() * 2.5,
      speed: 20 + Math.random() * 90,
      twinkle: Math.random() * PI * 2
    }));
  }

  function createPlayer() {
    return {
      x: W / 2,
      y: H - 90,
      radius: 18,
      width: 28,
      height: 34,
      maxHp: 180,
      hp: 180,
      attack: 16,
      defense: 6,
      speed: 330,
      level: 1,
      exp: 0,
      expToNext: 100,
      fireCooldown: 0.18,
      fireTimer: 0,
      damageCooldown: 0,
      levelUpGlow: 0,
      showHealthUntil: 0,
      buffs: {
        scatter: 0,
        invincible: 0,
        ricochet: 0
      }
    };
  }

  function resetGame() {
    game.time = 0;
    game.stageIndex = 0;
    game.stageTimer = 0;
    game.endless = false;
    game.spawnTimer = 0.4;
    game.bossMinionTimer = 2.4;
    game.endlessBossWaveActive = false;
    game.nextEndlessBossScore = 23800;
    game.currentBossLabel = "";
    game.enemies = [];
    game.bosses = [];
    game.playerBullets = [];
    game.enemyBullets = [];
    game.pickups = [];
    game.particles = [];
    game.floatingTexts = [];
    game.player = createPlayer();
    game.score = 0;
    showBanner(`${STAGES[0].name} · 新敌机 ${STAGES[0].featuredEnemy}`, 2200);
    setOverlay(
      "准备出击",
      "空格开始 · P 暂停",
      "HTML Plane War",
      false
    );
    syncModeText();
    updateSidebar();
  }

  function showOverlay(title, text, tag = "HTML Plane War") {
    overlayTag.textContent = tag;
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlay.classList.add("visible");
  }

  function setOverlay(title, text, tag = "HTML Plane War", visible = true) {
    overlayTag.textContent = tag;
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlay.classList.toggle("visible", visible);
  }

  function hideOverlay() {
    overlay.classList.remove("visible");
  }

  function showBanner(text, duration = 1600) {
    stageBanner.textContent = text;
    stageBanner.classList.add("show");
    window.clearTimeout(showBanner.timerId);
    showBanner.timerId = window.setTimeout(() => {
      stageBanner.classList.remove("show");
    }, duration);
  }

  function currentStage() {
    return STAGES[Math.min(game.stageIndex, STAGES.length - 1)];
  }

  function currentStageName() {
    return game.endless ? "无限模式" : currentStage().name;
  }

  function canTriggerStageBoss() {
    const stage = currentStage();
    return game.score >= stage.targetScore && game.stageTimer >= stage.minTime;
  }

  function getStageGateProgress() {
    const stage = currentStage();
    const scoreRatio = clamp(game.score / stage.targetScore, 0, 1);
    const timeRatio = clamp(game.stageTimer / stage.minTime, 0, 1);
    return Math.min(scoreRatio, timeRatio);
  }

  function getStageGateText() {
    const stage = currentStage();
    return `${formatScore(game.score)} / ${formatScore(stage.targetScore)} · ${Math.floor(game.stageTimer)} / ${stage.minTime}s`;
  }

  function syncModeText() {
    return;
  }

  function startGame() {
    resetGame();
    game.state = "running";
    hideOverlay();
    syncModeText();
  }

  function gameOver() {
    game.state = "gameover";
    if (game.score > game.highScore) {
      game.highScore = game.score;
      saveHighScore(game.highScore);
    }
    showOverlay(
      "任务失败",
      `得分 ${formatScore(game.score)} · 最高 ${formatScore(game.highScore)} · 空格重开`,
      "Game Over"
    );
    syncModeText();
    updateSidebar();
  }

  function togglePause() {
    if (game.state === "running") {
      game.state = "paused";
      showOverlay("已暂停", "按 P 继续", "Paused");
      syncModeText();
      return;
    }

    if (game.state === "paused") {
      game.state = "running";
      hideOverlay();
      game.lastFrame = performance.now();
      syncModeText();
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickOne(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function magnitude(x, y) {
    return Math.hypot(x, y) || 1;
  }

  function normalize(x, y) {
    const len = magnitude(x, y);
    return { x: x / len, y: y / len };
  }

  function damageAfterDefense(raw, defense) {
    return Math.max(1, Math.round(raw - defense * 0.48));
  }

  function createEnemy(kind, options = {}) {
    const levelScale = options.scale ?? 1;
    const stageBonus = options.stageBonus ?? 0;
    const x = options.x ?? rand(60, W - 60);
    const y = options.y ?? -40;
    const seed = Math.random() * PI * 2;
    const id = `enemy-${enemyId.value += 1}`;
    const enemy = {
      id,
      kind,
      x,
      y,
      baseX: x,
      radius: 18,
      hp: 40,
      maxHp: 40,
      defense: 0,
      speed: 120,
      touchDamage: 18,
      bulletDamage: 10,
      fireRate: 1.5,
      fireTimer: rand(0.2, 0.8),
      age: 0,
      seed,
      value: 50,
      exp: 24,
      color: "#ff9f68",
      showHealthUntil: 0,
      alpha: 1,
      scale: levelScale,
      stageBonus,
      vx: 0,
      vy: 120
    };

    if (kind === "scout") {
      enemy.radius = 17;
      enemy.hp = 34 + stageBonus * 7;
      enemy.maxHp = enemy.hp;
      enemy.speed = 170 + stageBonus * 5;
      enemy.vy = enemy.speed;
      enemy.touchDamage = 16 + stageBonus * 2;
      enemy.bulletDamage = 12 + stageBonus;
      enemy.fireRate = 1.45;
      enemy.value = 48;
      enemy.exp = 20;
      enemy.color = "#ffb36b";
    } else if (kind === "lancer") {
      enemy.radius = 19;
      enemy.hp = 56 + stageBonus * 10;
      enemy.maxHp = enemy.hp;
      enemy.speed = 145;
      enemy.vy = enemy.speed * 0.9;
      enemy.touchDamage = 20 + stageBonus * 2;
      enemy.bulletDamage = 14 + stageBonus;
      enemy.fireRate = 1.9;
      enemy.value = 72;
      enemy.exp = 30;
      enemy.color = "#83d8ff";
    } else if (kind === "orbiter") {
      enemy.radius = 22;
      enemy.hp = 92 + stageBonus * 16;
      enemy.maxHp = enemy.hp;
      enemy.speed = 116;
      enemy.vy = enemy.speed * 0.72;
      enemy.touchDamage = 22 + stageBonus * 2;
      enemy.bulletDamage = 12 + stageBonus;
      enemy.fireRate = 2.55;
      enemy.value = 108;
      enemy.exp = 44;
      enemy.color = "#9cc0ff";
    } else if (kind === "fortress") {
      enemy.radius = 26;
      enemy.hp = 182 + stageBonus * 24;
      enemy.maxHp = enemy.hp;
      enemy.speed = 74;
      enemy.vy = enemy.speed * 0.55;
      enemy.touchDamage = 28 + stageBonus * 2;
      enemy.bulletDamage = 18 + stageBonus;
      enemy.fireRate = 2.2;
      enemy.value = 160;
      enemy.exp = 68;
      enemy.color = "#b9ffd2";
    } else if (kind === "phantom") {
      enemy.radius = 20;
      enemy.hp = 122 + stageBonus * 18;
      enemy.maxHp = enemy.hp;
      enemy.speed = 188;
      enemy.vy = enemy.speed * 0.8;
      enemy.touchDamage = 25 + stageBonus * 2;
      enemy.bulletDamage = 17 + stageBonus;
      enemy.fireRate = 1.15;
      enemy.value = 190;
      enemy.exp = 76;
      enemy.color = "#f8a2ff";
      enemy.dashTimer = rand(1.2, 2.2);
      enemy.dashTime = 0;
    }

    const hpScale = kind === "scout" ? 0.95 : 1;
    enemy.maxHp = Math.round(enemy.maxHp * levelScale * hpScale);
    enemy.hp = enemy.maxHp;
    enemy.touchDamage = Math.round(enemy.touchDamage * Math.sqrt(levelScale));
    enemy.bulletDamage = Math.round(enemy.bulletDamage * Math.sqrt(levelScale));
    enemy.speed *= 1 + (levelScale - 1) * 0.24;
    enemy.value = Math.round(enemy.value * (1 + (levelScale - 1) * 0.55));
    enemy.exp = Math.round(enemy.exp * (1 + (levelScale - 1) * 0.42));

    return enemy;
  }

  function createBoss(bossKind, options = {}) {
    const stageScale = options.scale ?? 1;
    const x = options.x ?? W / 2;
    const y = options.y ?? 100;
    const boss = {
      id: `boss-${enemyId.value += 1}`,
      bossKind,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: 62,
      hp: 1200,
      maxHp: 1200,
      defense: 0,
      value: 900,
      exp: 220,
      touchDamage: 35,
      fireTimer: 0.4,
      burstTimer: 1.5,
      phaseTimer: 0,
      summonTimer: 3,
      age: 0,
      color: "#ff8c75",
      movePhase: Math.random() * PI * 2,
      showHealthUntil: Infinity,
      scale: stageScale,
      label: ""
    };

    if (bossKind === "hornet") {
      boss.label = "蜂群女王";
      boss.radius = 66;
      boss.hp = 1480;
      boss.defense = 3;
      boss.value = 980;
      boss.exp = 260;
      boss.touchDamage = 34;
      boss.color = "#ffb865";
    } else if (bossKind === "manta") {
      boss.label = "钢翼魔鬼鱼";
      boss.radius = 72;
      boss.hp = 2280;
      boss.defense = 5;
      boss.value = 1260;
      boss.exp = 340;
      boss.touchDamage = 38;
      boss.color = "#6dd4ff";
    } else if (bossKind === "core") {
      boss.label = "蚀光核心";
      boss.radius = 74;
      boss.hp = 3320;
      boss.defense = 7;
      boss.value = 1680;
      boss.exp = 420;
      boss.touchDamage = 42;
      boss.color = "#9da9ff";
      boss.spiralAngle = 0;
    } else if (bossKind === "carrier") {
      boss.label = "泰坦母舰";
      boss.radius = 82;
      boss.hp = 4560;
      boss.defense = 10;
      boss.value = 2350;
      boss.exp = 520;
      boss.touchDamage = 48;
      boss.color = "#90ffd0";
    } else if (bossKind === "seraph") {
      boss.label = "虚空炽天使";
      boss.radius = 76;
      boss.hp = 6120;
      boss.defense = 13;
      boss.value = 3200;
      boss.exp = 640;
      boss.touchDamage = 54;
      boss.color = "#ffa1f4";
      boss.dashTimer = 2.3;
    }

    boss.maxHp = Math.round(boss.hp * stageScale);
    boss.hp = boss.maxHp;
    boss.defense = Math.max(0, Math.round(boss.defense * (1 + (stageScale - 1) * 0.45)));
    boss.value = Math.round(boss.value * (1 + (stageScale - 1) * 0.7));
    boss.exp = Math.round(boss.exp * (1 + (stageScale - 1) * 0.55));
    boss.touchDamage = Math.round(boss.touchDamage * (0.92 + Math.sqrt(stageScale) * 0.35));
    return boss;
  }

  function getEndlessScale() {
    return 1 + Math.max(0, game.score - STAGES[4].targetScore) / 18000;
  }

  function pickEnemyForStage() {
    const mix = currentStage().enemyMix;
    const weights = [];
    for (let i = 0; i < mix.length; i += 1) {
      const repeat = i === mix.length - 1 ? 5 : i + 2;
      for (let j = 0; j < repeat; j += 1) {
        weights.push(mix[i]);
      }
    }
    return pickOne(weights);
  }

  function spawnEnemy(kind, options = {}) {
    const enemy = createEnemy(kind, options);
    game.enemies.push(enemy);
    return enemy;
  }

  function spawnBossForStage(stageIndex, scale = 1, x = W / 2) {
    const bossKind = BOSS_ORDER[Math.min(stageIndex, BOSS_ORDER.length - 1)];
    const boss = createBoss(bossKind, { scale, x });
    game.bosses.push(boss);
    game.currentBossLabel = boss.label;
    showBanner(`Boss 出现：${boss.label}`, 2400);
    syncModeText();
  }

  function startBossFight() {
    game.bossMinionTimer = 2;
    spawnBossForStage(game.stageIndex, 1);
    syncModeText();
  }

  function enterEndlessMode() {
    game.endless = true;
    game.stageIndex = STAGES.length - 1;
    game.endlessBossWaveActive = false;
    game.nextEndlessBossScore = Math.max(game.nextEndlessBossScore, game.score + 3800);
    showBanner("第 5 关完成，进入无限模式", 2600);
    createFloatingText(W / 2, H / 2, "无限模式开启", "#ffd46d", 1.6, 0);
    syncModeText();
  }

  function finishBossFight(boss) {
    game.currentBossLabel = "";
    const wasStageBoss = !game.endless && boss.bossKind === BOSS_ORDER[game.stageIndex];
    if (wasStageBoss) {
      if (game.stageIndex === STAGES.length - 1) {
        enterEndlessMode();
      } else {
        game.stageIndex += 1;
        game.stageTimer = 0;
        game.spawnTimer = 0.55;
        showBanner(`${STAGES[game.stageIndex].name} · 新敌机 ${STAGES[game.stageIndex].featuredEnemy}`, 2400);
        createFloatingText(W / 2, H / 2, STAGES[game.stageIndex].name, "#76f0ff", 1.5, 0);
        game.player.hp = Math.min(game.player.maxHp, game.player.hp + 45);
      }
    }

    if (game.endless) {
      if (game.bosses.length === 0) {
        game.endlessBossWaveActive = false;
        game.nextEndlessBossScore = Math.max(game.nextEndlessBossScore, game.score + 3800);
      } else {
        game.currentBossLabel = `剩余 ${game.bosses.length} 名 Boss`;
      }
    }

    syncModeText();
  }

  function spawnEndlessBossWave() {
    const count = Math.min(3, 1 + Math.floor(Math.max(0, game.score - 30000) / 15000));
    const spread = W / (count + 1);
    for (let i = 0; i < count; i += 1) {
      const bossIndex = clamp(Math.floor(rand(1, BOSS_ORDER.length)), 1, BOSS_ORDER.length - 1);
      const boss = createBoss(BOSS_ORDER[bossIndex], {
        scale: 1 + (getEndlessScale() - 1) * 0.82,
        x: spread * (i + 1)
      });
      game.bosses.push(boss);
    }
    game.currentBossLabel = `${count} 名 Boss`;
    game.endlessBossWaveActive = true;
    showBanner(count > 1 ? `高危波次：${count} 名 Boss 同时降临` : "无限模式 Boss 降临", 2600);
    syncModeText();
  }

  function stageBossActive() {
    return game.bosses.length > 0;
  }

  function updateSpawns(dt) {
    if (game.endless) {
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0 && game.enemies.length < 18) {
        const scale = getEndlessScale();
        const burst = clamp(Math.floor((game.score - 14000) / 9000) + 1, 1, 3);
        for (let i = 0; i < burst; i += 1) {
          spawnEnemy(pickEnemyForStage(), {
            scale,
            stageBonus: 2 + Math.floor(scale)
          });
        }
        game.spawnTimer = Math.max(0.28, 0.82 - (scale - 1) * 0.18);
      }

      if (!game.endlessBossWaveActive && game.score >= game.nextEndlessBossScore) {
        spawnEndlessBossWave();
      }

      if (stageBossActive()) {
        game.bossMinionTimer -= dt;
        if (game.bossMinionTimer <= 0 && game.enemies.length < 22) {
          spawnEnemy(pickEnemyForStage(), {
            scale: getEndlessScale(),
            stageBonus: 2 + Math.floor(getEndlessScale())
          });
          game.bossMinionTimer = Math.max(1.35, 2.4 - (getEndlessScale() - 1) * 0.35);
        }
      }
      return;
    }

    if (!stageBossActive() && canTriggerStageBoss()) {
      startBossFight();
      return;
    }

    if (stageBossActive()) {
      game.bossMinionTimer -= dt;
      if (game.bossMinionTimer <= 0 && game.enemies.length < 14) {
        spawnEnemy(pickEnemyForStage(), {
          scale: 1,
          stageBonus: game.stageIndex + 1
        });
        game.bossMinionTimer = rand(1.6, 2.8);
      }
      return;
    }

    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0 && game.enemies.length < 12) {
      const extra = Math.min(2, Math.floor((game.score / currentStage().targetScore) * 1.5));
      for (let i = 0; i <= extra; i += 1) {
        spawnEnemy(pickEnemyForStage(), {
          stageBonus: game.stageIndex + 1
        });
      }
      game.spawnTimer = Math.max(0.55, 1.02 - game.stageIndex * 0.08);
    }
  }

  function spawnPlayerBullet(x, y, angleOffset = 0, damageScale = 1, speedScale = 1, radius = 4) {
    const speed = (580 + game.player.level * 10) * speedScale;
    const angle = -PI / 2 + angleOffset;
    const baseColor = angleOffset === 0 ? "#7af7ff" : "#b6fcff";
    const bullet = {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      damage: Math.round(game.player.attack * damageScale),
      life: 3,
      color: baseColor,
      outlineColor: "",
      baseColor,
      bounceLeft: game.player.buffs.ricochet > 0 ? 2 : 0,
      reflected: false,
      hitCooldown: 0,
      lastEnemyId: ""
    };
    game.playerBullets.push(bullet);
  }

  function firePlayerVolley() {
    const player = game.player;
    const baseY = player.y - player.height * 0.42;
    const level = player.level;
    const pattern = [];

    if (level < 2) {
      pattern.push({ x: 0, angle: 0, damage: 1, speed: 1, radius: 4.6 });
    } else if (level < 4) {
      pattern.push({ x: -9, angle: 0, damage: 1, speed: 1, radius: 4.2 });
      pattern.push({ x: 9, angle: 0, damage: 1, speed: 1, radius: 4.2 });
    } else if (level < 6) {
      pattern.push({ x: 0, angle: 0, damage: 1, speed: 1.04, radius: 4.8 });
      pattern.push({ x: -15, angle: -0.12, damage: 0.88, speed: 1, radius: 4 });
      pattern.push({ x: 15, angle: 0.12, damage: 0.88, speed: 1, radius: 4 });
    } else if (level < 8) {
      pattern.push({ x: -10, angle: 0, damage: 1, speed: 1.05, radius: 4.6 });
      pattern.push({ x: 10, angle: 0, damage: 1, speed: 1.05, radius: 4.6 });
      pattern.push({ x: -18, angle: -0.16, damage: 0.84, speed: 1, radius: 4 });
      pattern.push({ x: 18, angle: 0.16, damage: 0.84, speed: 1, radius: 4 });
    } else if (level < 11) {
      pattern.push({ x: 0, angle: 0, damage: 1.08, speed: 1.06, radius: 4.8 });
      pattern.push({ x: -10, angle: -0.04, damage: 1, speed: 1.04, radius: 4.6 });
      pattern.push({ x: 10, angle: 0.04, damage: 1, speed: 1.04, radius: 4.6 });
      pattern.push({ x: -24, angle: -0.2, damage: 0.86, speed: 1, radius: 4 });
      pattern.push({ x: 24, angle: 0.2, damage: 0.86, speed: 1, radius: 4 });
    } else {
      pattern.push({ x: 0, angle: 0, damage: 1.1, speed: 1.08, radius: 5 });
      pattern.push({ x: -10, angle: -0.04, damage: 1, speed: 1.05, radius: 4.8 });
      pattern.push({ x: 10, angle: 0.04, damage: 1, speed: 1.05, radius: 4.8 });
      pattern.push({ x: -24, angle: -0.18, damage: 0.86, speed: 1.02, radius: 4.2 });
      pattern.push({ x: 24, angle: 0.18, damage: 0.86, speed: 1.02, radius: 4.2 });
      pattern.push({ x: -30, angle: -0.31, damage: 0.72, speed: 0.98, radius: 4 });
      pattern.push({ x: 30, angle: 0.31, damage: 0.72, speed: 0.98, radius: 4 });
    }

    if (player.buffs.scatter > 0) {
      pattern.push({ x: -12, angle: -0.42, damage: 0.7, speed: 0.98, radius: 3.8 });
      pattern.push({ x: 12, angle: 0.42, damage: 0.7, speed: 0.98, radius: 3.8 });
      pattern.push({ x: -6, angle: -0.28, damage: 0.78, speed: 1, radius: 4 });
      pattern.push({ x: 6, angle: 0.28, damage: 0.78, speed: 1, radius: 4 });
    }

    for (const shot of pattern) {
      spawnPlayerBullet(player.x + shot.x, baseY, shot.angle, shot.damage, shot.speed, shot.radius);
    }
  }

  function fireEnemyBullet(enemy, angle, speed, damage, radius = 5, color = "#ff8f6d") {
    game.enemyBullets.push({
      x: enemy.x,
      y: enemy.y + enemy.radius * 0.2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      damage,
      color,
      life: 5
    });
  }

  function fireAimedBullet(enemy, targetX, targetY, speed, damage, radius = 5, color = "#ff8f6d") {
    const dir = normalize(targetX - enemy.x, targetY - enemy.y);
    fireEnemyBullet(enemy, Math.atan2(dir.y, dir.x), speed, damage, radius, color);
  }

  function fireSpread(enemy, count, startAngle, endAngle, speed, damage, radius = 4.6, color = "#ff8f6d") {
    if (count <= 1) {
      fireEnemyBullet(enemy, (startAngle + endAngle) / 2, speed, damage, radius, color);
      return;
    }
    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1);
      fireEnemyBullet(enemy, startAngle + (endAngle - startAngle) * t, speed, damage, radius, color);
    }
  }

  function updatePlayer(dt) {
    const player = game.player;
    let moveX = 0;
    let moveY = 0;

    if (keys.ArrowLeft || keys.KeyA) {
      moveX -= 1;
    }
    if (keys.ArrowRight || keys.KeyD) {
      moveX += 1;
    }
    if (keys.ArrowUp || keys.KeyW) {
      moveY -= 1;
    }
    if (keys.ArrowDown || keys.KeyS) {
      moveY += 1;
    }

    if (moveX || moveY) {
      const move = normalize(moveX, moveY);
      player.x += move.x * player.speed * dt;
      player.y += move.y * player.speed * dt;
    }

    player.x = clamp(player.x, 28, W - 28);
    player.y = clamp(player.y, 48, H - 36);
    player.fireTimer -= dt;
    player.damageCooldown = Math.max(0, player.damageCooldown - dt);
    player.levelUpGlow = Math.max(0, player.levelUpGlow - dt);

    for (const buffKey of Object.keys(player.buffs)) {
      player.buffs[buffKey] = Math.max(0, player.buffs[buffKey] - dt);
    }

    if (player.fireTimer <= 0) {
      firePlayerVolley();
      player.fireTimer = Math.max(0.07, player.fireCooldown - (player.level - 1) * 0.004);
    }
  }

  function updateEnemy(enemy, dt) {
    const player = game.player;
    enemy.age += dt;
    enemy.fireTimer -= dt;

    if (enemy.kind === "scout") {
      enemy.y += enemy.speed * dt;
      enemy.x = enemy.baseX + Math.sin(enemy.age * 3.4 + enemy.seed) * 60;
      if (enemy.y > 90 && enemy.fireTimer <= 0) {
        fireAimedBullet(enemy, player.x, player.y, 270, enemy.bulletDamage, 4.4);
        enemy.fireTimer = enemy.fireRate;
      }
    } else if (enemy.kind === "lancer") {
      const drift = Math.sin(enemy.age * 4.6 + enemy.seed) * 120;
      enemy.y += enemy.speed * 0.82 * dt;
      enemy.x = clamp(enemy.baseX + drift, 40, W - 40);
      if (enemy.y > 100 && enemy.fireTimer <= 0) {
        const aim = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        fireEnemyBullet(enemy, aim - 0.15, 300, enemy.bulletDamage, 4.6, "#8fddff");
        fireEnemyBullet(enemy, aim, 330, enemy.bulletDamage + 1, 4.8, "#8fddff");
        fireEnemyBullet(enemy, aim + 0.15, 300, enemy.bulletDamage, 4.6, "#8fddff");
        enemy.fireTimer = enemy.fireRate;
      }
    } else if (enemy.kind === "orbiter") {
      if (enemy.y < 160) {
        enemy.y += enemy.speed * 0.65 * dt;
      } else {
        enemy.y += Math.sin(enemy.age * 1.8 + enemy.seed) * 28 * dt;
      }
      enemy.x = enemy.baseX + Math.sin(enemy.age * 2.2 + enemy.seed) * 110;
      if (enemy.fireTimer <= 0) {
        fireSpread(enemy, 7, 0.38 * PI, 0.62 * PI, 210, enemy.bulletDamage, 5.2, "#aeb8ff");
        enemy.fireTimer = enemy.fireRate;
      }
    } else if (enemy.kind === "fortress") {
      enemy.y += enemy.speed * 0.42 * dt;
      enemy.x += Math.sin(enemy.age * 1.8 + enemy.seed) * 18 * dt;
      if (enemy.fireTimer <= 0) {
        fireSpread(enemy, 5, 0.34 * PI, 0.66 * PI, 240, enemy.bulletDamage, 5.8, "#b7ffd1");
        fireAimedBullet(enemy, player.x, player.y, 210, enemy.bulletDamage + 3, 6.6, "#fff09e");
        enemy.fireTimer = enemy.fireRate;
      }
    } else if (enemy.kind === "phantom") {
      enemy.alpha = 0.5 + Math.sin(enemy.age * 10) * 0.18;
      enemy.dashTimer -= dt;
      if (enemy.dashTime > 0) {
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        enemy.dashTime -= dt;
      } else {
        enemy.y += enemy.speed * 0.74 * dt;
        enemy.x = enemy.baseX + Math.sin(enemy.age * 4.2 + enemy.seed) * 90;
        if (enemy.dashTimer <= 0) {
          const dir = normalize(player.x - enemy.x, player.y - enemy.y + 40);
          enemy.vx = dir.x * (enemy.speed + 160);
          enemy.vy = dir.y * (enemy.speed + 160);
          enemy.dashTime = 0.36;
          enemy.dashTimer = rand(1.2, 2);
        }
      }
      if (enemy.fireTimer <= 0) {
        fireAimedBullet(enemy, player.x - 18, player.y, 330, enemy.bulletDamage, 4.3, "#ffb1ff");
        fireAimedBullet(enemy, player.x + 18, player.y, 330, enemy.bulletDamage, 4.3, "#ffb1ff");
        enemy.fireTimer = enemy.fireRate;
      }
    }
  }

  function updateBoss(boss, dt) {
    const player = game.player;
    boss.age += dt;
    boss.fireTimer -= dt;
    boss.burstTimer -= dt;
    boss.phaseTimer += dt;
    boss.summonTimer -= dt;

    if (boss.bossKind === "hornet") {
      boss.x = W / 2 + Math.sin(boss.age * 1.1 + boss.movePhase) * 260;
      boss.y = 96 + Math.sin(boss.age * 2.1) * 12;
      if (boss.fireTimer <= 0) {
        fireSpread(boss, 7, 0.34 * PI, 0.66 * PI, 260, 18, 5, "#ffb86d");
        boss.fireTimer = 1.05;
      }
      if (boss.burstTimer <= 0) {
        fireAimedBullet(boss, player.x, player.y, 320, 19, 5.6, "#ffe08a");
        fireAimedBullet(boss, player.x - 32, player.y, 300, 16, 4.8, "#ffd0a1");
        fireAimedBullet(boss, player.x + 32, player.y, 300, 16, 4.8, "#ffd0a1");
        boss.burstTimer = 2.2;
      }
    } else if (boss.bossKind === "manta") {
      boss.x = W / 2 + Math.sin(boss.age * 0.9 + boss.movePhase) * 250;
      boss.y = 118 + Math.sin(boss.age * 1.4) * 18;
      if (boss.fireTimer <= 0) {
        fireSpread(boss, 8, 0.28 * PI, 0.72 * PI, 250, 19, 5.2, "#8adfff");
        boss.fireTimer = 1.3;
      }
      if (boss.burstTimer <= 0) {
        const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
        for (let i = -2; i <= 2; i += 1) {
          fireEnemyBullet(boss, aim + i * 0.08, 360 - Math.abs(i) * 25, 17, 4.8, "#c8f2ff");
        }
        boss.burstTimer = 2.6;
      }
    } else if (boss.bossKind === "core") {
      boss.x = W / 2 + Math.sin(boss.age * 0.7 + boss.movePhase) * 170;
      boss.y = 110 + Math.sin(boss.age * 1.2) * 26;
      boss.spiralAngle += dt * 1.8;
      if (boss.fireTimer <= 0) {
        fireEnemyBullet(boss, boss.spiralAngle, 260, 18, 5, "#bfc6ff");
        fireEnemyBullet(boss, boss.spiralAngle + PI, 260, 18, 5, "#bfc6ff");
        fireEnemyBullet(boss, boss.spiralAngle + PI / 2, 250, 17, 4.7, "#e6c4ff");
        fireEnemyBullet(boss, boss.spiralAngle + PI * 1.5, 250, 17, 4.7, "#e6c4ff");
        boss.fireTimer = 0.15;
      }
      if (boss.burstTimer <= 0) {
        fireSpread(boss, 12, 0.1 * PI, 0.9 * PI, 220, 20, 5.8, "#89a4ff");
        boss.burstTimer = 2.8;
      }
    } else if (boss.bossKind === "carrier") {
      boss.x = W / 2 + Math.sin(boss.age * 0.55 + boss.movePhase) * 210;
      boss.y = 102 + Math.sin(boss.age) * 14;
      if (boss.fireTimer <= 0) {
        fireSpread(boss, 6, 0.31 * PI, 0.69 * PI, 255, 21, 5.6, "#a2ffd5");
        fireAimedBullet(boss, player.x, player.y, 280, 22, 6.4, "#fff09f");
        boss.fireTimer = 1.25;
      }
      if (boss.burstTimer <= 0) {
        spawnEnemy("scout", { x: boss.x - 48, y: boss.y + 12, stageBonus: 4 });
        spawnEnemy("fortress", { x: boss.x + 52, y: boss.y + 20, stageBonus: 4, scale: 1 });
        boss.burstTimer = 4.6;
      }
    } else if (boss.bossKind === "seraph") {
      const hpRatio = boss.hp / boss.maxHp;
      boss.x = W / 2 + Math.sin(boss.age * (hpRatio < 0.5 ? 1.35 : 0.82) + boss.movePhase) * (hpRatio < 0.5 ? 290 : 210);
      boss.y = 102 + Math.sin(boss.age * 1.35) * 22;
      boss.dashTimer -= dt;
      if (boss.fireTimer <= 0) {
        fireSpread(boss, hpRatio < 0.35 ? 11 : 8, 0.24 * PI, 0.76 * PI, hpRatio < 0.35 ? 290 : 260, 24, 5.8, "#ffaae8");
        boss.fireTimer = hpRatio < 0.35 ? 0.95 : 1.28;
      }
      if (boss.burstTimer <= 0) {
        const lanes = hpRatio < 0.45 ? [-190, -70, 70, 190] : [-140, 0, 140];
        for (const offset of lanes) {
          game.enemyBullets.push({
            x: boss.x + offset,
            y: boss.y + 12,
            vx: 0,
            vy: 320,
            radius: 6.2,
            damage: 22,
            color: "#ffe99d",
            life: 3.8
          });
        }
        boss.burstTimer = hpRatio < 0.45 ? 2.1 : 2.8;
      }
      if (boss.dashTimer <= 0 && hpRatio < 0.55) {
        const dir = normalize(player.x - boss.x, 180);
        boss.x += dir.x * 70;
        boss.dashTimer = hpRatio < 0.25 ? 1.2 : 1.8;
        createBurst(boss.x, boss.y, boss.color, 16, 2.6);
      }
      if (boss.summonTimer <= 0 && hpRatio < 0.68) {
        spawnEnemy("phantom", { x: clamp(boss.x + rand(-120, 120), 60, W - 60), y: boss.y + 24, stageBonus: 5 });
        boss.summonTimer = hpRatio < 0.3 ? 2.4 : 3.4;
      }
    }
  }

  function updateBullets(dt) {
    for (const bullet of game.playerBullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      bullet.hitCooldown = Math.max(0, bullet.hitCooldown - dt);

      if (bullet.bounceLeft > 0) {
        let bounced = false;
        if (bullet.x <= bullet.radius) {
          bullet.x = bullet.radius;
          bullet.vx *= -1;
          bounced = true;
        } else if (bullet.x >= W - bullet.radius) {
          bullet.x = W - bullet.radius;
          bullet.vx *= -1;
          bounced = true;
        }
        if (bullet.y <= bullet.radius) {
          bullet.y = bullet.radius;
          bullet.vy *= -1;
          bounced = true;
        } else if (bullet.y >= H - bullet.radius) {
          bullet.y = H - bullet.radius;
          bullet.vy *= -1;
          bounced = true;
        }
        if (bounced) {
          bullet.bounceLeft -= 1;
          bullet.reflected = true;
          bullet.color = "#ff5fd2";
          bullet.outlineColor = "#ffe16f";
          bullet.hitCooldown = 0.05;
          createBurst(bullet.x, bullet.y, "#ffb3b3", 6, 1.6);
        }
      }
    }

    for (const bullet of game.enemyBullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
    }
  }

  function updateEnemies(dt) {
    for (const enemy of game.enemies) {
      updateEnemy(enemy, dt);
    }
    for (const boss of game.bosses) {
      updateBoss(boss, dt);
    }
  }

  function updatePickups(dt) {
    for (const pickup of game.pickups) {
      pickup.age += dt;
      pickup.y += pickup.vy * dt;
      pickup.x += Math.sin(pickup.age * 3 + pickup.seed) * 28 * dt;
    }
  }

  function updateParticles(dt) {
    for (const particle of game.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
      particle.vx *= 0.99;
      particle.vy *= 0.99;
    }

    for (const item of game.floatingTexts) {
      item.y += item.vy * dt;
      item.life -= dt;
    }
  }

  function createBurst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = (PI * 2 * i) / count + Math.random() * 0.4;
      const travel = rand(speed * 18, speed * 40);
      game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * travel,
        vy: Math.sin(angle) * travel,
        color,
        size: rand(1.6, 3.4),
        life: rand(0.22, 0.52)
      });
    }
  }

  function createFloatingText(x, y, text, color = "#ffffff", life = 0.9, vy = -28) {
    game.floatingTexts.push({ x, y, text, color, life, maxLife: life, vy });
  }

  function giveExp(amount) {
    const player = game.player;
    player.exp += amount;
    while (player.exp >= player.expToNext) {
      player.exp -= player.expToNext;
      player.level += 1;
      player.expToNext = Math.round(player.expToNext * 1.25 + 35);
      player.maxHp += 20;
      player.hp = Math.min(player.maxHp, player.hp + 40);
      player.attack += 3;
      player.defense += 1;
      player.speed += 8;
      player.levelUpGlow = 1.1;
      createBurst(player.x, player.y, "#ffe48e", 16, 3.1);
      createFloatingText(player.x, player.y - 36, `Lv.${player.level}`, "#ffe48e", 1.1, -24);
      showBanner(`等级提升至 ${player.level}`, 1200);
    }
  }

  function maybeSpawnPickup(x, y, guaranteed = false) {
    const player = game.player;
    const roll = Math.random();
    if (!guaranteed && roll > 0.16) {
      return;
    }
    const types = ["scatter", "invincible", "ricochet"];
    if (player.hp < player.maxHp * 0.55) {
      types.unshift("heal");
      types.unshift("heal");
    } else {
      types.push("heal");
    }
    const type = guaranteed && Math.random() < 0.5 ? "heal" : pickOne(types);
    game.pickups.push({
      type,
      x,
      y,
      vy: rand(60, 92),
      radius: 15,
      age: 0,
      seed: Math.random() * PI * 2
    });
  }

  function awardKill(enemy) {
    game.score += enemy.value;
    if (game.score > game.highScore) {
      game.highScore = game.score;
      saveHighScore(game.highScore);
    }
    giveExp(enemy.exp);
    maybeSpawnPickup(enemy.x, enemy.y, enemy.bossKind !== undefined);
  }

  function damageEnemy(enemy, amount) {
    const actualDamage = Math.max(1, Math.round(amount - (enemy.defense || 0)));
    enemy.hp -= actualDamage;
    enemy.showHealthUntil = game.time + 1.55;
    createBurst(enemy.x, enemy.y, enemy.color, 7, 1.9);
    if (enemy.hp <= 0) {
      enemy.dead = true;
      createBurst(enemy.x, enemy.y, enemy.color, enemy.bossKind ? 24 : 14, enemy.bossKind ? 4.4 : 2.6);
      createFloatingText(enemy.x, enemy.y, `+${enemy.value}`, "#ffd987", 1, -26);
      awardKill(enemy);
    }
  }

  function damagePlayer(rawDamage) {
    const player = game.player;
    if (player.buffs.invincible > 0 || player.damageCooldown > 0) {
      return;
    }
    const dmg = damageAfterDefense(rawDamage, player.defense);
    player.hp -= dmg;
    player.damageCooldown = 0.24;
    player.showHealthUntil = game.time + 1.7;
    createFloatingText(player.x, player.y - 32, `-${dmg}`, "#ffb5b5", 0.9, -20);
    createBurst(player.x, player.y, "#ffffff", 10, 2.1);
    if (player.hp <= 0) {
      player.hp = 0;
      gameOver();
    }
  }

  function reflectBulletFromEnemy(bullet, enemy) {
    const dx = bullet.x - enemy.x;
    const dy = bullet.y - enemy.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      bullet.vx *= -1;
      bullet.x += Math.sign(dx || 1) * 6;
    } else {
      bullet.vy *= -1;
      bullet.y += Math.sign(dy || -1) * 6;
    }
    bullet.bounceLeft -= 1;
    bullet.reflected = true;
    bullet.color = "#ff5fd2";
    bullet.outlineColor = "#ffe16f";
    bullet.hitCooldown = 0.05;
    bullet.lastEnemyId = enemy.id;
  }

  function collectPickup(pickup) {
    const player = game.player;
    if (pickup.type === "heal") {
      const amount = Math.round(player.maxHp * 0.32);
      player.hp = Math.min(player.maxHp, player.hp + amount);
      createFloatingText(player.x, player.y - 28, `+${amount} HP`, "#90ffb8", 0.9, -24);
    } else {
      player.buffs[pickup.type] = BUFFS[pickup.type].duration;
      createFloatingText(player.x, player.y - 28, `${BUFFS[pickup.type].label} 启动`, BUFFS[pickup.type].color, 0.95, -24);
    }
    pickup.dead = true;
  }

  function collisionCircle(a, b) {
    return magnitude(a.x - b.x, a.y - b.y) <= a.radius + b.radius;
  }

  function handleCollisions() {
    const player = game.player;
    const allTargets = game.enemies.concat(game.bosses);

    for (const bullet of game.playerBullets) {
      if (bullet.life <= 0) {
        bullet.dead = true;
        continue;
      }

      for (const enemy of allTargets) {
        if (enemy.dead) {
          continue;
        }
        if (bullet.hitCooldown > 0 && bullet.lastEnemyId === enemy.id) {
          continue;
        }
        if (collisionCircle(bullet, enemy)) {
          damageEnemy(enemy, bullet.damage);
          if (bullet.bounceLeft > 0) {
            reflectBulletFromEnemy(bullet, enemy);
          } else {
            bullet.dead = true;
          }
          break;
        }
      }
    }

    for (const bullet of game.enemyBullets) {
      if (bullet.life <= 0) {
        bullet.dead = true;
        continue;
      }
      if (collisionCircle(bullet, player)) {
        damagePlayer(bullet.damage);
        bullet.dead = true;
      }
    }

    for (const enemy of allTargets) {
      if (!enemy.dead && collisionCircle(enemy, player)) {
        damagePlayer(enemy.touchDamage);
        if (enemy.bossKind) {
          createBurst(player.x, player.y, enemy.color, 10, 2.2);
        } else {
          enemy.dead = true;
          createBurst(enemy.x, enemy.y, enemy.color, 10, 3.1);
        }
      }
    }

    for (const pickup of game.pickups) {
      if (!pickup.dead && collisionCircle(pickup, player)) {
        collectPickup(pickup);
      }
    }
  }

  function cleanupEntities() {
    const defeatedBosses = [];
    game.enemies = game.enemies.filter((enemy) => {
      if (enemy.dead) {
        return false;
      }
      return enemy.y < H + 90 && enemy.x > -120 && enemy.x < W + 120 && enemy.hp > 0;
    });
    game.bosses = game.bosses.filter((boss) => {
      if (boss.dead || boss.hp <= 0) {
        defeatedBosses.push(boss);
        return false;
      }
      return true;
    });

    for (const boss of defeatedBosses) {
      finishBossFight(boss);
    }

    game.playerBullets = game.playerBullets.filter((bullet) => {
      if (bullet.dead || bullet.life <= 0) {
        return false;
      }
      if (bullet.bounceLeft > 0) {
        return true;
      }
      return bullet.x > -40 && bullet.x < W + 40 && bullet.y > -40 && bullet.y < H + 40;
    });

    game.enemyBullets = game.enemyBullets.filter(
      (bullet) =>
        !bullet.dead &&
        bullet.life > 0 &&
        bullet.x > -60 &&
        bullet.x < W + 60 &&
        bullet.y > -80 &&
        bullet.y < H + 80
    );

    game.pickups = game.pickups.filter(
      (pickup) => !pickup.dead && pickup.y < H + 40
    );
    game.particles = game.particles.filter((particle) => particle.life > 0);
    game.floatingTexts = game.floatingTexts.filter((item) => item.life > 0);
  }

  function updateBackground(dt) {
    const speedBoost = game.endless ? 1.5 : 1 + game.stageIndex * 0.12;
    for (const star of game.stars) {
      star.y += star.speed * dt * speedBoost;
      star.twinkle += dt * (0.9 + star.size * 0.4);
      if (star.y > H + 2) {
        star.y = -4;
        star.x = Math.random() * W;
      }
    }
  }

  function update(dt) {
    game.time += dt;
    if (!game.endless && !stageBossActive()) {
      game.stageTimer += dt;
    }
    updateBackground(dt);
    updatePlayer(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updatePickups(dt);
    updateParticles(dt);
    handleCollisions();
    cleanupEntities();
    if (game.state === "running") {
      updateSpawns(dt);
    }
    syncModeText();
    updateSidebar();
  }

  function getBackgroundPalette() {
    if (game.endless) {
      return ["#040711", "#0c1730", "#130d28", "#0b3d56"];
    }
    const palettes = [
      ["#07111f", "#0d1c35", "#0e2a48", "#1d6075"],
      ["#08131f", "#152a44", "#1a3854", "#326778"],
      ["#05081a", "#181739", "#2d2461", "#43307d"],
      ["#07151b", "#163028", "#30554a", "#527d72"],
      ["#10061b", "#290f3a", "#50185b", "#71356c"]
    ];
    return palettes[game.stageIndex];
  }

  function drawBackground() {
    const palette = getBackgroundPalette();
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.48, palette[1]);
    gradient.addColorStop(1, palette[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W * 0.78, H * 0.12, 10, W * 0.78, H * 0.12, 260);
    glow.addColorStop(0, `${palette[3]}55`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 70) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    for (const star of game.stars) {
      const alpha = 0.25 + (Math.sin(star.twinkle) + 1) * 0.25;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer() {
    const player = game.player;
    ctx.save();
    ctx.translate(player.x, player.y);

    if (player.levelUpGlow > 0) {
      const glowRatio = player.levelUpGlow / 1.1;
      const pulse = 1 + Math.sin((1.1 - player.levelUpGlow) * 18) * 0.14;
      const radius = (player.radius + 16) * pulse;
      const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, radius);
      aura.addColorStop(0, `rgba(255, 248, 196, ${0.46 * glowRatio})`);
      aura.addColorStop(0.5, `rgba(255, 222, 120, ${0.24 * glowRatio})`);
      aura.addColorStop(1, "rgba(255, 222, 120, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 234, 156, ${0.85 * glowRatio})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 10 + (1 - glowRatio) * 12, 0, PI * 2);
      ctx.stroke();
    }

    if (player.buffs.invincible > 0) {
      ctx.fillStyle = "rgba(255, 212, 109, 0.18)";
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 10 + Math.sin(game.time * 8) * 2, 0, PI * 2);
      ctx.fill();
    }

    ctx.shadowColor = player.buffs.invincible > 0 ? "#ffe08b" : "#7af7ff";
    ctx.shadowBlur = 18;
    ctx.fillStyle = player.damageCooldown > 0 ? PLAYER_HIT_COLOR : PLAYER_COLOR;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(18, 16);
    ctx.lineTo(7, 10);
    ctx.lineTo(0, 20);
    ctx.lineTo(-7, 10);
    ctx.lineTo(-18, 16);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#183b60";
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(8, 12);
    ctx.lineTo(0, 8);
    ctx.lineTo(-8, 12);
    ctx.closePath();
    ctx.fill();

    if (player.buffs.scatter > 0) {
      ctx.strokeStyle = "rgba(118, 240, 255, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-24, 12);
      ctx.lineTo(-8, -2);
      ctx.moveTo(24, 12);
      ctx.lineTo(8, -2);
      ctx.stroke();
    }

    ctx.restore();
    drawHealthBar(player, 56, 6);
  }

  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.globalAlpha = enemy.alpha ?? 1;
    ctx.shadowColor = enemy.color;
    ctx.shadowBlur = 18;

    const pulse = 0.45 + (Math.sin(enemy.age * 6 + enemy.seed) + 1) * 0.18;
    const accent = enemy.kind === "fortress" ? "#f7ffe0" : "#eef7ff";

    if (enemy.kind === "scout") {
      ctx.rotate(Math.sin(enemy.age * 4.2 + enemy.seed) * 0.08);
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.moveTo(0, -21);
      ctx.lineTo(20, -2);
      ctx.lineTo(12, 19);
      ctx.lineTo(0, 9);
      ctx.lineTo(-12, 19);
      ctx.lineTo(-20, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.16 + pulse * 0.2})`;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(7, 4);
      ctx.lineTo(0, 10);
      ctx.lineTo(-7, 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 240, 190, 0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, 10);
      ctx.lineTo(-22, 16);
      ctx.moveTo(14, 10);
      ctx.lineTo(22, 16);
      ctx.stroke();
    } else if (enemy.kind === "lancer") {
      ctx.rotate(Math.sin(enemy.age * 3.4 + enemy.seed) * 0.06);
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(14, -6);
      ctx.lineTo(26, 4);
      ctx.lineTo(12, 20);
      ctx.lineTo(0, 10);
      ctx.lineTo(-12, 20);
      ctx.lineTo(-26, 4);
      ctx.lineTo(-14, -6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(10, 26, 42, 0.72)";
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(7, 5);
      ctx.lineTo(0, 13);
      ctx.lineTo(-7, 5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(230, 249, 255, 0.7)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(0, 10);
      ctx.moveTo(-17, 0);
      ctx.lineTo(-5, 10);
      ctx.moveTo(17, 0);
      ctx.lineTo(5, 10);
      ctx.stroke();
    } else if (enemy.kind === "orbiter") {
      ctx.rotate(enemy.age * 0.8);
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.25 + pulse * 0.25})`;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i += 1) {
        const angle = (PI * 2 * i) / 3;
        const px = Math.cos(angle) * 21;
        const py = Math.sin(angle) * 21;
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        ctx.moveTo(px, py - 6);
        ctx.lineTo(px + 7, py + 2);
        ctx.lineTo(px, py + 9);
        ctx.lineTo(px - 7, py + 2);
        ctx.closePath();
        ctx.fill();
      }
    } else if (enemy.kind === "fortress") {
      ctx.rotate(Math.sin(enemy.age * 1.4 + enemy.seed) * 0.03);
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.moveTo(-26, -10);
      ctx.lineTo(-10, -22);
      ctx.lineTo(10, -22);
      ctx.lineTo(26, -10);
      ctx.lineTo(26, 10);
      ctx.lineTo(10, 22);
      ctx.lineTo(-10, 22);
      ctx.lineTo(-26, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(8, 19, 15, 0.72)";
      ctx.fillRect(-13, -12, 26, 24);
      ctx.strokeStyle = "rgba(215, 255, 230, 0.52)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(18, 0);
      ctx.moveTo(0, -16);
      ctx.lineTo(0, 16);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillRect(-4, -4, 8, 8);
    } else if (enemy.kind === "phantom") {
      ctx.save();
      ctx.globalAlpha *= 0.34;
      ctx.translate(0, 8);
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(20, 6);
      ctx.lineTo(0, 20);
      ctx.lineTo(-20, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.rotate(Math.sin(enemy.age * 5.2) * 0.09);
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(18, -6);
      ctx.lineTo(22, 4);
      ctx.lineTo(8, 19);
      ctx.lineTo(0, 11);
      ctx.lineTo(-8, 19);
      ctx.lineTo(-22, 4);
      ctx.lineTo(-18, -6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 230, 255, 0.78)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-12, -2);
      ctx.lineTo(0, -14);
      ctx.lineTo(12, -2);
      ctx.moveTo(-6, 10);
      ctx.lineTo(0, 4);
      ctx.lineTo(6, 10);
      ctx.stroke();
    }

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, -2, enemy.kind === "fortress" ? 4 : 3.5, 0, PI * 2);
    ctx.fill();
    ctx.restore();
    drawHealthBar(enemy, Math.max(46, enemy.radius * 2.25), 5);
  }

  function drawBoss(boss) {
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.shadowColor = boss.color;
    ctx.shadowBlur = 26;

    if (boss.bossKind === "hornet") {
      ctx.fillStyle = boss.color;
      ctx.beginPath();
      ctx.moveTo(0, -46);
      ctx.lineTo(64, -10);
      ctx.lineTo(44, 18);
      ctx.lineTo(26, 44);
      ctx.lineTo(0, 24);
      ctx.lineTo(-26, 44);
      ctx.lineTo(-44, 18);
      ctx.lineTo(-64, -10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.fillRect(-10, -22, 20, 38);
      ctx.strokeStyle = "rgba(255, 239, 184, 0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-34, 16);
      ctx.lineTo(-54, 36);
      ctx.moveTo(34, 16);
      ctx.lineTo(54, 36);
      ctx.stroke();
    } else if (boss.bossKind === "manta") {
      ctx.fillStyle = boss.color;
      ctx.beginPath();
      ctx.moveTo(0, -32);
      ctx.quadraticCurveTo(84, -26, 104, 22);
      ctx.lineTo(24, 22);
      ctx.lineTo(0, 8);
      ctx.lineTo(-24, 22);
      ctx.lineTo(-104, 22);
      ctx.quadraticCurveTo(-84, -26, 0, -32);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(223, 249, 255, 0.82)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-58, 6);
      ctx.quadraticCurveTo(0, -12, 58, 6);
      ctx.stroke();
      ctx.fillStyle = "#eff9ff";
      ctx.fillRect(-8, -14, 16, 28);
    } else if (boss.bossKind === "core") {
      ctx.fillStyle = boss.color;
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ece8ff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 66 + Math.sin(game.time * 4) * 5, 0, PI * 2);
      ctx.stroke();
      ctx.rotate(game.time * 0.7);
      ctx.strokeStyle = "rgba(232, 220, 255, 0.75)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-58, 0);
      ctx.lineTo(58, 0);
      ctx.moveTo(0, -58);
      ctx.lineTo(0, 58);
      ctx.stroke();
    } else if (boss.bossKind === "carrier") {
      ctx.fillStyle = boss.color;
      ctx.beginPath();
      ctx.moveTo(-94, -22);
      ctx.lineTo(-54, -38);
      ctx.lineTo(54, -38);
      ctx.lineTo(94, -22);
      ctx.lineTo(94, 22);
      ctx.lineTo(54, 38);
      ctx.lineTo(-54, 38);
      ctx.lineTo(-94, 22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(20, 48, 43, 0.76)";
      ctx.fillRect(-52, -14, 104, 28);
      ctx.strokeStyle = "rgba(224, 255, 231, 0.78)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-78, 0);
      ctx.lineTo(78, 0);
      ctx.moveTo(-38, -24);
      ctx.lineTo(-38, 24);
      ctx.moveTo(38, -24);
      ctx.lineTo(38, 24);
      ctx.stroke();
    } else if (boss.bossKind === "seraph") {
      ctx.fillStyle = boss.color;
      ctx.beginPath();
      ctx.moveTo(0, -52);
      ctx.lineTo(34, -22);
      ctx.lineTo(68, -6);
      ctx.lineTo(34, 44);
      ctx.lineTo(0, 16);
      ctx.lineTo(-34, 44);
      ctx.lineTo(-68, -6);
      ctx.lineTo(-34, -22);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 231, 250, 0.88)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-26, -10);
      ctx.lineTo(0, -34);
      ctx.lineTo(26, -10);
      ctx.moveTo(-12, 6);
      ctx.lineTo(0, 18);
      ctx.lineTo(12, 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -58, 18, 0, PI * 2);
      ctx.stroke();
    }

    ctx.restore();
    drawHealthBar(boss, 120, 8, true);
  }

  function drawBullet(bullet, isPlayer) {
    ctx.save();
    ctx.shadowColor = bullet.color;
    ctx.shadowBlur = bullet.reflected ? 18 : isPlayer ? 12 : 10;
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, PI * 2);
    ctx.fill();
    if (bullet.reflected) {
      ctx.strokeStyle = bullet.outlineColor || "#ffe16f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius + 2.4, 0, PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#fff6d1";
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, Math.max(1.6, bullet.radius * 0.42), 0, PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPickup(pickup) {
    const colors = {
      heal: "#90ffb8",
      scatter: "#78f4ff",
      invincible: "#ffe08a",
      ricochet: "#ff9b9b"
    };
    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    ctx.shadowColor = colors[pickup.type];
    ctx.shadowBlur = 18;
    ctx.fillStyle = colors[pickup.type];
    ctx.beginPath();
    ctx.arc(0, 0, pickup.radius, 0, PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0a1622";
    ctx.font = "bold 16px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = pickup.type === "heal" ? "H" : pickup.type === "scatter" ? "S" : pickup.type === "invincible" ? "I" : "R";
    ctx.fillText(label, 0, 1);
    ctx.restore();
  }

  function drawHealthBar(entity, width, height, force = false) {
    if (!force && entity.showHealthUntil <= game.time) {
      return;
    }
    const x = entity.x - width / 2;
    const y = entity.y - entity.radius - 18;
    const ratio = clamp(entity.hp / entity.maxHp, 0, 1);

    ctx.save();
    ctx.fillStyle = "rgba(2, 8, 16, 0.72)";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = ratio > 0.5 ? "#6bf0a5" : ratio > 0.2 ? "#ffd46d" : "#ff7d7d";
    ctx.fillRect(x + 1, y + 1, (width - 2) * ratio, height - 2);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
  }

  function drawBossBars() {
    if (!game.bosses.length) {
      return;
    }
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "bold 13px Trebuchet MS";
    const startX = 28;
    let y = 20;
    for (const boss of game.bosses) {
      const width = W - 56;
      ctx.fillStyle = "rgba(7, 19, 30, 0.78)";
      ctx.fillRect(startX, y, width, 18);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(startX, y, width, 18);
      ctx.fillStyle = boss.color;
      ctx.fillRect(startX, y, width * clamp(boss.hp / boss.maxHp, 0, 1), 18);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.strokeRect(startX, y, width, 18);
      ctx.fillStyle = "#eff7ff";
      ctx.fillText(boss.label, startX + 10, y + 9);
      y += 28;
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const particle of game.particles) {
      ctx.globalAlpha = clamp(particle.life / 0.52, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatingTexts() {
    ctx.save();
    ctx.font = "bold 16px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const item of game.floatingTexts) {
      ctx.globalAlpha = clamp(item.life / item.maxLife, 0, 1);
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.x, item.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function getActiveBuffs() {
    return Object.entries(game.player.buffs)
      .filter((entry) => entry[1] > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([key, timeLeft]) => ({
        key,
        timeLeft,
        label: BUFFS[key].label,
        color: BUFFS[key].color
      }));
  }

  function drawHudBar(x, y, width, ratio, fillA, fillB, height = 8) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 999);
    ctx.fill();
    const fillWidth = Math.max(0, (width - 2) * clamp(ratio, 0, 1));
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, fillA);
    gradient.addColorStop(1, fillB);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, fillWidth, Math.max(1, height - 2), 999);
    ctx.fill();
    ctx.restore();
  }

  function drawStageTitle() {
    const titleX = 18;
    const titleY = game.bosses.length ? 18 + game.bosses.length * 28 + 18 : 54;
    const progressLabel = game.endless
      ? stageBossActive()
        ? "Boss 波次进行中"
        : `${formatScore(game.score)} / ${formatScore(game.nextEndlessBossScore)}`
      : stageBossActive()
        ? currentStage().bossName
        : getStageGateText();
    const progressRatio = game.endless
      ? stageBossActive()
        ? 1
        : clamp((game.score - (game.nextEndlessBossScore - 3800)) / 3800, 0, 1)
      : stageBossActive()
        ? 1
        : getStageGateProgress();

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#eff7ff";
    ctx.font = "bold 18px Consolas";
    ctx.fillText(formatScore(game.score), titleX, titleY);
    ctx.fillStyle = "#a0bdd0";
    ctx.font = "12px Consolas";
    ctx.fillText(`最高 ${formatScore(game.highScore)}`, titleX, titleY + 17);
    ctx.fillStyle = "#91bad1";
    ctx.font = "12px Trebuchet MS";
    ctx.fillText(progressLabel, titleX, titleY + 35);
    drawHudBar(titleX, titleY + 42, 254, progressRatio, "#f9b774", "#ff7d7d", 7);
    ctx.restore();
  }

  function drawHud() {
    const player = game.player;
    const buffs = getActiveBuffs();
    const hudWidth = 282;
    const sectionX = W - hudWidth - 18;
    const startY = game.bosses.length ? 18 + game.bosses.length * 28 + 10 : 18;
    let rowY = startY;

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 6;


    ctx.fillStyle = "#c6edf9";
    ctx.font = "12px Consolas";
    ctx.save();
    ctx.beginPath();
    ctx.rect(sectionX, rowY - 4, 182, 18);
    ctx.clip();
    ctx.fillText(
      `Lv.${player.level}  攻 ${player.attack}  防 ${player.defense}  速 ${player.speed}  高 ${formatScore(game.highScore)}`,
      sectionX,
      rowY + 9
    );
    ctx.restore();
    rowY += 18;


    ctx.fillStyle = "#eff7ff";
    ctx.fillText(`生命 ${Math.ceil(player.hp)} / ${player.maxHp}`, sectionX, rowY + 9);
    drawHudBar(sectionX, rowY + 14, hudWidth, player.hp / player.maxHp, "#44d0a1", "#87ef80", 7);
    rowY += 24;

    ctx.fillStyle = "#eff7ff";
    ctx.fillText(`经验 ${Math.floor(player.exp)} / ${player.expToNext}`, sectionX, rowY + 9);
    drawHudBar(sectionX, rowY + 14, hudWidth, player.exp / player.expToNext, "#59b4ff", "#76f0ff", 7);
    rowY += 26;

    if (buffs.length) {
      ctx.font = "12px Trebuchet MS";
      for (const buff of buffs) {
        ctx.fillStyle = buff.color;
        ctx.beginPath();
        ctx.arc(sectionX + 4, rowY + 2, 3.8, 0, PI * 2);
        ctx.fill();
        ctx.fillStyle = "#eaf7ff";
        ctx.fillText(`${buff.label} ${buff.timeLeft.toFixed(1)}s`, sectionX + 13, rowY + 2);
        rowY += 18;
      }
    }

    ctx.restore();
  }

  function draw() {
    drawBackground();
    drawParticles();

    for (const pickup of game.pickups) {
      drawPickup(pickup);
    }

    for (const bullet of game.playerBullets) {
      drawBullet(bullet, true);
    }
    for (const bullet of game.enemyBullets) {
      drawBullet(bullet, false);
    }
    for (const enemy of game.enemies) {
      drawEnemy(enemy);
    }
    for (const boss of game.bosses) {
      drawBoss(boss);
    }

    drawPlayer();
    drawBossBars();
    drawFloatingTexts();
    drawStageTitle();
    drawHud();

    if (game.state === "paused") {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function updateSidebar() {
    if (toolbarStageLabel) {
      toolbarStageLabel.textContent = currentStageName();
    }
  }

  function tick(frameTime) {
    layoutCanvas(false);

    if (!game.lastFrame) {
      game.lastFrame = frameTime;
    }
    const dt = Math.min(MAX_DT, (frameTime - game.lastFrame) / 1000 || 0);
    game.lastFrame = frameTime;

    if (game.state === "running") {
      update(dt);
    } else if (game.state === "menu" || game.state === "gameover") {
      updateBackground(dt);
      updateSidebar();
    } else {
      updateSidebar();
    }

    draw();
    requestAnimationFrame(tick);
  }

  for (const button of helpButtons) {
    button.addEventListener("click", () => {
      openInfoModal(button.dataset.help);
    });
  }

  closeInfoBtn.addEventListener("click", closeInfoModal);
  infoBackdrop.addEventListener("click", closeInfoModal);
  window.addEventListener("resize", () => layoutCanvas(true));
  window.addEventListener("load", () => layoutCanvas(true));
  window.addEventListener("fullscreenchange", () => layoutCanvas(true));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      layoutCanvas(true);
    }
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => layoutCanvas(true));
  }
  if (window.ResizeObserver) {
    const layoutObserver = new ResizeObserver(() => layoutCanvas(true));
    layoutObserver.observe(playfieldFrame);
  }

  window.addEventListener("keydown", (event) => {
    if (isInfoOpen()) {
      if (event.code === "Escape") {
        closeInfoModal();
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
        event.preventDefault();
      }
      return;
    }

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }

    keys[event.code] = true;

    if (event.code === "Space" && !event.repeat) {
      if (game.state === "menu" || game.state === "gameover") {
        startGame();
      }
    }

    if (event.code === "KeyP" && !event.repeat) {
      togglePause();
    }
  });

  window.addEventListener("keyup", (event) => {
    keys[event.code] = false;
  });

  resetGame();
  layoutCanvas(true);
  showOverlay("星穹机战", "空格开始 · P 暂停");
  requestAnimationFrame(tick);
})();
