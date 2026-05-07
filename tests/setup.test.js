import { describe, it, expect } from 'vitest';

describe('Vitest 基础设施验证', () => {
  it('测试框架正常运行', () => {
    expect(1 + 1).toBe(2);
  });

  it('DOM 环境可用', () => {
    expect(typeof document).toBe('object');
    expect(typeof window).toBe('object');
  });
});
