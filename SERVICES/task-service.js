/**
 * TaskService - 任务业务逻辑
 * 纯数据操作，无 DOM，无渲染
 *
 * 启动阶段：阶段 4（Service 初始化）
 * 全局挂载：window.PhoneServices.Task
 */

;(function () {
  'use strict';

  class TaskService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._taskData = new (window.PhoneData?.Task || function(){})(this._platform);
      this._aiService = new (window.PhoneServices?.AI || function(){})(this._platform);
    }

    async getTasks() {
      try { return await this._taskData.getTasks(); }
      catch (e) { console.warn('[TaskService] getTasks 失败:', e); return []; }
    }

    async getTask(taskId) {
      try { return await this._taskData.getById(taskId); }
      catch (e) { console.warn('[TaskService] getTask 失败:', e); return null; }
    }

    async getActiveTasks() {
      try { return await this._taskData.getActiveTasks(); }
      catch (e) { console.warn('[TaskService] getActiveTasks 失败:', e); return []; }
    }

    async getTasksByStatus(status) {
      try { return await this._taskData.getTasksByStatus(status); }
      catch (e) { console.warn('[TaskService] getTasksByStatus 失败:', e); return []; }
    }

    async getFamilyInfo() {
      try { return await this._taskData.getFamilyInfo(); }
      catch (e) { console.warn('[TaskService] getFamilyInfo 失败:', e); return null; }
    }

    async acceptTask(taskId) {
      try {
        const result = await this._taskData.acceptTask(taskId);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('task:accepted', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'task:accepted',
            data: { taskId, name: result?.name },
            timestamp: Date.now(),
            source: 'task-service'
          });
        }
        return result;
      }
      catch (e) { console.warn('[TaskService] acceptTask 失败:', e); return false; }
    }

    async updateProgress(taskId, progress) {
      try {
        const result = await this._taskData.updateProgress(taskId, progress);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('task:progressUpdated', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'task:progressUpdated',
            data: { taskId, progress },
            timestamp: Date.now(),
            source: 'task-service'
          });
        }
        return result;
      }
      catch (e) { console.warn('[TaskService] updateProgress 失败:', e); return false; }
    }

    async completeTask(taskId) {
      try {
        const result = await this._taskData.completeTask(taskId);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('task:completed', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'task:completed',
            data: { taskId, name: result?.name },
            timestamp: Date.now(),
            source: 'task-service'
          });
        }
        return result;
      }
      catch (e) { console.warn('[TaskService] completeTask 失败:', e); return false; }
    }

    async addTask(task) {
      try {
        const result = await this._taskData.addTask(task);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('task:added', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'task:added',
            data: { taskId: result?.id, name: result?.name || task?.name },
            timestamp: Date.now(),
            source: 'task-service'
          });
        }
        return result;
      }
      catch (e) { console.warn('[TaskService] addTask 失败:', e); return null; }
    }

    async deleteTask(taskId) {
      try {
        const result = await this._taskData.deleteTask(taskId);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('task:deleted', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'task:deleted',
            data: { taskId },
            timestamp: Date.now(),
            source: 'task-service'
          });
        }
        return result;
      }
      catch (e) { console.warn('[TaskService] deleteTask 失败:', e); return false; }
    }

    subscribeTasks(callback) {
      return this._taskData.subscribeTasks(callback);
    }
  }

  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Task = TaskService;

  console.log('[Service] TaskService 已加载');
})();
