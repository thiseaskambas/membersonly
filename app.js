const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const usersRouter = require('./routes/userRoutes');
const postsRouter = require('./routes/postsRoutes');
const authController = require('./controllers/authController');
const refreshRouter = require('./routes/refreshRoutes');

const app = express();

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

app.use('/api/v1/refresh', refreshRouter);
app.get('/api/v1/secret', authController.verifyJWT, (req, res) => {
  res.json({
    message: 'secret message!!!',
  });
});
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/posts', postsRouter);

module.exports = app;
