export interface Message<T> {
    _id
    topic: string
    timestamp: Date
    payload: T
    expireAt: Date
    acks: string[]
}
