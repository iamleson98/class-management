import {connect} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import ActionButton from './action_button';

function mapStateToProps(state: GlobalState) {
    return {
        theme: getTheme(state),
    };
}

export default connect(mapStateToProps)(ActionButton);
