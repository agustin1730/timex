import type { SequenceStep } from "./sequence-model.ts";
import type { Playback } from "./timer-session.ts";

/** Derived exclusively from the session snapshot, never from editable presets. */
export function sequenceTimeline(steps: SequenceStep[], state: Playback) {
  const segments: {
    key: string;
    name: string;
    transition: boolean;
    start: number;
    end: number;
    duration: number;
    elapsed: number;
    progress: number;
    status: "pending" | "current" | "completed";
  }[] = [];
  steps.forEach((step, index) => {
    const key = JSON.stringify([step.itemId, step.groupIndex]);
    let segment = segments.at(-1);
    if (!segment || segment.key !== key) {
      segment = {
        key,
        name: step.timerName || step.stageName,
        transition: !step.timerName,
        start: index,
        end: index,
        duration: 0,
        elapsed: 0,
        progress: 0,
        status: "pending",
      };
      segments.push(segment);
    }
    segment.end = index;
    segment.duration += step.duration;
    if (state.finished || index < state.index) segment.elapsed += step.duration;
    else if (index === state.index)
      segment.elapsed += Math.max(0, Math.min(step.duration, step.duration - state.remaining));
  });
  for (const segment of segments) {
    segment.progress = segment.duration > 0 ? segment.elapsed / segment.duration : 0;
    segment.status =
      state.finished || segment.end < state.index
        ? "completed"
        : segment.start <= state.index
          ? "current"
          : "pending";
  }
  return segments;
}
