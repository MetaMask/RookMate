const Router = require('koa-rest-router')
const Koa = require('koa')
const mount = require('koa-mount')
const bodyParser = require('koa-bodyparser')
const jsonResponse = require('koa-json')

const app = new Koa()

app.use(bodyParser())

// json result
app.use(jsonResponse({ pretty: true }))

// pseudo login for dev
app.use(async (ctx, next) => {
  ctx.state.user = await dbFetch('users', 0)
  return next()
})

// add api

const resources = [
  exposeResourceForUser('treasures'),
  exposeResourceForUser('connections'),
]
// api.resource('connections', {
resources.map((resource) => {
  app.use(mount('/api/v0', resource.middleware()))
})

app.listen(3000, () => {
  console.log('Open http://localhost:3000 and try')
  // log routes
  resources.forEach((resource) => {
    console.log(`MODEL ${resource.name}`)
    resource.routes.forEach((route) => {
      console.log(`  ${route.method} ${route.path}`)
    })
  })
})

// util

function exposeResourceForUser(model) {
  const router = Router({ prefix: model })
  router.name = model
  router.resource('/', {
    index: async (ctx, next) => {
      const user = ctx.state.user
      const modelIds = user[model]
      const result = await dbFetchMany(model, modelIds)
      ctx.body = result
    },
    show: async (ctx, next) => {
      const user = ctx.state.user
      const modelId = ctx.params.id
      const result = await dbFetch(model, modelId)
      if (!modelInstance) throw new Error('model not found for id')
      ctx.body = result
    },
    create: async (ctx, next) => {
      const user = ctx.state.user
      const reqParams = ctx.request.body
      if (typeof reqParams !== 'object') throw new Error('invalid params')
      const modelParams = {
        name: reqParams.name,
      }
      const result = await dbCreate(model, modelParams, user)
      ctx.body = result
    },
    update: async (ctx, next) => {
      const user = ctx.state.user
      const modelId = ctx.params.id
      const reqParams = ctx.request.body
      if (typeof reqParams !== 'object') throw new Error('invalid params')
      const modelParams = {
        name: reqParams.name,
      }
      const modelInstance = await dbFetch(model, modelId)
      if (!modelInstance) throw new Error('model not found for id')
      const patchedParams = Object.assign({}, modelInstance, modelParams)
      const result = await dbPut(model, modelId, patchedParams)
      ctx.body = result
    },
  })
  return router
}

//
// Model
//

const db = {
  users: [
    {
      name: 'Mello',
      treasures: [0],
      connections: [0],
    },
  ],
  treasures: [
    {
      name: 'primary wallet',
    },
  ],
  connections: [
    {
      name: 'metamask',
      apiKey: 'abcd',
      treasure: 0,
      capabilities: [0],
    },
  ],
  capabilities: [
    'sign',
  ],
}

async function dbPut(model, id, params) {
  const models = db[model][id] = params
  return params
}

async function dbCreate(model, params, owner) {
  const models = db[model]
  const nextId = models.length
  models.push(params)
  if (owner) {
    owner[model].push(nextId)
  }
  return params
}

async function dbFetch(model, id) {
  return db[model][id]
}

async function dbFetchMany(model, ids) {
  return await Promise.all(ids.map((id) => dbFetch(model, id)))
}