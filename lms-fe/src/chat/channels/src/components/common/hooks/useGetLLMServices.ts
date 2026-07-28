import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getLLMServices as getLLMServicesAction} from 'mattermost-redux/actions/agents';
import {getLLMServices} from 'mattermost-redux/selectors/entities/agents';

export default function useGetLLMServices() {
    const dispatch = useDispatch();
    const services = useSelector(getLLMServices);

    useEffect(() => {
        dispatch(getLLMServicesAction());
    }, [dispatch]);

    return services;
}

