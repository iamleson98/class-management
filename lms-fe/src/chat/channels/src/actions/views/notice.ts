import {ActionTypes} from 'utils/constants';

export function dismissNotice(type: string) {
    return {
        type: ActionTypes.DISMISS_NOTICE,
        data: type,
    };
}
