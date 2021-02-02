const request = require('request');
const axios = require('axios');
const url = require('url');
const bodyParser = require('body-parser');
const express = require("express");
const app = express();

app.set('view engine', 'jade');
app.use(bodyParser());

// Accept every SSL certificate
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function load_env_variable(name) {
  var value = process.env[name];
  if (value) {
    console.log(name + " is " + value);
    return value;
  } else {
    console.error("You need to specify a value for the environment variable: " + name);
    process.exit(1);
  }
}

/*
  URLs to Kong
*/
var KONG_ADMIN = process.env["KONG_ADMIN"] || "http://kong:8001";
var KONG_API = process.env["KONG_API"] || "https://kong:8443";

/* 
  The scopes that we support, with their extended
  description for a nicer frontend user experience
*/
var SCOPE_DESCRIPTIONS = process.env["SCOPES"] ? JSON.parse(process.env["SCOPES"]) : { email: "Grant permissions to read your email address" };

/* 
  The port the authorization server listens on. Defaults to 3301.
*/
var LISTEN_PORT = process.env["LISTEN_PORT"] || 3301

/*
  Retrieves the OAuth 2.0 client application name from
  a given client_id - used for a nicer fronted experience
*/
function get_application_name(client_id, callback) {
  request({
    method: "GET",
    url: KONG_ADMIN + "/oauth2/" + client_id
  }, function (error, response, body) {
    var application_name;
    if (client_id && !error) {
      var json_response = JSON.parse(body);
      if (json_response) {
        application_name = json_response.name;
      }
    }
    callback(application_name);
  });
}

/*
  The POST request to Kong that will actually try to
  authorize the OAuth 2.0 client application after the
  user submits the form
*/
function authorize(service_name, client_id, response_type, scope, provision_key, authenticated_userid, callback) {
  request({
    method: "POST",
    url: KONG_API + "/" + service_name + "/oauth2/authorize",
    form: {
      client_id: client_id,
      response_type: response_type,
      scope: scope,
      provision_key: provision_key,
      authenticated_userid: authenticated_userid // Hard-coding this value (it should be the logged-in user ID)
    }
  }, function (error, response, body) {
    callback(JSON.parse(body).redirect_uri);
  });
}

/*
  The route that shows the authorization page
*/
app.get('/oauth2/authorize', function (req, res) {
  var querystring = url.parse(req.url, true).query;
  get_application_name(querystring.client_id, function (application_name) {
    if (application_name) {
      res.render('authorization', {
        service_name: querystring.service_name,
        client_id: querystring.client_id,
        response_type: querystring.response_type,
        scope: querystring.scope,
        provision_key: querystring.provision_key,
        authenticated_userid: querystring.authenticated_userid,
        application_name: application_name,
        SCOPE_DESCRIPTIONS: SCOPE_DESCRIPTIONS
      });
    } else {
      res.status(403).send("Invalid client_id");
    }
  });
});

/*
  The route that handles the form submit, that will
  authorize the client application and redirect the user
*/
app.post('/oauth2/authorize', function (req, res) {
  authorize(req.body.service_name, req.body.client_id, req.body.response_type, req.body.scope, req.body.provision_key, req.body.authenticated_userid, function (redirect_uri) {
    res.redirect(redirect_uri);
  });
});

/*
  Get OAuth2 token
*/
app.post('/oauth2/token', function (req, res) {
  let body = req.body;
  axios({
		method: 'post',
    url: KONG_API + "/" + body.service_name + "/oauth2/token",
    data: {
      grant_type: body.grant_type,
      client_id: body.client_id,
      client_secret: body.client_secret,
      code: body.code
    }
	})
	.then(async (response) => {
		let data = response.data;
		res.send(data);
	})
	.catch((err) => {
		res.status(500)
    res.send('error')
	})
});

/*
  Index page
*/

app.get("/oauth2", function (req, res) {
  res.render('index');
});

app.listen(LISTEN_PORT);

console.log("Running at Port " + LISTEN_PORT);