import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {searchPermissionPolicies, deleteAccessControlPolicy} from 'mattermost-redux/actions/access_control';

import PermissionPolicyList from './permission_policies';

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        searchPolicies: searchPermissionPolicies,
        deletePolicy: deleteAccessControlPolicy,
    }, dispatch),
});

export default connect(null, mapDispatchToProps)(PermissionPolicyList);
