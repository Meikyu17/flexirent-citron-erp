export type SplitLayout = {
  desktopMain: number;
  desktopLeftTop: number;
  desktopBottom: number;
  desktopRightTop: number;
  tabletMain: number;
  tabletLeftTop: number;
  tabletLeftMiddle: number;
  tabletRightTop: number;
};

export type SplitKey = keyof SplitLayout;

export type ResizeState = {
  key: SplitKey;
  axis: "x" | "y";
  start: number;
  startValue: number;
  size: number;
};

export const LAYOUT_STORAGE_KEY = "citron-home-split-layout-v7";

export const defaultLayout: SplitLayout = {
  desktopMain: 0.62,
  desktopLeftTop: 0.34,
  desktopBottom: 0.48,
  desktopRightTop: 0.62,
  tabletMain: 0.52,
  tabletLeftTop: 0.30,
  tabletLeftMiddle: 0.68,
  tabletRightTop: 0.62,
};

export const splitLimits: Record<SplitKey, { min: number; max: number }> = {
  desktopMain: { min: 0.42, max: 0.72 },
  desktopLeftTop: { min: 0.18, max: 0.52 },
  desktopBottom: { min: 0.32, max: 0.68 },
  desktopRightTop: { min: 0.38, max: 0.75 },
  tabletMain: { min: 0.42, max: 0.62 },
  tabletLeftTop: { min: 0.16, max: 0.42 },
  tabletLeftMiddle: { min: 0.44, max: 0.82 },
  tabletRightTop: { min: 0.38, max: 0.78 },
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const sanitizeLayout = (candidate?: Partial<SplitLayout>): SplitLayout => ({
  desktopMain: clamp(
    candidate?.desktopMain ?? defaultLayout.desktopMain,
    splitLimits.desktopMain.min,
    splitLimits.desktopMain.max,
  ),
  desktopLeftTop: clamp(
    candidate?.desktopLeftTop ?? defaultLayout.desktopLeftTop,
    splitLimits.desktopLeftTop.min,
    splitLimits.desktopLeftTop.max,
  ),
  desktopBottom: clamp(
    candidate?.desktopBottom ?? defaultLayout.desktopBottom,
    splitLimits.desktopBottom.min,
    splitLimits.desktopBottom.max,
  ),
  desktopRightTop: clamp(
    candidate?.desktopRightTop ?? defaultLayout.desktopRightTop,
    splitLimits.desktopRightTop.min,
    splitLimits.desktopRightTop.max,
  ),
  tabletMain: clamp(
    candidate?.tabletMain ?? defaultLayout.tabletMain,
    splitLimits.tabletMain.min,
    splitLimits.tabletMain.max,
  ),
  tabletLeftTop: clamp(
    candidate?.tabletLeftTop ?? defaultLayout.tabletLeftTop,
    splitLimits.tabletLeftTop.min,
    splitLimits.tabletLeftTop.max,
  ),
  tabletLeftMiddle: clamp(
    candidate?.tabletLeftMiddle ?? defaultLayout.tabletLeftMiddle,
    splitLimits.tabletLeftMiddle.min,
    splitLimits.tabletLeftMiddle.max,
  ),
  tabletRightTop: clamp(
    candidate?.tabletRightTop ?? defaultLayout.tabletRightTop,
    splitLimits.tabletRightTop.min,
    splitLimits.tabletRightTop.max,
  ),
});

export const getViewport = (): "mobile" | "tablet" | "desktop" => {
  if (typeof window === "undefined") return "desktop";
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1280) return "tablet";
  return "desktop";
};
