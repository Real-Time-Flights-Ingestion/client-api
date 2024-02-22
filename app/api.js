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

router.get("/hello", async ctx => {
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
            const disconnect = await consumeFlights("ELLX", "test"+Math.random(), (obj) => {
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
        }
    } else {
        try {
            const flights = await getLatestFlights("ELLX", "test"+Math.random())
            ctx.set("Content-Type", "application/json;charset=utf-8")
            ctx.body = JSON.stringify(flights)
        } catch (error) {
            console.error(error)
            ctx.status = 500
            ctx.body = error.toString()
        }
    }
})

export default router
