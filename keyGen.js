const config = require('./config.json')
const HDKey = require('hdkey')

const rootKey = HDKey.fromMasterSeed(new Buffer(config.masterSeed, 'hex'))

module.exports = (path) => {
  return rootKey.derive(path)
}