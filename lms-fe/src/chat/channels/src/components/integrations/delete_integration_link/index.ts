import {connect} from 'react-redux';

import {openModal} from 'actions/views/modals';

import DeleteIntegrationLink from './delete_integration_link';

const mapDispatchToProps = {
    openModal,
};

export default connect(null, mapDispatchToProps)(DeleteIntegrationLink);
