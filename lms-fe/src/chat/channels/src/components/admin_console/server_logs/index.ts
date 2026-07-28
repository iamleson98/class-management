import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getLogs, getPlainLogs} from 'mattermost-redux/actions/admin';
import * as Selectors from 'mattermost-redux/selectors/entities/admin';

import type {GlobalState} from 'types/store';

import Logs from './logs';

function mapStateToProps(state: GlobalState) {
    const config = Selectors.getConfig(state);

    return {
        logs: Selectors.getAllLogs(state),
        plainLogs: Selectors.getPlainLogs(state),
        isPlainLogs: config.LogSettings?.FileJson === false,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getLogs,
            getPlainLogs,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Logs);
