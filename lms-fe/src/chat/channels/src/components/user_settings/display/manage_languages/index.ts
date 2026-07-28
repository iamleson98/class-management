import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {patchUser, updateMe} from 'mattermost-redux/actions/users';

import {getLanguages} from 'i18n/i18n';

import type {GlobalState} from 'types/store';

import ManageLanguages from './manage_languages';

function mapStateToProps(state: GlobalState) {
    return {
        locales: getLanguages(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            updateMe,
            patchUser,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ManageLanguages);
