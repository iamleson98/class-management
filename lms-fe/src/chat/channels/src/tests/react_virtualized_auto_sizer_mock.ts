jest.mock('react-virtualized-auto-sizer', () => {
    return function AutoSizer({children}: {children: any}) {
        return children({height: 100, width: 100});
    };
});

export default {};
