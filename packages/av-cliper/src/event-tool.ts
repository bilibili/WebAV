type EventKey = string | symbol;

type EventToolType = Record<EventKey, (...args: any[]) => any>;

/**
 * 事件工具类
 *
 * @example
 * const evtTool = new EventTool<{
 *   timeupdate: (time: number) => void;
 *   paused: () => void;
 *   playing: () => void;
 * }>()
 * evtTool.on('paused', () => {})
 * evtTool.emit('paused')
 */
export class EventTool<T extends EventToolType> {
  /**
   * 在两个 EventTool 实例间转发消息
   * @param from
   * @param to
   * @param evtTypes 需转发的消息类型
   *
   * @example
   * EventTool.forwardEvent(from, to, ['evtName']),
   */
  static forwardEvent<
    T1 extends EventToolType,
    T2 extends EventToolType,
    EvtType extends (keyof T1 | [keyof T1, keyof T2])[],
  >(
    from: { on: EventTool<T1>['on'] },
    to: { emit: EventTool<T2>['emit'] },
    // 转发的事件名，如果 evtTypes 为序对（元组）表示事件名称需要映射
    evtTypes: EvtType,
  ): () => void {
    const removeHandlers = evtTypes.map((evtType) => {
      const [fromEvtType, toEvtType] = (
        Array.isArray(evtType) ? evtType : [evtType, evtType]
      ) as [keyof T1, keyof T2];

      // @ts-expect-error
      return from.on(fromEvtType, (...args) => {
        // @ts-expect-error
        to.emit(toEvtType, ...args);
      });
    });
    return () => {
      removeHandlers.forEach((fn) => fn());
    };
  }

  #listeners = new Map<keyof T, Set<T[keyof T]>>();

  /**
   * 监听 EventType 中定义的事件
   */
  on = <Type extends keyof T>(type: Type, listener: T[Type]): (() => void) => {
    const handlers = this.#listeners.get(type) ?? new Set<T[keyof T]>();
    handlers.add(listener);

    if (!this.#listeners.has(type)) {
      this.#listeners.set(type, handlers);
    }

    return () => {
      handlers.delete(listener);
      if (handlers.size === 0) {
        this.#listeners.delete(type);
      }
    };
  };

  /**
   * 监听事件，首次触发后自动移除监听
   *
   * 期望回调一次的事件，使用 once; 期望多次回调使用 on
   */
  once = <Type extends keyof T>(
    type: Type,
    listener: T[Type],
  ): (() => void) => {
    // @ts-ignore
    const off = this.on(type, (...args) => {
      off();
      listener(...args);
    });

    return off;
  };

  /**
   * 触发事件
   * @param type
   * @param args
   * @returns
   */
  emit = <Type extends keyof T>(
    type: Type,
    ...args: Type extends string
      ? T[Type] extends (...args: any[]) => any
        ? Parameters<T[Type]>
        : never
      : never
  ): void => {
    const handlers = this.#listeners.get(type);
    if (handlers == null) return;

    handlers.forEach((handler) => handler(...args));
  };

  destroy(): void {
    this.#listeners.clear();
  }
}
