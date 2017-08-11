const Router = require('koa-rest-router')
const Koa = require('koa')
const mount = require('koa-mount')
const route = require('koa-route')
const bodyParser = require('koa-bodyparser')
const jsonResponse = require('koa-json')
const secp256k1 = require('secp256k1')
const keyGen = require('./keyGen')

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

resources.map((resource) => {
  app.use(resource.middleware())
})

app.use(route.get('/features/secp256k1/sign/:hashHex', async (ctx, hashHex, next) => {
  const user = ctx.state.user
  const apiKey = ctx.query.apiKey
  const targetHash = Buffer.from(hashHex.slice(2), 'hex')
  const connectionIds = user.connections
  const connections = await dbFetchMany('connections', connectionIds)
  const connection = connections.find((connection) => apiKey === connection.apiKey)
  if (!connection) throw new Error('Connection not found for apiKey')
  const canSign = connection.capabilities.includes('sign')
  if (!canSign) throw new Error('Not allowed to sign via this connection')
  const treasure = await dbFetch('treasures', connection.treasure)
  if (!treasure) throw new Error('No Treasure found for this connection')
  const rootKey = keyGen(`m/${treasure.id}'`)._privateKey
  const sig = secp256k1.sign(targetHash, rootKey)
  const result = {
    r: '0x'+sig.signature.slice(0, 32).toString('hex'),
    s: '0x'+sig.signature.slice(32, 64).toString('hex'),
    v: sig.recovery + 27,
  }
  ctx.body = result
}))

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
  users: [],
  treasures: [],
  connections: [],
}

// setup fixture data
;(async () => {
  const user = await dbCreate('users', {
    name: 'Ott',
    treasures: [],
    connections: [],
  })
  const treasure = await dbCreate('treasures', {
    name: 'primary wallet',
  }, user)
  await dbCreate('connections', {
    name: 'metamask',
    apiKey: 'abcd',
    treasure: treasure.id,
    capabilities: ['sign'],
  }, user)
  console.log(JSON.stringify(db, null, 2))
})()

async function dbPut(model, id, params) {
  const models = db[model][id] = params
  return params
}

async function dbCreate(model, params, owner) {
  const models = db[model]
  const nextId = models.length
  params.id = nextId
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