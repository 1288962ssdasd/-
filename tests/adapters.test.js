import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('适配器加载验证', () => {
  it('应确认所有适配器文件存在', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const adaptersDir = path.join(__dirname, '../adapters');

    const expectedAdapters = [
      'style-config-manager-adapter.js',
      'forum-styles-adapter.js',
      'weibo-styles-adapter.js',
      'drag-helper-adapter.js',
      'diagnostic-tool-adapter.js',
      'performance-tester-adapter.js',
      'image-config-modal-adapter.js',
      'mesid-floor-monitor-adapter.js',
      'pending-msg-patch-adapter.js',
      'character-data-isolation-adapter.js',
      'wechat-voice-enhancer-adapter.js',
      'performance-monitor-adapter.js',
      'phone-data-store-adapter.js',
      'bridge-api-adapter.js',
      'bridge-client-adapter.js',
      'context-monitor-adapter.js',
      'xiaobaix-bridge-adapter.js',
      'role-api-adapter.js',
      'social-api-adapter.js',
      'memory-bridge-adapter.js',
      'worldbook-contact-adapter.js',
      'quick-reply-bridge-adapter.js',
      'friend-renderer-adapter.js',
      'message-renderer-adapter.js',
      'message-sender-adapter.js',
      'message-app-adapter.js',
      'attachment-sender-adapter.js',
      'friends-circle-adapter.js',
      'voice-message-handler-adapter.js',
      'phone-tts-adapter.js',
      'incremental-renderer-adapter.js',
      'quest-engine-adapter.js',
      'quest-planner-bridge-adapter.js',
      'quest-app-adapter.js',
      'forum-manager-adapter.js',
      'forum-auto-listener-adapter.js',
      'forum-ui-adapter.js',
      'forum-control-app-adapter.js',
      'weibo-manager-adapter.js',
      'weibo-auto-listener-adapter.js',
      'weibo-ui-adapter.js',
      'weibo-control-app-adapter.js',
      'event-bridge-adapter.js',
      'adapter-loader.js',
    ];

    for (const adapter of expectedAdapters) {
      const filePath = path.join(adaptersDir, adapter);
      const exists = fs.existsSync(filePath);
      expect(exists, `适配器文件 ${adapter} 应存在`).toBe(true);
    }
  });

  it('应确认适配器数量符合预期', () => {
    const fs = require('fs');
    const path = require('path');
    const adaptersDir = path.join(__dirname, '../adapters');
    const files = fs.readdirSync(adaptersDir).filter(f => f.endsWith('-adapter.js') || f === 'adapter-loader.js');
    // 42 个适配器 + 1 个加载器
    expect(files.length).toBeGreaterThanOrEqual(40);
  });
});

describe('适配器模板验证', () => {
  it('每个适配器应包含 __PHONE_CORE__ 检查', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const adaptersDir = path.join(__dirname, '../adapters');
    const files = fs.readdirSync(adaptersDir).filter(f => f.endsWith('-adapter.js'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(adaptersDir, file), 'utf-8');
      expect(content, `${file} 应包含 __PHONE_CORE__ 检查`).toContain('__PHONE_CORE__');
    }
  });

  it('A 类适配器应包含 delete window', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const adaptersDir = path.join(__dirname, '../adapters');

    const aClassAdapters = [
      'style-config-manager-adapter.js',
      'forum-styles-adapter.js',
      'weibo-styles-adapter.js',
      'drag-helper-adapter.js',
      'diagnostic-tool-adapter.js',
      'performance-tester-adapter.js',
      'image-config-modal-adapter.js',
      'mesid-floor-monitor-adapter.js',
      'pending-msg-patch-adapter.js',
      'character-data-isolation-adapter.js',
      'wechat-voice-enhancer-adapter.js',
      'performance-monitor-adapter.js',
    ];

    for (const file of aClassAdapters) {
      const content = fs.readFileSync(path.join(adaptersDir, file), 'utf-8');
      expect(content, `${file} (A 类) 应包含 delete window`).toContain('delete window');
    }
  });

  it('B 类适配器应标记 __managed', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const adaptersDir = path.join(__dirname, '../adapters');

    const bClassAdapters = [
      'phone-data-store-adapter.js',
      'bridge-api-adapter.js',
      'bridge-client-adapter.js',
      'context-monitor-adapter.js',
      'message-app-adapter.js',
      'forum-manager-adapter.js',
    ];

    for (const file of bClassAdapters) {
      const content = fs.readFileSync(path.join(adaptersDir, file), 'utf-8');
      expect(content, `${file} (B 类) 应标记 __managed`).toContain('__managed');
    }
  });
});
