export type CheckSeverity = "info" | "warning" | "danger";

export interface CheckMessage {
  code: string;
  severity: CheckSeverity;
  title: string;
  details?: string;
  help?: string;
}

export function makeMsg(
  code: string,
  severity: CheckSeverity,
  title: string,
  details?: string,
  help?: string
): CheckMessage {
  return { code, severity, title, details, help };
}
