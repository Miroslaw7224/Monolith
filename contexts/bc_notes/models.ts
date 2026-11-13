/** Notatka (`Notes/*.md` w vaulcie: frontmatter + treść Markdown). */
export type Note = {
  id: string;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string;
};
