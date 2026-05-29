/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 聲音效能管理：使用 Web Audio API 原生合成音，不佔用頻寬，能極速播放
class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // 延遲初始化，避免瀏覽器在使用者點擊前拋出 Auto-play 錯誤
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private playTone(freqs: number[], duration: number, type: OscillatorType = 'sine', decay: boolean = true) {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (freqs.length === 1) {
        osc.frequency.setValueAtTime(freqs[0], now);
      } else if (freqs.length > 1) {
        // 音頻滑移或琶音
        const step = duration / (freqs.length - 1);
        freqs.forEach((freq, idx) => {
          osc.frequency.setValueAtTime(freq, now + idx * step);
        });
      }

      // 音量控制 (避免爆音，並實作漸弱 Decay)
      gain.gain.setValueAtTime(0.15, now);
      if (decay) {
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      } else {
        gain.gain.setValueAtTime(0.15, now + duration - 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      }

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn('Web Audio Play error:', e);
    }
  }

  public playBouncePaddle() {
    // 擋板反彈：低音向上微彈 180Hz -> 200Hz
    this.playTone([180, 220], 0.1, 'sine');
  }

  public playBounceWall() {
    // 牆壁反彈：中低音
    this.playTone([160, 160], 0.08, 'sine');
  }

  public playBreakBrick() {
    // 普通磚塊破裂：中高音向下快速滑動，帶三角波或鋸齒波的碎裂感
    this.playTone([350, 150], 0.12, 'triangle');
  }

  public playBreakStrong() {
    // 堅固磚塊：雙聲波，兩次短促聲
    this.playTone([240, 280], 0.08, 'sawtooth');
  }

  public playMetalHit() {
    // 金屬不可破壞：高頻刺耳金屬敲擊
    this.playTone([800, 600], 0.08, 'triangle');
  }

  public playPowerUpDrop() {
    // 道具掉落
    this.playTone([300, 400], 0.15, 'sine');
  }

  public playPowerUpCollect() {
    // 吃到道具：開心的琶音上升「叮鈴鈴」
    this.playTone([330, 440, 550, 660, 880], 0.25, 'sine');
  }

  public playLaserFire() {
    // 發射雷射：「嗞——」
    this.playTone([900, 200], 0.12, 'sawtooth');
  }

  public playLoseLife() {
    // 失去生命：悲傷的降音
    this.playTone([400, 300, 180], 0.4, 'triangle');
  }

  public playGameOver() {
    // 遊戲結束
    this.playTone([300, 240, 180, 120], 0.8, 'sawtooth');
  }

  public playLevelUp() {
    // 關卡成功：勝利的華麗和弦
    this.playTone([261.6, 329.6, 392.0, 523.3, 659.3, 784.0, 1046.5], 0.6, 'sine', false);
  }

  public playClick() {
    // 滑鼠點選 UI 聲音
    this.playTone([400, 500], 0.05, 'sine');
  }
}

export const sound = new SoundManager();
