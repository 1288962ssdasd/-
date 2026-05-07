;(function () {
    'use strict';

    /**
     * module-manifest.js - 模块声明清单
     * 定义 42 个模块的名称、脚本文件、依赖关系。
     * 由 phone-core.js 自动加载执行。
     */

    const BASE = './scripts/extensions/third-party/mobile/';

    /**
     * 检查 __PHONE_CORE__ 是否已初始化
     */
    if (!window.__PHONE_CORE__) {
        console.error('[ModuleManifest] window.__PHONE_CORE__ is not available. Aborting module registration.');
        return;
    }

    const { loader } = window.__PHONE_CORE__;

    /**
     * 42 个模块声明
     *
     * 分层结构:
     *   Layer 0: 无依赖的基础模块
     *   Layer 1: 依赖 Layer 0
     *   Layer 2: 依赖 Layer 0-1
     *   Layer 3: 依赖 Layer 0-2
     *   Layer 4: 依赖 Layer 0-3
     *   Layer 5: 依赖 Layer 0-4
     *   Layer 6: 依赖 Layer 0-5
     */
    const modules = [
        // ============================================================
        // Layer 0: 基础模块 (无依赖)
        // ============================================================
        {
            name: 'phoneDataStore',
            file: 'phoneDataStore.js',
            deps: [],
            globalVar: 'phoneDataStore'
        },
        {
            name: 'bridgeClient',
            file: 'bridgeClient.js',
            deps: [],
            globalVar: 'bridgeClient'
        },
        {
            name: 'forumStyles',
            file: 'forumStyles.js',
            deps: [],
            globalVar: null
        },
        {
            name: 'weiboStyles',
            file: 'weiboStyles.js',
            deps: [],
            globalVar: null
        },

        // ============================================================
        // Layer 1
        // ============================================================
        {
            name: 'friendRenderer',
            file: 'friendRenderer.js',
            deps: ['phoneDataStore'],
            globalVar: 'friendRenderer'
        },
        {
            name: 'phoneTTS',
            file: 'phoneTTS.js',
            deps: ['phoneDataStore'],
            globalVar: 'phoneTTS'
        },

        // ============================================================
        // Layer 2
        // ============================================================
        {
            name: 'messageRenderer',
            file: 'messageRenderer.js',
            deps: ['phoneDataStore', 'friendRenderer'],
            globalVar: 'messageRenderer'
        },
        {
            name: 'bridgeAPI',
            file: 'bridgeAPI.js',
            deps: ['bridgeClient', 'phoneDataStore'],
            globalVar: 'bridgeAPI'
        },

        // ============================================================
        // Layer 3
        // ============================================================
        {
            name: 'messageSender',
            file: 'messageSender.js',
            deps: ['bridgeAPI', 'messageRenderer'],
            globalVar: 'messageSender'
        },
        {
            name: 'xiaobaixBridge',
            file: 'xiaobaixBridge.js',
            deps: ['bridgeAPI'],
            globalVar: 'xiaobaixBridge'
        },
        {
            name: 'roleAPI',
            file: 'roleAPI.js',
            deps: ['bridgeAPI', 'phoneDataStore'],
            globalVar: 'roleAPI'
        },
        {
            name: 'socialAPI',
            file: 'socialAPI.js',
            deps: ['bridgeAPI', 'phoneDataStore'],
            globalVar: 'socialAPI'
        },
        {
            name: 'worldbookContact',
            file: 'worldbookContact.js',
            deps: ['bridgeAPI', 'phoneDataStore'],
            globalVar: 'worldbookContact'
        },
        {
            name: 'memoryBridge',
            file: 'memoryBridge.js',
            deps: ['bridgeAPI'],
            globalVar: 'memoryBridge'
        },
        {
            name: 'questEngine',
            file: 'questEngine.js',
            deps: ['bridgeAPI', 'phoneDataStore'],
            globalVar: 'questEngine'
        },
        {
            name: 'questPlannerBridge',
            file: 'questPlannerBridge.js',
            deps: ['bridgeAPI', 'questEngine'],
            globalVar: 'questPlannerBridge'
        },
        {
            name: 'pendingMsgPatch',
            file: 'pendingMsgPatch.js',
            deps: ['bridgeAPI', 'messageRenderer'],
            globalVar: 'pendingMsgPatch'
        },
        {
            name: 'quickReplyBridge',
            file: 'quickReplyBridge.js',
            deps: ['bridgeAPI', 'messageRenderer'],
            globalVar: 'quickReplyBridge'
        },

        // ============================================================
        // Layer 4: 论坛 & 微博
        // ============================================================
        {
            name: 'forumManager',
            file: 'forumManager.js',
            deps: ['bridgeAPI', 'phoneDataStore', 'forumStyles'],
            globalVar: 'forumManager'
        },
        {
            name: 'forumAutoListener',
            file: 'forumAutoListener.js',
            deps: ['forumManager', 'bridgeAPI'],
            globalVar: 'forumAutoListener'
        },
        {
            name: 'forumUI',
            file: 'forumUI.js',
            deps: ['forumManager', 'forumStyles', 'messageRenderer'],
            globalVar: 'forumUI'
        },
        {
            name: 'forumControlApp',
            file: 'forumControlApp.js',
            deps: ['forumManager', 'forumUI', 'forumAutoListener'],
            globalVar: 'forumControlApp'
        },
        {
            name: 'weiboManager',
            file: 'weiboManager.js',
            deps: ['bridgeAPI', 'phoneDataStore', 'weiboStyles'],
            globalVar: 'weiboManager'
        },
        {
            name: 'weiboAutoListener',
            file: 'weiboAutoListener.js',
            deps: ['weiboManager', 'bridgeAPI'],
            globalVar: 'weiboAutoListener'
        },
        {
            name: 'weiboUI',
            file: 'weiboUI.js',
            deps: ['weiboManager', 'weiboStyles', 'messageRenderer'],
            globalVar: 'weiboUI'
        },
        {
            name: 'weiboControlApp',
            file: 'weiboControlApp.js',
            deps: ['weiboManager', 'weiboUI', 'weiboAutoListener'],
            globalVar: 'weiboControlApp'
        },

        // ============================================================
        // Layer 5
        // ============================================================
        {
            name: 'messageApp',
            file: 'messageApp.js',
            deps: ['messageSender', 'messageRenderer', 'friendRenderer', 'phoneDataStore'],
            globalVar: 'messageApp'
        },
        {
            name: 'attachmentSender',
            file: 'attachmentSender.js',
            deps: ['bridgeAPI', 'messageSender'],
            globalVar: 'attachmentSender'
        },
        {
            name: 'friendsCircle',
            file: 'friendsCircle.js',
            deps: ['socialAPI', 'phoneDataStore', 'messageRenderer'],
            globalVar: 'friendsCircle'
        },
        {
            name: 'voiceMessageHandler',
            file: 'voiceMessageHandler.js',
            deps: ['phoneTTS', 'bridgeAPI', 'messageRenderer'],
            globalVar: 'voiceMessageHandler'
        },
        {
            name: 'questApp',
            file: 'questApp.js',
            deps: ['questEngine', 'questPlannerBridge', 'phoneDataStore'],
            globalVar: 'questApp'
        },

        // ============================================================
        // Layer 6: 应用层
        // ============================================================
        {
            name: 'diaryApp',
            file: 'diaryApp.js',
            deps: ['bridgeAPI', 'phoneDataStore', 'messageRenderer'],
            globalVar: 'diaryApp'
        },
        {
            name: 'taskApp',
            file: 'taskApp.js',
            deps: ['bridgeAPI', 'phoneDataStore', 'questEngine'],
            globalVar: 'taskApp'
        },
        {
            name: 'backpackApp',
            file: 'backpackApp.js',
            deps: ['bridgeAPI', 'phoneDataStore'],
            globalVar: 'backpackApp'
        },
        {
            name: 'shopApp',
            file: 'shopApp.js',
            deps: ['bridgeAPI', 'phoneDataStore'],
            globalVar: 'shopApp'
        },
        {
            name: 'statusApp',
            file: 'statusApp.js',
            deps: ['bridgeAPI', 'phoneDataStore', 'roleAPI'],
            globalVar: 'statusApp'
        },
        {
            name: 'profileApp',
            file: 'profileApp.js',
            deps: ['bridgeAPI', 'phoneDataStore', 'roleAPI', 'socialAPI'],
            globalVar: 'profileApp'
        },
        {
            name: 'liveApp',
            file: 'liveApp.js',
            deps: ['bridgeAPI', 'phoneDataStore'],
            globalVar: 'liveApp'
        },
        {
            name: 'watchLive',
            file: 'watchLive.js',
            deps: ['liveApp', 'bridgeAPI', 'phoneDataStore'],
            globalVar: 'watchLive'
        },
        {
            name: 'styleConfigManager',
            file: 'styleConfigManager.js',
            deps: ['phoneDataStore', 'forumStyles', 'weiboStyles'],
            globalVar: 'styleConfigManager'
        },
        {
            name: 'imageConfigModal',
            file: 'imageConfigModal.js',
            deps: ['phoneDataStore', 'bridgeAPI'],
            globalVar: 'imageConfigModal'
        }
    ];

    // 注册所有模块
    loader.registerAll(modules);

    console.info(`[ModuleManifest] Registered ${modules.length} modules.`);
})();
