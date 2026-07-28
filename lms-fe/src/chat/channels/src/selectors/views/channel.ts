import type {GlobalState} from 'types/store';

export const getLastPostsApiTimeForChannel = (state: GlobalState, channelId: string) => state.views.channel.lastGetPosts[channelId];
export const getToastStatus = (state: GlobalState) => state.views.channel.toastStatus;
