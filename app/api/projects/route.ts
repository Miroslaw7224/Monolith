export { listProjects as GET } from "@/contexts/bc_projects/router";

// Rejestr czytamy z vaulta przy każdym żądaniu; bez tego Next mógłby wyrenderować trasę statycznie przy buildzie.
export const dynamic = "force-dynamic";
