/**
 * localStorage-migrator.js - localStorage 数据迁移工具
 *
 * 职责：
 *   将旧版直接存储在 localStorage 中的数据迁移到 Platform 数据层
 *   在 Schema 注册完成后、业务模块加载前自动执行一次
 *
 * 铁则合规：
 *   - 铁则九：全程 try/catch，失败不阻断
 *   - 数据读写通过 platform.data / platform.setData
 *   - 迁移完成后删除旧 localStorage key
 *
 * @see 施工计划书 §2.7.2 localStorage 迁移映射表
 */

;(function () {
  'use strict';

  // 确保 PhoneData 命名空间存在
  if (!window.PhoneData) {
    window.PhoneData = {};
  }

  /**
   * 从 localStorage 迁移数据到 Platform 数据层
   *
   * @param {Object} migrationMap - 迁移映射表
   *   格式：{ 'localStorage_key': { domain: 'xxx', key: 'yyy' } }
   * @returns {{ migrated: number, skipped: number, failed: number }} 迁移统计
   */
  window.PhoneData._migrateFromLocalStorage = function (migrationMap) {
    var stats = { migrated: 0, skipped: 0, failed: 0 };

    if (!migrationMap || typeof migrationMap !== 'object') {
      console.warn('[localStorage Migrator] 迁移映射表无效，跳过');
      return stats;
    }

    var platform = window.Platform;
    if (!platform || !platform.isReady) {
      console.warn('[localStorage Migrator] Platform 未就绪，跳过迁移');
      return stats;
    }

    var localStorageKeys = Object.keys(migrationMap);
    console.info('[localStorage Migrator] 开始迁移，共 ' + localStorageKeys.length + ' 个 key');

    for (var i = 0; i < localStorageKeys.length; i++) {
      var lsKey = localStorageKeys[i];
      var target = migrationMap[lsKey];

      if (!target || !target.domain || !target.key) {
        console.warn('[localStorage Migrator] 映射条目无效，跳过:', lsKey);
        stats.skipped++;
        continue;
      }

      try {
        // 1. 读取 localStorage，如果为 null 则跳过
        var rawValue = localStorage.getItem(lsKey);
        if (rawValue === null || rawValue === undefined) {
          stats.skipped++;
          continue;
        }

        // 2. 解析 JSON
        var parsed;
        try {
          parsed = JSON.parse(rawValue);
        } catch (parseErr) {
          // 如果不是有效 JSON，当作原始字符串处理
          parsed = rawValue;
        }

        // 3. 检查新位置是否已有数据，有则跳过并删除旧 key
        var existingData = platform.data(target.domain, target.key);
        if (existingData !== undefined && existingData !== null) {
          // 新位置已有数据，删除旧 key 即可
          localStorage.removeItem(lsKey);
          console.info('[localStorage Migrator] 新位置已有数据，清理旧 key:', lsKey);
          stats.skipped++;
          continue;
        }

        // 4. 迁移数据到新位置
        platform.setData(target.domain, target.key, parsed);
        console.info('[localStorage Migrator] 迁移成功:', lsKey, '->', target.domain + '/' + target.key);

        // 5. 删除旧 localStorage key
        localStorage.removeItem(lsKey);

        stats.migrated++;
      } catch (err) {
        // 铁则九：失败不阻断
        console.error('[localStorage Migrator] 迁移失败（非致命）:', lsKey, err);
        stats.failed++;
      }
    }

    console.info(
      '[localStorage Migrator] 迁移完成 - 成功: ' + stats.migrated +
      ', 跳过: ' + stats.skipped +
      ', 失败: ' + stats.failed
    );

    return stats;
  };

  // ========== 迁移映射表（施工计划书 §2.7.2） ==========

  var MIGRATION_MAP = {
    'mobile_forum_settings':       { domain: 'forum',    key: 'settings' },
    'mobile_forum_custom_styles':  { domain: 'forum',    key: 'customStyles' },
    'mobile_forum_custom_prefix':  { domain: 'forum',    key: 'customPrefix' },
    'mobile_weibo_settings':       { domain: 'weibo',    key: 'settings' },
    'mobile_weibo_account':        { domain: 'weibo',    key: 'account' },
    'mobile_weibo_custom_prefix':  { domain: 'weibo',    key: 'customPrefix' },
    'profile-app-cache':           { domain: 'profile',  key: 'cache' },
    'profile-app-config':          { domain: 'profile',  key: 'config' },
    'messageSenderSettings':       { domain: 'messages', key: 'senderSettings' },
    'stickerConfig_cache':         { domain: 'sticker',  key: 'config' },
  };

  // ========== Platform 就绪后自动执行迁移 ==========

  function tryAutoMigrate() {
    if (window.Platform && window.Platform.isReady) {
      try {
        window.PhoneData._migrateFromLocalStorage(MIGRATION_MAP);
      } catch (err) {
        console.error('[localStorage Migrator] 自动迁移异常（非致命）:', err);
      }
    } else {
      // Platform 尚未就绪，延迟重试（最多等待 5 秒）
      var retries = 0;
      var maxRetries = 50;
      var timer = setInterval(function () {
        retries++;
        if (window.Platform && window.Platform.isReady) {
          clearInterval(timer);
          try {
            window.PhoneData._migrateFromLocalStorage(MIGRATION_MAP);
          } catch (err) {
            console.error('[localStorage Migrator] 自动迁移异常（非致命）:', err);
          }
        } else if (retries >= maxRetries) {
          clearInterval(timer);
          console.warn('[localStorage Migrator] Platform 就绪超时，跳过自动迁移');
        }
      }, 100);
    }
  }

  // 立即尝试执行（如果 Platform 已就绪则同步完成）
  tryAutoMigrate();

  console.info('[localStorage Migrator] 迁移工具已加载，映射表已注册');

})();
