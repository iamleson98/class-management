import type {RemoteClusterInfo} from '@mattermost/types/shared_channels';

export type WorkspaceWithStatus = RemoteClusterInfo & {pendingSave?: boolean};
