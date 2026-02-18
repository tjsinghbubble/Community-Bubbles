import { Filter } from "bad-words";

const filter = new Filter();

export interface ModerationResult {
  flagged: boolean;
  field?: string;
  message?: string;
}

export function moderateText(fields: Record<string, string | string[] | undefined | null>): ModerationResult {
  for (const [fieldName, value] of Object.entries(fields)) {
    if (!value) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && filter.isProfane(item)) {
          return {
            flagged: true,
            field: fieldName,
            message: `Your ${fieldName} contains inappropriate language. Please revise and try again.`,
          };
        }
      }
    } else if (typeof value === "string" && filter.isProfane(value)) {
      return {
        flagged: true,
        field: fieldName,
        message: `Your ${fieldName} contains inappropriate language. Please revise and try again.`,
      };
    }
  }
  return { flagged: false };
}
