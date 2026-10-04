import { Clock } from 'three'
import { expect, it, vi } from 'vitest'

it('supports the Clock API used by React Three Fiber without deprecation warnings', () => {
  const warning = vi.spyOn(console, 'warn')
  try {
    const clock = new Clock()
    clock.start()
    expect(clock.running).toBe(true)
    expect(clock.getDelta()).toBeGreaterThanOrEqual(0)
    clock.stop()
    expect(clock.running).toBe(false)
    expect(warning).not.toHaveBeenCalled()
  } finally {
    warning.mockRestore()
  }
})
