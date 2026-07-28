import type {GlobalState} from 'types/store';

export function getAnnouncementBarCount(state: GlobalState) {
    return state.views.announcementBar.announcementBarState.announcementBarCount;
}
