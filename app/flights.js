"use strict"

import settings from "./settings.js"
import { consume, getLastMessages } from "./kafka.js"
import { realtimeSubscribe, realtimeUnsubscribe, cacheGet } from "./kafkaDefaultConsumer.js"

export function airportIcaoToTopic(icao) {
    return settings.kafka.topicPrefix + "airport." + icao.toLowerCase()
}

export function consumeFlights(airportIcao, consumerGroup, callback, lookBack = 0) {
    return consume(airportIcaoToTopic(airportIcao), consumerGroup, callback, lookBack)
}

export async function getLatestFlights(airportIcao, consumerGroup, lookBack = 30, timeoutMs = 10000) {
    const topic = airportIcaoToTopic(airportIcao)
    var flightMessages = []
    try {
        flightMessages = cacheGet(topic)
    } catch (error) {
        console.warn("cache error - now querying db", error)
        try {
            flightMessages = await getLastMessages(airportIcaoToTopic(airportIcao), consumerGroup, lookBack, timeoutMs)
        } catch (error) {
            console.error(error)
            throw error
        }
    }
    return flightMessages
}

export async function realtimeFlights(airportIcao, callback) {
    const airportTopic = airportIcaoToTopic(airportIcao)
    await realtimeSubscribe(airportTopic, callback)
    return () => realtimeUnsubscribe(airportTopic, callback)
}
