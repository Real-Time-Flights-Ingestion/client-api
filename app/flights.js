"use strict"

import settings from "./settings.js"
import { consume, getLastMessages } from "./kafka.js"
import { realtimeSubscribe, realtimeUnsubscribe } from "./kafkaDefaultConsumer.js"

export function airportIcaoToTopic(icao) {
    return settings.kafka.topicPrefix + "airport." + icao.toLowerCase()
}

export function consumeFlights(airportIcao, consumerGroup, callback, lookBack = 0) {
    return consume(airportIcaoToTopic(airportIcao), consumerGroup, callback, lookBack)
}

export function getLatestFlights(airportIcao, consumerGroup, lookBack = 30, timeoutMs = 5000) {
    return getLastMessages(airportIcaoToTopic(airportIcao), consumerGroup, lookBack, timeoutMs)
}

export async function realtimeFlights(airportIcao, callback) {
    const airportTopic = airportIcaoToTopic(airportIcao)
    await realtimeSubscribe(airportTopic, callback)
    return () => realtimeUnsubscribe(airportTopic, callback)
}
