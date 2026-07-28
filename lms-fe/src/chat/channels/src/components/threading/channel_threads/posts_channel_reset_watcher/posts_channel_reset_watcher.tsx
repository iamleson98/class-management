import {useEffect, useRef} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import {resetReloadPostsInChannel} from 'mattermost-redux/actions/posts';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';

const PostsChannelResetWatcher = () => {
    const dispatch = useDispatch();
    const isCRTEnabled = useSelector(isCollapsedThreadsEnabled);
    const loaded = useRef(false);
    useEffect(() => {
        if (loaded.current) {
            dispatch(resetReloadPostsInChannel());
        } else {
            loaded.current = true;
        }
    }, [isCRTEnabled]);
    return null;
};

export default PostsChannelResetWatcher;
