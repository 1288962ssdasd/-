/**
 * 嵌套壁纸系统 - 三层视差效果
 * 
 * 基于现有 wallpaper.png 扩展为三层视差系统
 * 支持鼠标移动/陀螺仪倾斜响应
 * 
 * 铁则合规：
 * - 纯视觉层，不影响数据流
 * - 不操作业务数据
 * 
 * @version 1.0.0
 * @since 3.8.0
 */

(function() {
  'use strict';

  class ParallaxWallpaper {
    constructor(config = {}) {
      this.config = {
        // 使用现有 wallpaper.png 作为近景层
        near: config.near || '/mobile/ASSETS/wallpaper.png',
        // 中景层 - 如果没有则使用近景层+模糊效果
        mid: config.mid || null,
        // 远景层 - 如果没有则使用纯色渐变
        far: config.far || null,
        // 视差强度
        intensity: config.intensity || 20,
        // 是否启用陀螺仪
        gyroscope: config.gyroscope !== false,
        // 时间感知
        timeAware: config.timeAware !== false
      };

      this.layers = [];
      this.container = null;
      this.isActive = false;
      
      this._init();
    }

    _init() {
      // 创建容器
      this.container = document.createElement('div');
      this.container.className = 'parallax-wallpaper';
      this.container.style.cssText = `
        position: fixed;
        inset: -40px;
        z-index: -1;
        overflow: hidden;
        pointer-events: none;
      `;

      // 创建三层
      this._createLayer('far', 0.2, this.config.far);
      this._createLayer('mid', 0.5, this.config.mid);
      this._createLayer('near', 1.0, this.config.near);

      document.body.insertBefore(this.container, document.body.firstChild);

      // 绑定事件
      this._bindEvents();

      // 时间感知
      if (this.config.timeAware) {
        this._applyTimeOfDay();
      }

      this.isActive = true;
    }

    _createLayer(name, speed, imageUrl) {
      const layer = document.createElement('div');
      layer.className = `wallpaper-layer layer-${name}`;
      
      let backgroundStyle;
      if (imageUrl) {
        backgroundStyle = `url('${imageUrl}') center/cover no-repeat`;
      } else {
        // 如果没有图片，使用渐变或模糊效果
        if (name === 'far') {
          backgroundStyle = 'linear-gradient(180deg, #87CEEB 0%, #E0F6FF 50%, #F0F8FF 100%)';
        } else if (name === 'mid') {
          // 中景层使用近景层的模糊版本
          backgroundStyle = `url('${this.config.near}') center/cover no-repeat`;
          layer.style.filter = 'blur(8px) brightness(0.8)';
        }
      }

      layer.style.cssText = `
        position: absolute;
        inset: -20px;
        background: ${backgroundStyle};
        transition: transform 0.1s ease-out, filter 0.5s ease;
        will-change: transform;
      `;

      this.container.appendChild(layer);
      this.layers.push({ element: layer, speed, name });
    }

    _bindEvents() {
      // 鼠标移动视差
      let rafId = null;
      let targetX = 0;
      let targetY = 0;
      let currentX = 0;
      let currentY = 0;

      const updatePosition = () => {
        if (!this.isActive) return;

        // 平滑插值
        currentX += (targetX - currentX) * 0.1;
        currentY += (targetY - currentY) * 0.1;

        this.layers.forEach(layer => {
          const x = currentX * layer.speed * this.config.intensity;
          const y = currentY * layer.speed * this.config.intensity;
          layer.element.style.transform = `translate(${x}px, ${y}px)`;
        });

        rafId = requestAnimationFrame(updatePosition);
      };

      document.addEventListener('mousemove', (e) => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        targetX = (e.clientX - centerX) / centerX;
        targetY = (e.clientY - centerY) / centerY;

        if (!rafId) {
          rafId = requestAnimationFrame(updatePosition);
        }
      });

      // 陀螺仪支持（移动端）
      if (this.config.gyroscope && window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', (e) => {
          const tiltX = (e.gamma || 0) / 45; // -1 to 1
          const tiltY = (e.beta || 0) / 45;

          targetX = tiltX;
          targetY = tiltY;

          if (!rafId) {
            rafId = requestAnimationFrame(updatePosition);
          }
        });
      }

      // 启动动画循环
      rafId = requestAnimationFrame(updatePosition);

      // 清理
      this._cleanup = () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      };
    }

    _applyTimeOfDay() {
      const hour = new Date().getHours();
      const nearLayer = this.layers.find(l => l.name === 'near');
      if (!nearLayer) return;

      let filter = '';
      
      if (hour >= 6 && hour < 12) {
        // 早晨 - 暖色调
        filter = 'sepia(20%) brightness(110%) saturate(110%)';
      } else if (hour >= 12 && hour < 18) {
        // 白天 - 原色
        filter = 'none';
      } else if (hour >= 18 && hour < 21) {
        // 黄昏 - 暖橙色
        filter = 'sepia(40%) hue-rotate(-30deg) brightness(90%)';
      } else {
        // 夜晚 - 暗蓝色
        filter = 'brightness(60%) saturate(80%) hue-rotate(10deg)';
      }

      nearLayer.element.style.filter = filter;
    }

    /**
     * 设置壁纸
     * @param {string} layer - 'near' | 'mid' | 'far'
     * @param {string} imageUrl - 图片URL
     */
    setWallpaper(layer, imageUrl) {
      const layerObj = this.layers.find(l => l.name === layer);
      if (layerObj) {
        layerObj.element.style.backgroundImage = `url('${imageUrl}')`;
      }
    }

    /**
     * 设置视差强度
     * @param {number} intensity - 0-50
     */
    setIntensity(intensity) {
      this.config.intensity = Math.max(0, Math.min(50, intensity));
    }

    /**
     * 暂停视差效果
     */
    pause() {
      this.isActive = false;
      if (this._cleanup) {
        this._cleanup();
      }
    }

    /**
     * 恢复视差效果
     */
    resume() {
      this.isActive = true;
      this._bindEvents();
    }

    /**
     * 销毁
     */
    destroy() {
      this.pause();
      if (this.container) {
        this.container.remove();
        this.container = null;
      }
      this.layers = [];
    }
  }

  // 导出
  window.ParallaxWallpaper = ParallaxWallpaper;

})();
