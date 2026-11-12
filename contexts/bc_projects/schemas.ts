/** Same GET: brak schematów zod wejścia. */
import type {
  BugEntry,
  ChecklistItem,
  ChecklistSection,
  Freshness,
  Project,
  ProjectWithContent,
} from "./models";

export type ChecklistItemDto = ChecklistItem;
export type ChecklistSectionDto = ChecklistSection;
export type BugEntryDto = BugEntry;
export type FreshnessDto = Freshness;

export type ProjectSummaryDto = {
  id: string;
  name: string;
  status: string;
  priority: string;
  localPath: string;
  deploy?: string;
  github?: string;
  owner: "personal";
  lastWorked?: string;
  stateConfidence?: string;
  freshness: FreshnessDto;
};

export type ProjectDetailDto = ProjectSummaryDto & {
  tasks: ChecklistSectionDto[];
  bugs: BugEntryDto[];
  whereIStopped: string | null;
};

export function toSummaryDto(p: Project): ProjectSummaryDto {
  const dto: ProjectSummaryDto = {
    id: p.id,
    name: p.name,
    status: p.status,
    priority: p.priority,
    localPath: p.localPath,
    owner: p.owner,
    freshness: p.freshness,
  };
  if (p.deploy !== undefined) dto.deploy = p.deploy;
  if (p.github !== undefined) dto.github = p.github;
  if (p.lastWorked !== undefined) dto.lastWorked = p.lastWorked;
  if (p.stateConfidence !== undefined) dto.stateConfidence = p.stateConfidence;
  return dto;
}

export function toDetailDto(p: ProjectWithContent): ProjectDetailDto {
  return {
    ...toSummaryDto(p),
    tasks: p.tasks,
    bugs: p.bugs,
    whereIStopped: p.whereIStopped,
  };
}
