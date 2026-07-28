import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {autocompleteUsers} from 'actions/user_actions';

import UserAutocompleteSetting from './user_autocomplete_setting';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            autocompleteUsers,
        }, dispatch),
    };
}
export default connect(null, mapDispatchToProps)(UserAutocompleteSetting);
