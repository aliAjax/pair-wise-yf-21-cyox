/**
 * 本地 React 类型垫片：项目未打包 @types/react，为遵守“不新增依赖”，
 * 仅声明本项目实际使用到的 React API 与 DOM 事件形状；
 * 业务领域类型仍由 src/types.ts 完整约束。
 */
declare module "react" {
  export type ReactNode = unknown;

  export function useState<T>(
    initialState: T | (() => T)
  ): [T, (value: T | ((prev: T) => T)) => void];

  export function useEffect(
    effect: () => void | (() => void),
    deps?: readonly unknown[]
  ): void;

  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;

  export function useSyncExternalStore<T>(
    subscribe: (onChange: () => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot?: () => T
  ): T;

  const React: {
    StrictMode: (props: { children?: ReactNode }) => ReactNode;
  };
  export default React;
}

declare module "react/jsx-runtime" {
  export const jsx: (...args: unknown[]) => unknown;
  export const jsxs: (...args: unknown[]) => unknown;
  export const Fragment: unknown;
}

declare module "react-dom/client" {
  export function createRoot(container: Element | DocumentFragment): {
    render(node: unknown): void;
  };
}

declare namespace JSX {
  /** 自动应用于所有 JSX 元素的属性（等价 React 类型中的 key 处理） */
  interface IntrinsicAttributes {
    key?: string | number;
  }

  interface ChangeTarget {
    value: string;
  }

  interface ChangeLike {
    target: ChangeTarget;
  }

  /** 覆盖项目用到的内置标签：给出事件参数形状，其余属性放开 */
  interface IntrinsicElements {
    [elemName: string]: {
      children?: unknown;
      onChange?: (event: ChangeLike) => void;
      onClick?: (event: ChangeLike) => void;
      [attrName: string]: unknown;
    };
  }
}
