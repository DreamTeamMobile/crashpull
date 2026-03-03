// Firebase Crashlytics API response types

export type ErrorType = "FATAL" | "NON_FATAL" | "ANR";
export type IssueState = "OPEN" | "CLOSED" | "MUTED";
export type FrameOwner = "DEVELOPER" | "VENDOR" | "SYSTEM" | "PLATFORM" | "RUNTIME";

export interface Signal {
  signal: string;
  description?: string;
}

export interface Variant {
  id: string;
  sampleEvent?: string;
  uri?: string;
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

/** Issue enriched with metrics from topIssues response */
export interface EnrichedIssue extends Issue {
  eventCount?: number;
  impactedDevicesCount?: number;
  createTime?: string;
}

export interface Frame {
  line: string;
  file: string;
  symbol: string;
  library: string;
  owner: FrameOwner;
  blamed?: boolean;
  offset?: string;
}

export interface Exception {
  type: string;
  exceptionMessage: string;
  frames: Frame[];
  rawStackTrace: string;
  title?: string;
  subtitle?: string;
  nested?: boolean;
  blamed?: boolean;
}

export interface Thread {
  name: string;
  title?: string;
  frames: Frame[];
  crashed: boolean;
}

export interface Device {
  model: string;
  manufacturer: string;
  architecture: string;
  displayName?: string;
  marketingName?: string;
  companyName?: string;
  formFactor?: string;
}

export interface OS {
  displayVersion: string;
  os: string;
  type: string;
  modificationState?: string;
  deviceType?: string;
  displayName?: string;
}

export interface Version {
  displayVersion: string;
  buildVersion: string;
}

export interface Memory {
  used: string;
  free: string;
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
  bundleOrPackage?: string;
  receivedTime?: string;
  issue?: string;
  installationUuid?: string;
  crashlyticsSdkVersion?: string;
  appOrientation?: string;
  deviceOrientation?: string;
  storage?: Record<string, string>;
  processState?: string;
  issueVariant?: string;
}

// Raw API response types (reports/topIssues)

export interface TopIssueMetrics {
  startTime: string;
  endTime: string;
  eventsCount: string;
  impactedUsersCount: string;
  sessionsCount?: string;
}

export interface TopIssueGroup {
  issue: Issue;
  metrics: TopIssueMetrics[];
}

export interface TopIssuesRawResponse {
  groups?: TopIssueGroup[];
  nextPageToken?: string;
}

// Normalized response used by commands

export interface TopIssuesResponse {
  issues: EnrichedIssue[];
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
