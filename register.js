const pify = require('pify')
const QRCode = require('qrcode')
const terminalQr = require('qrcode-terminal')
const speakeasy = require('speakeasy')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

module.exports = register

register ()

async function register () {

  const secret = speakeasy.generateSecret({
    name: 'RookMate',
    length: 20,
  })
  console.log(secret.base32)
  // Save this value to your DB for the user
  // Example:  JFBVG4R7ORKHEZCFHZFW26L5F55SSP2Y

  // A data URI for the QR code image
  const imageData = await pify(QRCode.toDataURL)(secret.otpauth_url)
  console.log(secret.otpauth_url)
  // console.log(imageData)
  terminalQr.generate(secret.otpauth_url)

  const userToken = await askUser('2FA code? ')
  // // USER ACTION STUB: SUBMIT TOKEN
  // const userToken = speakeasy.totp({
  //   secret: secret.base32,
  //   encoding: 'base32',
  // })
  console.log(`user submitted ${userToken}`)

  // Verify that the user token matches what it should at this moment
  const tokenIsValid = speakeasy.totp.verify({
    secret: secret.base32,
    encoding: 'base32',
    token: userToken,
  })
  console.log('token is valid?', tokenIsValid)

}

function askUser(message) {
  return pify((query, cb) => {
    rl.question(query, (answer) => {
      rl.close()
      cb(null, answer)
    })
  })(message)
}