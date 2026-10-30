import { inject, type InjectionKey, type Ref } from "vue";
import type { ThemePreference } from "../../config/theme.config";
import type { InspectionMode } from "../../adapters/storage";
import type { Category } from "../../types/audit";

export type Surface = "sidebar" | "report";
export type Tone = "good" | "warn" | "err" | "gray";

export interface IssueFocus {
  category?: Category;
  check?: string;
}

/** App-level actions the sidebar and report views share. */
export interface WorkbenchContext {
  surface: Surface;
  tabId: Ref<number | undefined>;
  ready: Ref<boolean>;
  probing: Ref<boolean>;
  probeMessage: Ref<string>;
  preference: Ref<ThemePreference>;
  inspectionMode: Ref<InspectionMode | null>;
  automaticAccessGranted: Ref<boolean>;
  issueFocus: Ref<IssueFocus | null>;
  go: (section: string, focus?: IssueFocus) => void;
  toast: (message: string) => void;
  copy: (value: string) => Promise<void>;
  highlight: (kind: string) => Promise<void>;
  clearMarks: () => Promise<void>;
  refresh: () => Promise<void>;
  runSiteProbe: (more?: boolean) => Promise<void>;
  setPreference: (value: ThemePreference) => Promise<void>;
  setInspectionMode: (value: InspectionMode) => Promise<void>;
  enableAutomaticChecks: () => Promise<void>;
  revokeAutomaticAccess: () => Promise<boolean>;
  openReport: (section?: string) => Promise<void>;
}

export const workbenchKey: InjectionKey<WorkbenchContext> = Symbol("workbench");

export function useWorkbench(): WorkbenchContext {
  const context = inject(workbenchKey);
  if (!context) throw new Error("Workbench context is missing.");
  return context;
}

/** Category bar tone used by the prototype: green, amber, or red. */
export function scoreTone(value: number | null): "good" | "warn" | "red" {
  if (value == null || value >= 90) return "good";
  return value >= 50 ? "warn" : "red";
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
