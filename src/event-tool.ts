export class EventTool<T extends Record<P, (...args: any[]) => any> = any, P extends string | number | symbol = keyof T> {
  /**
   * 在两个 EventBus 实例间转发消息
   * @param from
   * @param to
   * @param evtTypes 需转发的消息类型
   * @returns
   */
  static forwardEvent <O, E>(
    from: { on: O },
    to: { emit: E },
    // 转发的事件名，如果 evtTypes 为序对（元组）表示事件名称需要映射
    evtTypes: string[] | Array<[string, string]>
  ): () => void {
    const removeHandlers = evtTypes.map((evtType: any) => {
      const [fromEvtType, toEvtType] = Array.isArray(evtType) ? evtType : [evtType, evtType]
      // @ts-expect-error
      return from.on(
        fromEvtType,
        // @ts-expect-error
        (...args: any[]) => to.emit(toEvtType, ...args)
      )
    })
    return () => {
      removeHandlers.forEach(fn => fn())
    }
  }

  #listeners = new Map<keyof T, Set<T[keyof T]>>()

  getHandlers (type: keyof T): Set<T[keyof T]> {
    return this.#listeners.get(type) ?? new Set()
  }

  /**
   * 监听EventType中定义的事件，调用方【必须】在合适的时机自行移除监听
   */
  on = <Type extends keyof T>(type: Type, listener: T[Type]): () => void => {
    const handlers = this.#listeners.get(type) ?? new Set<T[keyof T]>()
    handlers.add(listener)

    if (!this.#listeners.has(type)) {
      this.#listeners.set(type, handlers)
    }

    return () => {
      handlers.delete(listener)
      if (handlers.size === 0) {
        this.#listeners.delete(type)
      }
    }
  }

  /**
   * 监听事件，首次触发后自动移除监听
   * 期望回调一次的事件，使用once; 期望多次回调使用on
   */
  once <Type extends keyof T>(type: Type, listener: T[Type]): () => void {
    // @ts-expect-error
    const off = this.on(type, (...args: any[]) => {
      off()
      listener(...args)
    })

    return off
  }

  /**
   * 触发事件
   * @param type
   * @param args
   * @returns
   */
  emit = <Type extends keyof T>(type: Type, ...args: Type extends string ? T[Type] extends (...args: any[]) => any ? Parameters<T[Type]> : any[] : any[]): void => {
    const handlers = this.#listeners.get(type)
    if (handlers == null) return

    handlers.forEach((handler) => handler(...args))
  }

  destroy (): void {
    this.#listeners.clear()
  }
}
