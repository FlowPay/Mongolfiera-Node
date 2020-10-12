export class Subscription<T> {
    topic: string
    recovers: Promise<void>[] = []
    watchers: Promise<void>[] = []
    actions: ((T) => Promise<void>)[] = []

    constructor(topic: string) {
        this.topic = topic
    }

    isWatching = () => this.recovers.length > 0
    isRecovering = () => this.watchers.length > 0
}
