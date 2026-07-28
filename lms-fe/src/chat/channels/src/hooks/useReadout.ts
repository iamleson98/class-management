import {useCallback} from 'react';
import {useDispatch} from 'react-redux';

import {setReadout} from 'actions/views/root';

export const useReadout = () => {
    const dispatch = useDispatch();

    const readAloud = useCallback((message: string) => {
        dispatch(setReadout(message));
    }, [dispatch]);

    return readAloud;
};
