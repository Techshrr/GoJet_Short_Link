export const functionalIconPolicy = {
  library: "lucide",
  strokeWidth: 1.75,
  emphasizedStrokeWidth: 2,
  sizes: {
    inline: 16,
    button: 16,
    sidebar: 18,
    pageAction: 18,
    marketingFeature: 24,
    emptyState: 32
  }
} as const;

export const brandAssetPriority = ["official-brand-kit", "official-svg", "simple-icons"] as const;

export const customProductIconPolicy = {
  grid: 24,
  safeArea: 2,
  strokeWidth: 1.75,
  linecap: "round",
  linejoin: "round"
} as const;

/**
 * P02 freezes the source and geometry policy only. P03 owns React icon
 * primitives and will bind Lucide components without changing these rules.
 */
export type FunctionalIconSize = keyof typeof functionalIconPolicy.sizes;
