"use strict"

import Koa from "koa"

const koa = new Koa()

koa.use(async ctx => {
    ctx.body = 'Hello World';
});

koa.listen(3000);
