# Format plików YAML w vaulcie (tagi, szablony zadań, zasoby)

Aplikacja czyta i zapisuje trzy pliki w `NEXUS/Vault/` (ścieżka z `NEXUS_VAULT_PATH`). Kod: `lib/nexus/yaml-store.ts`, `lib/nexus/repos/`.

| Plik                       | Klucz listy | Pola rekordu (kolejność)                                                                                      |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| `Resources/tags.yaml`      | `tags`      | `id`, `tag`, `title`, `color` (opcjonalne), `created`                                                         |
| `Tasks/templates.yaml`     | `templates` | `id`, `label`, `title`, `link`, `created`                                                                     |
| `Resources/resources.yaml` | `resources` | `id`, `title`, `url`, `description`, `tags`, `favorite`, `thumbnail_url`\*, `note_id`\*, `created`, `updated` |

\* opcjonalne: klucz jest pomijany, gdy brak wartości (nigdy `null`).

Struktura pliku: `version: 1`, lista rekordów pod kluczem. Czas to tekst ISO 8601 (UTC). `id`: 20 znaków alfanumerycznych.

## Zasady zapisu

- Aplikacja zapisuje atomowo i tylko wtedy, gdy plik nie zmienił się od odczytu (inaczej ponawia; po wyczerpaniu ponowień błąd 409).
- Nieznane klucze w rekordach i kolejność rekordów przeżywają zapis. **Komentarze YAML giną**, podobnie jak ewentualne klucze najwyższego poziomu pliku inne niż `version` i lista.
- Po pierwszym zapisie aplikacji znika `generated_by`, więc ponowny import 0b zapisze pliki obok zamiast je nadpisać.
- Plik, który się nie parsuje, nie jest nadpisywany; operacja kończy się błędem z nazwą pliku.
- Odczyt jest posortowany niezależnie od kolejności w pliku: tagi i szablony rosnąco po `created`, zasoby malejąco po `created`; remisy po `id`.
- `userId` nie jest zapisywany (jednoużytkownikowy vault do etapu 0d).
- Ręcznie wpisane `favorite: yes` jest czytane jako tekst (YAML 1.2), czyli nie jako „ulubiony”. Używaj `true`/`false`.
