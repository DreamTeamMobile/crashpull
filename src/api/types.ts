// Firebase Crashlytics API response types

export type ErrorType = "FATAL" | "NON_FATAL" | "ANR";
export type IssueState = "OPEN" | "CLOSED" | "MUTED";
export type FrameOwner = "DEVELOPER" | "VENDOR" | "SYSTEM" | "PLATFORM" | "RUNTIME";

export interface Signal {
  signal: string;
  code: string;
}

export interface Variant {
  id: string;
  title: string;
  subtitle: string;
  sampleEvent?: string;
}

export interface Issue {
  id: string;
  title: string;
  subtitle: string;
  errorType: ErrorType;
  state: IssueState;
  sampleEvent: string;
  uri: string;
  firstSeenVersion: string;
  lastSeenVersion: string;
  signals: Signal[];
  name: string;
  variants: Variant[];
}

export interface Frame {
  line: number;
  file: string;
  symbol: string;
  library: string;
  owner: FrameOwner;
  blamed: boolean;
}

export interface Exception {
  type: string;
  reason: string;
  frames: Frame[];
  rawStackTrace: string;
}

export interface Thread {
  name: string;
  frames: Frame[];
  crashed: boolean;
}

export interface Device {
  model: string;
  manufacturer: string;
  architecture: string;
}

export interface OS {
  displayVersion: string;
  name: string;
  type: string;
}

export interface Version {
  displayVersion: string;
  buildVersion: string;
}

export interface Memory {
  used: number;
  free: number;
}

export interface CustomKey {
  key: string;
  value: string;
}

export interface Event {
  name: string;
  platform: string;
  eventId: string;
  eventTime: string;
  device: Device;
  operatingSystem: OS;
  version: Version;
  blameFrame: Frame;
  exceptions: Exception[];
  threads: Thread[];
  memory: Memory;
  customKeys: CustomKey[];
  logs: string;
}

// Paginated response wrappers

export interface TopIssuesResponse {
  issues: Issue[];
  nextPageToken?: string;
}

export interface ListEventsResponse {
  events: Event[];
  nextPageToken?: string;
}

// Reporting / metrics types

export interface IntervalMetrics {
  date: string;
  count: number;
  impactedDevices: number;
}

export interface Report {
  issueId: string;
  errorType: ErrorType;
  metrics: IntervalMetrics[];
}

export interface ReportGroup {
  groupKey: string;
  reports: Report[];
}
