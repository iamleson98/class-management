import type {GlobalState} from '@mattermost/types/store';

export function getDisplayableErrors(state: GlobalState) {
    return state.errors.filter((error) => error.displayable);
}
