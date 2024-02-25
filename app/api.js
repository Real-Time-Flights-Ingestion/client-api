"use strict"

import stream from "node:stream"
import Router from "koa-router"
import settings from "./settings.js"
import { getLatestFlights, consumeFlights } from "./flights.js"

const router = new Router({
    strict: !settings.server.trailingSlashNormalization
})

function acceptsSSE(ctx) {
    return ctx.get("Accept").toLowerCase() == "text/event-stream"
}

const airportIcao = new Set(["ELLX", "LIRF", "KATL"])

function icaoOk(icao) {
    return airportIcao.has(icao)
}

router.get("/airport/:icao/flights", async ctx => {
    const icao = ctx.params.icao.toUpperCase()
    if (icaoOk(icao)) {
        ctx.set("Access-Control-Allow-Origin", "*")
        if (acceptsSSE(ctx)) {
            ctx.request.socket.setTimeout(0);
            ctx.req.socket.setNoDelay(true);
            ctx.req.socket.setKeepAlive(true);
            ctx.set({
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            })
            const sseStream = new stream.PassThrough()
            ctx.status = 200
            ctx.body = sseStream
            try {
                const disconnect = await consumeFlights(icao, "test"+Math.random(), (obj) => {
                    if (sseStream.closed || sseStream.destroyed) {
                        obj.disconnect()
                        return
                    }
                    try {
                        sseStream.write(`data: ${JSON.stringify(obj)}\n\n`)
                    } catch (error) {
                        console.error("stream write error", error)
                        obj.disconnect()
                    }
                })
                sseStream.on("close", () => disconnect())
            } catch (error) {
                console.error("consumeFlights error", error)
                if (error.cause.type === "UNKNOWN_TOPIC_OR_PARTITION") {
                    console.log("(Kafka not found error)")
                    ctx.status = 404
                    ctx.body = "not found"
                } else {
                    ctx.status = 500
                    ctx.body = error.toString()
                }
                ctx.res.end() // manually end the connection since it's a stream
            }
        } else {
            try {
                const flights = await getLatestFlights(icao, "test"+Math.random())
                ctx.set("Content-Type", "application/json;charset=utf-8")
                ctx.body = JSON.stringify(flights)
            } catch (error) {
                console.error("getLatestFlights error", error)
                if (error.cause.type === "UNKNOWN_TOPIC_OR_PARTITION") {
                    console.log("(Kafka not found error)")
                    ctx.status = 404
                    ctx.body = "not found"
                } else {
                    ctx.status = 500
                    ctx.body = error.toString()
                }
            }
        }
    } else {
        ctx.status = 404
        ctx.body = "icao not found"
    }
})

export default router
