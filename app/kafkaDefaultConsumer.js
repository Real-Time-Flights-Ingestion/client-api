"use strict"

import settings from "./settings.js"
import { kafkaClient, iHeadersToStringObj, getOffsets } from "./kafka.js"

// to keep an active connection with Kafka
// note: cannot do a unique connection because cannot subscribe after connection is running
// and, additionally, an unsubscribe function does not exist (https://github.com/tulios/kafkajs/issues/947)
const defaultConsumers = {
    // something like
    // "rtifi.airport.ellx": {
    //     consumer: Kafka.Consumer,
    //     cache: [message_t, message_t-1, ..., message_t-(defaultCache-1)]
    //     subscribers: Set[callbackFuncSubscriber1, callbackFuncSubscriber2],
    // },
    // ...
}

for (const topic of settings.kafka.defaultPermanentListeners) {
    realtimeSubscribe(topic, obj => null)
}

async function subscribeNewTopic(topic) {
    if (defaultConsumers[topic]) {
        throw new Error("Already subscribed to " + topic)
    } else {
        const realtimeConsumer = kafkaClient.consumer({
            groupId: settings.kafka.consumerGroupPrefix + settings.kafka.defaultConsumerGroup + "-" + topic,
            allowAutoTopicCreation: false
        })
        defaultConsumers[topic] = {
            consumer: realtimeConsumer,
            cache: [],
            subscribers: new Set(),
        }
        try {
            await realtimeConsumer.connect()
            await realtimeConsumer.subscribe({
                topics: [topic],
                // this is valid only for new subscribers groups,
                // but if you want to start from the latest offset
                // you have to use the seek operation
                // -> see after consumer.run()
                fromBeginning: false,
            })
            const offsets = await getOffsets(topic)
            await realtimeConsumer.run({
                autoCommit: true,
                autoCommitInterval: 3000,
                eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {
                    const obj = {
                        topic: topic,
                        partition: partition,
                        key: message.key.toString(),
                        value: message.value.toString(),
                        headers: iHeadersToStringObj(message.headers),
                        timestamp: message.timestamp,
                        attributes: message.attributes,
                        offset: message.offset,
                        size: message.size,
                        disconnect: () => realtimeUnsubscribe(topic, callbackFunc),
                    }
                    console.log("MESSAGE obj (realtimeConsumer):", obj)
                    if (defaultConsumers[topic]) {
                        if (defaultConsumers[topic].subscribers) {
                            // forward
                            for (const callbackFunc of defaultConsumers[topic].subscribers) {
                                callbackFunc(obj)
                            }
                            // cache
                            if (settings.kafka.defaultCache > 0) {
                                while (defaultConsumers[topic].cache.length >= settings.kafka.defaultCache) {
                                    defaultConsumers[topic].cache.shift()
                                }
                                defaultConsumers[topic].cache.push(obj)
                            }
                        } else {
                            console.warn("received message of topic with null subscribers")
                            unsubscribeActiveTopic(topic)
                        }
                    } else {
                        console.warn("received message of not active topic")
                    }
                },
            })
            for (const partitionOffset of offsets) {
                realtimeConsumer.seek({ topic: topic, partition: partitionOffset.partition, offset: partitionOffset.high })
            }
        } catch (error) {
            unsubscribeActiveTopic(topic)
            throw error
        }
    }
}

async function unsubscribeActiveTopic(topic, force = false) {
    if (defaultConsumers[topic]) {
        if (!force && defaultConsumers[topic].length > 0) {
            throw new Error("Cannot delete subscription currently in use to " + topic)
        } else {
            // TODO handle error
            await defaultConsumers[topic].consumer.disconnect()
            delete defaultConsumers[topic]
        }
    } else {
        throw new Error("Not subscribed to " + topic)
    }
}

export async function realtimeSubscribe(topic, callback) {
    console.log("realtime subscription to " + topic)
    if (!defaultConsumers[topic]) {
        console.log("activating new subscription to " + topic)
        await subscribeNewTopic(topic)
    }
    if (defaultConsumers[topic].subscribers.has(callback)) {
        console.warn("callback already in subscribers set")
    } else {
        // since it's a set, adding multiple times is a no-op
        defaultConsumers[topic].subscribers.add(callback)
    }
    console.log("now " + topic + " has " + defaultConsumers[topic].subscribers.size + " subscriptions")
}

export async function realtimeUnsubscribe(topic, callback) {
    console.log("realtime unsubscription to " + topic)
    if (!defaultConsumers[topic]) {
        throw new Error("Cannot unsubscribe from not tracked topic " + topic)
    } else {
        // since it's a set, deleting multiple times is a no-op (but returns false)
        const success = defaultConsumers[topic].subscribers.delete(callback)
        if (!success) {
            console.warn("callback was not in subscribers set")
        }
        console.log("now " + topic + " has " + defaultConsumers[topic].subscribers.size + " subscriptions")
        if (defaultConsumers[topic].subscribers.size <= 0) {
            await unsubscribeActiveTopic(topic)
        }
    }
}

export function cacheGet(topic, n = settings.kafka.defaultCache, allowLess = false) {
    if (!defaultConsumers[topic]) {
        throw new Error("Topic is not currently tracked")
    } else if (n <= 0) {
        throw new Error("Asked an invalid number of messages")
    } else if (n > settings.kafka.defaultCache ) {
        throw new Error("Asked a number of messages greater than cache capacity")
    } else {
        if (defaultConsumers[topic].cache) {
            // slice does not throw an error if second argument is greater than length
            // it just returns as may values as possible
            const values = defaultConsumers[topic].cache.slice(0, n)
            if (allowLess || values.length === n) {
                return values
            } else {
                throw new Error("Cache is not full enough yet")
            }
        } else {
            throw new Error("Cannot find the cache, this should not happen")
        }
    }
}