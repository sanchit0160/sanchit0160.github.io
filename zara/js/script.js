(function(){
    "use strict";

    // ============================================================
    // 1. CANVAS & RESPONSIVE SCALING
    // ============================================================
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const wrapper = document.getElementById('canvas-wrapper');

    let GAME_W = 1200;
    let GAME_H = 800;
    let GAME_ASPECT = GAME_W / GAME_H;

    // We use a "backing store" at GAME_W x GAME_H and let CSS letterbox it.
    // To make it look sharp on all screens, we scale the backing store to
    // match the displayed size × devicePixelRatio, up to a cap.
    let viewW = GAME_W;
    let viewH = GAME_H;
    let dpr = 1;

    function resizeCanvas() {
      const rect = wrapper.getBoundingClientRect();
      const cssW = rect.width;
      const cssH = rect.height;

      let displayW, displayH;
      if (cssH > cssW) {
        // Portrait mode - scale height dynamically to fill screen
        GAME_W = 1200;
        GAME_H = Math.round(1200 * (cssH / cssW));
        displayW = cssW;
        displayH = cssH;
      } else {
        // Landscape mode - fixed aspect letterboxing
        GAME_W = 1200;
        GAME_H = 800;
        GAME_ASPECT = GAME_W / GAME_H;
        if (cssW / cssH > GAME_ASPECT) {
          displayH = cssH;
          displayW = cssH * GAME_ASPECT;
        } else {
          displayW = cssW;
          displayH = cssW / GAME_ASPECT;
        }
      }

      // Position canvas centered
      canvas.style.width = displayW + 'px';
      canvas.style.height = displayH + 'px';
      canvas.style.left = ((cssW - displayW) / 2) + 'px';
      canvas.style.top = ((cssH - displayH) / 2) + 'px';

      // Backing store resolution — cap DPR to 2 for performance
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      viewW = Math.round(displayW * dpr);
      viewH = Math.round(displayH * dpr);

      // Set actual canvas pixels
      canvas.width = viewW;
      canvas.height = viewH;

      // Scale context so we can draw in GAME_W × GAME_H coordinates
      ctx.setTransform(viewW / GAME_W, 0, 0, viewH / GAME_H, 0, 0);

      // Sharper pixel art on small screens? Actually keep smooth for anti-aliasing.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }

    // Initial resize
    resizeCanvas();

    // Debounced resize handler
    let resizeTimeout = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeCanvas, 80);
    });
    window.addEventListener('orientationchange', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeCanvas, 200);
    });

    // ============================================================
    // 2. COLOR PALETTE
    // ============================================================
    const C = {
      bgTop:     '#1a1916',
      bgBot:     '#0e0d0b',
      wallLine:  'rgba(255,255,255,0.02)',
      floor:     '#0a0908',
      floorLine: 'rgba(255,255,255,0.04)',
      cork:      '#2f2a22',
      corkEdge:  '#3a342a',
      note1:     '#d9d2c0',
      note2:     '#c7bfa9',
      note3:     '#b3a892',
      note4:     '#9c927d',
      noteText:  '#2a2723',
      playerSkin:   '#e8c9a8',
      playerHair:   '#2a2018',
      playerDress:  '#b57a5c',
      playerAccent: '#8a5a42',
      playerBook:   '#3a2e4a',
      playerBookLt: '#c9b896',
      blasterBody:  '#5a4a3a',
      blasterTip:   '#d9a86a',
      bossBody:    '#e0d5b8',
      bossShade:   '#c9b896',
      bossLine:    '#8a7a5a',
      bossKnot:    '#a89870',
      bossEye:     '#3a3020',
      bossEyeLt:   '#f0e0b8',
      bossGrease:  '#b8a878',
      projCore:   '#f0d99a',
      projTrail:  'rgba(240,217,154,0.4)',
      momoBody:   '#e8d9b8',
      momoLine:   '#a89870',
      momoKnot:   '#c9b896',
      particle:   '#e8d9b8',
      particleHit:'#f0c88a',
      hpBack:     'rgba(0,0,0,0.55)',
      hpGood:     '#7cbf7a',
      hpMid:      '#d9b96b',
      hpLow:      '#d97c6c',
      hpBorder:   'rgba(255,255,255,0.15)',
      ink:        '#f4f1ea',
      inkSoft:    '#cfc9bd',
      inkMid:     '#9a9488',
      inkDim:     '#6a655c'
    };

    // ============================================================
    // 3. STATE
    // ============================================================
    const STATE = {
      MENU: 'menu', RULES: 'rules', PLAYING: 'playing',
      VICTORY: 'victory', GAMEOVER: 'gameover', CONFIRM_QUIT: 'confirmQuit'
    };
    let currentState = STATE.MENU;

    const player = {
      x: 300, y: 550, w: 80, h: 110,
      vx: 0, vy: 0, speed: 5.2,
      hp: 100, maxHp: 100,
      iFrames: 0, blinkTimer: 0,
      shootCooldown: 0, shootDelay: 24,
      recoil: 0, legPhase: 0, facing: 1, isShielding: false
    };

    const boss = {
      x: 850, y: 450, w: 200, h: 200,
      hp: 300, maxHp: 300,
      vx: 0, vy: 0, speed: 1.6,
      shootTimer: 0, shootInterval: 70,
      enraged: false, squash: 0, enrageFlash: 0, hitFlash: 0
    };

    let projectiles = [];
    let enemyProjectiles = [];
    let particles = [];

    let gameLoopId = null;
    let lastTimestamp = 0;
    let freezeAll = false;

    const keys = {
      w: false, a: false, s: false, d: false,
      up: false, down: false, left: false, right: false, space: false
    };
    let touchDir = { up: false, down: false, left: false, right: false };
    let firePressed = false;

    // Swipe
    const SWIPE_DEADZONE = 14;
    let swipeState = {
      active: false,
      startX: 0, startY: 0,
      lastX: 0, lastY: 0,
      startTime: 0,
      moved: false,
      pointerId: null
    };

    let audioCtx = null;
    let isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    // ============================================================
    // 4. AUDIO
    // ============================================================
    function initAudio() {
      if (!audioCtx) {
        try {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) { return; }
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    function playSound(type) {
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      try {
        switch (type) {
          case 'shoot': {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g); g.connect(audioCtx.destination);
            o.type = 'triangle';
            o.frequency.setValueAtTime(620, now);
            o.frequency.exponentialRampToValueAtTime(240, now + 0.08);
            g.gain.setValueAtTime(0.05, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            o.start(now); o.stop(now + 0.1);
            break;
          }
          case 'hitBoss': {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g); g.connect(audioCtx.destination);
            o.type = 'sine';
            o.frequency.setValueAtTime(150, now);
            o.frequency.exponentialRampToValueAtTime(75, now + 0.13);
            g.gain.setValueAtTime(0.08, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            o.start(now); o.stop(now + 0.15);
            break;
          }
          case 'playerHit': {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g); g.connect(audioCtx.destination);
            o.type = 'sine';
            o.frequency.setValueAtTime(240, now);
            o.frequency.exponentialRampToValueAtTime(60, now + 0.26);
            g.gain.setValueAtTime(0.1, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            o.start(now); o.stop(now + 0.3);
            break;
          }
          case 'victory': {
            [392, 523, 659, 784].forEach((f, i) => {
              const o = audioCtx.createOscillator();
              const g = audioCtx.createGain();
              o.connect(g); g.connect(audioCtx.destination);
              o.type = 'sine';
              o.frequency.value = f;
              g.gain.setValueAtTime(0.06, now + i * 0.14);
              g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.24);
              o.start(now + i * 0.14);
              o.stop(now + i * 0.14 + 0.24);
            });
            break;
          }
          case 'defeat': {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g); g.connect(audioCtx.destination);
            o.type = 'sine';
            o.frequency.setValueAtTime(180, now);
            o.frequency.exponentialRampToValueAtTime(50, now + 0.85);
            g.gain.setValueAtTime(0.12, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
            o.start(now); o.stop(now + 0.9);
            break;
          }
          case 'enrage': {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g); g.connect(audioCtx.destination);
            o.type = 'sine';
            o.frequency.setValueAtTime(330, now);
            o.frequency.exponentialRampToValueAtTime(660, now + 0.32);
            g.gain.setValueAtTime(0.08, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
            o.start(now); o.stop(now + 0.38);
            break;
          }
        }
      } catch (e) { /* silent */ }
    }

    // ============================================================
    // 5. UI MANAGEMENT
    // ============================================================
    const overlays = {
      mainMenu: document.getElementById('mainMenu'),
      rulesScreen: document.getElementById('rulesScreen'),
      victoryScreen: document.getElementById('victoryScreen'),
      gameOverScreen: document.getElementById('gameOverScreen')
    };
    const gameHUD = document.getElementById('gameHUD');
    const touchControls = document.getElementById('touchControls');
    const confirmDialog = document.getElementById('confirmDialog');
    const swipeHint = document.getElementById('swipeHint');

    function showOverlay(id) {
      Object.values(overlays).forEach(el => el.classList.remove('active'));
      if (id && overlays[id]) overlays[id].classList.add('active');
    }

    function setState(s) {
      currentState = s;

      // Overlays
      if (s === STATE.MENU) showOverlay('mainMenu');
      else if (s === STATE.RULES) showOverlay('rulesScreen');
      else if (s === STATE.VICTORY) showOverlay('victoryScreen');
      else if (s === STATE.GAMEOVER) showOverlay('gameOverScreen');
      else showOverlay(null);

      // HUD & touch controls
      if (s === STATE.PLAYING) {
        gameHUD.classList.add('visible');
        touchControls.classList.add('visible');
      } else {
        gameHUD.classList.remove('visible');
        touchControls.classList.remove('visible');
        confirmDialog.classList.remove('active');
      }

      // Swipe hint on first play
      if (s === STATE.PLAYING && isTouchDevice) {
        if (!sessionStorage.getItem('zaraHintShown')) {
          swipeHint.classList.add('show');
          setTimeout(() => {
            swipeHint.classList.remove('show');
            sessionStorage.setItem('zaraHintShown', '1');
          }, 3200);
        }
      } else {
        swipeHint.classList.remove('show');
      }
    }

    // Button bindings
    document.getElementById('btnPlay').addEventListener('click', () => { initAudio(); startGame(); });
    document.getElementById('btnHow').addEventListener('click', () => { initAudio(); setState(STATE.RULES); });
    document.getElementById('btnBackFromRules').addEventListener('click', () => setState(STATE.MENU));
    document.getElementById('btnVictoryAgain').addEventListener('click', () => { initAudio(); startGame(); });
    document.getElementById('btnVictoryMenu').addEventListener('click', () => setState(STATE.MENU));
    document.getElementById('btnGameOverAgain').addEventListener('click', () => { initAudio(); startGame(); });
    document.getElementById('btnGameOverMenu').addEventListener('click', () => setState(STATE.MENU));

    // Quit flow
    document.getElementById('btnQuit').addEventListener('click', () => {
      if (currentState === STATE.PLAYING) {
        freezeAll = true;
        confirmDialog.classList.add('active');
        currentState = STATE.CONFIRM_QUIT;
      }
    });
    document.getElementById('btnCancelQuit').addEventListener('click', () => {
      confirmDialog.classList.remove('active');
      if (currentState === STATE.CONFIRM_QUIT) {
        freezeAll = false;
        currentState = STATE.PLAYING;
      }
    });
    document.getElementById('btnConfirmQuit').addEventListener('click', () => {
      confirmDialog.classList.remove('active');
      freezeAll = false;
      resetToMenu();
    });

    function resetToMenu() {
      // Fully reset state
      freezeAll = false;
      setState(STATE.MENU);
    }

    // ============================================================
    // 6. START GAME
    // ============================================================
    function startGame() {
      player.x = 300; player.y = (GAME_H - player.h) / 2;
      player.vx = 0; player.vy = 0;
      player.hp = player.maxHp;
      player.iFrames = 0; player.blinkTimer = 0;
      player.shootCooldown = 0; player.recoil = 0;
      player.legPhase = 0; player.facing = 1; player.isShielding = false;

      boss.x = 850; boss.y = (GAME_H - boss.h) / 2;
      boss.hp = boss.maxHp;
      boss.enraged = false;
      boss.shootTimer = 0; boss.squash = 0;
      boss.enrageFlash = 0; boss.hitFlash = 0;

      projectiles = []; enemyProjectiles = []; particles = [];
      freezeAll = false;

      // Reset input
      touchDir.up = touchDir.down = touchDir.left = touchDir.right = false;
      firePressed = false; shieldPressed = false;

      setState(STATE.PLAYING);
      initAudio();

      if (!gameLoopId) {
        lastTimestamp = performance.now();
        gameLoopId = requestAnimationFrame(gameLoop);
      }
    }

    // ============================================================
    // 7. INPUT — KEYBOARD
    // ============================================================
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ' || e.key === ' ') e.preventDefault();
      if (k === 'w' || e.key === 'ArrowUp') { keys.w = true; keys.up = true; }
      if (k === 's' || e.key === 'ArrowDown') { keys.s = true; keys.down = true; }
      if (k === 'a' || e.key === 'ArrowLeft') { keys.a = true; keys.left = true; }
      if (k === 'd' || e.key === 'ArrowRight') { keys.d = true; keys.right = true; }
      if (k === ' ') { keys.space = true; e.preventDefault(); }
      if (k === 'shift') { keys.shift = true; }
      if (k === 'escape' && currentState === STATE.PLAYING) {
        document.getElementById('btnQuit').click();
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') { keys.w = false; keys.up = false; }
      if (k === 's' || e.key === 'ArrowDown') { keys.s = false; keys.down = false; }
      if (k === 'a' || e.key === 'ArrowLeft') { keys.a = false; keys.left = false; }
      if (k === 'd' || e.key === 'ArrowRight') { keys.d = false; keys.right = false; }
      if (k === ' ') { keys.space = false; e.preventDefault(); }
      if (k === 'shift') { keys.shift = false; }
    });

    // ============================================================
    // 8. INPUT — D-PAD
    // ============================================================
    document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
      const dir = btn.dataset.dir;
      const setDir = (val) => {
        if (dir === 'up') touchDir.up = val;
        if (dir === 'down') touchDir.down = val;
        if (dir === 'left') touchDir.left = val;
        if (dir === 'right') touchDir.right = val;
        if (val) btn.classList.add('pressed'); else btn.classList.remove('pressed');
      };
      const start = (e) => { e.preventDefault(); e.stopPropagation(); setDir(true); initAudio(); };
      const end = (e) => { e.preventDefault(); e.stopPropagation(); setDir(false); };

      btn.addEventListener('pointerdown', start);
      btn.addEventListener('pointerup', end);
      btn.addEventListener('pointercancel', end);
      btn.addEventListener('pointerout', end);
    });

    // ============================================================
    // 9. INPUT — FIRE BUTTON
    // ============================================================
    const fireBtn = document.getElementById('fireBtn');
    const setFire = (val) => {
      firePressed = val;
      if (val) fireBtn.classList.add('pressed'); else fireBtn.classList.remove('pressed');
    };
    const fireStart = (e) => { e.preventDefault(); e.stopPropagation(); setFire(true); initAudio(); };
    const fireEnd = (e) => { e.preventDefault(); e.stopPropagation(); setFire(false); };

    fireBtn.addEventListener('pointerdown', fireStart);
    fireBtn.addEventListener('pointerup', fireEnd);
    fireBtn.addEventListener('pointercancel', fireEnd);
    fireBtn.addEventListener('pointerout', fireEnd);

    let shieldPressed = false;
    const shieldBtn = document.getElementById('shieldBtn');
    const setShield = (val) => {
      shieldPressed = val;
      if (val) shieldBtn.classList.add('pressed'); else shieldBtn.classList.remove('pressed');
    };
    const shieldStart = (e) => { e.preventDefault(); e.stopPropagation(); setShield(true); };
    const shieldEnd = (e) => { e.preventDefault(); e.stopPropagation(); setShield(false); };

    shieldBtn.addEventListener('pointerdown', shieldStart);
    shieldBtn.addEventListener('pointerup', shieldEnd);
    shieldBtn.addEventListener('pointercancel', shieldEnd);
    shieldBtn.addEventListener('pointerout', shieldEnd);

    // ============================================================
    // 10. INPUT — SWIPE + TAP ON CANVAS
    // ============================================================
    function canvasGameCoords(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / rect.width * GAME_W,
        y: (clientY - rect.top) / rect.height * GAME_H
      };
    }

    // Touch handlers on wrapper (so overlays don't interfere)
    wrapper.addEventListener('touchstart', (e) => {
      if (currentState !== STATE.PLAYING) return;
      // Ignore if touch started on an interactive element
      if (e.target.closest('.dpad-btn') || e.target.closest('.fire-btn') || e.target.closest('#btnQuit')) return;
      e.preventDefault();
      initAudio();
      const t = e.changedTouches[0];
      const p = canvasGameCoords(t.clientX, t.clientY);
      swipeState.active = true;
      swipeState.startX = p.x;
      swipeState.startY = p.y;
      swipeState.lastX = p.x;
      swipeState.lastY = p.y;
      swipeState.startTime = performance.now();
      swipeState.moved = false;
      swipeState.pointerId = t.identifier;
    }, { passive: false });

    wrapper.addEventListener('touchmove', (e) => {
      if (currentState !== STATE.PLAYING || !swipeState.active) return;
      // Find matching touch
      let touch = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === swipeState.pointerId) {
          touch = e.changedTouches[i];
          break;
        }
      }
      if (!touch) return;
      e.preventDefault();
      const p = canvasGameCoords(touch.clientX, touch.clientY);
      const dx = p.x - swipeState.startX;
      const dy = p.y - swipeState.startY;
      const dist = Math.hypot(dx, dy);

      if (dist > SWIPE_DEADZONE) {
        swipeState.moved = true;
        touchDir.left  = dx < -SWIPE_DEADZONE * 0.4;
        touchDir.right = dx >  SWIPE_DEADZONE * 0.4;
        touchDir.up    = dy < -SWIPE_DEADZONE * 0.4;
        touchDir.down  = dy >  SWIPE_DEADZONE * 0.4;
      } else {
        touchDir.left = touchDir.right = touchDir.up = touchDir.down = false;
      }
    }, { passive: false });

    wrapper.addEventListener('touchend', (e) => {
      if (currentState !== STATE.PLAYING || !swipeState.active) return;
      let touch = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === swipeState.pointerId) {
          touch = e.changedTouches[i];
          break;
        }
      }
      if (!touch) return;
      e.preventDefault();

      // Tap-to-fire
      const elapsed = performance.now() - swipeState.startTime;
      if (!swipeState.moved && elapsed < 250) {
        firePressed = true;
        setTimeout(() => { firePressed = false; }, 90);
      }

      touchDir.left = touchDir.right = touchDir.up = touchDir.down = false;
      swipeState.active = false;
      swipeState.moved = false;
      swipeState.pointerId = null;
    }, { passive: false });

    wrapper.addEventListener('touchcancel', () => {
      touchDir.left = touchDir.right = touchDir.up = touchDir.down = false;
      swipeState.active = false;
      swipeState.moved = false;
      swipeState.pointerId = null;
    });

    // Mouse fallback for desktop
    wrapper.addEventListener('mousedown', (e) => {
      if (currentState !== STATE.PLAYING) return;
      if (e.target.closest('.dpad-btn') || e.target.closest('.fire-btn') || e.target.closest('#btnQuit')) return;
      firePressed = true;
      initAudio();
    });
    window.addEventListener('mouseup', () => { firePressed = false; });

    // ============================================================
    // 11. UTILITIES
    // ============================================================
    function rectCollide(r1, r2) {
      return !(r2.x > r1.x + r1.w || r2.x + r2.w < r1.x ||
               r2.y > r1.y + r1.h || r2.y + r2.h < r1.y);
    }

    function spawnParticles(x, y, count, color, speed, sizeRange) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * (speed || 4) + 1;
        const sr = sizeRange || [2, 6];
        particles.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 1.0,
          color: color || C.particle,
          size: Math.random() * (sr[1] - sr[0]) + sr[0]
        });
      }
    }

    function getHpColor(ratio) {
      if (ratio > 0.6) return C.hpGood;
      if (ratio > 0.3) return C.hpMid;
      return C.hpLow;
    }

    // ============================================================
    // 12. UPDATE
    // ============================================================
    function update() {
      if (freezeAll) return;

      // Player movement
      let mx = 0, my = 0;
      if (keys.w || keys.up || touchDir.up) my -= 1;
      if (keys.s || keys.down || touchDir.down) my += 1;
      if (keys.a || keys.left || touchDir.left) mx -= 1;
      if (keys.d || keys.right || touchDir.right) mx += 1;

      player.isShielding = keys.shift || shieldPressed;

      if (mx || my) {
        const len = Math.hypot(mx, my);
        mx /= len; my /= len;
        const curSpeed = player.isShielding ? player.speed * 0.5 : player.speed;
        player.vx = mx * curSpeed;
        player.vy = my * curSpeed;
        player.legPhase += 0.25;
      } else {
        player.vx *= 0.7; player.vy *= 0.7;
        player.legPhase *= 0.9;
      }
      
      // Always face the boss so firing while retreating feels smooth
      player.facing = (boss.x + boss.w / 2 > player.x + player.w / 2) ? 1 : -1;
      player.x += player.vx; player.y += player.vy;

      // Boundary
      player.x = Math.max(40, Math.min(GAME_W - player.w - 40, player.x));
      player.y = Math.max(80, Math.min(GAME_H - player.h - 40, player.y));

      // Timers
      if (player.iFrames > 0) { player.iFrames--; player.blinkTimer += 0.3; }
      else player.blinkTimer = 0;
      if (player.shootCooldown > 0) player.shootCooldown--;
      if (player.recoil > 0) player.recoil *= 0.85;

      // Shooting
      if (!player.isShielding && (keys.space || firePressed) && player.shootCooldown <= 0) {
        const ang = Math.atan2(
          (boss.y + boss.h/2) - (player.y + 40),
          (boss.x + boss.w/2) - (player.x + player.w/2)
        );
        const sx = player.x + player.w/2 + Math.cos(ang) * 40;
        const sy = player.y + 40 + Math.sin(ang) * 40;
        projectiles.push({
          x: sx, y: sy, vx: Math.cos(ang) * 13, vy: Math.sin(ang) * 13,
          w: 18, h: 8, life: 300, ang: ang
        });
        player.shootCooldown = player.shootDelay;
        player.recoil = 1.0;
        playSound('shoot');
        spawnParticles(sx, sy, 5, C.projCore, 2.5, [1, 3]);
      }

      // Boss AI
      const dx = player.x - boss.x;
      const targetDist = 480;
      if (Math.abs(dx) > targetDist + 60) boss.vx = Math.sign(dx) * boss.speed;
      else if (Math.abs(dx) < targetDist - 60) boss.vx = -Math.sign(dx) * boss.speed * 0.8;
      else boss.vx *= 0.9;

      // Vertical tracking so boss isn't isolated in portrait mode
      const dy = player.y - boss.y;
      if (Math.abs(dy) > 100) boss.vy = Math.sign(dy) * boss.speed * 0.6;
      else boss.vy *= 0.9;

      boss.x += boss.vx;
      boss.y += boss.vy + Math.sin(performance.now() * 0.002) * 0.8;
      boss.x = Math.max(500, Math.min(GAME_W - boss.w - 40, boss.x));
      boss.y = Math.max(100, Math.min(GAME_H - boss.h - 80, boss.y));

      if (!boss.enraged && boss.hp <= boss.maxHp * 0.4) {
        boss.enraged = true;
        boss.shootInterval = 40;
        boss.enrageFlash = 60;
        playSound('enrage');
      }
      if (boss.enrageFlash > 0) boss.enrageFlash--;
      if (boss.hitFlash > 0) boss.hitFlash--;

      boss.squash = Math.sin(performance.now() * 0.008) * 0.06 + 0.06;

      boss.shootTimer++;
      if (boss.shootTimer >= boss.shootInterval) {
        boss.shootTimer = 0;
        const ang = Math.atan2(
          player.y + player.h/2 - (boss.y + boss.h/2),
          player.x + player.w/2 - (boss.x + boss.w/2)
        );
        const spd = boss.enraged ? 7 : 5;
        enemyProjectiles.push({
          x: boss.x + boss.w/2, y: boss.y + boss.h/2,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          r: 22, life: 400
        });
        boss.squash = -0.2;
      }

      // Player projectiles
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.vx; p.y += p.vy; p.life--;
        if (p.x < -100 || p.x > GAME_W + 100 || p.y < -100 || p.y > GAME_H + 100 || p.life <= 0) {
          projectiles.splice(i, 1); continue;
        }
        const bRect = { x: boss.x, y: boss.y, w: boss.w, h: boss.h };
        const pRect = { x: p.x - p.w/2, y: p.y - p.h/2, w: p.w, h: p.h };
        if (rectCollide(bRect, pRect)) {
          projectiles.splice(i, 1);
          boss.hp -= 12;
          boss.squash = 0.3;
          boss.hitFlash = 6;
          spawnParticles(p.x, p.y, 12, C.particleHit, 5, [2, 7]);
          playSound('hitBoss');
          if (boss.hp <= 0) {
            boss.hp = 0;
            freezeAll = true;
            playSound('victory');
            setState(STATE.VICTORY);
            spawnParticles(boss.x + boss.w/2, boss.y + boss.h/2, 40, C.particleHit, 8, [3, 9]);
          }
        }
      }

      // Enemy projectiles
      for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const e = enemyProjectiles[i];
        e.x += e.vx; e.y += e.vy; e.life--;
        if (e.x < -100 || e.x > GAME_W + 100 || e.y < -100 || e.y > GAME_H + 100 || e.life <= 0) {
          enemyProjectiles.splice(i, 1); continue;
        }
        const pRect = { x: player.x, y: player.y, w: player.w, h: player.h };
        const eRect = { x: e.x - e.r, y: e.y - e.r, w: e.r*2, h: e.r*2 };
        if (rectCollide(pRect, eRect)) {
          enemyProjectiles.splice(i, 1);
          if (player.isShielding) {
            spawnParticles(e.x, e.y, 8, C.note1, 3, [1, 4]);
            particles.push({
              x: player.x + player.w/2, y: player.y - 20,
              vx: (Math.random() - 0.5) * 1.5, vy: -1.5,
              life: 1.5,
              color: '#ffffff',
              text: 'khikhi!'
            });
          } else if (player.iFrames <= 0) {
            player.hp -= 15;
            player.iFrames = 55;
            player.blinkTimer = 0;
            playSound('playerHit');
            spawnParticles(player.x + player.w/2, player.y + player.h/2, 16, C.momoLine, 4, [2, 6]);
            if (player.hp <= 0) {
              player.hp = 0;
              freezeAll = true;
              playSound('defeat');
              setState(STATE.GAMEOVER);
            }
          }
        }
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (!p.text) p.vy += 0.1;
        else p.vy *= 0.9;
        p.life -= 0.022;
        if (p.life <= 0) particles.splice(i, 1);
      }
    }

    // ============================================================
    // 13. RENDER
    // ============================================================
    function drawBackground() {
      const grad = ctx.createLinearGradient(0, 0, 0, GAME_H);
      grad.addColorStop(0, C.bgTop);
      grad.addColorStop(1, C.bgBot);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      ctx.strokeStyle = C.wallLine;
      ctx.lineWidth = 1;
      for (let y = 0; y < GAME_H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GAME_W, y); ctx.stroke();
      }

      // Corkboard
      ctx.fillStyle = C.corkEdge;
      ctx.beginPath();
      ctx.roundRect(58, 48, 304, 204, 12);
      ctx.fill();
      ctx.fillStyle = C.cork;
      ctx.beginPath();
      ctx.roundRect(64, 54, 292, 192, 10);
      ctx.fill();

      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 0; i < 240; i++) {
        const px = 64 + Math.random() * 292;
        const py = 54 + Math.random() * 192;
        ctx.fillRect(px, py, 1, 1);
      }

      const notes = [
        { x: 92, y: 78, w: 68, h: 68, color: C.note1, text: 'Reading' },
        { x: 200, y: 96, w: 68, h: 68, color: C.note2, text: 'Hakka\nNoodles' },
        { x: 130, y: 168, w: 68, h: 68, color: C.note3, text: 'Momos\nNO' },
        { x: 250, y: 70, w: 68, h: 68, color: C.note4, text: 'Tue off' }
      ];
      notes.forEach((n, idx) => {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.translate(n.x, n.y);
        ctx.rotate((idx % 2 === 0 ? 1 : -1) * 0.03);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.roundRect(2, 3, n.w, n.h, 5);
        ctx.fill();
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.roundRect(0, 0, n.w, n.h, 5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        for (let ly = 22; ly < n.h - 6; ly += 12) {
          ctx.beginPath();
          ctx.moveTo(6, ly); ctx.lineTo(n.w - 6, ly); ctx.stroke();
        }
        ctx.fillStyle = C.noteText;
        ctx.font = 'bold 9px "Inter", sans-serif';
        ctx.textAlign = 'center';
        n.text.split('\n').forEach((line, i) => {
          ctx.fillText(line, n.w/2, 22 + i * 13);
        });
        ctx.restore();
      });

      // Floor
      ctx.fillStyle = C.floor;
      ctx.fillRect(0, GAME_H - 70, GAME_W, 70);
      ctx.strokeStyle = C.floorLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, GAME_H - 70); ctx.lineTo(GAME_W, GAME_H - 70);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      for (let x = 0; x < GAME_W; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, GAME_H - 70);
        ctx.lineTo(x - 40, GAME_H);
        ctx.stroke();
      }
    }

    function drawPlayer() {
      if (player.iFrames > 0 && Math.floor(player.blinkTimer) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }

      const px = player.x;
      const py = player.y;
      const legSwing = Math.sin(player.legPhase) * 8;
      const recoil = player.recoil * 8 * -player.facing;

      ctx.save();
      ctx.translate(px + player.w/2 + recoil, py);

      // Legs
      ctx.fillStyle = C.playerHair;
      ctx.beginPath();
      ctx.roundRect(-18, 70, 12, 30 + legSwing, 5);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(6, 70, 12, 30 - legSwing, 5);
      ctx.fill();

      // Dress
      ctx.fillStyle = C.playerDress;
      ctx.beginPath();
      ctx.roundRect(-25, 20, 50, 60, 10);
      ctx.fill();
      ctx.strokeStyle = C.playerAccent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-25, 50); ctx.lineTo(25, 50);
      ctx.stroke();

      // Left arm
      ctx.fillStyle = C.playerSkin;
      ctx.beginPath();
      ctx.roundRect(-35, 30, 16, 40, 7);
      ctx.fill();

      const aimAng = Math.atan2(
        (boss.y + boss.h/2) - (player.y + 40),
        (boss.x + boss.w/2) - (player.x + player.w/2)
      );

      // Book
      if (player.isShielding) {
        ctx.save();
        ctx.translate(Math.cos(aimAng) * 45, Math.sin(aimAng) * 45); // move it in front of her face towards the aim
        ctx.rotate(aimAng + Math.PI/2);
        ctx.fillStyle = C.playerBook;
        ctx.beginPath();
        ctx.roundRect(-22, -29, 44, 58, 3);
        ctx.fill();
        ctx.fillStyle = '#e8dfd0';
        ctx.beginPath();
        ctx.roundRect(-18, -25, 38, 50, 2);
        ctx.fill();
        ctx.fillStyle = C.playerBook;
        ctx.beginPath();
        ctx.roundRect(-20, -27, 42, 54, 3);
        ctx.fill();
        ctx.strokeStyle = C.playerBookLt;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-20, -27); ctx.lineTo(-20, 27);
        ctx.stroke();
        ctx.fillStyle = C.playerBookLt;
        ctx.font = 'bold 6.5px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CAN WE', 1, -9);
        ctx.fillText('BE', 1, 0);
        ctx.fillText('STRANGERS', 1, 9);
        ctx.fillText('AGAIN', 1, 18);
        ctx.restore();
      } else {
        ctx.fillStyle = C.playerBook;
        ctx.beginPath();
        ctx.roundRect(-56, 24, 44, 58, 3);
        ctx.fill();
        ctx.fillStyle = '#e8dfd0';
        ctx.beginPath();
        ctx.roundRect(-52, 28, 38, 50, 2);
        ctx.fill();
        ctx.fillStyle = C.playerBook;
        ctx.beginPath();
        ctx.roundRect(-54, 26, 42, 54, 3);
        ctx.fill();
        ctx.strokeStyle = C.playerBookLt;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-54, 26); ctx.lineTo(-54, 80);
        ctx.stroke();
        ctx.fillStyle = C.playerBookLt;
        ctx.font = 'bold 6.5px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CAN WE', -33, 44);
        ctx.fillText('BE', -33, 53);
        ctx.fillText('STRANGERS', -33, 62);
        ctx.fillText('AGAIN', -33, 71);
      }

      // Right arm
      ctx.save();
      ctx.translate(26, 38);
      ctx.rotate(aimAng);
      ctx.translate(-26, -38);

      ctx.fillStyle = C.playerSkin;
      ctx.beginPath();
      ctx.roundRect(18, 28, 16, 40, 7);
      ctx.fill();

      // Blaster
      ctx.fillStyle = C.blasterBody;
      ctx.beginPath();
      ctx.roundRect(30, 35, 28, 12, 5);
      ctx.fill();
      ctx.fillStyle = C.blasterTip;
      ctx.beginPath();
      ctx.arc(58, 41, 6, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = C.blasterBody;
      ctx.beginPath();
      ctx.arc(58, 41, 3, 0, Math.PI*2);
      ctx.fill();
      
      ctx.restore();

      // Head
      ctx.fillStyle = C.playerSkin;
      ctx.beginPath();
      ctx.arc(0, -2, 26, 0, Math.PI*2);
      ctx.fill();

      // Hair
      ctx.fillStyle = C.playerHair;
      ctx.beginPath();
      ctx.arc(0, -10, 25, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-14, -6, 12, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(14, -6, 12, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-26, -12, 6, 26, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(20, -12, 6, 26, 3);
      ctx.fill();

      // Eyes
      if (player.iFrames > 0 && Math.floor(player.blinkTimer) % 2 === 0) {
        ctx.strokeStyle = C.playerHair;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-11, -5); ctx.lineTo(-3, -5);
        ctx.moveTo(3, -5); ctx.lineTo(11, -5);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-7, -5, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(7, -5, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = C.playerHair;
        ctx.beginPath();
        ctx.arc(-7, -5, 2.4, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(7, -5, 2.4, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(-6, -6, 0.9, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(8, -6, 0.9, 0, Math.PI*2);
        ctx.fill();
      }

      // Smile
      ctx.strokeStyle = '#8a5a42';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 4, 8, 0.2, Math.PI - 0.2);
      ctx.stroke();

      // Blush
      ctx.fillStyle = 'rgba(200, 120, 100, 0.15)';
      ctx.beginPath();
      ctx.arc(-14, 2, 5, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(14, 2, 5, 0, Math.PI*2);
      ctx.fill();

      ctx.restore();
      ctx.globalAlpha = 1;

      // Player health bar
      const hpW = 76, hpH = 8;
      const hpX = player.x + player.w/2 - hpW/2;
      const hpY = player.y - 22;
      const hpRatio = player.hp / player.maxHp;

      ctx.fillStyle = C.hpBack;
      ctx.beginPath();
      ctx.roundRect(hpX - 1, hpY - 1, hpW + 2, hpH + 2, 5);
      ctx.fill();
      ctx.fillStyle = getHpColor(hpRatio);
      ctx.beginPath();
      ctx.roundRect(hpX, hpY, hpW * hpRatio, hpH, 4);
      ctx.fill();
      ctx.strokeStyle = C.hpBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(hpX - 1, hpY - 1, hpW + 2, hpH + 2, 5);
      ctx.stroke();
    }

    function drawBoss() {
      const bx = boss.x;
      const by = boss.y;
      const sx = 1 + boss.squash;
      const sy = 1 - boss.squash;

      ctx.save();
      ctx.translate(bx + boss.w/2, by + boss.h/2);
      ctx.scale(sx, sy);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(4, 8, 98, 96, 0, 0, Math.PI*2);
      ctx.fill();

      const hitFlashAlpha = boss.hitFlash > 0 ? boss.hitFlash / 12 : 0;

      // Body
      ctx.fillStyle = C.bossBody;
      ctx.beginPath();
      ctx.ellipse(0, 0, 95, 95, 0, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.beginPath();
      ctx.ellipse(0, 22, 88, 58, 0, 0, Math.PI*2);
      ctx.fill();

      // Pleats
      ctx.strokeStyle = C.bossLine;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * 14, Math.sin(ang) * 14);
        ctx.lineTo(Math.cos(ang) * 82, Math.sin(ang) * 82);
        ctx.stroke();
      }

      // Center knot
      ctx.fillStyle = C.bossKnot;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = C.bossLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI*2);
      ctx.stroke();

      // Eyes
      ctx.fillStyle = C.bossEye;
      ctx.beginPath();
      ctx.ellipse(-34, -18, 18, 22, 0.08, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(34, -18, 18, 22, -0.08, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = boss.enraged ? C.bossEyeLt : C.bossBody;
      ctx.beginPath();
      ctx.arc(-34, -20, 6, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(34, -20, 6, 0, Math.PI*2);
      ctx.fill();

      if (boss.enraged) {
        ctx.strokeStyle = C.bossEye;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-52, -42); ctx.lineTo(-20, -34);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(52, -42); ctx.lineTo(20, -34);
        ctx.stroke();
      }

      // Mouth
      ctx.strokeStyle = C.bossEye;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 32, 42, 0.15, Math.PI - 0.15);
      ctx.stroke();

      if (boss.enraged) {
        ctx.fillStyle = 'rgba(58, 48, 32, 0.6)';
        ctx.beginPath();
        ctx.arc(0, 32, 40, 0.15, Math.PI - 0.15);
        ctx.closePath();
        ctx.fill();
      }

      // Grease
      ctx.fillStyle = C.bossGrease;
      ctx.beginPath();
      ctx.ellipse(-58, 58, 9, 17, 0.25, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(62, 52, 8, 20, -0.15, 0, Math.PI*2);
      ctx.fill();

      if (hitFlashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 240, 200, ${hitFlashAlpha * 0.35})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 95, 95, 0, 0, Math.PI*2);
        ctx.fill();
      }

      if (boss.enrageFlash > 0) {
        ctx.strokeStyle = `rgba(217, 124, 108, ${boss.enrageFlash / 100})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 100, 100, 0, 0, Math.PI*2);
        ctx.stroke();
      }

      ctx.restore();

      // Boss health bar
      const barW = 580, barH = 20;
      const barX = (GAME_W - barW) / 2;
      const barY = 30;
      const hpRatio = Math.max(0, boss.hp / boss.maxHp);

      ctx.fillStyle = C.hpBack;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 10);
      ctx.fill();
      ctx.fillStyle = getHpColor(hpRatio);
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * hpRatio, barH, 10);
      ctx.fill();
      ctx.strokeStyle = C.hpBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 10);
      ctx.stroke();

      ctx.fillStyle = C.ink;
      ctx.font = '600 12px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TITAN MOMO MONSTER', GAME_W/2, barY + barH/2);

      if (boss.enraged) {
        ctx.fillStyle = C.hpLow;
        ctx.font = '600 11px "Inter", sans-serif';
        ctx.fillText('— ENRAGED —', GAME_W/2, barY + barH + 14);
      }
    }

    function drawProjectiles() {
      projectiles.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.ang !== undefined) ctx.rotate(p.ang);

        ctx.strokeStyle = C.projTrail;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const speed = Math.hypot(p.vx, p.vy);
        ctx.moveTo(-speed * 2, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();

        ctx.fillStyle = C.projCore;
        ctx.beginPath();
        ctx.roundRect(-p.w/2, -p.h/2, p.w, p.h, 3);
        ctx.fill();

        ctx.fillStyle = '#fff8e0';
        ctx.beginPath();
        ctx.roundRect(-p.w/4, -p.h/4, p.w/2, p.h/2, 2);
        ctx.fill();

        ctx.restore();
      });

      enemyProjectiles.forEach(e => {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(e.x + 2, e.y + 3, e.r, e.r*0.9, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = C.momoBody;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, e.r, e.r*0.9, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = C.momoKnot;
        ctx.beginPath();
        ctx.arc(e.x, e.y - e.r*0.35, e.r*0.35, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = 'rgba(120, 90, 40, 0.18)';
        ctx.beginPath();
        ctx.ellipse(e.x + e.r*0.3, e.y + e.r*0.25, e.r*0.35, e.r*0.25, 0.5, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = C.momoLine;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, e.r, e.r*0.9, 0, 0, Math.PI*2);
        ctx.stroke();
      });
    }

    function drawParticles() {
      particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        if (p.text) {
          ctx.font = 'bold 16px "Inter", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(p.text, p.x, p.y);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
    }

    function render() {
      ctx.clearRect(0, 0, GAME_W, GAME_H);
      drawBackground();
      drawBoss();
      drawPlayer();
      drawProjectiles();
      drawParticles();

      if (player.iFrames > 0) {
        ctx.fillStyle = C.inkMid;
        ctx.font = '500 11px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('· I-FRAMES ·', player.x + player.w/2, player.y - 44);
      }
    }

    // ============================================================
    // 14. GAME LOOP
    // ============================================================
    function gameLoop(ts) {
      if (!lastTimestamp) lastTimestamp = ts;
      if (currentState === STATE.PLAYING) update();
      render();
      gameLoopId = requestAnimationFrame(gameLoop);
    }

    // ============================================================
    // 15. POLYFILL + INIT
    // ============================================================
    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (typeof r === 'number') r = [r, r, r, r];
        else if (Array.isArray(r) && r.length === 2) r = [r[0], r[0], r[1], r[1]];
        else if (!Array.isArray(r)) r = [0, 0, 0, 0];
        const [tl, tr, br, bl] = r;
        this.moveTo(x + tl, y);
        this.lineTo(x + w - tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + tr);
        this.lineTo(x + w, y + h - br);
        this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        this.lineTo(x + bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - bl);
        this.lineTo(x, y + tl);
        this.quadraticCurveTo(x, y, x + tl, y);
        return this;
      };
    }

    // Prevent scroll/zoom on overlays except the rules panel
    document.querySelectorAll('.overlay').forEach(el => {
      el.addEventListener('touchmove', (e) => {
        if (e.target.closest('.rules-panel')) return;
        e.preventDefault();
      }, { passive: false });
    });

    // Prevent pinch-zoom
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
    document.addEventListener('gestureend', (e) => e.preventDefault());

    // Prevent double-tap zoom
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });

    // Also handle visibility change — pause the game if tab hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && currentState === STATE.PLAYING) {
        // Auto-quit? No — just freeze. Resume when visible.
        // (We don't want to freeze because the loop is still running, but
        //  the browser pauses rAF anyway. Fine.)
      }
    });

    // Start
    setState(STATE.MENU);
    lastTimestamp = performance.now();
    gameLoopId = requestAnimationFrame(gameLoop);

    // Unlock audio on first interaction
    ['click', 'touchstart', 'keydown'].forEach(ev => {
      window.addEventListener(ev, () => { initAudio(); }, { once: true });
    });

  })();