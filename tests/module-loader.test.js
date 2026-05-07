import { describe, it, expect, beforeEach } from 'vitest';

class ModuleLoader {
  constructor() {
    this._modules = new Map();
    this._loadOrder = [];
  }
  register(module) {
    if (!module || !module.name || !module.file) throw new Error('[ModuleLoader] 模块声明必须包含 name 和 file');
    this._modules.set(module.name, { name: module.name, file: module.file, deps: module.deps || [], state: 'registered', error: null });
  }
  registerAll(modules) { for (const mod of modules) this.register(mod); }
  detectCircularDeps() {
    const visited = new Set();
    const stack = new Set();
    const dfs = (name, path) => {
      if (stack.has(name)) return path.slice(path.indexOf(name)).concat(name).join(' -> ');
      if (visited.has(name)) return null;
      visited.add(name); stack.add(name); path.push(name);
      const mod = this._modules.get(name);
      if (mod) { for (const dep of mod.deps) { const r = dfs(dep, path); if (r) return r; } }
      stack.delete(name); path.pop(); return null;
    };
    for (const name of this._modules.keys()) { const r = dfs(name, []); if (r) return r; }
    return null;
  }
  topologicalSort() {
    const inDegree = new Map();
    const dependents = new Map();
    for (const [name] of this._modules) { inDegree.set(name, 0); dependents.set(name, []); }
    for (const [name, mod] of this._modules) {
      for (const dep of mod.deps) {
        if (this._modules.has(dep)) { inDegree.set(name, inDegree.get(name) + 1); dependents.get(dep).push(name); }
      }
    }
    const layers = [];
    let queue = [];
    for (const [name, degree] of inDegree) { if (degree === 0) queue.push(name); }
    while (queue.length > 0) {
      layers.push(queue.slice());
      const next = [];
      for (const name of queue) { for (const dep of dependents.get(name)) { inDegree.set(dep, inDegree.get(dep) - 1); if (inDegree.get(dep) === 0) next.push(dep); } }
      queue = next;
    }
    return layers;
  }
  getState(name) { const mod = this._modules.get(name); return mod ? mod.state : null; }
  listModules() {
    const result = [];
    for (const [, mod] of this._modules) result.push({ name: mod.name, state: mod.state, deps: mod.deps });
    return result;
  }
}

describe('ModuleLoader', () => {
  let loader;
  beforeEach(() => { loader = new ModuleLoader(); });

  it('应注册模块', () => {
    loader.register({ name: 'a', file: 'a.js' });
    expect(loader.getState('a')).toBe('registered');
  });
  it('应在缺少 name 或 file 时抛出错误', () => {
    expect(() => loader.register({ name: 'a' })).toThrow('name 和 file');
  });
  it('应检测循环依赖', () => {
    loader.register({ name: 'a', file: 'a.js', deps: ['b'] });
    loader.register({ name: 'b', file: 'b.js', deps: ['c'] });
    loader.register({ name: 'c', file: 'c.js', deps: ['a'] });
    expect(loader.detectCircularDeps()).toBeTruthy();
  });
  it('应正确拓扑排序', () => {
    loader.register({ name: 'a', file: 'a.js' });
    loader.register({ name: 'b', file: 'b.js', deps: ['a'] });
    loader.register({ name: 'c', file: 'c.js', deps: ['a'] });
    const layers = loader.topologicalSort();
    expect(layers[0]).toContain('a');
    expect(layers[1]).toContain('b');
    expect(layers[1]).toContain('c');
  });
  it('应将同层无依赖模块放在同一组', () => {
    loader.register({ name: 'a', file: 'a.js' });
    loader.register({ name: 'b', file: 'b.js' });
    const layers = loader.topologicalSort();
    expect(layers).toHaveLength(1);
    expect(layers[0]).toHaveLength(2);
  });
});
