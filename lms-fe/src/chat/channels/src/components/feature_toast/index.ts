export class FeaturesToAnnounce {
    static MARK_ALL_AS_READ_SHORTCUT = 'mark_all_as_read_shortcut';
}

export const createHasSeenFeatureSuffix = (userId: string, featureName: string) =>
    `${userId}_${featureName}`;
