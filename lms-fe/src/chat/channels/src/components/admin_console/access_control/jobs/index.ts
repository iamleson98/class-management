import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {createJob, getJobsByType} from 'mattermost-redux/actions/jobs';

import AccessControlSyncJobTable from './access_control_sync_job_table';

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        createJob,
        getJobsByType,
    }, dispatch),
});

export default connect(null, mapDispatchToProps)(AccessControlSyncJobTable);
