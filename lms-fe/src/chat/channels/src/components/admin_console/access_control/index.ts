import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {searchAccessControlPolicies, deleteAccessControlPolicy} from 'mattermost-redux/actions/access_control';

import PolicyList from './policies';

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        searchPolicies: searchAccessControlPolicies,
        deletePolicy: deleteAccessControlPolicy,
    }, dispatch),
});

export default connect(null, mapDispatchToProps)(PolicyList);
