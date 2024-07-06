export class ConcurrencyController {
  max: number;
  current: number;

  constructor(max: number) {
    this.max = max < 1 ? 1 : max;
    this.current = 0;
  }

  async requestSlot() {
    return new Promise<void>((resolve) => {
      const tryAcquire = () => {
        if (this.current < this.max) {
          this.current++;
          resolve();
        } else {
          setTimeout(tryAcquire, 100); // 每100ms尝试一次获取资源
        }
      };
      tryAcquire();
    });
  }

  get available() {
    return this.current < this.max;
  }

  releaseSlot() {
    this.current && this.current--;
  }

  setMax(max: number) {
    this.max = max < 1 ? 1 : max;
  }
}
