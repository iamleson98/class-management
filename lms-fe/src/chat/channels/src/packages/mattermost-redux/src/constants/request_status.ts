import type {RequestStatusOption} from '@mattermost/types/requests';

const status: Record<string, RequestStatusOption> = {
    NOT_STARTED: 'not_started',
    STARTED: 'started',
    SUCCESS: 'success',
    FAILURE: 'failure',
    CANCELLED: 'cancelled',
};

export default status;
