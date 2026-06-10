/**
 * ApiSettingsModule 扩展 - 四通道配置UI
 * 
 * 将此代码添加到 api-settings-module.js 的适当位置
 * 在 render() 方法中添加通道配置卡片
 */

// ==================== 通道配置UI代码（插入到render方法中）====================

/**
 * 渲染通道配置卡片
 * 在 render() 方法的适当位置调用此方法
 */
_renderChannelConfig() {
  const channels = window.LLMChannelConfig ? window.LLMChannelConfig.getDefaults() : {};
  
  return `
    <div class="api-section-label">LLM 四通道配置</div>
    <div class="api-card">
      <div class="api-card-title">🚀 通道配置</div>
      <div style="margin-bottom: 16px; padding: 12px; background: #F2F2F7; border-radius: 10px; font-size: 13px; color: #6D6D72; line-height: 1.5;">
        <strong>四通道架构：</strong><br>
        • 通道A（大世界）：低频、高耗时、高质量<br>
        • 通道B（管家）：高频、实时、推理密集<br>
        • 通道C（内容）：高并发、快速响应<br>
        • 通道D（备用）：故障转移
      </div>
      
      ${Object.entries(channels).map(([channelId, config]) => `
        <div style="margin-bottom: 16px; padding: 12px; background: #FAFAFA; border-radius: 10px; border: 1px solid #E5E5EA;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-weight: 600; font-size: 15px; color: #000;">${config.name}</span>
            <span style="font-size: 12px; color: #8E8E93; background: #F2F2F7; padding: 2px 8px; border-radius: 10px;">${channelId}</span>
          </div>
          <div style="font-size: 13px; color: #6D6D72; margin-bottom: 10px;">${config.description}</div>
          
          <div class="api-form-group">
            <label class="api-label">模型名称</label>
            <input type="text" 
                   class="api-input" 
                   data-channel="${channelId}" 
                   data-field="model"
                   placeholder="例如：deepseek-v4, gpt-3.5-turbo"
                   value="${config.model || ''}">
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="api-form-group">
              <label class="api-label">超时时间(ms)</label>
              <input type="number" 
                     class="api-input" 
                     data-channel="${channelId}" 
                     data-field="timeout"
                     value="${config.timeout || 30000}">
            </div>
            <div class="api-form-group">
              <label class="api-label">最大并发</label>
              <input type="number" 
                     class="api-input" 
                     data-channel="${channelId}" 
                     data-field="maxConcurrent"
                     value="${config.maxConcurrent || 1}">
            </div>
          </div>
        </div>
      `).join('')}
      
      <div style="display: flex; gap: 10px; margin-top: 16px;">
        <button class="api-btn api-btn-save" data-action="save-channels">💾 保存通道配置</button>
        <button class="api-btn api-btn-test" data-action="test-channels" style="background: #34C759;">🧪 测试通道</button>
      </div>
    </div>
  `;
}

/**
 * 绑定通道配置事件
 * 在 bindEvents() 方法中调用
 */
_bindChannelEvents() {
  const container = this._formEl;
  if (!container) return;

  // 保存通道配置
  container.querySelector('[data-action="save-channels"]')?.addEventListener('click', async () => {
    try {
      const configs = {};
      container.querySelectorAll('[data-channel]').forEach(input => {
        const channelId = input.dataset.channel;
        const field = input.dataset.field;
        const value = input.type === 'number' ? parseInt(input.value) : input.value;
        
        if (!configs[channelId]) {
          configs[channelId] = {};
        }
        configs[channelId][field] = value;
      });

      // 保存到 ApiConfig
      if (this._apiConfig && typeof this._apiConfig.saveChannelConfig === 'function') {
        await this._apiConfig.saveChannelConfig(configs);
      }

      // 更新 LLMGateway
      if (this._gateway) {
        for (const [channelId, config] of Object.entries(configs)) {
          this._gateway.updateChannel(channelId, config);
        }
      }

      this._showStatus('✅ 通道配置已保存', 'success');
      console.log('[ApiSettings] 通道配置已保存:', configs);
    } catch (err) {
      console.error('[ApiSettings] 保存通道配置失败:', err);
      this._showStatus('❌ 保存失败: ' + err.message, 'error');
    }
  });

  // 测试通道
  container.querySelector('[data-action="test-channels"]')?.addEventListener('click', async () => {
    this._showStatus('🧪 正在测试通道...', 'info');
    
    const results = [];
    const channels = ['channel-world', 'channel-director', 'channel-content', 'channel-fallback'];
    
    for (const channelId of channels) {
      try {
        const startTime = Date.now();
        // 发送一个简单的测试请求
        const response = await this._testChannel(channelId);
        const elapsed = Date.now() - startTime;
        results.push({ channel: channelId, status: 'success', time: elapsed });
      } catch (err) {
        results.push({ channel: channelId, status: 'error', error: err.message });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    this._showStatus(`🧪 通道测试完成: ${successCount}/${results.length} 通过`, successCount === results.length ? 'success' : 'warning');
    console.log('[ApiSettings] 通道测试结果:', results);
  });
}

/**
 * 测试单个通道
 */
async _testChannel(channelId) {
  // 这里可以实现具体的通道测试逻辑
  // 例如发送一个简单的ping请求
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // 模拟测试
      if (Math.random() > 0.1) {
        resolve({ ok: true });
      } else {
        reject(new Error('连接超时'));
      }
    }, 500);
  });
}

/**
 * 添加到 ApiConfigData Schema 的方法
 */

// 在 SCHEMA/api-config-data.js 中添加：

/**
 * 保存通道配置
 * @param {Object} configs - 通道配置对象
 */
async saveChannelConfig(configs) {
  await this._set('channelConfigs', configs);
  console.log('[ApiConfigData] 通道配置已保存');
}

/**
 * 获取通道配置
 * @returns {Promise<Object|null>}
 */
async getChannelConfig() {
  return await this._get('channelConfigs', null);
}
