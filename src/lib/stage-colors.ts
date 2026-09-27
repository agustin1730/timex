/** Stable color names shared by saved timers, playback, and future native views. */
export const stageColors = ["gray", "red", "yellow", "green", "purple", "blue", "orange"] as const;
export type StageColor = (typeof stageColors)[number];

export const stageColorPalette: Record<
  StageColor,
  { label: string; solid: string; tint: string; ink: string }
> = {
  gray: { label: "Gris", solid: "#89929f", tint: "#202a35", ink: "#111820" },
  red: { label: "Rojo", solid: "#ef5350", tint: "#352629", ink: "#ffffff" },
  yellow: { label: "Amarillo", solid: "#facc15", tint: "#353124", ink: "#1d1a0b" },
  green: { label: "Verde", solid: "#4ade80", tint: "#253329", ink: "#102016" },
  purple: { label: "Violeta", solid: "#a970e8", tint: "#30283b", ink: "#ffffff" },
  blue: { label: "Azul", solid: "#3b9bff", tint: "#233345", ink: "#ffffff" },
  orange: { label: "Naranja", solid: "#f59e0b", tint: "#392d22", ink: "#211607" },
};

export function stageColor(value: unknown): StageColor {
  return stageColors.find((color) => color === value) ?? "gray";
}
