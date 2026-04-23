export const BubblePrivacy = {
  PUBLIC: 'Public',
  REQUEST_TO_JOIN: 'Request to Join',
  PRIVATE: 'Private',
} as const;

export type BubblePrivacyValue = typeof BubblePrivacy[keyof typeof BubblePrivacy];

export function isRequestBased(privacy: string | undefined | null): boolean {
  return privacy === BubblePrivacy.REQUEST_TO_JOIN || privacy === BubblePrivacy.PRIVATE || privacy === 'Request';
}
