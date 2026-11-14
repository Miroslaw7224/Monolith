export { getMapGraph as GET } from "@/contexts/bc_map/router";

// Vault czytamy przy każdym żądaniu; bez tego Next mógłby wyrenderować trasę statycznie przy buildzie.
export const dynamic = "force-dynamic";
