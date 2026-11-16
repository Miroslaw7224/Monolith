export { getCodeSyncMap as GET } from "@/contexts/bc_projects/router";

// Stany liczymy z repozytoriów przy każdym żądaniu; bez tego Next wyrenderuje trasę statycznie przy buildzie.
export const dynamic = "force-dynamic";
