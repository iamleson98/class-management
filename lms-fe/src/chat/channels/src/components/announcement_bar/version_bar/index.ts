import {connect} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import VersionBar from './version_bar';

function mapStateToProps(state: GlobalState) {
    return {
        buildHash: state.entities.general.config.BuildHash,
    };
}

export default connect(mapStateToProps)(VersionBar);
