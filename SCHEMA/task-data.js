/**
 * TaskData - 任务数据 Schema 辅助函数
 *
 * 启动阶段：阶段 3（Schema 注册）
 * 全局挂载：window.PhoneData.Task
 *
 * 铁则合规：
 *   - 所有数据读写通过 Schema 辅助函数（铁则一）
 *   - 不直接调用 Platform.setData() 或 localStorage
 */

;(function () {
  'use strict';

  const DOMAIN = 'task';

  // 任务状态常量
  const TASK_STATUS = {
    AVAILABLE: 'available',   // 可接取
    ACCEPTED: 'accepted',     // 已接取
    IN_PROGRESS: 'in_progress', // 进行中
    COMPLETED: 'completed',   // 已完成
    FAILED: 'failed',         // 已失败
    EXPIRED: 'expired',       // 已过期
  };

  /**
   * TaskData 任务数据操作类
   */
  class TaskData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 读取操作 ====================

    /**
     * 获取所有任务
     * @returns {Promise<Array>}
     */
    async getTasks() {
      return await this._get('tasks', []);
    }

    /**
     * 获取单个任务
     * @param {string} taskId
     * @returns {Promise<Object|null>}
     */
    async getById(taskId) {
      const tasks = await this.getTasks();
      return tasks.find(t => t.id === taskId) || null;
    }

    /**
     * 按状态获取任务
     * @param {string} status
     * @returns {Promise<Array>}
     */
    async getTasksByStatus(status) {
      const tasks = await this.getTasks();
      return tasks.filter(t => t.status === status);
    }

    /**
     * 获取进行中的任务
     * @returns {Promise<Array>}
     */
    async getActiveTasks() {
      const tasks = await this.getTasks();
      return tasks.filter(t => t.status === TASK_STATUS.ACCEPTED || t.status === TASK_STATUS.IN_PROGRESS);
    }

    /**
     * 获取家族信息
     * @returns {Promise<Object>}
     */
    async getFamilyInfo() {
      return await this._get('familyInfo', {
        name: '',
        currentTime: '',
        members: [],
      });
    }

    // ==================== 写入操作 ====================

    /**
     * 设置所有任务
     * @param {Array} tasks
     * @returns {Promise<boolean>}
     */
    async setTasks(tasks) {
      await this._set('tasks', tasks);
      this._emit('task:updated', { tasks });
      return true;
    }

    /**
     * 添加任务
     * @param {Object} task
     * @returns {Promise<Object>}
     */
    async addTask(task) {
      const tasks = await this.getTasks();

      const newTask = {
        id: task.id || this._generateId(),
        name: task.name || '未命名任务',
        description: task.description || '',
        status: task.status || TASK_STATUS.AVAILABLE,
        progress: task.progress || 0,
        maxProgress: task.maxProgress || 100,
        rewards: task.rewards || [],
        deadline: task.deadline || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      tasks.push(newTask);
      await this._set('tasks', tasks);

      this._emit('task:added', { task: newTask });
      return newTask;
    }

    /**
     * 更新任务
     * @param {string} taskId
     * @param {Object} updates
     * @returns {Promise<boolean>}
     */
    async updateTask(taskId, updates) {
      const tasks = await this.getTasks();
      const task = tasks.find(t => t.id === taskId);

      if (!task) return false;

      Object.assign(task, updates, { updatedAt: Date.now() });
      await this._set('tasks', tasks);

      this._emit('task:updated', { taskId, updates });
      return true;
    }

    /**
     * 接取任务
     * @param {string} taskId
     * @returns {Promise<boolean>}
     */
    async acceptTask(taskId) {
      return await this.updateTask(taskId, { status: TASK_STATUS.ACCEPTED });
    }

    /**
     * 更新任务进度
     * @param {string} taskId
     * @param {number} progress
     * @returns {Promise<boolean>}
     */
    async updateProgress(taskId, progress) {
      const tasks = await this.getTasks();
      const task = tasks.find(t => t.id === taskId);

      if (!task) return false;

      task.progress = Math.min(progress, task.maxProgress);
      task.updatedAt = Date.now();

      // 检查是否完成
      if (task.progress >= task.maxProgress) {
        task.status = TASK_STATUS.COMPLETED;
      }

      await this._set('tasks', tasks);
      this._emit('task:progressUpdated', { taskId, progress: task.progress });
      return true;
    }

    /**
     * 完成任务
     * @param {string} taskId
     * @returns {Promise<boolean>}
     */
    async completeTask(taskId) {
      return await this.updateTask(taskId, { 
        status: TASK_STATUS.COMPLETED,
        progress: 100,
        completedAt: Date.now(),
      });
    }

    /**
     * 删除任务
     * @param {string} taskId
     * @returns {Promise<boolean>}
     */
    async deleteTask(taskId) {
      const tasks = await this.getTasks();
      const index = tasks.findIndex(t => t.id === taskId);

      if (index === -1) return false;

      tasks.splice(index, 1);
      await this._set('tasks', tasks);

      this._emit('task:deleted', { taskId });
      return true;
    }

    /**
     * 设置家族信息
     * @param {Object} info
     * @returns {Promise<boolean>}
     */
    async setFamilyInfo(info) {
      await this._set('familyInfo', info);
      this._emit('task:familyUpdated', { familyInfo: info });
      return true;
    }

    // ==================== 订阅 ====================

    /**
     * 订阅任务变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeTasks(callback) {
      return this._subscribe('tasks', callback);
    }

    /**
     * 订阅家族信息变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeFamilyInfo(callback) {
      return this._subscribe('familyInfo', callback);
    }

    // ==================== 内部方法 ====================

        async _get(key, defaultValue) {
      // [修复] 等待 Platform 就绪
      if (!this._platform) {
        console.warn('[Schema] Platform 未初始化');
        return defaultValue;
      }
      
      // [修复] 如果 Platform 未就绪，等待其就绪
      if (!this._platform.isReady && this._platform.waitForReady) {
        try {
          await this._platform.waitForReady(5000);
        } catch (e) {
          console.warn('[Schema] Platform 就绪超时，使用默认值');
          return defaultValue;
        }
      }
      
      const result = await this._platform.data(DOMAIN, key, defaultValue);
      // 防御性编程：如果平台返回 undefined/null，使用默认值
      return result !== undefined && result !== null ? result : defaultValue;
    }

        async _set(key, value) {
      if (!this._platform) {
        console.warn('[Schema] Platform 未初始化，无法写入数据');
        return false;
      }
      
      // [铁则一] 通过 Platform.setData 写入，由 DataStore 管理防抖和持久化
      // 不手动调用 flush()，避免破坏 DataStore 的防抖队列导致数据丢失
      await this._platform.setData(DOMAIN, key, value, { persist: true });

      return true;
    }

    _subscribe(key, callback) {
      if (!this._platform?.subscribeData) return () => {};
      return this._platform.subscribeData(DOMAIN, key, callback);
    }

    _emit(event, data) {
      if (this._platform?.emit) {
        this._platform.emit(event, data);
      }
    }

    _generateId() {
      const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      return 'task_' + uuid.substr(0, 12);
    }
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.Task = TaskData;
  window.PhoneData.Task.STATUS = TASK_STATUS;

  console.log('[Schema] TaskData 已加载');
})();
