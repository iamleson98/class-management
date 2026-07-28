export type LimitsState = {
    serverLimits: ServerLimits;
};

export type ServerLimits = {
    activeUserCount: number;
    maxUsersLimit: number;
    maxUsersHardLimit?: number;

    // Post history limit fields
    lastAccessiblePostTime?: number; // Timestamp of the last accessible post (0 if no limits)
    postHistoryLimit?: number; // The actual message history limit value (0 if no limits)

    singleChannelGuestCount?: number;
    singleChannelGuestLimit?: number;
};
