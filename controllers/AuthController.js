const UserModel = require("../models/UserModel");
const { body, validationResult } = require("express-validator");
const { sanitizeBody } = require("express-validator");
//helper file to prepare responses.
const apiResponse = require("../helpers/apiResponse");
const utility = require("../helpers/utility");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mailer = require("../helpers/mailer");
const { constants } = require("../helpers/constants");

/**
 * User registration.
 *
 * @param {string}      name
 * @param {string}      email
 * @param {string}      password
 *
 * @returns {Object}
 */
exports.register = [
// Validate fields.
body("name").isLength({ min: 1 }).trim().withMessage("Name must be specified."),
body("email").isLength({ min: 1 }).trim().withMessage("Email must be specified.")
	.isEmail().withMessage("Email must be a valid email address.").custom((value) => {
		return UserModel.findOne({ email: value }).then((user) => {
			if (user) {
				return Promise.reject("E-mail already in use");
			}
		});
	}),
	body('password').isLength({ min: 6 })
  .withMessage('Password Must Be at Least 6 Characters')
  .matches('[0-9]').withMessage('Password Must Contain a Number')
  .matches('[A-Z]').withMessage('Password Must Contain an Uppercase Letter')
  .matches('[a-z]').withMessage('Password Must Contain an Lowercase Letter'),
// Sanitize fields.
sanitizeBody("name").escape(),
sanitizeBody("email").escape(),
sanitizeBody("password").escape(),
// Process request after validation and sanitization.
(req, res) => {
	try {
		// Extract the validation errors from a request.
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			// Display sanitized values/errors messages.
			return apiResponse.validationErrorWithData(res, "Validation Error.", errors.array());
		} else {
			//hash input password
			bcrypt.hash(req.body.password, 10, function (err, hash) {
				
				// Create User object with escaped and trimmed data
				var user = new UserModel(
					{
						name: req.body.name,
						email: req.body.email,
						password: hash
					}
				);
					
				// Save user.
				user.save(function (err) {
					if (err) { return apiResponse.ErrorResponse(res, err); }
					let userData = {
						_id: user._id,
						name: user.name,
						email: user.email
					};
					return apiResponse.successResponseWithData(res,"Registration Success.", userData);
				});
			});
		}
	} catch (err) {
		//throw error in json response with status 500.
		return apiResponse.ErrorResponse(res, err);
	}
}];

/**
 * User login.
 *
 * @param {string}      email
 * @param {string}      password
 *
 * @returns {Object}
 */
exports.login = [
body("email").isLength({ min: 1 }).trim().withMessage("Email must be specified.")
	.isEmail().withMessage("Email must be a valid email address."),
body("password").isLength({ min: 1 }).trim().withMessage("Password must be specified."),
sanitizeBody("email").escape(),
sanitizeBody("password").escape(),
(req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return apiResponse.validationErrorWithData(res, "Validation Error.", errors.array());
		} else {
			UserModel.findOne({ email: req.body.email }).then(user => {
				if (user) {
					//Compare given password with db's hash.
					bcrypt.compare(req.body.password, user.password, function (err, same) {
						if (same) {
							let userData = {
								_id: user._id,
								name: user.name,
								email: user.email,
							};
							//Prepare JWT token for authentication
							const jwtPayload = userData;
							const jwtData = {
								expiresIn: process.env.JWT_TIMEOUT_DURATION,
							};
							const secret = process.env.JWT_SECRET;
							//Generated JWT token with Payload and secret.
							userData.token = jwt.sign(jwtPayload, secret, jwtData);
							return apiResponse.successResponseWithData(res, "Login Success.", userData);
						} else {
							return apiResponse.unauthorizedResponse(res, "Email or Password wrong.");
						}
					});
				} else {
					return apiResponse.unauthorizedResponse(res, "Email or Password wrong.");
				}
			});
		}
	} catch (err) {
		return apiResponse.ErrorResponse(res, err);
	}
}];
