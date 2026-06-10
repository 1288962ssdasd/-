/**
 * 触觉反馈 + 声效系统
 * 
 * 提供统一的操作反馈接口，所有模块通过此系统触发反馈
 * 铁则合规：纯UI交互层，不影响数据流
 * 
 * @version 1.0.0
 * @since 3.8.0
 */

(function() {
  'use strict';

  // ==================== 声效引擎 ====================
  class SoundEngine {
    constructor() {
      this._ctx = null;
      this._enabled = true;
      this._volume = 0.3;
    }

    _getContext() {
      if (!this._ctx) {
        try {
          this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
          this._enabled = false;
        }
      }
      // 恢复被暂停的上下文（浏览器策略）
      if (this._ctx?.state === 'suspended') {
        this._ctx.resume();
      }
      return this._ctx;
    }

    _playTone(freq, duration, type = 'sine', volume = null) {
      if (!this._enabled) return;
      const ctx = this._getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const vol = (volume !== null ? volume : this._volume);
      const now = ctx.currentTime;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.start(now);
      osc.stop(now + duration);
    }

    // 发送消息 - 短促"嗖"
    playSend() {
      const ctx = this._getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
      gain.gain.setValueAtTime(this._volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }

    // 收到消息 - 轻柔"叮"
    playReceive() {
      this._playTone(1200, 0.15, 'sine', this._volume * 0.5);
    }

    // 红包/金币 - 金属碰撞
    playCoin() {
      [1200, 1600, 2000].forEach((freq, i) => {
        setTimeout(() => this._playTone(freq, 0.08, 'sine', this._volume * 0.6), i * 30);
      });
    }

    // 操作成功
    playSuccess() {
      this._playTone(880, 0.12, 'sine', this._volume * 0.4);
      setTimeout(() => this._playTone(1100, 0.15, 'sine', this._volume * 0.4), 80);
    }

    // 操作错误
    playError() {
      this._playTone(300, 0.1, 'square', this._volume * 0.3);
      setTimeout(() => this._playTone(250, 0.1, 'square', this._volume * 0.3), 120);
      setTimeout(() => this._playTone(200, 0.15, 'square', this._volume * 0.3), 240);
    }

    // 切换Tab
    playTab() {
      this._playTone(600, 0.05, 'sine', this._volume * 0.2);
    }

    // 领取/完成
    playClaim() {
      this._playTone(523, 0.1, 'sine', this._volume * 0.5);
      setTimeout(() => this._playTone(659, 0.1, 'sine', this._volume * 0.5), 100);
      setTimeout(() => this._playTone(784, 0.2, 'sine', this._volume * 0.5), 200);
    }

    setEnabled(enabled) { this._enabled = enabled; }
    setVolume(vol) { this._volume = Math.max(0, Math.min(1, vol)); }
  }

  // ==================== 触觉引擎 ====================
  class HapticEngine {
    constructor() {
      this._enabled = true;
      this._supported = 'vibrate' in navigator;
    }

    _vibrate(pattern) {
      if (!this._enabled || !this._supported) return;
      try {
        navigator.vibrate(pattern);
      } catch (e) { /* 静默失败 */ }
    }

    // 轻触
    light() { this._vibrate(10); }

    // 中等
    medium() { this._vibrate(25); }

    // 重
    heavy() { this._vibrate(50); }

    // 成功
    success() { this._vibrate([30, 50, 30]); }

    // 错误
    error() { this._vibrate([30, 30, 30, 30, 60]); }

    // 红包
    redpack() { this._vibrate([20, 40, 20, 40, 80]); }

    setEnabled(enabled) { this._enabled = enabled; }
  }

  // ==================== 统一反馈接口 ====================
  const Feedback = {
    sound: new SoundEngine(),
    haptic: new HapticEngine(),

    // 预设反馈组合
    send()      { this.haptic.light(); this.sound.playSend(); },
    receive()   { this.haptic.light(); this.sound.playReceive(); },
    redpack()   { this.haptic.redpack(); this.sound.playCoin(); },
    transfer()  { this.haptic.redpack(); this.sound.playCoin(); },
    success()   { this.haptic.success(); this.sound.playSuccess(); },
    error()     { this.haptic.error(); this.sound.playError(); },
    tab()       { this.haptic.light(); this.sound.playTab(); },
    claim()     { this.haptic.medium(); this.sound.playClaim(); },
    delete()    { this.haptic.medium(); },
    longPress() { this.haptic.medium(); },
  };

  window.Feedback = Feedback;

})();
