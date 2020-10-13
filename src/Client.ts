import {ChangeStream, Collection, Db, MongoClient, UpdateWriteOpResult} from "mongodb";
import {Message} from "./Event";
import {Subscription} from "./Subscription";

export class Client {
    public defaultTTL: number = 300
    private connection: Promise<MongoClient>
    private database: Db
    private readonly clientName: string;
    private subscriptions: { topic: string, subscription: Subscription<any> }[] = []

    public constructor(dbURI: string, dbName: string, clientName: string) {
        this.clientName = clientName
        this.connection = new MongoClient(dbURI).connect()
            .then(client => this.database = client.db(dbName))
            .then()
    }

    public static publish<T>(object: T, broker: Client, topic: string): Promise<void> {
        return broker.connection.then(_ => {
            const collection = broker.database.collection(topic)
            let timestamp = new Date()
            let expire = new Date(timestamp.getTime() + broker.defaultTTL)
            const message = { // TODO: Sostituire interface con class
                _id: null,
                topic,
                timestamp: timestamp.toISOString(),
                payload: object,
                expireAt: expire.toISOString(),
                acks: []
            }
            return collection.insertOne(message).then()
        });
    }

    public publish<T>(object: T, topic: string): Promise<void> {
        return Client.publish(object, this, topic).then()
    }

    public subscribe<T>(topic: string, action: (data: T) => Promise<void>): Promise<void> {
        return this.connection.then(_ => {
            const collection = this.database.collection(topic);

            if (!this.subscriptions[topic]) {
                this.createTTL(collection).then();
                this.subscriptions[topic] = new Subscription(topic);
            }

            let recover = this.recoverEvents(topic)
            let watcher = this.watch(collection)

            this.subscriptions[topic]?.actions.append(action)
            this.subscriptions[topic]?.recovers.append(recover)
            this.subscriptions[topic]?.watchers.append(watcher)

            return watcher.next()
        })
    }

    private writeAck<T>(event: Message<T>): Promise<UpdateWriteOpResult> {

        let collection = this.database.collection(event.topic)
        return collection.updateOne(
            {"_id": event._id},
            {"$push": {"acks": this.clientName}}
        )
    }

    private handle<T>(event: Message<T>): Promise<void> {
        let subscription = this.subscriptions[event.topic]
        return Promise.all(subscription.actions).then(_ => this.writeAck(event)).then();
    }

    private recoverEvents<T>(topic: string): Promise<void> {
        let query = {"acks": {"$nin": [this.clientName]}}

        return this.database.collection(topic)
            .find(query)
            .toArray()
            .then(documents => {
                documents.forEach(document => {
                    const event = document as Message<T>
                    if (event) {
                        this.handle(event).then();
                    }
                })
            })
    }

    private watch<T>(collection: Collection): ChangeStream {

        const watcher = collection.watch()
        return watcher.on('change', (documents) => {
            console.log(documents)
            if (documents.operationType != 'insert') {
                return
            }
            const event = documents.fullDocument as Message<T>
            if (!event || event.acks.includes(this.clientName)) {
                return;
            }

            this.handle(event).then()
        })

    }

    private createTTL(collection: Collection): Promise<void> {
        return collection.createIndex(
            {"expireAt": 1},
            {
                name: "expire",
                expireAfterSeconds: this.defaultTTL
            }).then()
    }
}
