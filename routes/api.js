var express = require("express");
var authRouter = require("./auth");
var app = express();

app.use("/", authRouter);

module.exports = app;