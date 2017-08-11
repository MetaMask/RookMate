const express = require('express')
const passport = require('passport')
const flash = require('connect-flash')
const loggedin = require('connect-ensure-login')
const base32 = require('thirty-two')
const LocalStrategy = require('passport-local').Strategy
const TotpStrategy = require('passport-totp').Strategy
const utils = require('./util')

var users = [
    {
      id: 1,
      twoFactor: {
        key: 'x93kun3r98',
        enabled: false,
      },
      username: 'bob',
      password: 'secret',
      email: 'bob@example.com',
      services: [
        {
          "id": 0,
          "name": "snake"
        }
      ],
    }
];

function findById(id, fn) {
  var idx = id - 1;
  if (users[idx]) {
    fn(null, users[idx]);
  } else {
    fn(new Error('User ' + id + ' does not exist'));
  }
}

function findByUsername(username, fn) {
  for (var i = 0, len = users.length; i < len; i++) {
    var user = users[i];
    if (user.username === username) {
      return fn(null, user);
    }
  }
  return fn(null, null);
}

function findKeyForUserId(id, fn) {
  return fn(null, users[id].twoFactor);
}

function enableKeyForUserId(id, fn) {
  users[id].twoFactor.enabled = true;
  console.log('2fa enabled for', id)
  return fn(null);
}

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  findById(id, function (err, user) {
    done(err, user);
  });
});

// Use the LocalStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a username and password), and invoke a callback
//   with a user object.  In the real world, this would query a database;
//   however, in this example we are using a baked-in set of users.
passport.use(new LocalStrategy(function(username, password, done) {
    process.nextTick(function () {
      // Find the user by username.  If there is no user with the given
      // username, or the password is not correct, set the user to `false` to
      // indicate failure and set a flash message.  Otherwise, return the
      // authenticated `user`.
      findByUsername(username, function(err, user) {
        if (err) { return done(err); }
        if (!user) { return done(null, false, { message: 'Invalid username or password' }); }
        if (user.password != password) { return done(null, false, { message: 'Invalid username or password' }); }
        return done(null, user);
      })
    });
  }));

passport.use(new TotpStrategy(
  function(user, done) {
    // setup function, supply key and period to done callback
    console.log('verifying user')
    // findKeyForUserId(user.id, function(err, obj) {
    //   if (err) { return done(err); }
      return done(null, user.twoFactor.key, 30);
    // });
  }
));

var app = express();

const morgan = require('morgan')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const methodOverride = require('method-override')
const expressSession = require('express-session')


// configure Express
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('ejs', require('ejs-locals'));
app.use(morgan('tiny'));
// app.use(cookieParser());
app.use(bodyParser());
app.use(methodOverride());
app.use(expressSession({ secret: 'keyboard cat' }));
app.use(flash());
// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());


app.get('/', function(req, res){
  res.render('index', { user: req.user, session: req.session });
});

//
// SERVICE CRUD
//

const keyGen = require('./keyGen')

app.get('/services', loggedin.ensureLoggedIn(), function(req, res){
  const services = req.user.services
  const rootKeys = services.map((service) => keyGen(`m/${req.user.id}'/${service.id}'`))
  res.render('services', { user: req.user, rootKeys, session: req.session });
});

app.post('/services/new', loggedin.ensureLoggedIn(), function(req, res){
  req.user.services.push({
    id: req.user.services.length,
    name: req.body.name,
  })
  res.redirect('/services')
});

//
// Login and Admin
//

// To view account details, user must be authenticated using two factors
app.get('/account', loggedin.ensureLoggedIn(), ensureSecondFactor, function(req, res){
  res.render('account', { user: req.user, session: req.session });
});

app.get('/setup', loggedin.ensureLoggedIn(), function(req, res, next){
  // findKeyForUserId(req.user.id, function(err, obj) {
  //   if (err) { return next(err); }
  // generate QR code for scanning into Google Authenticator
  // reference: https://code.google.com/p/google-authenticator/wiki/KeyUriFormat
  var userKey = req.user.twoFactor.key
  var encodedKey = base32.encode(userKey).toString()
  var label = `RookMate (${req.user.email})`
  var otpUrl = `otpauth://totp/${encodeURIComponent(label)}?secret=${encodedKey}&period=30`;
  var qrImage = 'https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=' + encodeURIComponent(otpUrl);
  // new two-factor setup.  generate and save a secret key
  res.render('setup', { user: req.user, session: req.session, key: encodedKey, qrImage: qrImage });
  // });
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user, message: req.flash('error') });
});

// POST /login
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
//
//   curl -v -d "username=bob&password=secret" http://127.0.0.1:3000/login
app.post('/login',
  passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/auth-otp', loggedin.ensureLoggedIn(),
  function(req, res, next) {
    res.redirect('/account')
  })

app.post('/auth-otp',
  passport.authenticate('totp', { failureFlash: true }),
  function(req, res) {
    // set on session
    req.user.twoFactor.enabled = true
    // set in user db
    enableKeyForUserId(req.user.id, function(err) {
      if (err) { return next(err); }
      req.session.secondFactor = 'totp';
      res.redirect('/account')
    });
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.listen(3000, function() {
  console.log('Express server listening on port 3000');
});


function ensureSecondFactor(req, res, next) {
  if (req.session.secondFactor == 'totp') { return next(); }
  res.redirect('/setup')
}