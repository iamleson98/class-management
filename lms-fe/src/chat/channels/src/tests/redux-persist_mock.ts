jest.mock('redux-persist', () => {
    const {combineReducers} = require('redux');
    const real = jest.requireActual('redux-persist');

    return {
        ...real,
        createTransform: () => {
            return {};
        },

        persistReducer: jest.fn().mockImplementation((config, reducers) => reducers),
        persistCombineReducers: (persistConfig: any, reducers: any) => combineReducers(reducers),
        persistStore: () => {
            return {
                pause: () => {},
                purge: () => Promise.resolve(),
                resume: () => {},
            };
        },
    };
});

export default {};
