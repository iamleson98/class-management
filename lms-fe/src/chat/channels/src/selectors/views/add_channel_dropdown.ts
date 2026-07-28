import type {GlobalState} from 'types/store';

export function isAddChannelCtaDropdownOpen(state: GlobalState) {
    return state.views.addChannelCtaDropdown.isOpen;
}
