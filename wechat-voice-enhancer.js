/**
 * 微信语音增强器
 * 为语音消息提供播放控制和可视化
 */
(function() {
    'use strict';
    
    window.WechatVoiceEnhancer = {
        init() {
            console.log('[WechatVoiceEnhancer] 初始化');
            this.setupVoicePlayers();
        },
        
        setupVoicePlayers() {
            // 语音播放器设置
            document.querySelectorAll('.voice-message').forEach(el => {
                el.addEventListener('click', this.playVoice.bind(this));
            });
        },
        
        playVoice(e) {
            const voiceEl = e.currentTarget;
            const audioUrl = voiceEl.dataset.url;
            if (audioUrl) {
                const audio = new Audio(audioUrl);
                audio.play();
            }
        }
    };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => WechatVoiceEnhancer.init());
    } else {
        WechatVoiceEnhancer.init();
    }
})();
