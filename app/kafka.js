"use strict"

import { Kafka } from "kafkajs"

const kafkaClient = new Kafka({
    clientId: "client-api",
    brokers: ["kafka:9092"]
})

const admin = kafkaClient.admin() // to fetch metadata, offset in particular

function iHeadersToStringObj(IHeaders) {
    // IHeaders interface (TypeScript):
    //   interface IHeaders {
    //     [key: string]: Buffer | string | (Buffer | string)[] | undefined
    //   }
    // Objective: only strings, no buffers
    //   interface IHeaders {
    //     [key: string]: string | string[] | undefined
    //   }
    const headers = {}
    for (let key in IHeaders) {
        if (IHeaders[key] instanceof Buffer) {
            headers[key] = IHeaders[key].toString();
        } else if (Array.isArray(IHeaders[key])) {
            headers[key] = IHeaders[key].map(item => item instanceof Buffer ? item.toString() : item);
        } else {
            headers[key] = IHeaders[key];
        }
    }
    return headers
}

async function getOffsets(topic) {
    await admin.connect()
    const offsets = await admin.fetchTopicOffsets(topic)
    // something like:
    // [
    //   { partition: 0, offset: '31004', high: '31004', low: '421' },
    //   { partition: 1, offset: '54312', high: '54312', low: '3102' },
    //   { partition: 2, offset: '32103', high: '32103', low: '518' },
    //   { partition: 3, offset: '28', high: '28', low: '0' },
    // ]
    // but we have just one partition for now
    // 
    // remember: offset high does not exist, the last message has offset high-1
    await admin.disconnect()
    console.log(offsets)
    return offsets
}

export async function consume(topic, consumerGroup, callback, lookBack = 0, startOffset = null) {
    // create consumer
    const consumer = kafkaClient.consumer({
        groupId: "client-api-" + consumerGroup
    })
    // prepare to seek back messages if needed
    // startOffset has precedence over lookBack
    var seekOffset = null
    if (startOffset !== null) {
        seekOffset = startOffset
    } else if (lookBack > 0) {
        const offsets = await getOffsets(topic)
        seekOffset = offsets[0].high - lookBack
    }
    if (seekOffset < 0) {
        seekOffset = 0
    }
    console.log("consume() offset:", seekOffset)
    // subscribe and await confirmation
    await consumer.subscribe({topics: [topic]})
    // launch message listener
    consumer.run({
        eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {
            console.log("MESSAGE:", message)
            callback({
                topic: topic,
                partition: partition,
                key: message.key.toString(),
                value: message.value.toString(),
                headers: iHeadersToStringObj(message.headers),
                timestamp: message.timestamp,
                attributes: message.attributes,
                offset: message.offset,
                size: message.size,
                // return function to disconnect also here if disconnection depends on messages
                disconnect: consumer.disconnect,
            })
        },
    })
    // seek to message if needed
    if (seekOffset !== null) {
        consumer.seek({ topic: topic, partition: 0, offset: seekOffset })
    }
    // return function to disconnect
    return consumer.disconnect
}

export async function getLastMessages(topic, consumerGroup, lookBack = 30, timeoutMs = 10000) {
    return new Promise(async (resolve, reject) => {
        const messages = []
        const offsets = await getOffsets(topic)
        if (offsets[0].high == 0) {
            // topic is empty
            resolve(messages)
        }
        const targetOffset = offsets[0].high - 1 // high offset never exists, the last message has high-1 offset
        const startOffset = targetOffset - lookBack // if < 0 is adjusted in consume()
        var end = false // signal end to callback through context
        const receive = function({key, value, headers, timestamp, offset, disconnect: disconnectFunc}) {
            console.log("RECEIVED:", key, value, headers, timestamp, offset)
            messages.push({key, value, headers, timestamp})
            if (offset >= targetOffset || end) {
                disconnectFunc()
                resolve(messages)
            }
        }
        setTimeout(() => {
            //resolve(messages)
            end = true
            reject(new Error("Timeout reached (" + timeoutMs + "ms)"))
        }, timeoutMs);
        try {
            await consume(topic, consumerGroup, receive, 0, startOffset)
        } catch (error) {
            end = true
            reject(error)
        }
    })
}
