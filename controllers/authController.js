const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const createSendToken = async (user, statusCode, res) => {
  const accessToken = jwt.sign({ id: user._id }, process.env.JWT_ACCESS_KEY, {
    expiresIn: process.env.JWT_ACCESS_KEY_EXPIRES_IN,
  });
  const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_KEY, {
    expiresIn: process.env.JWT_REFRESH_KEY_EXPIRES_IN,
  });
  const cookieOptions = {
    maxAge: process.env.JWT_COOKIE_EXPIRES_IN * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  };

  user.password = undefined; //so that we don't return the password

  // NOTE: we still need to save it to our DB!!! TEMP SOLUTION
  await User.findByIdAndUpdate(user._id, { refreshToken: [refreshToken] });

  //NOTE: the refresh token is send with a cookie
  res.cookie('jwt', refreshToken, cookieOptions);
  res.status(statusCode).json({
    status: 'success',
    accessToken,
    data: {
      user,
    },
  });
};

//
//
//

exports.signup = async (req, res, next) => {
  const newUser = await User.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    email: req.body.email,
  });
  await createSendToken(newUser, 200, res);
};

//
//
//

exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  //check if email and password exist
  if (!email || !password) {
    return next('no username or pwd provided');
  }
  //check if user exists and password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next('Incorrect name or password');
  }
  //if all good, send token to client
  await createSendToken(user, 200, res);
};

//
//
//

exports.logout = async (req, res, next) => {
  //NOTE:  on frontEnd/Client, also delete accessToken!
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204); //No content
  const refreshToken = cookies.jwt;
  //NOTE: is refreshToken in DB?
  const user = await User.findOne({ refreshToken: [refreshToken] });
  if (!user) {
    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
    return res.sendStatus(403);
  }
  //NOTE: delete refreshToken from DB:
  user.refreshToken = [];
  const result = await user.save();
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });
  res.json({ message: 'logged out!!!', user: result });
};

exports.protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  if (!token) {
    return res.status(401).json({ message: 'not logged in' });
  }
  const decoded = jwt.verify(token, process.env.JWT_ACCESS_KEY);
  const freshUser = await User.findById(decoded.id);
  req.user = freshUser;
  res.locals.user = freshUser;
  next();
};

//NOTE: to be used when implementing refresh tokens (no ACCESS jwt on cookies):
exports.verifyJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.sendStatus(401);
  const token = authHeader.split(' ')[1];
  if (!token) {
    return next('You are not logged in!', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_KEY);
    const freshUser = await User.findById(decoded.id);
    req.user = freshUser;
    return next();
  } catch (err) {
    return res.status(403).json({ message: 'no access!!', err });
  }

  // const freshUser = await User.findById(decoded.id);
  // req.user = freshUser;

  // res.locals.user = freshUser;
};
