import type {CloudUsage} from '@mattermost/types/cloud';
import type {GlobalState} from '@mattermost/types/store';

export function getUsage(state: GlobalState): CloudUsage {
    return state.entities.usage;
}
