"use strict"

import Koa from "koa"
import apiRouter from "./app/api.js"
import settings from "./app/settings.js"
import { logger, responseTime } from "./app/middleware.js"

const koa = new Koa()

koa.use(logger)
koa.use(responseTime)

koa.use(apiRouter.routes())
koa.use(apiRouter.allowedMethods())

koa.listen(settings.server.port)
