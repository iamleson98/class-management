import type {GlobalState} from '@mattermost/types/store';

export const emptyLimits: () => GlobalState['entities']['cloud']['limits'] = () => ({
    limitsLoaded: true,
    limits: {},
});
