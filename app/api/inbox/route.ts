export {
  listInbox as GET,
  createItem as POST,
  clearClosedItems as DELETE,
} from "@/contexts/bc_inbox/router";

export const dynamic = "force-dynamic";
