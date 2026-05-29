/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameStatus, Brick, Ball, Paddle, PowerUp, Particle, LaserBullet, PowerUpType, BrickType } from '../types';
import { LEVELS } from '../levels';
import { sound } from '../sound';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Shield, Zap, Sparkles, Heart, Award, ArrowRight, MousePointer, Keyboard } from 'lucide-react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// 定義磚塊顏色與HP對應，打造精美霓虹漸層
const BRICK_COLORS: Record<BrickType, string[]> = {
  NORMAL: ['#00F2FF', '#0891B2'], // 霓虹青色 (1HP)
  STRONG: ['#FF007A', '#BE185D'], // 霓虹洋紅 (2HP)
  METAL: ['#E4E4E7', '#52525B'],  // 銀灰色金屬冷鋼 (不可摧毀)
  GOLDEN: ['#FFD600', '#B45309'], // 金黃色特工磚 (1HP)
};

const POWERUP_DETAILS: Record<PowerUpType, { label: string; color: string; desc: string; icon: string }> = {
  ENLARGE_PADDLE: { label: '加長平台', color: '#00F2FF', desc: '平台寬度加長 1.5 倍', icon: '↔️' },
  SHRINK_PADDLE: { label: '縮小平台', color: '#FF007A', desc: '平台變窄 (小心！)', icon: '🤏' },
  MULTI_BALL: { label: '分裂多球', color: '#00F2FF', desc: '分裂成 3 顆球！', icon: '🔮' },
  SUPER_BALL: { label: '強力穿透', color: '#FFD600', desc: '球變火球，穿透一切磚塊', icon: '🔥' },
  LASER_PADDLE: { label: '雷射砲台', color: '#FF007A', desc: '平台可發射雷射擊碎磚塊', icon: '⚡' },
  SAFETY_FLOOR: { label: '防護力場', color: '#a855f7', desc: '最底下放置防護網', icon: '🛡️' },
  EXTRA_LIFE: { label: '額外生命', color: '#ef4444', desc: '獲得額外 1 條生命', icon: '❤️' },
};

export default function GameBoard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 遊戲當前進行的 React State (用於 UI 顯示)
  const [gameStatus, setGameStatus] = useState<GameStatus>('MENU');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [activePowerUps, setActivePowerUps] = useState<{ type: PowerUpType; timeLeft: number }[]>([]);
  const [controlType, setControlType] = useState<'MOUSE' | 'KEYBOARD'>('MOUSE');

  // 持久化變數，用於 Game Loop (避免 React re-render 造成畫格延遲)
  const stateRef = useRef({
    status: 'MENU' as GameStatus,
    score: 0,
    lives: 3,
    levelIdx: 0,
    paddle: { x: 340, y: 550, width: 120, height: 16, speed: 10, isLaserActive: false, laserCooldown: 0, laserDurationLeft: 0 } as Paddle,
    balls: [] as Ball[],
    bricks: [] as Brick[],
    powerUps: [] as PowerUp[],
    particles: [] as Particle[],
    bullets: [] as LaserBullet[],
    safetyFloorActive: false,
    safetyFloorTimeLeft: 0,
    keys: { ArrowLeft: false, ArrowRight: false, d: false, a: false },
    mouseX: 400,
    lastTime: 0,
    shakeTime: 0, // 震屏效果
    shakeIntensity: 0,
  });

  // 從 LocalStorage 載入最高分
  useEffect(() => {
    const saved = localStorage.getItem('brick_breaker_highscore');
    if (saved) {
      setHighScore(parseInt(saved, 10));
    }
  }, []);

  // 滑鼠 / 按鍵手感切換聲
  const handleControlChange = (type: 'MOUSE' | 'KEYBOARD') => {
    sound.playClick();
    setControlType(type);
  };

  // 切換靜音
  const toggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  // 初始化某個關卡
  const initLevel = (levelIndex: number, keepScoreAndLives: boolean = false) => {
    const config = LEVELS[levelIndex];
    if (!config) return;

    const game = stateRef.current;
    game.levelIdx = levelIndex;
    setCurrentLevelIdx(levelIndex);

    if (!keepScoreAndLives) {
      game.score = 0;
      game.lives = 3;
      setScore(0);
      setLives(3);
    }

    // 1. 初始化平台
    game.paddle = {
      x: CANVAS_WIDTH / 2 - 60,
      y: CANVAS_HEIGHT - 45,
      width: 120,
      height: 16,
      speed: 10,
      isLaserActive: false,
      laserCooldown: 0,
      laserDurationLeft: 0,
    };

    // 2. 初始化球：放在 Paddle 正上方
    game.balls = [
      {
        id: 'ball-init',
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT - 45 - 10, // 擋板上方
        vx: 3 + Math.random() * 2, // 初始帶有一點點角度
        vy: -5,
        radius: 9,
        isSuper: false,
        color: '#ffffff',
        isAttachedToPaddle: true, // 初始吸附於平台
      },
    ];

    // 3. 生成磚塊
    const layout = config.layout;
    const padding = 6;
    const offsetTop = 75;
    const offsetLeft = 40;
    const cols = 12; // 一律 12 欄
    const brickWidth = (CANVAS_WIDTH - offsetLeft * 2 - (cols - 1) * padding) / cols;
    const brickHeight = 22;

    const generatedBricks: Brick[] = [];

    for (let r = 0; r < layout.length; r++) {
      for (let c = 0; c < layout[r].length; c++) {
        const typeVal = layout[r][c];
        if (typeVal === 0) continue;

        let bType: BrickType = 'NORMAL';
        let maxHp = 1;
        let scoreValue = 100;

        if (typeVal === 2) {
          bType = 'STRONG';
          maxHp = 2;
          scoreValue = 250;
        } else if (typeVal === 3) {
          bType = 'METAL';
          maxHp = Infinity;
          scoreValue = 0; // 不可打破
        } else if (typeVal === 4) {
          bType = 'GOLDEN';
          maxHp = 1;
          scoreValue = 300;
        }

        // 隨機賦予道具 (若是金色磚塊，必派發道具；普通/硬磚塊有 15% 機率掉落)
        let powerType: PowerUpType | null = null;
        if (bType === 'GOLDEN') {
          const powerTypes: PowerUpType[] = ['ENLARGE_PADDLE', 'MULTI_BALL', 'SUPER_BALL', 'LASER_PADDLE', 'SAFETY_FLOOR', 'EXTRA_LIFE'];
          powerType = powerTypes[Math.floor(Math.random() * powerTypes.length)];
        } else if (bType !== 'METAL' && Math.random() < 0.16) {
          const powerTypes: PowerUpType[] = ['ENLARGE_PADDLE', 'SHRINK_PADDLE', 'MULTI_BALL', 'SUPER_BALL', 'LASER_PADDLE', 'SAFETY_FLOOR', 'EXTRA_LIFE'];
          powerType = powerTypes[Math.floor(Math.random() * powerTypes.length)];
        }

        const x = offsetLeft + c * (brickWidth + padding);
        const y = offsetTop + r * (brickHeight + padding);

        generatedBricks.push({
          id: `brick-${r}-${c}`,
          x,
          y,
          width: brickWidth,
          height: brickHeight,
          type: bType,
          hp: maxHp,
          maxHp,
          color: '', // 渲染時採漸層，但可以儲存輔助色
          isDestroyed: false,
          powerUp: powerType,
          scoreValue,
        });
      }
    }

    game.bricks = generatedBricks;
    game.powerUps = [];
    game.bullets = [];
    game.particles = [];
    game.safetyFloorActive = false;
    game.safetyFloorTimeLeft = 0;

    setActivePowerUps([]);
  };

  // 鍵盤與滑鼠事件監聽
  useEffect(() => {
    const game = stateRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免視窗滾動
      if (['Space', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        game.keys.ArrowLeft = true;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        game.keys.ArrowRight = true;
      }

      // 發射或雷射
      if (e.key === ' ' || e.key === 'Spacebar') {
        triggerAction();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        game.keys.ArrowLeft = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        game.keys.ArrowRight = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      // 將滑鼠 X 對應到 800px 解析度
      const mouseX = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
      game.mouseX = mouseX;
    };

    // 點擊滑鼠也可以釋放球
    const handleMouseClick = () => {
      triggerAction();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mousedown', handleMouseClick);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (canvas) {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mousedown', handleMouseClick);
      }
    };
  }, [gameStatus]);

  // 按下空白鍵或滑鼠點擊時的動作
  const triggerAction = () => {
    const game = stateRef.current;

    // 1. 若球吸附在 Paddle 上，則發射
    let firedAny = false;
    game.balls.forEach((ball) => {
      if (ball.isAttachedToPaddle) {
        ball.isAttachedToPaddle = false;
        ball.vx = (Math.random() - 0.5) * 4; // 隨機斜率角
        ball.vy = -6.5; // 發射向上
        firedAny = true;
      }
    });

    if (firedAny) {
      sound.playBouncePaddle();
      return;
    }

    // 2. 若雷射道具啟動中，且冷卻時間完畢，則發射
    if (game.paddle.isLaserActive && game.paddle.laserCooldown <= 0) {
      // 左右兩端各發射一顆子彈
      const leftBullet: LaserBullet = {
        id: `bullet-${Date.now()}-L`,
        x: game.paddle.x + 8,
        y: game.paddle.y - 10,
        vy: -9,
        width: 3,
        height: 12,
        color: '#ff2e93', // 亮粉紅
      };
      const rightBullet: LaserBullet = {
        id: `bullet-${Date.now()}-R`,
        x: game.paddle.x + game.paddle.width - 11,
        y: game.paddle.y - 10,
        vy: -9,
        width: 3,
        height: 12,
        color: '#ff2e93',
      };
      game.bullets.push(leftBullet, rightBullet);
      game.paddle.laserCooldown = 200; // 0.2 秒冷卻
      sound.playLaserFire();
      // 砲台後座粒子
      createParticles(game.paddle.x + 8, game.paddle.y, '#ff2e93', 4);
      createParticles(game.paddle.x + game.paddle.width - 11, game.paddle.y, '#ff2e93', 4);
    }
  };

  // 產出撞擊碎裂粒子
  const createParticles = (x: number, y: number, color: string, count: number = 12) => {
    const game = stateRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5, // 偏向上噴射
        radius: 1.5 + Math.random() * 3,
        color: color,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.03,
        gravity: 0.1,
      });
    }
  };

  // 生成震屏效果
  const shakeScreen = (intensity: number, duration: number) => {
    const game = stateRef.current;
    game.shakeIntensity = intensity;
    game.shakeTime = duration;
  };

  // 點擊開始遊戲 (UI 使用)
  const startGame = () => {
    sound.playClick();
    initLevel(0, false);
    stateRef.current.status = 'PLAYING';
    setGameStatus('PLAYING');
  };

  // 暫停鍵
  const togglePause = () => {
    sound.playClick();
    const game = stateRef.current;
    if (game.status === 'PLAYING') {
      game.status = 'PAUSED';
      setGameStatus('PAUSED');
    } else if (game.status === 'PAUSED') {
      game.status = 'PLAYING';
      setGameStatus('PLAYING');
    }
  };

  // 重新開始
  const handleReset = () => {
    sound.playClick();
    initLevel(0, false);
    stateRef.current.status = 'PLAYING';
    setGameStatus('PLAYING');
  };

  // 至下一關
  const nextLevel = () => {
    sound.playClick();
    const game = stateRef.current;
    const nextIdx = (game.levelIdx + 1) % LEVELS.length;
    initLevel(nextIdx, true);
    game.status = 'PLAYING';
    setGameStatus('PLAYING');
  };

  // 回到主選單
  const backToMenu = () => {
    sound.playClick();
    stateRef.current.status = 'MENU';
    setGameStatus('MENU');
  };

  // 觸發道具獲取
  const collectPowerUp = (type: PowerUpType) => {
    const game = stateRef.current;
    sound.playPowerUpCollect();

    // 在擋板位置產生閃亮粒子
    createParticles(game.paddle.x + game.paddle.width / 2, game.paddle.y, '#fbbf24', 25);

    // 回饋加分
    game.score += 150;
    setScore(game.score);

    switch (type) {
      case 'EXTRA_LIFE':
        game.lives += 1;
        setLives(game.lives);
        break;

      case 'ENLARGE_PADDLE':
        // 增寬
        game.paddle.width = 180;
        // 如果有反向道具，將其消除
        removeActivePowerUpUI('SHRINK_PADDLE');
        addPowerUpUI('ENLARGE_PADDLE', 8000);
        break;

      case 'SHRINK_PADDLE':
        // 減寬
        game.paddle.width = 80;
        removeActivePowerUpUI('ENLARGE_PADDLE');
        addPowerUpUI('SHRINK_PADDLE', 8000);
        break;

      case 'MULTI_BALL':
        // 取得目前場上任何一顆球，在它的位置分裂出另外兩顆球
        const referenceBall = game.balls[0] || { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, vx: 2, vy: -5, radius: 9 };
        const b1: Ball = {
          id: `ball-multi-${Date.now()}-1`,
          x: referenceBall.x,
          y: referenceBall.y,
          vx: referenceBall.vx + (Math.random() - 0.5) * 3,
          vy: -Math.abs(referenceBall.vy),
          radius: referenceBall.radius,
          isSuper: referenceBall.isSuper,
          color: '#2dd4bf',
          isAttachedToPaddle: false,
        };
        const b2: Ball = {
          id: `ball-multi-${Date.now()}-2`,
          x: referenceBall.x,
          y: referenceBall.y,
          vx: referenceBall.vx - (Math.random() - 0.5) * 3,
          vy: -Math.abs(referenceBall.vy),
          radius: referenceBall.radius,
          isSuper: referenceBall.isSuper,
          color: '#38bdf8',
          isAttachedToPaddle: false,
        };
        game.balls.push(b1, b2);
        break;

      case 'SUPER_BALL':
        game.balls.forEach((b) => {
          b.isSuper = true;
          b.color = '#ff6b00';
        });
        addPowerUpUI('SUPER_BALL', 10000);
        break;

      case 'LASER_PADDLE':
        game.paddle.isLaserActive = true;
        game.paddle.laserDurationLeft = 8000;
        addPowerUpUI('LASER_PADDLE', 8000);
        break;

      case 'SAFETY_FLOOR':
        game.safetyFloorActive = true;
        game.safetyFloorTimeLeft = 15000;
        addPowerUpUI('SAFETY_FLOOR', 15000);
        break;
    }
  };

  // 更新 React State UI 顯示的道具時效
  const addPowerUpUI = (type: PowerUpType, duration: number) => {
    setActivePowerUps((prev) => {
      // 若已有了，更新時間；否則新增
      const existing = prev.find((p) => p.type === type);
      if (existing) {
        return prev.map((p) => (p.type === type ? { ...p, timeLeft: duration } : p));
      }
      return [...prev, { type, timeLeft: duration }];
    });
  };

  const removeActivePowerUpUI = (type: PowerUpType) => {
    setActivePowerUps((prev) => prev.filter((p) => p.type !== type));
  };

  // 持續處理道具失效邏輯在 Game Loop
  const updatePowerUpTimers = (deltaTime: number) => {
    const game = stateRef.current;

    // 1. Paddle 寬度與雷射時效
    let shrinkTimeLeft = 0;
    let enlargeTimeLeft = 0;

    setActivePowerUps((prev) => {
      const next = prev
        .map((p) => {
          const rem = p.timeLeft - deltaTime;
          if (p.type === 'SHRINK_PADDLE') shrinkTimeLeft = rem;
          if (p.type === 'ENLARGE_PADDLE') enlargeTimeLeft = rem;
          return { ...p, timeLeft: rem };
        })
        .filter((p) => p.timeLeft > 0);

      // 若失效，還原狀態
      if (prev.find((p) => p.type === 'SHRINK_PADDLE') && shrinkTimeLeft <= 0) {
        game.paddle.width = 120;
      }
      if (prev.find((p) => p.type === 'ENLARGE_PADDLE') && enlargeTimeLeft <= 0) {
        game.paddle.width = 120;
      }
      if (prev.find((p) => p.type === 'SUPER_BALL') && !next.find((p) => p.type === 'SUPER_BALL')) {
        game.balls.forEach((b) => {
          b.isSuper = false;
          b.color = '#ffffff';
        });
      }
      if (prev.find((p) => p.type === 'LASER_PADDLE') && !next.find((p) => p.type === 'LASER_PADDLE')) {
        game.paddle.isLaserActive = false;
      }
      if (prev.find((p) => p.type === 'SAFETY_FLOOR') && !next.find((p) => p.type === 'SAFETY_FLOOR')) {
        game.safetyFloorActive = false;
      }

      return next;
    });

    if (game.paddle.isLaserActive) {
      game.paddle.laserDurationLeft -= deltaTime;
      if (game.paddle.laserCooldown > 0) {
        game.paddle.laserCooldown -= deltaTime;
      }
    }
  };

  // ----------------------------------------------------------------
  // 核心 Game Loop - 高效物理繪製迴圈 (不觸發 React 渲染)
  // ----------------------------------------------------------------
  useEffect(() => {
    let animId: number;

    const loop = (timestamp: number) => {
      const game = stateRef.current;
      if (!game.lastTime) game.lastTime = timestamp;
      const deltaTime = timestamp - game.lastTime;
      game.lastTime = timestamp;

      // 如果不是處於 PLAYING 狀態，只繪製背景，不運行物理運算
      if (game.status === 'PLAYING') {
        updatePhysics(deltaTime);
      }

      renderCanvas();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  // ----------------------------------------------------------------
  // 1. 物理學計算與碰撞判斷
  // ----------------------------------------------------------------
  const updatePhysics = (deltaTime: number) => {
    const game = stateRef.current;

    // 0. 更新震動
    if (game.shakeTime > 0) {
      game.shakeTime -= deltaTime;
    }

    // 更新道具定時器
    updatePowerUpTimers(deltaTime);

    // 1. 更新擋板 (Paddle) 位置
    if (controlType === 'MOUSE') {
      // 滑鼠控制：直接平滑貼近 target position
      const targetX = game.mouseX - game.paddle.width / 2;
      // 限制在畫布內
      game.paddle.x = Math.max(0, Math.min(CANVAS_WIDTH - game.paddle.width, targetX));
    } else {
      // 鍵盤控制：
      if (game.keys.ArrowLeft) {
        game.paddle.x -= game.paddle.speed;
        if (game.paddle.x < 0) game.paddle.x = 0;
      }
      if (game.keys.ArrowRight) {
        game.paddle.x += game.paddle.speed;
        if (game.paddle.x > CANVAS_WIDTH - game.paddle.width) {
          game.paddle.x = CANVAS_WIDTH - game.paddle.width;
        }
      }
    }

    // 2. 更新與移動所有球 (Ball movement)
    game.balls.forEach((ball) => {
      // 若吸附在平台，跟著平台移動
      if (ball.isAttachedToPaddle) {
        ball.x = game.paddle.x + game.paddle.width / 2;
        ball.y = game.paddle.y - ball.radius;
        return;
      }

      // 移動
      ball.x += ball.vx;
      ball.y += ball.vy;

      // A. 球與左右側牆壁碰撞
      if (ball.x - ball.radius <= 0) {
        ball.x = ball.radius;
        ball.vx = -ball.vx;
        sound.playBounceWall();
        createParticles(0, ball.y, '#e2e8f0', 5);
        shakeScreen(2, 80);
      } else if (ball.x + ball.radius >= CANVAS_WIDTH) {
        ball.x = CANVAS_WIDTH - ball.radius;
        ball.vx = -ball.vx;
        sound.playBounceWall();
        createParticles(CANVAS_WIDTH, ball.y, '#e2e8f0', 5);
        shakeScreen(2, 80);
      }

      // B. 球與頂部碰撞
      if (ball.y - ball.radius <= 0) {
        ball.y = ball.radius;
        ball.vy = -ball.vy;
        sound.playBounceWall();
        createParticles(ball.x, 0, '#e2e8f0', 5);
        shakeScreen(2, 80);
      }

      // C. 球與底部碰撞 (安全底網 or 扣命)
      if (ball.y >= CANVAS_HEIGHT) {
        // 設定球掉落出局。
      }

      // D. 球與安全防護底網碰撞
      if (game.safetyFloorActive && ball.y + ball.radius >= CANVAS_HEIGHT - 10) {
        ball.vy = -Math.abs(ball.vy);
        ball.y = CANVAS_HEIGHT - 10 - ball.radius - 2;
        // 消耗掉防護底板
        game.safetyFloorActive = false;
        removeActivePowerUpUI('SAFETY_FLOOR');
        sound.playBouncePaddle();
        shakeScreen(4, 150);
        // 大量電磁粒子
        for (let idx = 0; idx < CANVAS_WIDTH; idx += 20) {
          createParticles(idx, CANVAS_HEIGHT - 10, '#8b5cf6', 1);
        }
      }

      // E. 球與擋板 (Paddle) 的碰撞
      if (
        ball.vy > 0 && // 球向下前進才算反彈
        ball.y + ball.radius >= game.paddle.y &&
        ball.y - ball.radius <= game.paddle.y + game.paddle.height &&
        ball.x + ball.radius >= game.paddle.x &&
        ball.x - ball.radius <= game.paddle.x + game.paddle.width
      ) {
        // 撞擊點與擋板中心的相對比例 (值介於 -0.5 到 0.5)
        const hitPoint = (ball.x - (game.paddle.x + game.paddle.width / 2)) / game.paddle.width;

        // 動態調整反彈角度與速度。若切得越邊緣，角度就越平、越刁鑽
        const baseSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const nextSpeed = Math.min(10, Math.max(5.5, baseSpeed + 0.1)); // 每次碰撞些微加速提昇緊湊感，最高不超過 10px / frame
        const angle = hitPoint * (Math.PI / 3); // 最大反彈偏斜角 60 度

        ball.vx = nextSpeed * Math.sin(angle);
        ball.vy = -nextSpeed * Math.cos(angle);
        ball.y = game.paddle.y - ball.radius - 1; // 修正穿模

        sound.playBouncePaddle();
        // 藍綠霓虹撞擊粒子
        createParticles(ball.x, game.paddle.y, '#38bdf8', 8);
        shakeScreen(3, 100);
      }

      // F. 球與磚塊的碰撞檢測
      for (let i = 0; i < game.bricks.length; i++) {
        const brick = game.bricks[i];
        if (brick.isDestroyed) continue;

        // 尋找磚塊上最靠近球心的點
        const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
        const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));

        // 計算距離
        const distanceX = ball.x - closestX;
        const distanceY = ball.y - closestY;
        const distanceSq = distanceX * distanceX + distanceY * distanceY;

        if (distanceSq < ball.radius * ball.radius) {
          // 發生碰撞！
          
          // 若不是穿透球，則計算反彈
          if (!ball.isSuper && brick.type !== 'METAL') {
            // 判定最接近的碰撞邊緣進行反轉
            const overlapX = ball.radius - Math.abs(distanceX);
            const overlapY = ball.radius - Math.abs(distanceY);

            if (overlapX < overlapY) {
              ball.vx = distanceX > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
            } else {
              ball.vy = distanceY > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
            }
          } else if (brick.type === 'METAL') {
            // 金屬即使強力也必須反彈
            const overlapX = ball.radius - Math.abs(distanceX);
            const overlapY = ball.radius - Math.abs(distanceY);
            if (overlapX < overlapY) {
              ball.vx = distanceX > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
            } else {
              ball.vy = distanceY > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
            }
          }

          // 磚塊受傷邏輯
          if (brick.type === 'METAL') {
            sound.playMetalHit();
            // 金屬火花
            createParticles(closestX, closestY, '#ffffff', 5);
            shakeScreen(2, 60);
          } else {
            // 普通、堅固、金色磚
            if (ball.isSuper) {
              brick.hp = 0; // 火球直接擊毀
            } else {
              brick.hp -= 1;
            }

            if (brick.hp <= 0) {
              brick.isDestroyed = true;
              game.score += brick.scoreValue;
              setScore(game.score);
              sound.playBreakBrick();

              // 彩虹爆炸粒子
              const chipColor = BRICK_COLORS[brick.type][0] || '#38bdf8';
              createParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, chipColor, 12);
              shakeScreen(5, 120);

              // 檢查道具釋放
              if (brick.powerUp) {
                game.powerUps.push({
                  id: `powerup-${Date.now()}-${Math.random()}`,
                  x: brick.x + brick.width / 2,
                  y: brick.y + brick.height,
                  vy: 2.5, // 向下飄落的速度
                  type: brick.powerUp,
                  radius: 12,
                  color: POWERUP_DETAILS[brick.powerUp]?.color || '#ffffff',
                });
                sound.playPowerUpDrop();
              }
            } else {
              sound.playBreakStrong();
              // 紫色碎骨粒子
              createParticles(closestX, closestY, '#a855f7', 6);
              shakeScreen(3, 80);
            }
          }

          // 碰撞到一個就結束此球此幀的磚塊碰撞檢測，避免單幀多重撞擊異常
          break;
        }
      }
    });

    // 溢出畫布底部球隻回收與死亡偵測
    const originalCount = game.balls.length;
    game.balls = game.balls.filter((ball) => ball.y - ball.radius < CANVAS_HEIGHT);

    // 檢查是否有球掉落
    if (game.balls.length === 0 && originalCount > 0) {
      game.lives -= 1;
      setLives(game.lives);
      sound.playLoseLife();

      if (game.lives <= 0) {
        // 1. 遊戲結束
        game.status = 'GAMEOVER';
        setGameStatus('GAMEOVER');
        sound.playGameOver();

        // 更新最高分數
        const currentHighScore = parseInt(localStorage.getItem('brick_breaker_highscore') || '0', 10);
        if (game.score > currentHighScore) {
          localStorage.setItem('brick_breaker_highscore', game.score.toString());
          setHighScore(game.score);
        }
      } else {
        // 還有命，在 Paddle 上重新放置一顆與 Paddle 吸附的球
        game.balls = [
          {
            id: `ball-respawn-${Date.now()}`,
            x: game.paddle.x + game.paddle.width / 2,
            y: game.paddle.y - 10,
            vx: 0,
            vy: 0,
            radius: 9,
            isSuper: false,
            color: '#ffffff',
            isAttachedToPaddle: true,
          },
        ];
        // 移除所有目前的負面/正面狀態（加長除外，體恤玩家）
        game.paddle.width = 120;
        game.paddle.isLaserActive = false;
        setActivePowerUps([]);
      }
    }

    // 3. 更新與移動所有漂落中的道具
    game.powerUps.forEach((pu) => {
      pu.y += pu.vy;

      // 吃到道具的檢測 (圓形與擋板 Paddle 的矩形碰撞)
      if (
        pu.y + pu.radius >= game.paddle.y &&
        pu.y - pu.radius <= game.paddle.y + game.paddle.height &&
        pu.x + pu.radius >= game.paddle.x &&
        pu.x - pu.radius <= game.paddle.x + game.paddle.width
      ) {
        pu.y = 9999; // 標記被吃了
        collectPowerUp(pu.type);
      }
    });
    // 過濾已被吃掉或飄出畫布的道具
    game.powerUps = game.powerUps.filter((pu) => pu.y < CANVAS_HEIGHT);

    // 4. 雷射子彈飛行與碰撞檢測
    game.bullets.forEach((bullet) => {
      bullet.y += bullet.vy;

      // 雷射擊中磚塊檢測
      for (let i = 0; i < game.bricks.length; i++) {
        const brick = game.bricks[i];
        if (brick.isDestroyed) continue;

        if (
          bullet.x + bullet.width >= brick.x &&
          bullet.x <= brick.x + brick.width &&
          bullet.y <= brick.y + brick.height &&
          bullet.y + bullet.height >= brick.y
        ) {
          bullet.y = -999; // 標記銷毀

          if (brick.type !== 'METAL') {
            brick.hp -= 1;
            if (brick.hp <= 0) {
              brick.isDestroyed = true;
              game.score += brick.scoreValue;
              setScore(game.score);
              sound.playBreakBrick();
              
              const chipColor = BRICK_COLORS[brick.type][0];
              createParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, chipColor, 10);
              shakeScreen(4, 100);

              // 釋放道具
              if (brick.powerUp) {
                game.powerUps.push({
                  id: `powerup-laser-${Date.now()}`,
                  x: brick.x + brick.width / 2,
                  y: brick.y + brick.height,
                  vy: 2.5,
                  type: brick.powerUp,
                  radius: 12,
                  color: POWERUP_DETAILS[brick.powerUp]?.color || '#ffffff',
                });
                sound.playPowerUpDrop();
              }
            } else {
              sound.playBreakStrong();
              createParticles(bullet.x, brick.y + brick.height, '#a855f7', 4);
            }
          } else {
            // 撞擊鐵塊，雷射無效
            sound.playMetalHit();
            createParticles(bullet.x, brick.y + brick.height, '#94a3b8', 3);
          }
          break;
        }
      }
    });
    game.bullets = game.bullets.filter((bullet) => bullet.y > 0);

    // 5. 更新粒子生命
    game.particles.forEach((part) => {
      part.x += part.vx;
      part.y += part.vy;
      if (part.gravity) part.vy += part.gravity;
      part.alpha -= part.decay;
    });
    game.particles = game.particles.filter((part) => part.alpha > 0);

    // 6. 勝利判定 (通關 / 全部消除)
    // 判定非鐵塊 (METAL) 的磚塊是否都被摧毀
    const remainingDestructible = game.bricks.filter((b) => !b.isDestroyed && b.type !== 'METAL');
    if (remainingDestructible.length === 0 && game.bricks.length > 0) {
      if (game.levelIdx + 1 >= LEVELS.length) {
        game.status = 'GAME_COMPLETED';
        setGameStatus('GAME_COMPLETED');
        sound.playLevelUp();

        // 刷新最高分
        const currentHighScore = parseInt(localStorage.getItem('brick_breaker_highscore') || '0', 10);
        if (game.score > currentHighScore) {
          localStorage.setItem('brick_breaker_highscore', game.score.toString());
          setHighScore(game.score);
        }
      } else {
        game.status = 'LEVEL_COMPLETED';
        setGameStatus('LEVEL_COMPLETED');
        sound.playLevelUp();
      }
    }
  };

  // ----------------------------------------------------------------
  // 2. 渲染核心 — 使用雙緩衝/漸層、陰影發光打造華麗賽博朋克畫面
  // ----------------------------------------------------------------
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const game = stateRef.current;

    // 清空與震屏偏移
    ctx.save();
    if (game.shakeTime > 0) {
      const shakeX = (Math.random() - 0.5) * game.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * game.shakeIntensity;
      ctx.translate(shakeX, shakeY);
    }

    // A. 繪製太空深邃格狀背景
    ctx.fillStyle = '#020617'; // slate-950
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 網格效果 (Grid Background)
    ctx.strokeStyle = '#0f172a'; // slate-900
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < CANVAS_WIDTH; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // 繪製背景裝飾：一些太空微塵星光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(150, 100, 2, 2);
    ctx.fillRect(350, 240, 3, 3);
    ctx.fillRect(680, 140, 2, 2);
    ctx.fillRect(520, 380, 2, 2);
    ctx.fillRect(110, 480, 3, 3);

    // B. 繪製安全力場底網
    if (game.safetyFloorActive) {
      const pulse = Math.abs(Math.sin(Date.now() / 150));
      const floorGrad = ctx.createLinearGradient(0, CANVAS_HEIGHT - 10, 0, CANVAS_HEIGHT);
      floorGrad.addColorStop(0, `rgba(139, 92, 246, ${0.4 + pulse * 0.4})`);
      floorGrad.addColorStop(1, 'rgba(139, 92, 246, 0.05)');

      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, CANVAS_HEIGHT - 12, CANVAS_WIDTH, 12);

      // 安全網亮邊
      ctx.strokeStyle = `rgba(167, 139, 250, ${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT - 12);
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 12);
      ctx.stroke();
    }

    // C. 繪製磚塊 (Bricks) 附帶霓虹圓角與龜裂效果
    game.bricks.forEach((brick) => {
      if (brick.isDestroyed) return;

      const grad = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.height);
      const colorSet = BRICK_COLORS[brick.type];
      
      if (brick.type === 'STRONG' && brick.hp === 1) {
        // 堅硬磚塊受損：變更淡色
        grad.addColorStop(0, '#e5e7eb');
        grad.addColorStop(1, '#94a3b8');
      } else {
        grad.addColorStop(0, colorSet[0]);
        grad.addColorStop(1, colorSet[1]);
      }

      ctx.fillStyle = grad;

      // 繪製圓角矩型磚塊
      const radius = 4;
      ctx.beginPath();
      ctx.moveTo(brick.x + radius, brick.y);
      ctx.lineTo(brick.x + brick.width - radius, brick.y);
      ctx.quadraticCurveTo(brick.x + brick.width, brick.y, brick.x + brick.width, brick.y + radius);
      ctx.lineTo(brick.x + brick.width, brick.y + brick.height - radius);
      ctx.quadraticCurveTo(brick.x + brick.width, brick.y + brick.height, brick.x + brick.width - radius, brick.y + brick.height);
      ctx.lineTo(brick.x + radius, brick.y + brick.height - radius);
      ctx.quadraticCurveTo(brick.x, brick.y + brick.height, brick.x, brick.y + brick.height);
      ctx.lineTo(brick.x, brick.y + radius);
      ctx.quadraticCurveTo(brick.x, brick.y, brick.x + radius, brick.y);
      ctx.closePath();
      ctx.fill();

      // 精美內邊框，增加立體炫光
      ctx.strokeStyle = brick.type === 'METAL' ? '#334155' : 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 堅硬磚龜裂紋路 (當 HP 剩 1)
      if (brick.type === 'STRONG' && brick.hp === 1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // 畫斜線龜裂
        ctx.moveTo(brick.x + 10, brick.y + 2);
        ctx.lineTo(brick.x + brick.width / 2, brick.y + brick.height - 4);
        ctx.lineTo(brick.x + brick.width - 15, brick.y + 4);
        ctx.stroke();
      }

      // 金黃道具磚中央閃耀星星
      if (brick.type === 'GOLDEN') {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 耀眼閃光點
        const isBlink = Math.floor(Date.now() / 200) % 2 === 0;
        ctx.fillText(isBlink ? '✦' : '★', brick.x + brick.width / 2, brick.y + brick.height / 2 + 1);
      }
    });

    // D. 繪製平台 (Paddle) - 光滑飛梭造型
    const paddleGrad = ctx.createLinearGradient(game.paddle.x, game.paddle.y, game.paddle.x, game.paddle.y + game.paddle.height);
    if (game.paddle.isLaserActive) {
      paddleGrad.addColorStop(0, '#f472b6'); // 亮霓粉
      paddleGrad.addColorStop(1, '#db2777');
    } else {
      paddleGrad.addColorStop(0, '#38bdf8'); // 賽博藍
      paddleGrad.addColorStop(1, '#0369a1');
    }

    ctx.fillStyle = paddleGrad;

    // 平台高科技圓角
    const pRadius = 8;
    ctx.beginPath();
    ctx.moveTo(game.paddle.x + pRadius, game.paddle.y);
    ctx.lineTo(game.paddle.x + game.paddle.width - pRadius, game.paddle.y);
    ctx.quadraticCurveTo(game.paddle.x + game.paddle.width, game.paddle.y, game.paddle.x + game.paddle.width, game.paddle.y + pRadius);
    ctx.lineTo(game.paddle.x + game.paddle.width - pRadius / 2, game.paddle.y + game.paddle.height);
    ctx.lineTo(game.paddle.x + pRadius / 2, game.paddle.y + game.paddle.height);
    ctx.quadraticCurveTo(game.paddle.x, game.paddle.y + game.paddle.height, game.paddle.x, game.paddle.y + game.paddle.height - pRadius / 2);
    ctx.lineTo(game.paddle.x, game.paddle.y + pRadius);
    ctx.quadraticCurveTo(game.paddle.x, game.paddle.y, game.paddle.x + pRadius, game.paddle.y);
    ctx.closePath();
    ctx.fill();

    // 平台描邊 (極簡美感)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 畫高科技格紋細節或砲台 (Laser cannons)
    if (game.paddle.isLaserActive) {
      // 繪製左右兩端雷射砲管
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(game.paddle.x + 5, game.paddle.y - 6, 8, 8);
      ctx.fillRect(game.paddle.x + game.paddle.width - 13, game.paddle.y - 6, 8, 8);
      // 金屬邊緣
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(game.paddle.x + 5, game.paddle.y - 6, 8, 8);
      ctx.strokeRect(game.paddle.x + game.paddle.width - 13, game.paddle.y - 6, 8, 8);
    } else {
      // 畫平台內置藍色核心裝飾
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(game.paddle.x + game.paddle.width / 2 - 15, game.paddle.y + 4, 30, 4);
    }

    // E. 繪製落下的道具 (Power-Ups)
    game.powerUps.forEach((pu) => {
      // 道具發光外框
      ctx.shadowBlur = 10;
      ctx.shadowColor = pu.color;

      // 繪製六邊形或發光圓球
      ctx.fillStyle = pu.color;
      ctx.beginPath();
      ctx.arc(pu.x, pu.y, pu.radius, 0, Math.PI * 2);
      ctx.fill();

      // 白色中心圓圈
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pu.x, pu.y, pu.radius - 4, 0, Math.PI * 2);
      ctx.fill();

      // 清除陰影，避免之後的繪圖都發光受阻
      ctx.shadowBlur = 0;

      // 繪製道具標示文字
      const details = POWERUP_DETAILS[pu.type];
      if (details) {
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(details.icon, pu.x, pu.y);
      }
    });

    // F. 繪製雷射子彈
    ctx.fillStyle = '#ff2e93';
    game.bullets.forEach((bullet) => {
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ff2e93';
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
      ctx.shadowBlur = 0;
    });

    // G. 繪製球體 (Balls) 霓虹或火球殘影
    game.balls.forEach((ball) => {
      ctx.save();
      
      // 火球強力球發光尾巴
      if (ball.isSuper) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#f97316';
        
        // 繪製小火尾
        const trailGrad = ctx.createRadialGradient(ball.x, ball.y, 1, ball.x - ball.vx * 2, ball.y - ball.vy * 2, ball.radius * 2);
        trailGrad.addColorStop(0, 'rgba(249, 115, 22, 0.8)');
        trailGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = trailGrad;
        ctx.beginPath();
        ctx.arc(ball.x - ball.vx, ball.y - ball.vy, ball.radius * 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      }

      // 繪製球本體
      const bGrad = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, ball.radius);
      if (ball.isSuper) {
        bGrad.addColorStop(0, '#ffedd5');
        bGrad.addColorStop(0.3, '#f97316');
        bGrad.addColorStop(1, '#ea580c');
      } else {
        bGrad.addColorStop(0, '#ffffff');
        bGrad.addColorStop(1, '#e2e8f0');
      }

      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // 普通黑線，增加立體層次
      ctx.strokeStyle = ball.isSuper ? '#ea580c' : '#475569';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    });

    // H. 繪製粒子特效 (Particles)
    game.particles.forEach((part) => {
      ctx.save();
      ctx.globalAlpha = part.alpha;
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // I. 提示：吸附時提示空白鍵射擊
    if (game.status === 'PLAYING') {
      const hasAttached = game.balls.some(b => b.isAttachedToPaddle);
      if (hasAttached) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(controlType === 'MOUSE' ? '點擊滑鼠左鍵 或 按空白鍵 射擊起點球！' : '按空白鍵 射擊起點球！', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 95);
        _drawPulseArrow(ctx, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 120);
      }
    }

    ctx.restore(); // 結束震屏 translate 效果
  };

  // 繪製發射按鍵動態箭頭
  const _drawPulseArrow = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const pulse = Math.sin(Date.now() / 120) * 5;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + pulse);
    ctx.lineTo(x, y - 8 + pulse);
    ctx.lineTo(x + 8, y + pulse);
    ctx.stroke();
  };

  return (
    <div className="w-full flex flex-col items-center select-none" id="brick_breaker_game">
      {/* 1. 頂部狀態顯示面板 */}
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 mb-4 shadow-xl flex flex-wrap gap-4 items-center justify-between" id="game_hud_panel">
        <div className="flex items-center gap-6" id="score_lives_box">
          <div className="flex flex-col">
            <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">目前得分</span>
            <span className="text-3xl font-extrabold text-white tracking-tight drop-shadow-md">{score}</span>
          </div>
          <div className="h-10 w-px bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">最高紀錄</span>
            <span className="text-2xl font-bold text-amber-400 flex items-center gap-1">
              <Award className="w-5 h-5" />
              {highScore}
            </span>
          </div>
        </div>

        {/* 當前生命值 & 關卡 */}
        <div className="flex items-center gap-6" id="level_lives_box">
          <div className="flex flex-col">
            <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">第幾關</span>
            <span className="text-lg font-bold text-sky-400">{LEVELS[currentLevelIdx].name}</span>
          </div>
          <div className="h-10 w-px bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-1">生命次數</span>
            <div className="flex gap-1.5" id="heart_lives_container">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Heart
                  key={idx}
                  id={`heart-${idx}`}
                  className={`w-6 h-6 transition-all duration-300 ${
                    idx < lives ? 'text-red-500 fill-red-500 scale-100 drop-shadow' : 'text-slate-700 fill-slate-800 scale-90'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 控制按鈕與設置 */}
        <div className="flex items-center gap-2" id="controls_toolbar">
          <button
            onClick={() => handleControlChange(controlType === 'MOUSE' ? 'KEYBOARD' : 'MOUSE')}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-2 transition"
            title="點擊切換操作模式"
          >
            {controlType === 'MOUSE' ? (
              <>
                <MousePointer className="w-3.5 h-3.5" />
                <span>滑鼠操控</span>
              </>
            ) : (
              <>
                <Keyboard className="w-3.5 h-3.5" />
                <span>鍵盤操控 (A/D)</span>
              </>
            )}
          </button>

          <button
            onClick={toggleMute}
            className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
            title="切換靜音"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* 2. 核心 HTML5 Canvas 畫布區域 */}
      <div className="relative w-full max-w-4xl flex justify-center aspect-[4/3]" id="canvas_wrapper_div">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full bg-slate-950 rounded-2xl border-2 border-slate-800 shadow-2xl block overflow-hidden"
          id="brick_breaker_canvas"
        />

        {/* OVERLAYS: 根據不同遊戲狀態疊加精美毛玻璃效果 UI */}

        {/* A. 主選單 (MENU) */}
        {gameStatus === 'MENU' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-8 text-center animate-fade-in z-20" id="menu_overlay">
            <div className="mb-6 p-4 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 animate-pulse">
              <Sparkles className="w-12 h-12" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 mb-2 tracking-tight">
              霓虹沙排打磚塊
            </h1>
            <p className="text-slate-400 text-sm max-w-md mb-8">
              經典 HTML5 Canvas 高幀率彈珠打磚塊。完美分離物理運算與畫面渲染，支援炫彩粒子爆炸效果、Web Audio 音效與豐富威力道具！
            </p>

            <button
              onClick={startGame}
              className="px-8 py-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-extrabold text-lg rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-3"
            >
              <Play className="w-5 h-5 fill-white" />
              開始經典挑戰
            </button>

            {/* 操作提示 */}
            <div className="mt-12 grid grid-cols-2 gap-6 text-left max-w-sm" id="control_tutorial_box">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-xs font-bold text-sky-400 block mb-1">🖱️ 滑鼠操作 (預設)</span>
                <span className="text-xs text-slate-400">滑動控制平台左右。點擊左鍵發射球與砲彈。</span>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-xs font-bold text-indigo-400 block mb-1">⌨️ 按鍵與空白鍵</span>
                <span className="text-xs text-slate-400">A/D 或 左右方向鍵 控制移動。空白鍵發射、開砲。</span>
              </div>
            </div>
          </div>
        )}

        {/* B. 遊戲暫停 (PAUSED) */}
        {gameStatus === 'PAUSED' && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-10" id="paused_overlay">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm text-center shadow-2xl" id="paused_panel">
              <h2 className="text-2xl font-bold text-white mb-6">遊戲已暫停</h2>
              <div className="flex flex-col gap-3">
                <button
                  onClick={togglePause}
                  className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" />
                  繼續遊戲
                </button>
                <button
                  onClick={handleReset}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  重新開始本關
                </button>
                <button
                  onClick={backToMenu}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm font-semibold rounded-xl transition"
                >
                  回到主選單
                </button>
              </div>
            </div>
          </div>
        )}

        {/* C. 關卡完成 (LEVEL_COMPLETED) */}
        {gameStatus === 'LEVEL_COMPLETED' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center z-10" id="lvl_completed_overlay">
            <div className="max-w-md text-center p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl" id="lvl_completed_panel">
              <span className="text-xs uppercase inline-block font-extrabold tracking-widest px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full mb-4">
                LEVEL CLEAR!
              </span>
              <h2 className="text-3xl font-black text-white mb-2">成功突破本關卡！</h2>
              <p className="text-slate-400 text-sm mb-6">下一關已解鎖，難度將進一步提升。準備好了嗎？</p>

              <button
                onClick={nextLevel}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 mx-auto"
              >
                <span>進入下一關</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* D. 遊戲通關 (GAME_COMPLETED) */}
        {gameStatus === 'GAME_COMPLETED' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center z-10" id="game_completed_overlay">
            <div className="max-w-md text-center p-8 bg-slate-900 border-2 border-amber-500/30 rounded-3xl shadow-2xl" id="game_completed_panel">
              <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <Award className="w-8 h-8" />
              </div>
              <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-500 mb-2">
                成就解鎖：宇宙大滿貫！
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                太驚人了！你已完美擊破所有的關卡防線，你是當之無愧的打磚塊至尊！
              </p>
              <div className="bg-slate-950/50 rounded-xl p-4 mb-8 border border-slate-800">
                <span className="text-xs text-slate-400 uppercase block mb-1">你的最終榮譽得分</span>
                <span className="text-3xl font-extrabold text-amber-400">{score}</span>
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition"
                >
                  再次挑戰
                </button>
                <button
                  onClick={backToMenu}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
                >
                  回到主頁
                </button>
              </div>
            </div>
          </div>
        )}

        {/* E. 遊戲結束 (GAMEOVER) */}
        {gameStatus === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center z-10" id="gameover_overlay">
            <div className="max-w-md text-center p-8 bg-slate-900 border border-red-500/10 rounded-3xl shadow-2xl" id="gameover_panel">
              <span className="text-xs uppercase inline-block font-extrabold tracking-widest px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full mb-4">
                GAME OVER
              </span>
              <h2 className="text-3xl font-black text-white mb-2">生命值歸零</h2>
              <p className="text-slate-400 text-sm mb-6">
                不要氣餒，球在掉落時可以使用防護力場道具🛡️來形成安全底層！再試一次？
              </p>

              <div className="bg-slate-950/40 rounded-xl p-4 mb-8 border border-slate-800">
                <span className="text-xs text-slate-400 uppercase block mb-1">本次得分</span>
                <span className="text-2xl font-bold text-white">{score}</span>
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-red-500 hover:bg-red-400 text-white font-extrabold rounded-xl transition"
                >
                  立刻重新挑戰
                </button>
                <button
                  onClick={backToMenu}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
                >
                  回到選單
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. 底部資訊：狀態、道具效果列表、下方控制按鈕 */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4 mt-4" id="game_footer_grid">
        {/* A. 當前啟用道具清單 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between" id="active_powers_panel">
          <span className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3 block">啟用的威力道具</span>
          
          {activePowerUps.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-4 text-slate-500 text-xs" id="no_active_powers">
              <Zap className="w-5 h-5 mb-1 opacity-40 text-slate-500" />
              擊破包含道具的金色磚塊！
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-32 pr-1" id="active_powers_list">
              {activePowerUps.map((pu) => {
                const details = POWERUP_DETAILS[pu.type];
                return (
                  <div key={pu.type} id={`active-power-${pu.type}`} className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{details?.icon}</span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">{details?.label}</span>
                        <span className="text-[10px] text-slate-400 leading-none">{details?.desc}</span>
                      </div>
                    </div>
                    {/* 進度剩餘秒數條 */}
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                      {(pu.timeLeft / 1000).toFixed(1)}s
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* B. 關卡資訊與下一關控制 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between" id="level_info_panel">
          <div className="flex flex-col" id="level_info_header">
            <span className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">目前關卡任務</span>
            <span className="text-sm font-bold text-sky-400">{LEVELS[currentLevelIdx].name}</span>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {LEVELS[currentLevelIdx].description}
            </p>
          </div>

          <div className="flex gap-2 mt-4" id="level_actions">
            {gameStatus === 'PLAYING' && (
              <button
                onClick={togglePause}
                className="flex-1 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center gap-1 transition"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>暫停</span>
              </button>
            )}
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-semibold bg-red-950/20 border border-red-900/40 hover:bg-red-950/40 text-red-400 rounded-lg flex items-center justify-center gap-1 transition"
              title="重新挑戰本關卡"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重設</span>
            </button>
          </div>
        </div>

        {/* C. 道具圖鑑簡介 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between" id="powerups_guide_panel">
          <span className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2 block">量子特工道具指南</span>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-400" id="guide_items">
            <div className="flex items-center gap-1">
              <span>{POWERUP_DETAILS.ENLARGE_PADDLE.icon}</span>
              <span>{POWERUP_DETAILS.ENLARGE_PADDLE.label}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{POWERUP_DETAILS.MULTI_BALL.icon}</span>
              <span>{POWERUP_DETAILS.MULTI_BALL.label}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{POWERUP_DETAILS.SUPER_BALL.icon}</span>
              <span>{POWERUP_DETAILS.SUPER_BALL.label}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{POWERUP_DETAILS.LASER_PADDLE.icon}</span>
              <span>{POWERUP_DETAILS.LASER_PADDLE.label}</span>
            </div>
            <div className="flex items-center gap-1 col-span-2">
              <span>{POWERUP_DETAILS.SAFETY_FLOOR.icon}</span>
              <span>{POWERUP_DETAILS.SAFETY_FLOOR.label} (底部安全立體牆)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
