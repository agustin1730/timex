import { expandTimer, type TimerPreset, type Step } from "./timer-model.ts";

export type Playback = { index: number; remaining: number; running: boolean; finished: boolean };

/** Una sesión independiente del preset guardado y del ciclo de render de React. */
export class TimelineSession<S extends Step = Step> {
  readonly steps: S[];
  state: Playback;
  private deadline: number | null = null;
  private announced = false;

  constructor(
    steps: S[],
    private now: () => number,
    private onStage: (step: S) => void,
    private onFinish: () => void,
  ) {
    this.steps = structuredClone(steps);
    this.state = {
      index: 0,
      remaining: this.steps[0]?.duration ?? 0,
      running: false,
      finished: false,
    };
  }

  start() {
    if (!this.steps.length || this.state.running) return;
    if (this.state.finished) this.reset();
    this.state = { ...this.state, running: true };
    this.deadline = this.now() + this.state.remaining * 1000;
    if (!this.announced) {
      this.announced = true;
      this.onStage(this.steps[this.state.index]!);
    }
  }

  tick() {
    if (!this.state.running || this.deadline === null) return;
    const now = this.now();
    while (now >= this.deadline) {
      const next = this.state.index + 1;
      const step = this.steps[next];
      if (!step) {
        this.deadline = null;
        this.state = { ...this.state, remaining: 0, running: false, finished: true };
        this.onFinish();
        return;
      }
      this.deadline += step.duration * 1000;
      this.state = { ...this.state, index: next };
      this.announced = true;
      this.onStage(step);
    }
    this.state = { ...this.state, remaining: (this.deadline - now) / 1000 };
  }

  pause() {
    this.tick();
    this.deadline = null;
    this.state = { ...this.state, running: false };
  }

  goTo(index: number) {
    if (!this.steps.length) return;
    const target = Math.max(0, Math.min(this.steps.length - 1, index));
    const step = this.steps[target]!;
    this.state = { ...this.state, index: target, remaining: step.duration, finished: false };
    this.deadline = this.state.running ? this.now() + step.duration * 1000 : null;
    this.announced = this.state.running;
    if (this.state.running) this.onStage(step);
  }

  reset() {
    this.deadline = null;
    this.announced = false;
    this.state = {
      index: 0,
      remaining: this.steps[0]?.duration ?? 0,
      running: false,
      finished: false,
    };
  }
}

export class TimerSession extends TimelineSession {
  readonly timer: TimerPreset;
  constructor(
    timer: TimerPreset,
    now: () => number,
    onStage: (step: Step) => void,
    onFinish: () => void,
  ) {
    super(expandTimer(timer), now, onStage, onFinish);
    this.timer = structuredClone(timer);
  }
}
