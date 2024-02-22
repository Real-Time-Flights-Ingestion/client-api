"use strict"

import { consume, getLastMessages } from "./kafka.js"

function airportIcaoToTopic(icao) {
    return "rtfi.airport." + icao.toLowerCase()
}

export function consumeFlights(airportIcao, consumerGroup, callback, lookBack = 0) {
    return consume(airportIcaoToTopic(airportIcao), consumerGroup, callback, lookBack)
}

export function getLatestFlights(airportIcao, consumerGroup, lookBack = 30, timeoutMs = 5000) {
    return getLastMessages(airportIcaoToTopic(airportIcao), consumerGroup, lookBack, timeoutMs)
}
