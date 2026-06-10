/**
 * @layer CORE
 * @file   workflow-engine.js
 * @depends Platform, EventBus, AIService
 * @emits  workflow:completed, workflow:error, workflow:state_changed, workflow:cancelled
 *
 * 职责: 工作流引擎 - 状态机模式，支持多阶段任务和条件分支
 * 禁止: 操作DOM、持有业务状态、直接调用业务Schema
 */

;(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  //  WorkflowInstance - 单次工作流运行实例（状态机载体）
  // ---------------------------------------------------------------------------
  class WorkflowInstance {
    /**
     * @param {string}  instanceId   - 唯一实例 ID
     * @param {Object}  workflowDef  - 已规范化（含 states）的工作流定义
     * @param {Object}  event        - 触发事件载荷
     * @param {number}  maxRetries   - 最大重试次数
     */
    constructor(instanceId, workflowDef, event, maxRetries) {
      this.id = instanceId;
      this.workflowId = workflowDef.id;
      this.workflowName = workflowDef.name || '';
      this.currentState = workflowDef.initialState || 'initial';
      this.states = workflowDef.states || {};
      this.event = event;
      this.context = {
        event: event,
        results: {},
        variables: {},
        timestamp: Date.now()
      };
      this.status = 'running';       // running | completed | failed | cancelled
      this.retries = 0;
      this.maxRetries = maxRetries || 0;
      this.history = [];              // 状态变更历史
      this.createdAt = Date.now();
      this.updatedAt = Date.now();
      this._timeoutTimer = null;

      this._pushHistory(this.currentState, 'created');
    }

    /** 当前状态定义 */
    _stateDef() {
      return this.states[this.currentState] || {};
    }

    /** 是否处于终态 */
    _isTerminal() {
      return !!this._stateDef().terminal;
    }

    /** 推入历史记录 */
    _pushHistory(state, reason) {
      this.history.push({ state: state, reason: reason, timestamp: Date.now() });
      this.updatedAt = Date.now();
    }

    /** 获取下一个状态名 */
    _nextStateName() {
      return this._stateDef().next || null;
    }

    /** 获取失败状态名 */
    _errorStateName() {
      return this._stateDef().error || 'failed';
    }

    /** 获取当前状态超时时间 */
    _stateTimeout() {
      return this._stateDef().timeout || 0;
    }

    /** 获取当前状态的动作列表 */
    _stateActions() {
      return this._stateDef().actions || [];
    }

    /** 转移到指定状态 */
    transitionTo(stateName, reason) {
      if (!this.states[stateName]) {
        return false;
      }
      const prev = this.currentState;
      this.currentState = stateName;
      this._pushHistory(stateName, reason || 'transition');
      return prev;
    }

    /** 标记完成 */
    complete() {
      this.status = 'completed';
      this.updatedAt = Date.now();
    }

    /** 标记失败 */
    fail(error) {
      this.status = 'failed';
      this.context.lastError = error;
      this.updatedAt = Date.now();
    }

    /** 标记取消 */
    cancel() {
      this.status = 'cancelled';
      this.updatedAt = Date.now();
    }

    /** 重置到初始状态 */
    reset() {
      this.currentState = Object.keys(this.states)[0] || 'initial';
      this.status = 'running';
      this.retries = 0;
      this.context.results = {};
      this.context.variables = {};
      this.context.lastError = undefined;
      this._pushHistory(this.currentState, 'reset');
    }

    /** 递增重试计数并返回是否仍可重试 */
    canRetry() {
      this.retries++;
      return this.retries <= this.maxRetries;
    }

    /** 设置超时定时器 */
    setTimeout(ms, onTimeout) {
      this._clearTimeout();
      if (ms > 0) {
        this._timeoutTimer = setTimeout(function () { onTimeout(); }, ms);
      }
    }

    /** 清除超时定时器 */
    _clearTimeout() {
      if (this._timeoutTimer) {
        clearTimeout(this._timeoutTimer);
        this._timeoutTimer = null;
      }
    }

    /** 销毁实例，释放定时器 */
    destroy() {
      this._clearTimeout();
    }

    /** 序列化为可持久化对象 */
    toJSON() {
      return {
        id: this.id,
        workflowId: this.workflowId,
        workflowName: this.workflowName,
        currentState: this.currentState,
        status: this.status,
        retries: this.retries,
        maxRetries: this.maxRetries,
        history: this.history,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
      };
    }
  }

  // ---------------------------------------------------------------------------
  //  WorkflowEngine - 工作流引擎（状态机调度器）
  // ---------------------------------------------------------------------------
  class WorkflowEngine {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._workflows = {};            // { id: normalizedWorkflowDef }
      this._instances = {};            // { instanceId: WorkflowInstance }
      this._debounceTimers = {};       // { wfId: timerId }
      this._lastTriggerKeys = {};      // { 'wfId:eventKey': timestamp }
      this._instanceCounter = 0;

      console.log('[WorkflowEngine] 初始化完成 (v3.0 state-machine)');
    }

    // ========================================================================
    //  公共 API - 注册 / 移除 / 查询 / 触发
    // ========================================================================

    /**
     * 注册工作流（自动规范化旧版格式）
     * @param {Object} workflow - 工作流定义
     */
    register(workflow) {
      if (!workflow || !workflow.id) {
        console.warn('[WorkflowEngine] 无效的工作流定义');
        return;
      }
      if (this._workflows[workflow.id]) {
        console.warn('[WorkflowEngine] 工作流 ' + workflow.id + ' 已存在，将被覆盖');
      }

      var normalized = this._normalizeWorkflow(workflow);
      this._workflows[workflow.id] = normalized;
      this._bindTrigger(normalized);
      console.log('[WorkflowEngine] 工作流已注册: ' + workflow.id + ' (' + (workflow.name || '') + ')');
    }

    /**
     * 批量注册工作流
     * @param {Array} workflows - 工作流定义数组
     */
    registerAll(workflows) {
      if (!Array.isArray(workflows)) return;
      for (var i = 0; i < workflows.length; i++) {
        this.register(workflows[i]);
      }
    }

    /**
     * 移除工作流
     */
    remove(id) {
      if (this._workflows[id]) {
        delete this._workflows[id];
        console.log('[WorkflowEngine] 工作流已移除: ' + id);
      }
    }

    /**
     * 列出所有工作流
     */
    listWorkflows() {
      var ids = Object.keys(this._workflows);
      var result = [];
      for (var i = 0; i < ids.length; i++) {
        var wf = this._workflows[ids[i]];
        result.push({
          id: wf.id,
          name: wf.name,
          version: wf.version,
          priority: wf.priority,
          trigger: wf.trigger,
          states: Object.keys(wf.states || {})
        });
      }
      return result;
    }

    /**
     * 手动触发工作流
     * @param {string} workflowId
     * @param {Object} eventData
     */
    trigger(workflowId, eventData) {
      var wf = this._workflows[workflowId];
      if (!wf) {
        console.warn('[WorkflowEngine] 工作流不存在: ' + workflowId);
        return;
      }
      var event = eventData || { type: 'manual', source: 'manual', timestamp: Date.now() };
      this._executeWorkflow(wf, event);
    }

    // ========================================================================
    //  实例管理 API
    // ========================================================================

    /**
     * 获取所有活跃实例
     * @returns {Array} 实例摘要列表
     */
    getInstances() {
      var ids = Object.keys(this._instances);
      var result = [];
      for (var i = 0; i < ids.length; i++) {
        result.push(this._instances[ids[i]].toJSON());
      }
      return result;
    }

    /**
     * 获取单个实例
     * @param {string} instanceId
     * @returns {Object|null}
     */
    getInstance(instanceId) {
      var inst = this._instances[instanceId];
      return inst ? inst.toJSON() : null;
    }

    /**
     * 取消指定实例
     * @param {string} instanceId
     */
    cancelInstance(instanceId) {
      var inst = this._instances[instanceId];
      if (!inst) {
        console.warn('[WorkflowEngine] 实例不存在: ' + instanceId);
        return;
      }
      inst.cancel();
      inst.destroy();
      delete this._instances[instanceId];
      this._emitEvent('workflow:cancelled', {
        id: instanceId,
        workflowId: inst.workflowId,
        type: 'workflow:cancelled',
        data: { state: inst.currentState, reason: 'cancelled' },
        timestamp: Date.now(),
        source: 'WorkflowEngine'
      });
      console.log('[WorkflowEngine] 实例已取消: ' + instanceId);
    }

    // ========================================================================
    //  工作流规范化（向后兼容）
    // ========================================================================

    /**
     * 将旧版 actions 数组格式自动包装为 states 格式
     * @param {Object} workflow - 原始工作流定义
     * @returns {Object} 规范化后的工作流定义
     */
    _normalizeWorkflow(workflow) {
      var wf = this._clone(workflow);

      // 已经有 states 定义 → 直接使用
      if (wf.states && typeof wf.states === 'object' && Object.keys(wf.states).length > 0) {
        wf.initialState = wf.initialState || 'initial';
        return wf;
      }

      // 旧版格式：顶层 actions 数组 → 包装为单状态
      var actions = wf.actions || [];
      wf.states = {
        initial: {
          actions: actions,
          next: 'complete',
          error: 'failed'
        },
        complete: {
          actions: [],
          terminal: true
        },
        failed: {
          actions: [],
          terminal: true
        }
      };
      wf.initialState = 'initial';
      return wf;
    }

    // ========================================================================
    //  触发器绑定
    // ========================================================================

    /**
     * 绑定触发器到事件源
     */
    _bindTrigger(workflow) {
      var trigger = workflow.trigger;
      if (!trigger) return;
      var self = this;

      switch (trigger.type) {
        case 'variable_changed':
          if (this._platform && typeof this._platform.subscribeData === 'function') {
            this._platform.subscribeData('*', function (data) {
              if (self._matchTrigger(data, trigger)) {
                self._executeWorkflow(workflow, data);
              }
            });
          }
          if (window.Platform && window.Platform.eventBus) {
            window.Platform.eventBus.on('variable:changed', function (eventData) {
              if (self._matchTrigger(eventData, trigger)) {
                self._executeWorkflow(workflow, eventData);
              }
            });
          }
          break;

        case 'engine_event':
          if (window.Platform && window.Platform.eventBus) {
            window.Platform.eventBus.on(trigger.pattern, function (eventData) {
              self._executeWorkflow(workflow, {
                type: trigger.pattern,
                data: eventData,
                source: 'engine_event',
                timestamp: Date.now()
              });
            });
          }
          break;

        case 'timer':
          if (trigger.interval && trigger.interval > 0) {
            setInterval(function () {
              self._executeWorkflow(workflow, {
                type: 'timer',
                source: 'internal',
                timestamp: Date.now()
              });
            }, trigger.interval);
            console.log('[WorkflowEngine] 定时工作流已启动: ' + workflow.id + ' (间隔 ' + trigger.interval + 'ms)');
          }
          break;
      }
    }

    /**
     * 匹配触发条件
     */
    _matchTrigger(eventData, trigger) {
      if (!trigger.pattern) return true;
      var key = eventData.key || eventData.type || '';
      var pattern = trigger.pattern;

      if (pattern === key) return true;

      if (pattern.indexOf('*') >= 0) {
        var regexStr = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
        try {
          var regex = new RegExp(regexStr);
          return regex.test(key);
        } catch (e) {
          return false;
        }
      }

      return false;
    }

    // ========================================================================
    //  工作流执行（入口 + 防抖 + 去重）
    // ========================================================================

    /**
     * 执行工作流（带防抖和去重）
     */
    _executeWorkflow(workflow, event) {
      var id = workflow.id;
      var options = workflow.options || {};

      // 去重检查
      if (options.dedup !== false) {
        var dedupKey = id + ':' + (event.key || event.type || 'unknown');
        var dedupWindow = options.dedupWindow || 3000;
        var lastTime = this._lastTriggerKeys[dedupKey] || 0;
        if (Date.now() - lastTime < dedupWindow) {
          console.log('[WorkflowEngine] 工作流去重跳过: ' + id);
          return;
        }
        this._lastTriggerKeys[dedupKey] = Date.now();
      }

      // 防抖处理
      if (options.debounce && options.debounce > 0) {
        if (this._debounceTimers[id]) {
          clearTimeout(this._debounceTimers[id]);
        }
        var self = this;
        this._debounceTimers[id] = setTimeout(function () {
          delete self._debounceTimers[id];
          self._startStateMachine(workflow, event);
        }, options.debounce);
        return;
      }

      this._startStateMachine(workflow, event);
    }

    // ========================================================================
    //  状态机核心
    // ========================================================================

    /**
     * 启动状态机：创建实例并驱动状态流转
     */
    _startStateMachine(workflow, event) {
      var instanceId = this._generateInstanceId(workflow.id);
      var maxRetries = (workflow.options && workflow.options.maxRetries) || 0;
      var instance = new WorkflowInstance(instanceId, workflow, event, maxRetries);
      this._instances[instanceId] = instance;

      console.log('[WorkflowEngine] \u25B6 开始执行工作流: ' + workflow.id + ' (' + (workflow.name || '') + ') [实例: ' + instanceId + ']');

      this._emitEvent('workflow:state_changed', {
        id: instanceId,
        type: 'workflow:state_changed',
        data: {
          workflowId: workflow.id,
          state: instance.currentState,
          previousState: null,
          reason: 'started'
        },
        timestamp: Date.now(),
        source: 'WorkflowEngine'
      });

      this._runCurrentState(instance, workflow);
    }

    /**
     * 运行当前状态的所有动作，然后推进到下一状态
     */
    _runCurrentState(instance, workflow) {
      var self = this;
      var options = workflow.options || {};
      var actions = instance._stateActions();
      var stateTimeout = instance._stateTimeout() || options.timeout || 15000;

      // 终态检查
      if (instance._isTerminal()) {
        this._finalizeInstance(instance, workflow);
        return;
      }

      // 设置超时保护
      instance.setTimeout(stateTimeout, function () {
        console.warn('[WorkflowEngine] 状态超时: ' + instance.workflowId + '#' + instance.currentState);
        self._handleStateError(instance, workflow, new Error('状态执行超时 (' + stateTimeout + 'ms)'));
      });

      // 顺序执行当前状态的动作
      this._runActionsSequential(instance, actions, 0, stateTimeout)
        .then(function () {
          instance._clearTimeout();

          // 检查实例是否在执行期间被取消
          if (instance.status === 'cancelled') return;

          // 推进到下一状态
          var nextState = instance._nextStateName();
          if (nextState && instance.states[nextState]) {
            var prev = instance.transitionTo(nextState, 'actions_completed');
            self._emitEvent('workflow:state_changed', {
              id: instance.id,
              type: 'workflow:state_changed',
              data: {
                workflowId: instance.workflowId,
                state: nextState,
                previousState: prev,
                reason: 'actions_completed'
              },
              timestamp: Date.now(),
              source: 'WorkflowEngine'
            });
            // 递归运行下一状态
            self._runCurrentState(instance, workflow);
          } else {
            // 没有下一状态，视为完成
            instance.complete();
            self._finalizeInstance(instance, workflow);
          }
        })
        .catch(function (error) {
          instance._clearTimeout();
          if (instance.status === 'cancelled') return;
          self._handleStateError(instance, workflow, error);
        });
    }

    /**
     * 处理状态执行错误
     */
    _handleStateError(instance, workflow, error) {
      console.error('[WorkflowEngine] \u2718 状态执行失败: ' + instance.workflowId + '#' + instance.currentState, error);

      // 尝试重试
      if (instance.canRetry()) {
        console.log('[WorkflowEngine]   \u21BB 重试 (' + instance.retries + '/' + instance.maxRetries + '): ' + instance.workflowId);
        this._emitEvent('workflow:state_changed', {
          id: instance.id,
          type: 'workflow:state_changed',
          data: {
            workflowId: instance.workflowId,
            state: instance.currentState,
            previousState: instance.currentState,
            reason: 'retrying'
          },
          timestamp: Date.now(),
          source: 'WorkflowEngine'
        });
        this._runCurrentState(instance, workflow);
        return;
      }

      // 转移到失败状态（错误回滚）
      var errorState = instance._errorStateName();
      if (errorState && instance.states[errorState]) {
        var prev = instance.currentState;
        instance.transitionTo(errorState, 'error');
        instance.fail(error);

        this._emitEvent('workflow:state_changed', {
          id: instance.id,
          type: 'workflow:state_changed',
          data: {
            workflowId: instance.workflowId,
            state: errorState,
            previousState: prev,
            reason: 'error'
          },
          timestamp: Date.now(),
          source: 'WorkflowEngine'
        });

        // 执行失败状态的 actions（错误回滚）
        var failActions = instance._stateActions();
        if (failActions.length > 0) {
          var self = this;
          this._runActionsSequential(instance, failActions, 0, 15000)
            .then(function () {
              self._finalizeInstance(instance, workflow);
            })
            .catch(function (rollbackErr) {
              console.error('[WorkflowEngine] \u2718 错误回滚动作执行失败:', rollbackErr);
              self._finalizeInstance(instance, workflow);
            });
          return;
        }
      } else {
        instance.fail(error);
      }

      this._finalizeInstance(instance, workflow);
    }

    /**
     * 完成实例：清理资源、发送事件、可选持久化
     */
    _finalizeInstance(instance, workflow) {
      instance.destroy();

      if (instance.status === 'running') {
        instance.complete();
      }

      var isSuccess = instance.status === 'completed';

      if (isSuccess) {
        console.log('[WorkflowEngine] \u2714 工作流完成: ' + instance.workflowId + ' [实例: ' + instance.id + ']');
        this._emitEvent('workflow:completed', {
          id: instance.id,
          type: 'workflow:completed',
          data: {
            workflowId: instance.workflowId,
            context: instance.context
          },
          timestamp: Date.now(),
          source: 'WorkflowEngine'
        });
      } else {
        console.error('[WorkflowEngine] \u2718 工作流失败: ' + instance.workflowId + ' [实例: ' + instance.id + '] 状态: ' + instance.status);
        this._emitEvent('workflow:error', {
          id: instance.id,
          type: 'workflow:error',
          data: {
            workflowId: instance.workflowId,
            error: instance.context.lastError ? (instance.context.lastError.message || String(instance.context.lastError)) : 'unknown',
            state: instance.currentState,
            status: instance.status
          },
          timestamp: Date.now(),
          source: 'WorkflowEngine'
        });
      }

      // 可选持久化
      this._persistInstance(instance);

      // 延迟清理实例（保留短暂时间供查询）
      var self = this;
      setTimeout(function () {
        if (self._instances[instance.id]) {
          delete self._instances[instance.id];
        }
      }, 60000);
    }

    /**
     * 顺序执行动作序列（Promise 链）
     */
    _runActionsSequential(instance, actions, startIndex, timeout) {
      var self = this;
      var index = startIndex;

      function runNext() {
        if (index >= actions.length) {
          return Promise.resolve();
        }

        var action = actions[index];

        // 条件判断
        if (action.condition) {
          if (!self._evaluateCondition(action.condition, instance.context)) {
            console.log('[WorkflowEngine]   \u21B3 动作 ' + (index + 1) + ' 条件不满足，跳过: ' + action.type);
            index++;
            return runNext();
          }
        }

        console.log('[WorkflowEngine]   \u21B3 执行动作 ' + (index + 1) + '/' + actions.length + ': ' + action.type + ' \u2192 ' + (action.target || '') + ' [状态: ' + instance.currentState + ']');

        var actionTimeout = action.timeout || timeout || 15000;
        return self._executeActionWithTimeout(action, instance.context, actionTimeout)
          .then(function () {
            index++;
            return runNext();
          });
      }

      return runNext();
    }

    /**
     * 执行单个动作（带超时包装）
     */
    _executeActionWithTimeout(action, context, timeout) {
      var self = this;
      var timeoutMs = timeout || 15000;

      return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
          reject(new Error('动作超时: ' + action.type + ' (' + timeoutMs + 'ms)'));
        }, timeoutMs);

        self._executeAction(action, context)
          .then(function (result) {
            clearTimeout(timer);
            resolve(result);
          })
          .catch(function (err) {
            clearTimeout(timer);
            reject(err);
          });
      });
    }

    // ========================================================================
    //  动作执行器
    // ========================================================================

    /**
     * 执行单个动作
     */
    async _executeAction(action, context) {
      var resolvedParams = this._resolveTemplate(this._clone(action.params), context);

      switch (action.type) {
        case 'ai_call':
          return await this._callAI(resolvedParams, action, context);

        case 'module_call':
          return await this._callModule(
            resolvedParams.target || action.target,
            resolvedParams.method,
            resolvedParams.args
          );

        case 'variable_set':
          return await this._setVariable(resolvedParams, action);

        case 'event_emit':
          if (window.Platform && window.Platform.eventBus) {
            window.Platform.eventBus.emit(
              resolvedParams.event || action.target,
              resolvedParams.data || {}
            );
          }
          return Promise.resolve();

        case 'function_call':
          if (typeof action.handler === 'function') {
            return await Promise.resolve().then(function () {
              return action.handler(context, resolvedParams);
            });
          }
          return Promise.resolve();

        default:
          console.warn('[WorkflowEngine] 未知动作类型: ' + action.type);
          return Promise.resolve();
      }
    }

    /**
     * 调用 AI（通过 AIService）
     */
    async _callAI(params, action, context) {
      try {
        var AIService = (window.PhoneServices && window.PhoneServices.AI) || null;
        if (!AIService) {
          console.warn('[WorkflowEngine] AIService 不可用');
          return null;
        }

        var ai = new AIService(this._platform);
        var result = await ai.generate(params.prompt || '', params.options || {});

        if (action.resultKey) {
          context.results[action.resultKey] = result;
        }
        return result;
      } catch (e) {
        console.error('[WorkflowEngine] AI 调用失败:', e);
        throw e;
      }
    }

    /**
     * 调用模块方法
     */
    async _callModule(target, method, args) {
      var module = (this._platform && this._platform.services && this._platform.services.get) ?
        this._platform.services.get(target) : null;

      if (!module) {
        console.warn('[WorkflowEngine] 模块不存在: ' + target);
        return Promise.reject(new Error('模块不存在: ' + target));
      }
      if (typeof module[method] !== 'function') {
        console.warn('[WorkflowEngine] 模块方法不存在: ' + target + '.' + method);
        return Promise.reject(new Error('模块方法不存在: ' + target + '.' + method));
      }

      try {
        var result = await Promise.resolve(module[method].apply(module, args || []));
        return result;
      } catch (e) {
        console.warn('[WorkflowEngine] 模块调用异常: ' + target + '.' + method, e);
        throw e;
      }
    }

    /**
     * 设置变量（通过 Schema）
     * [铁则一] 数据读写唯一通道
     */
    async _setVariable(params, action) {
      var varKey = params.key || action.target;
      var varValue = params.value;

      try {
        if (this._platform && typeof this._platform.setData === 'function') {
          var parts = varKey.split('.');
          if (parts.length >= 2) {
            var domain = parts[1];
            var key = parts.slice(2).join('.');
            await this._platform.setData(domain, key, varValue);
          }
        }

        if (window.Platform && window.Platform.eventBus) {
          window.Platform.eventBus.emit('variable:changed', {
            key: varKey,
            value: varValue,
            source: 'workflow',
            timestamp: Date.now()
          });
        }
      } catch (e) {
        console.error('[WorkflowEngine] 设置变量失败:', e);
        throw e;
      }
    }

    // ========================================================================
    //  模板 & 条件
    // ========================================================================

    /**
     * 模板变量解析 {{context.path}} \u2192 实际值
     */
    _resolveTemplate(obj, context) {
      if (typeof obj === 'string') {
        return obj.replace(/\{\{([^}]+)\}\}/g, function (match, path) {
          path = path.trim();
          var value = this._getByPath(context, path);
          return value != null ? String(value) : match;
        }.bind(this));
      }
      if (obj && typeof obj === 'object') {
        var result = {};
        var keys = Object.keys(obj);
        for (var i = 0; i < keys.length; i++) {
          result[keys[i]] = this._resolveTemplate(obj[keys[i]], context);
        }
        return result;
      }
      return obj;
    }

    /**
     * 按路径取值
     */
    _getByPath(obj, path) {
      var parts = path.split('.');
      var current = obj;
      for (var i = 0; i < parts.length; i++) {
        if (current == null) return undefined;
        current = current[parts[i]];
      }
      return current;
    }

    /**
     * 简单条件求值
     */
    _evaluateCondition(condition, context) {
      if (condition.type === 'function' && typeof condition.fn === 'function') {
        try {
          return condition.fn(context);
        } catch (e) {
          return false;
        }
      }
      if (condition.type === 'expr') {
        try {
          var expr = condition.expr || '';
          var val = this._getByPath(context, expr.trim());
          return !!(val && val !== '' && val !== '0' && val !== 0 && val !== false);
        } catch (e) {
          return false;
        }
      }
      return true;
    }

    // ========================================================================
    //  事件发射（铁则十二：载荷 { id, type, data, timestamp, source }）
    // ========================================================================

    /**
     * 发射事件
     * @param {string} eventName - 事件名
     * @param {Object} payload   - 事件载荷，必须包含 id, type, data, timestamp, source
     */
    _emitEvent(eventName, payload) {
      if (window.Platform && window.Platform.eventBus) {
        window.Platform.eventBus.emit(eventName, payload);
      }
    }

    // ========================================================================
    //  实例持久化（可选，通过 Platform.data）
    // ========================================================================

    /**
     * 持久化实例状态到 Platform.data
     */
    _persistInstance(instance) {
      try {
        if (this._platform && typeof this._platform.setData === 'function') {
          this._platform.setData('workflow', 'instance:' + instance.id, instance.toJSON());
        }
      } catch (e) {
        // 持久化失败不影响主流程 [铁则九]
        console.warn('[WorkflowEngine] 实例持久化失败（不影响主流程）:', e);
      }
    }

    // ========================================================================
    //  工具方法
    // ========================================================================

    /**
     * 生成唯一实例 ID
     */
    _generateInstanceId(workflowId) {
      this._instanceCounter++;
      return workflowId + ':' + Date.now() + ':' + this._instanceCounter;
    }

    /**
     * 浅拷贝对象
     */
    _clone(obj) {
      if (!obj || typeof obj !== 'object') return obj;
      var result = {};
      var keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        result[keys[i]] = obj[keys[i]];
      }
      return result;
    }
  }

  // ---------------------------------------------------------------------------
  //  暴露到全局
  // ---------------------------------------------------------------------------
  window.WorkflowEngine = WorkflowEngine;
  window.WorkflowInstance = WorkflowInstance;

  console.log('[Core] WorkflowEngine 已加载 (v3.0 state-machine)');
})();
