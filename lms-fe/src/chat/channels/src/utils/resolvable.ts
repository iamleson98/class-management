type ResolvableFunction<TVal, TArg, TArg2> = (arg: TArg, arg2: TArg2) => TVal;

export type Resolvable<TVal, TArg = undefined, TArg2 = undefined> = ResolvableFunction<TVal, TArg, TArg2> | TVal;

export function resolve<TVal, TArg = undefined, TArg2 = undefined>(
    prop: Resolvable<TVal, TArg, TArg2>,
    arg: TArg,
    arg2: TArg2,
): TVal {
    return typeof prop === 'function' ? (prop as ResolvableFunction<TVal, TArg, TArg2>)(arg, arg2) : prop;
}
