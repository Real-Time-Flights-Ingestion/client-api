"use strict"

import { deepFreeze } from './utils.js'

const settings_setup = {
    server: {
        host: "0.0.0.0",
        domain: "rtfi.servehttp.com",
        port: process.env.PORT || 3000,
        trailingSlashNormalization: true,
    },
    kafka: {
        clientId: "client-api",
        brokers: ["kafka:9092"],
        topicPrefix: "rtfi.",
        consumerGroupPrefix: "client-api-",
        defaultConsumerGroup: "realtime", // client-api-realtime
        defaultCache: 30,
        defaultPermanentListeners: ["rtfi.airport.ellx"]
    },
}

const settings = deepFreeze(settings_setup)

export default settings
