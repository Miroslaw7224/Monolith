/** Tag użytkownika (`Resources/tags.yaml` w vaulcie). */
export type UserTag = {
  id: string;
  tag: string;
  title: string;
  color?: string;
  aliases?: string[]; // synonimy (porównanie bez względu na wielkość liter)
  created_at?: string;
};
