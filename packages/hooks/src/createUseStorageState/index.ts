/* eslint-disable no-empty */
import { useState, useEffect } from 'react';
import useMemoizedFn from '../useMemoizedFn';
import useUpdateEffect from '../useUpdateEffect';
import { isFunction } from '../utils';

export interface IFuncUpdater<T> {
  (previousState?: T): T;
}
export interface IFuncStorage {
  (): Storage;
}

export interface Options<T> {
  serializer?: (value: T) => string;
  deserializer?: (value: string) => T;
}

export interface OptionsWithDefaultValue<T> extends Options<T> {
  defaultValue: T | IFuncUpdater<T>;
}

export type StorageStateResult<T> = [T | undefined, (value?: T | IFuncUpdater<T>) => void];
export type StorageStateResultHasDefaultValue<T> = [T, (value?: T | IFuncUpdater<T>) => void];

export function createUseStorageState(getStorage: () => Storage | undefined) {
  function useStorageState<T = any>(key: string, options?: Options<T>): StorageStateResult<T>;
  function useStorageState<T>(
    key: string,
    options: OptionsWithDefaultValue<T>,
  ): StorageStateResultHasDefaultValue<T>;

  function useStorageState<T>(key: string, options?: Options<T> & OptionsWithDefaultValue<T>) {
    let storage: Storage | undefined;

    // https://github.com/alibaba/hooks/issues/800
    try {
      storage = getStorage();
    } catch (err) {
      console.error(err);
    }

    const serializer = (value: T) => {
      if (options?.serializer) {
        return options?.serializer(value);
      }
      return JSON.stringify(value);
    };

    const deserializer = (value: string) => {
      if (options?.deserializer) {
        return options?.deserializer(value);
      }
      return JSON.parse(value);
    };

    function getStoredValue() {
      try {
        const raw = storage?.getItem(key);
        if (raw) {
          return deserializer(raw);
        }
      } catch (e) {
        console.error(e);
      }
      if (isFunction(options?.defaultValue)) {
        return options?.defaultValue();
      }
      return options?.defaultValue;

      // if (options?.defaultValue === undefined) {
      //   return;
      // }
      // const value = isFunction(options?.defaultValue)
      //   ? options?.defaultValue()
      //   : options?.defaultValue;

      // storage?.setItem(key, serializer(value));
      // return value;
    }

    const [state, setState] = useState<T | undefined>(() => getStoredValue());

    useUpdateEffect(() => {
      setState(getStoredValue());
    }, [key]);

    const updateState = (value?: T | IFuncUpdater<T>) => {
      if (typeof value === 'undefined') {
        setState(undefined);

        const se = new StorageEvent('storage', {
          cancelable: false,
          bubbles: false,
          key,
          newValue: null,
          oldValue: storage?.getItem(key),
          storageArea: storage,
          url: location.href,
        });
        window.dispatchEvent(se);

        storage?.removeItem(key);
      } else if (isFunction(value)) {
        const currentState = value(state);
        try {
          setState(currentState);

          const se = new StorageEvent('storage', {
            cancelable: false,
            bubbles: false,
            key,
            newValue: serializer(currentState),
            oldValue: storage?.getItem(key),
            storageArea: storage,
            url: location.href,
          });
          window.dispatchEvent(se);

          storage?.setItem(key, serializer(currentState));
        } catch (e) {
          console.error(e);
        }
      } else {
        try {
          setState(value);

          const se = new StorageEvent('storage', {
            cancelable: false,
            bubbles: false,
            key,
            newValue: serializer(value),
            oldValue: storage?.getItem(key),
            storageArea: storage,
            url: location.href,
          });
          window.dispatchEvent(se);

          storage?.setItem(key, serializer(value));
        } catch (e) {
          console.error(e);
        }
      }
    };

    useEffect(() => {
      const handleStorage = (event: StorageEvent) => {
        if (event.storageArea === storage) {
          // handle clear event
          if (event.key === null) {
            setState(undefined);
          } else if (event.key === key) {
            // handle removeItem event
            if (event.newValue === null) {
              setState(undefined);
            } else {
              setState(deserializer(event.newValue));
            }
          }
        }
      };

      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }, []);

    return [state, useMemoizedFn(updateState)];
  }
  return useStorageState;
}
