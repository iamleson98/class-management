import {connect} from 'react-redux';

import {getRoles} from 'mattermost-redux/selectors/entities/roles_helpers';

import type {GlobalState} from 'types/store';

import SystemRoles from './system_roles';

function mapStateToProps(state: GlobalState) {
    return {
        roles: getRoles(state),
    };
}

export default connect(mapStateToProps)(SystemRoles);
