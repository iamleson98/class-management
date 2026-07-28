import {connect} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {makeGetFilesForPost} from 'mattermost-redux/selectors/entities/files';

import CommentedOnFilesMessage from './commented_on_files_message';

type OwnProps = {

    /*
     * The id of the post that was commented on
     */
    parentPostId: string;
};

function makeMapStateToProps() {
    const selectFileInfosForPost = makeGetFilesForPost();

    return function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
        let fileInfos;
        if (ownProps.parentPostId) {
            fileInfos = selectFileInfosForPost(state, ownProps.parentPostId);
        }

        return {
            fileInfos,
        };
    };
}

export default connect(makeMapStateToProps)(CommentedOnFilesMessage);
