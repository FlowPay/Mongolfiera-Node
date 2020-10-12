import {Client} from "../src/Client";
import { expect } from 'chai';

describe('Client tests', () => { // the tests container

    it('Generic test', () => { // the single test

        const client = new Client(
            "mongodb://localhost:30000/?replicaSet=rs0",
            "BrokerNodeTest",
            "LibTestClient"
        )

        const payload = "Hello World"
        client.subscribe("lib/testGeneric", (data: string) => {
            return Promise.bind(promise => {
                expect(data).equal(payload)
            });
        })

        client.publish(payload, "lib/testGeneric")
    });
})
