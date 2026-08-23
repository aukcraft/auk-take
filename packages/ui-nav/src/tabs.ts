/**
 * Tab definition: pure data. The shell renders the platform skeleton
 * (bottom TabBar on mobile / left Sidebar on desktop) from this data;
 * content components are pulled from the CapabilityRegistry by key.
 */
export type TabId = "records" | "calendar" | "read" | "profile";

export interface TabDefinition {
  /** Stable tab identifier. */
  readonly id: TabId;
  /** CapabilityRegistry key of the tab's content component, e.g. "ui:tab:records". */
  readonly capabilityKey: string;
  /** CapabilityRegistry key of the tab's icon. */
  readonly iconKey: string;
  /** Copy key. Phase 0b hardcodes zh-CN strings; i18n lands in Phase 6. */
  readonly titleKey: string;
  /** Sort order, ascending. */
  readonly order: number;
  /** When true the tab cannot be hidden by user settings. */
  readonly required?: boolean;
}

/** Hardcoded zh-CN titles for Phase 0b (titleKey -> text). */
export const TAB_TITLES: Record<string, string> = {
  "tab.title.records": "记录",
  "tab.title.calendar": "日历",
  "tab.title.read": "读",
  "tab.title.profile": "我的",
};

/** Default tab set. 'read' is content-provided by the mood plugin (Phase 5). */
export const DEFAULT_TABS: readonly TabDefinition[] = [
  {
    id: "records",
    capabilityKey: "ui:tab:records",
    iconKey: "ui:icon:records",
    titleKey: "tab.title.records",
    order: 0,
    required: true,
  },
  {
    id: "calendar",
    capabilityKey: "ui:tab:calendar",
    iconKey: "ui:icon:calendar",
    titleKey: "tab.title.calendar",
    order: 1,
    required: true,
  },
  {
    id: "read",
    capabilityKey: "ui:tab:read",
    iconKey: "ui:icon:read",
    titleKey: "tab.title.read",
    order: 2,
  },
  {
    id: "profile",
    capabilityKey: "ui:tab:profile",
    iconKey: "ui:icon:profile",
    titleKey: "tab.title.profile",
    order: 3,
    required: true,
  },
];
