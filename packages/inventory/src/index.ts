export const inventoryRules = {
  sourceOfTruth: "inventory_events",
  projectionTable: "inventory_levels",
  principle: "Never overwrite inventory blindly"
} as const;

