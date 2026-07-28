import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {checkIfTeamExists, createTeam} from 'mattermost-redux/actions/teams';

import CreateTeamForm from './create_team_form';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            checkIfTeamExists,
            createTeam,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(CreateTeamForm);
