/**
 * service-registry.js - Service 注册中心
 * 
 * [铁则合规]
 * - 铁则四: 服务注册在 SERVICES_READY 阶段执行
 * - 铁则七: 所有服务通过 Platform.get() 获取
 * - 铁则二十: Service 无状态，通过 Platform 容器管理
 * 
 * [职责]
 * 集中管理所有 Service 的注册，供 index.js 调用
 * 
 * @version 1.0.0
 */

;(function () {
  'use strict';

  /**
   * 注册所有 Service 到 Platform
   * @param {Platform} platform - Platform 实例
   * @returns {number} 注册成功的服务数量
   */
  function registerAllServices(platform) {
    if (!platform) {
      console.error('[ServiceRegistry] Platform 不可用，无法注册服务');
      return 0;
    }

    var servicesToRegister = [];

    if (window.PhoneServices) {
      // AI 服务（供 LLMGateway 使用）
      if (window.PhoneServices.AI) {
        servicesToRegister.push({
          key: 'AI',
          factory: function() { return new window.PhoneServices.AI(platform); }
        });
      }
      // 社交通讯领域
      if (window.PhoneServices.Message) {
        servicesToRegister.push({
          key: 'messageService',
          factory: function() { return new window.PhoneServices.Message(platform); }
        });
      }
      if (window.PhoneServices.Friend) {
        servicesToRegister.push({
          key: 'friendService',
          factory: function() { return new window.PhoneServices.Friend(platform); }
        });
      }
      if (window.PhoneServices.FriendsCircle) {
        servicesToRegister.push({
          key: 'friendsCircleService',
          factory: function() { return new window.PhoneServices.FriendsCircle(platform); }
        });
      }
      if (window.PhoneServices.Social) {
        servicesToRegister.push({
          key: 'socialService',
          factory: function() { return new window.PhoneServices.Social(platform); }
        });
      }
      if (window.PhoneServices.SocialAggregator) {
        servicesToRegister.push({
          key: 'socialAggregatorService',
          factory: function() { return new window.PhoneServices.SocialAggregator(platform); }
        });
      }
      if (window.PhoneServices.NPCSocial) {
        servicesToRegister.push({
          key: 'npcSocialService',
          factory: function() { return new window.PhoneServices.NPCSocial(platform); }
        });
      }
      if (window.PhoneServices.ContextManager) {
        servicesToRegister.push({
          key: 'contextManagerService',
          factory: function() { return new window.PhoneServices.ContextManager(platform); }
        });
      }
      // 内容媒体领域
      if (window.PhoneServices.Weibo) {
        servicesToRegister.push({
          key: 'weiboService',
          factory: function() { return new window.PhoneServices.Weibo(platform); }
        });
      }
      if (window.PhoneServices.Forum) {
        servicesToRegister.push({
          key: 'forumService',
          factory: function() { return new window.PhoneServices.Forum(platform); }
        });
      }
      if (window.PhoneServices.ForumStyles) {
        servicesToRegister.push({
          key: 'forumStylesService',
          factory: function() { return new window.PhoneServices.ForumStyles(platform); }
        });
      }
      if (window.PhoneServices.Live) {
        servicesToRegister.push({
          key: 'liveService',
          factory: function() { return new window.PhoneServices.Live(platform); }
        });
      }
      if (window.PhoneServices.MediaLocal) {
        servicesToRegister.push({
          key: 'mediaLocalService',
          factory: function() { return new window.PhoneServices.MediaLocal(platform); }
        });
      }
      // 任务邀约领域
      if (window.PhoneServices.Quest) {
        servicesToRegister.push({
          key: 'questService',
          factory: function() { return new window.PhoneServices.Quest(platform); }
        });
      }
      if (window.PhoneServices.Task) {
        servicesToRegister.push({
          key: 'taskService',
          factory: function() { return new window.PhoneServices.Task(platform); }
        });
      }
      if (window.PhoneServices.Invitation) {
        servicesToRegister.push({
          key: 'invitationService',
          factory: function() { return new window.PhoneServices.Invitation(platform); }
        });
      }
      if (window.PhoneServices.NPCGenerator) {
        servicesToRegister.push({
          key: 'npcGeneratorService',
          factory: function() { return new window.PhoneServices.NPCGenerator(platform); }
        });
      }
      // 经济交易领域
      if (window.PhoneServices.Economy) {
        servicesToRegister.push({
          key: 'economyService',
          factory: function() { return new window.PhoneServices.Economy(platform); }
        });
      }
      if (window.PhoneServices.Shop) {
        servicesToRegister.push({
          key: 'shopService',
          factory: function() { return new window.PhoneServices.Shop(platform); }
        });
      }
      if (window.PhoneServices.Inventory) {
        servicesToRegister.push({
          key: 'inventoryService',
          factory: function() { return new window.PhoneServices.Inventory(platform); }
        });
      }
      if (window.PhoneServices.Bank) {
        servicesToRegister.push({
          key: 'bankService',
          factory: function() { return new window.PhoneServices.Bank(platform); }
        });
      }
      if (window.PhoneServices.Stock) {
        servicesToRegister.push({
          key: 'stockService',
          factory: function() { return new window.PhoneServices.Stock(platform); }
        });
      }
      // 个人状态领域
      if (window.PhoneServices.Profile) {
        servicesToRegister.push({
          key: 'profileService',
          factory: function() { return new window.PhoneServices.Profile(platform); }
        });
      }
      if (window.PhoneServices.Status) {
        servicesToRegister.push({
          key: 'statusService',
          factory: function() { return new window.PhoneServices.Status(platform); }
        });
      }
      if (window.PhoneServices.Diary) {
        servicesToRegister.push({
          key: 'diaryService',
          factory: function() { return new window.PhoneServices.Diary(platform); }
        });
      }
      if (window.PhoneServices.Map) {
        servicesToRegister.push({
          key: 'mapService',
          factory: function() { return new window.PhoneServices.Map(platform); }
        });
      }
      // 世界剧情领域
      if (window.PhoneServices.World) {
        servicesToRegister.push({
          key: 'worldService',
          factory: function() { return new window.PhoneServices.World(platform); }
        });
      }
      if (window.PhoneServices.WorldSync) {
        servicesToRegister.push({
          key: 'worldSyncService',
          factory: function() { return new window.PhoneServices.WorldSync(platform); }
        });
      }
      if (window.PhoneServices.WorldBookSync) {
        servicesToRegister.push({
          key: 'worldbookSyncService',
          factory: function() { return new window.PhoneServices.WorldBookSync(platform); }
        });
      }
      // [v4.31-fix] 只注册 V2 导演服务
      if (window.PhoneServices.DirectorV2) {
        servicesToRegister.push({
          key: 'directorV2Service',
          factory: function() { return new window.PhoneServices.DirectorV2(platform); }
        });
      }
      if (window.PhoneServices.Prediction) {
        servicesToRegister.push({
          key: 'predictionService',
          factory: function() { return new window.PhoneServices.Prediction(platform); }
        });
      }
      if (window.PhoneServices.Memory) {
        servicesToRegister.push({
          key: 'memoryService',
          factory: function() { return new window.PhoneServices.Memory(platform); }
        });
      }
      // 头像管理领域
      if (window.PhoneServices.Avatar) {
        servicesToRegister.push({
          key: 'avatarService',
          factory: function() { return new window.PhoneServices.Avatar(platform); }
        });
      }
      // 系统配置领域
      if (window.PhoneServices.DataCleanup) {
        servicesToRegister.push({
          key: 'dataCleanupService',
          factory: function() { return new window.PhoneServices.DataCleanup(platform); }
        });
      }
    }

    // 注册所有服务
    var registeredCount = 0;
    servicesToRegister.forEach(function (svc) {
      try {
        var instance = svc.factory();
        platform.register(svc.key, instance);
        console.log('[ServiceRegistry] ✅ 已注册服务:', svc.key);
        registeredCount++;

        // 保存关键服务到全局以便调试
        if (svc.key === 'worldService') window.__worldService = instance;
        if (svc.key === 'directorV2Service') window.__directorService = instance;
      } catch (e) {
        console.error('[ServiceRegistry] ❌ 注册服务失败:', svc.key, e);
      }
    });

    console.info('[ServiceRegistry] ✅ 已注册 ' + registeredCount + ' 个服务到 Platform');
    return registeredCount;
  }

  // 全局暴露
  window.ServiceRegistry = {
    registerAll: registerAllServices
  };

})();
