/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameStatus = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'LEVEL_COMPLETED' | 'GAME_COMPLETED';

export type BrickType = 'NORMAL' | 'STRONG' | 'METAL' | 'GOLDEN';

export interface Brick {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: BrickType;
  hp: number;
  maxHp: number;
  color: string;
  isDestroyed: boolean;
  powerUp: PowerUpType | null;
  scoreValue: number;
}

export type PowerUpType = 
  | 'ENLARGE_PADDLE' 
  | 'SHRINK_PADDLE' 
  | 'MULTI_BALL' 
  | 'SUPER_BALL' 
  | 'LASER_PADDLE' 
  | 'SAFETY_FLOOR'
  | 'EXTRA_LIFE';

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  vy: number;
  type: PowerUpType;
  radius: number;
  color: string;
}

export interface Ball {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isSuper: boolean; // 是否為穿透強力球
  color: string;
  isAttachedToPaddle: boolean; // 是否黏在平台等發射
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  isLaserActive: boolean;
  laserCooldown: number;
  laserDurationLeft: number; // 毫秒
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  gravity?: number;
}

export interface LaserBullet {
  id: string;
  x: number;
  y: number;
  vy: number;
  width: number;
  height: number;
  color: string;
}

export interface LevelConfig {
  name: string;
  description: string;
  layout: number[][]; // 0: 空, 1: 普通(1HP), 2: 堅固(2HP), 3: 鐵磚(不可破HP), 4: 金色帶道具磚
}
