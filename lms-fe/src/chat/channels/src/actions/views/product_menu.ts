import {ActionTypes} from 'utils/constants';

export function setProductMenuSwitcherOpen(open: boolean) {
    return {
        type: ActionTypes.SET_PRODUCT_SWITCHER_OPEN,
        open,
    };
}
