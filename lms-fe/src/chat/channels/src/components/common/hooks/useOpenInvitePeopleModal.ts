import {useCallback} from 'react';
import {useDispatch} from 'react-redux';

import {openModal} from 'actions/views/modals';

import InvitationModal from 'components/invitation_modal';

import {ModalIdentifiers} from 'utils/constants';

export default function useOpenInvitePeopleModal() {
    const dispatch = useDispatch();
    return useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.INVITATION,
            dialogType: InvitationModal,
        }));
    }, [dispatch]);
}
