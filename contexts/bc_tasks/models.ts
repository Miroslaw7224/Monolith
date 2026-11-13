/** Zadanie globalne (`Tasks/tasks.md` w vaulcie, linie Dataview). */
export type Task = {
  id: string;
  title: string;
  link: string;
  description: string;
  status: "todo" | "in_progress" | "to_review" | "done";
  due_date: string | null;
  priority: number | null;
  order?: number;
  created_at?: string;
  updated_at?: string;
};

/** Szablon zadania (`Tasks/templates.yaml` w vaulcie). */
export type TaskTemplate = {
  id: string;
  label: string;
  title: string;
  link: string;
  created_at?: string;
};
