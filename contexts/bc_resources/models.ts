/** Zasób użytkownika: link z opisem i tagami (`Resources/resources.yaml`). */
export type Resource = {
  id: string;
  noteId?: string; // opcjonalne: zasoby są na poziomie użytkownika, nie notatki
  description: string;
  url: string;
  title: string;
  thumbnailUrl?: string;
  tags: string[];
  isFavorite?: boolean;
  createdAt?: string; // ISO 8601
  updatedAt?: string; // ISO 8601
};
