import authMiddleware from './authMiddleware.js';
// import errorHandler from './errorHandler.js';
import paginationValidator from './paginationValidator.js';
import personaValidator from './personaValidator.js';

const middlewares = {
  authMiddleware,
  // errorHandler,
  paginationValidator,
  personaValidator,
};

export default middlewares;