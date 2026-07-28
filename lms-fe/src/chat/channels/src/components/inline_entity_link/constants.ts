export const InlineEntityTypes = {
    POST: 'POST',
    CHANNEL: 'CHANNEL',
    TEAM: 'TEAM',
} as const;

export type InlineEntityType = typeof InlineEntityTypes[keyof typeof InlineEntityTypes];

