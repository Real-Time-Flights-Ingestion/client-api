"use strict"

import Koa from "koa"
import Router from "koa-router"
import { logger, responseTime } from "./app/middleware.js"

const koa = new Koa()
const router = new Router()

koa.use(logger)
koa.use(responseTime)

router.get("/hello", (ctx, next) => {
    ctx.body = "Hello World!"
})

koa.use(router.routes())
koa.use(router.allowedMethods())

koa.listen(3000)
