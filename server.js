var bodyParser = require('body-parser');
var express = require('express');
var exphbs  = require('express-handlebars');
var session = require('express-session');
var morgan = require('morgan');
var oauth2orize = require('oauth2orize');
var passport = require('passport');
var BearerStrategy = require('passport-http-bearer').Strategy;
var ClientPasswordStrategy = require('passport-oauth2-client-password').Strategy;

function getUser () {
    return { id: 1, name: 'Some User' };
}

function getClient () {
    return { id: '1', name: 'client_1', clientId: 'client_id_1', clientSecret: 'client_secret_1' };
}

var server = oauth2orize.createServer();

server.serializeClient(function (client, done) {
    return done(null, client.id);
});

server.deserializeClient(function (id, done) {
    return done(null, getClient());
});

server.grant(oauth2orize.grant.code(function (client, redirectUri, user, ares, done) {
    // here we would generate a code and record it
    var code = 'code_1';
    done(null, code);
}));

server.exchange(oauth2orize.exchange.code(function (client, code, redirectUri, done) {
    console.log('client=' + JSON.stringify(client));
    // here we would generate an access token and record it
    var accessToken = 'access_token_1';
    done(null, accessToken);
}));

// Used to verify the (client_id, client_secret) pair.
// ClientPasswordStrategy reads the client_id and client_secret from
// the request body. Can also use a BasicStrategy for HTTP Basic authentication.
passport.use(new ClientPasswordStrategy(
    function (clientId, clientSecret, done) {
        // here we would verify that the clientSecret matches what we have
        // registered for the clientId
        console.log('client_id=' + clientId);
        console.log('client_secret=' + clientSecret);
        return done(null, getClient());
    }
));

// Used to check the accessToken on protected APIs
passport.use(new BearerStrategy(
    function (accessToken, done) {
        // here we would check the accessToken and find the associated user
        console.log('access_token=' + accessToken);
        return done(null, getUser());
    }
));

var app = express();
app.use(morgan(':method :url', { immediate: true }));
app.use(bodyParser.urlencoded({ extended: true }));
// OAuth2orize requires session support
app.use(session({secret: 'some secret'}));
app.use(passport.initialize());
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

app.get('/authorize',
    // here we would ask the user to log in if they aren't already
    function (req, res, next) {
        console.log('Adding user to request');
        req.user = getUser();
        next();
    },
    server.authorize(function (clientId, redirectUri, done) {
        // here we would look up the client in our records and check the
        // redirectUri against the one registered for that client
        done(null, getClient(), redirectUri);
    }),
    function (req, res) {
        res.render('askPermission', { transactionID: req.oauth2.transactionID, user: req.user, client: req.oauth2.client });
    }
);

app.post('/authorize_decision',
    server.decision()
);

app.post('/access_token',
    passport.authenticate(['oauth2-client-password'], { session: false }),
    server.token()
);

app.get('/secured',
    passport.authenticate('bearer', { session: false }),
    function (req, res) {
        res.send('hello world');
    }
);

app.listen(3000);
