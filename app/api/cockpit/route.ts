export { getCockpit as GET } from "@/contexts/bc_cockpit/router";

// Dane z vaulta i „dziś” liczymy przy każdym żądaniu; bez tego Next mógłby wyrenderować trasę statycznie przy buildzie.
export const dynamic = "force-dynamic";
