import React, {useCallback, useContext, useMemo} from 'react';
import {useStore, useSelector, useDispatch} from 'react-redux';
import {concat} from 'ramda';

import {DashLayoutPath} from '../types/component';
import {LoadingPayload} from '../actions/loading';

type LoadingFilterFunc = (loading: LoadingPayload) => boolean;

type LoadingOptions = {
    /**
     * Path to add after the current component if loading.
     * Ex `["props"]` will return true only for when that component load.
     */
    extraPath?: DashLayoutPath;
    /**
     * A raw path used instead of the current component.
     * Useful if you want the loading of a child component
     * as the path is available in `child.props.componentPath`.
     */
    rawPath?: DashLayoutPath;
    /**
     * Function used to filter the properties of the loading component.
     * Filter argument is an Entry of `{path, property, id}`.
     */
    filterFunc?: LoadingFilterFunc;
};

type DashContextType = {
    componentPath: DashLayoutPath;

    isLoading: (options?: LoadingOptions) => boolean;
    useLoading: (options?: LoadingOptions) => boolean;

    // Give access to the right store.
    useSelector: typeof useSelector;
    useDispatch: typeof useDispatch;
    useStore: typeof useStore;
};

export const DashContext = React.createContext<DashContextType>({} as any);

export type DashContextProviderProps = {
    children: JSX.Element;
    componentPath: DashLayoutPath;
};

export function DashContextProvider(props: DashContextProviderProps) {
    const {children, componentPath} = props;

    const stringPath = useMemo<string>(
        () => JSON.stringify(componentPath),
        [componentPath]
    );

    const store = useStore();

    /**
     * Synchronous version (kept for compatibility)
     */
    const isLoading = useCallback(
        (options?: LoadingOptions) => {
            const {extraPath, rawPath, filterFunc} = options || {};

            let basePath = componentPath;

            if (extraPath) {
                basePath = concat(componentPath, extraPath);
            } else if (rawPath) {
                basePath = rawPath;
            }

            const loadingPath = JSON.stringify(basePath);

            const loading = (store.getState() as any).loading || {};
            const load = loading[loadingPath] || [];

            return filterFunc
                ? load.filter(filterFunc).length > 0
                : load.length > 0;
        },
        [componentPath, store]
    );

    /**
     * 🔥 FIXED: reactive loading hook
     * Now matches loadingSelector behavior (prefix-based, not exact-path)
     */
    const useLoading = useCallback(
        (options?: LoadingOptions) => {
            const {filterFunc, extraPath, rawPath} = options || {};

            return useSelector((state: any) => {
                const loadingState = state.loading || {};

                let basePath = componentPath;

                if (extraPath) {
                    basePath = concat(componentPath, extraPath);
                } else if (rawPath) {
                    basePath = rawPath;
                }

                // Match Dash internal format used in loading reducer
                const stringBase = JSON.stringify(basePath);

                // Normalize to prefix form used by Dash loading tree
                const prefix = stringBase.slice(0, -1) + ','; // "[...," trick

                const matches = Object.entries(loadingState).some(
                    ([path, load]: [string, any]) => {
                        if (!path.startsWith(prefix) || !load?.length) {
                            return false;
                        }

                        if (filterFunc) {
                            return load.some(filterFunc);
                        }

                        return true;
                    }
                );

                return matches;
            });
        },
        [componentPath]
    );

    const ctxValue = useMemo(() => {
        return {
            componentPath,
            isLoading,
            useLoading,

            useSelector,
            useStore,
            useDispatch
        };
    }, [stringPath, componentPath]);

    return (
        <DashContext.Provider value={ctxValue}>{children}</DashContext.Provider>
    );
}

export function useDashContext() {
    const ctx = useContext(DashContext);
    if (!ctx) {
        // eslint-disable-next-line no-console
        console.error(
            'Dash Context was not found, component was rendered without a wrapper. Use `window.dash_component_api.ExternalWrapper` to make sure the component is properly connected.'
        );
    }
    return ctx || {};
}
