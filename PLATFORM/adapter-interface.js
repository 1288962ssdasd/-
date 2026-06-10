/**
 * Platform Adapter Interface
 * 平台适配器接口定义
 *
 * 所有平台适配器必须实现此接口。
 * 通过适配器模式，业务代码与底层平台解耦。
 */

;(function () {
  'use strict';

  /**
   * 平台适配器接口基类
   * 定义了平台必须提供的能力
   */
  class IPlatformAdapter {
    constructor() {
      if (new.target === IPlatformAdapter) {
        throw new Error('IPlatformAdapter 是抽象类，不能直接实例化');
      }
    }

    // ==================== 变量存储 API ====================

    /**
     * 读取变量值
     * @param {string} key - 变量键名
     * @returns {Promise<any>} 变量值
     */
    async read(key) {
      throw new Error('Not implemented: read()');
    }

    /**
     * 写入变量值
     * @param {string} key - 变量键名
     * @param {any} value - 变量值
     * @returns {Promise<boolean>} 是否成功
     */
    async write(key, value) {
      throw new Error('Not implemented: write()');
    }

    /**
     * 删除变量
     * @param {string} key - 变量键名
     * @returns {Promise<boolean>} 是否成功
     */
    async delete(key) {
      throw new Error('Not implemented: delete()');
    }

    /**
     * 列出指定前缀的所有变量
     * @param {string} prefix - 键名前缀
     * @returns {Promise<Array<{key: string, value: any}>>}
     */
    async list(prefix) {
      throw new Error('Not implemented: list()');
    }

    /**
     * 批量读取变量
     * @param {string[]} keys - 变量键名数组
     * @returns {Promise<Object>} 键值对对象
     */
    async batchRead(keys) {
      const result = {};
      for (const key of keys) {
        result[key] = await this.read(key);
      }
      return result;
    }

    /**
     * 批量写入变量
     * @param {Object} data - 键值对对象
     * @returns {Promise<boolean>} 是否成功
     */
    async batchWrite(data) {
      for (const [key, value] of Object.entries(data)) {
        await this.write(key, value);
      }
      return true;
    }

    // ==================== 事件订阅 API ====================

    /**
     * 订阅变量变更事件
     * @param {Function} callback - 回调函数 (key, value, oldValue) => void
     * @returns {Function} 取消订阅函数
     */
    onVariableChange(callback) {
      throw new Error('Not implemented: onVariableChange()');
    }

    /**
     * 订阅特定变量的变更
     * @param {string} key - 变量键名
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    onVariable(key, callback) {
      throw new Error('Not implemented: onVariable()');
    }

    // ==================== 平台特定 API ====================

    /**
     * 获取当前聊天上下文
     * @returns {Object|null} 聊天上下文
     */
    getChatContext() {
      throw new Error('Not implemented: getChatContext()');
    }

    /**
     * 获取当前角色信息
     * @returns {Object|null} 角色信息
     */
    getCurrentCharacter() {
      throw new Error('Not implemented: getCurrentCharacter()');
    }

    /**
     * 发送消息到当前聊天
     * @param {string} content - 消息内容
     * @param {Object} options - 选项
     * @returns {Promise<boolean>} 是否成功
     */
    async sendMessage(content, options = {}) {
      throw new Error('Not implemented: sendMessage()');
    }

    /**
     * 获取世界书条目
     * @param {string} entryName - 条目名称
     * @returns {Promise<any>} 条目内容
     */
    async getWorldInfoEntry(entryName) {
      throw new Error('Not implemented: getWorldInfoEntry()');
    }

    /**
     * 设置世界书条目
     * @param {string} entryName - 条目名称
     * @param {any} content - 条目内容
     * @returns {Promise<boolean>} 是否成功
     */
    async setWorldInfoEntry(entryName, content) {
      throw new Error('Not implemented: setWorldInfoEntry()');
    }

    // ==================== 平台信息 API ====================

    /**
     * 获取平台名称
     * @returns {string}
     */
    getPlatformName() {
      throw new Error('Not implemented: getPlatformName()');
    }

    /**
     * 获取平台版本
     * @returns {string}
     */
    getPlatformVersion() {
      throw new Error('Not implemented: getPlatformVersion()');
    }

    /**
     * 检查平台是否就绪
     * @returns {boolean}
     */
    isReady() {
      throw new Error('Not implemented: isReady()');
    }

    /**
     * 等待平台就绪
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise<void>}
     */
    async waitForReady(timeout = 30000) {
      throw new Error('Not implemented: waitForReady()');
    }
  }

  // 暴露到全局
  window.IPlatformAdapter = IPlatformAdapter;

  console.log('[Platform] Adapter Interface 已加载');
})();
