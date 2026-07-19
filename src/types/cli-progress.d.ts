declare module 'cli-progress' {
  export class SingleBar {
    constructor(options?: any, preset?: any);
    start(total: number, startValue?: number, payload?: any): void;
    update(current: number, payload?: any): void;
    stop(): void;
    updateETA(): void;
    setTotal(total: number): void;
    getProgress(): number;
    getTotal(): number;
    getETA(): number;
    formatTime(t: number, roundToMultipleOf: number): string;
  }

  export class MultiBar {
    constructor(options?: any, preset?: any);
    create(total: number, startValue: number, payload?: any): SingleBar;
    stop(): void;
    update(): void;
    log(data: any): void;
  }

  export class Presets {
    static shades_classic: any;
    static shades_grey: any;
    static rect: any;
    static legacy: any;
  }

  export const Format: any;
  export const Formatter: any;
}
