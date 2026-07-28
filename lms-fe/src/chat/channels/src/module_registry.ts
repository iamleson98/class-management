const modules: Record<string, unknown> = {};

export const getModule = <T>(name: string) => {
    return modules[name] as T;
};

export const setModule = <T>(name: string, component: T) => {
    if (modules[name]) {
        return false;
    }

    modules[name] = component;
    return true;
};
