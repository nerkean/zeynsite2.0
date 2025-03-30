class AppError extends Error {
    constructor(message, statusCode) {
        super(message); 
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Ресурс не найден') {
        super(message, 404); 
    }
}

class BadRequestError extends AppError {
    constructor(message = 'Неверный запрос') {
        super(message, 400); 
    }
}

class AuthenticationError extends AppError {
     constructor(message = 'Ошибка аутентификации') {
         super(message, 401);
     }
}

class ForbiddenError extends AppError {
     constructor(message = 'Доступ запрещен') {
         super(message, 403);
     }
}

module.exports = { AppError, NotFoundError, BadRequestError, AuthenticationError, ForbiddenError };