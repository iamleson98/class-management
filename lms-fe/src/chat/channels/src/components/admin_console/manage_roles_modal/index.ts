import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {updateUserRoles} from 'mattermost-redux/actions/users';

import type {GlobalState} from 'types/store';

import ManageRolesModal from './manage_roles_modal';

function mapStateToProps(state: GlobalState) {
    return {
        userAccessTokensEnabled: state.entities.admin.config.ServiceSettings!.EnableUserAccessTokens,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            updateUserRoles,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ManageRolesModal);
