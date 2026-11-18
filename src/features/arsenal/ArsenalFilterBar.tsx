import React from "react";
import {
  SkillCategorySchema,
  type DeployTargetDto,
  type SkillCategoryDto,
} from "@/contexts/bc_arsenal/schemas";
import { useT } from "@/src/i18n/useT";
import { EMPTY_FILTERS, isFiltered, type ArsenalFilters, type KindFilter } from "./arsenalFilters";

type Props = {
  filters: ArsenalFilters;
  onChange: (filters: ArsenalFilters) => void;
  targets: DeployTargetDto[];
  models: string[];
};

export function ArsenalFilterBar({ filters, onChange, targets, models }: Props) {
  const t = useT();
  const kinds: { id: KindFilter; label: string }[] = [
    { id: "all", label: t("arsenal:arsenalFilterAll") },
    { id: "skill", label: t("arsenal:arsenalFilterSkills") },
    { id: "prompt", label: t("arsenal:arsenalFilterPrompts") },
  ];
  const set = (patch: Partial<ArsenalFilters>) => onChange({ ...filters, ...patch });
  return (
    <div className="asv-filters">
      <input
        type="search"
        className="asv-search"
        aria-label={t("arsenal:arsenalSearchAria")}
        placeholder={t("arsenal:arsenalSearchPlaceholder")}
        value={filters.query}
        onChange={(e) => set({ query: e.target.value })}
      />
      <div className="asv-chips">
        {kinds.map((kind) => (
          <button
            key={kind.id}
            type="button"
            className="asv-chip"
            aria-pressed={filters.kind === kind.id}
            onClick={() => set({ kind: kind.id })}
          >
            {kind.label}
          </button>
        ))}
      </div>
      <select
        className="asv-select"
        aria-label={t("arsenal:arsenalFilterProjectAria")}
        value={filters.project ?? ""}
        onChange={(e) => set({ project: e.target.value === "" ? null : e.target.value })}
      >
        <option value="">{t("arsenal:arsenalAllProjects")}</option>
        {targets.map((target) => (
          <option key={target.id} value={target.id}>
            {target.name}
          </option>
        ))}
      </select>
      <select
        className="asv-select"
        aria-label={t("arsenal:arsenalFilterCategoryAria")}
        value={filters.category ?? ""}
        onChange={(e) =>
          set({ category: e.target.value === "" ? null : (e.target.value as SkillCategoryDto) })
        }
      >
        <option value="">{t("arsenal:arsenalAllCategories")}</option>
        {SkillCategorySchema.options.map((c) => (
          <option key={c} value={c}>
            {t(`arsenal:arsenalCategory_${c}`)}
          </option>
        ))}
      </select>
      {models.length > 0 && (
        <select
          className="asv-select"
          aria-label={t("arsenal:arsenalFilterModelAria")}
          value={filters.model ?? ""}
          onChange={(e) => set({ model: e.target.value === "" ? null : e.target.value })}
        >
          <option value="">{t("arsenal:arsenalAllModels")}</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      )}
      <label className="asv-check">
        <input
          type="checkbox"
          checked={filters.undeployedOnly}
          onChange={(e) => set({ undeployedOnly: e.target.checked })}
        />
        {t("arsenal:arsenalUndeployedCheckbox")}
      </label>
      {isFiltered(filters) && (
        <button type="button" className="asv-btn" onClick={() => onChange(EMPTY_FILTERS)}>
          {t("arsenal:arsenalClearFilters")}
        </button>
      )}
    </div>
  );
}
