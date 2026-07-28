import type {Post} from '@mattermost/types/posts';

import {getPostsByIdsBatched} from 'mattermost-redux/actions/posts';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {makeUseEntity} from './useEntity';

export const usePost = makeUseEntity<Post>({
    name: 'usePost',
    fetch: (postId: string) => getPostsByIdsBatched([postId]),
    selector: getPost,
});
