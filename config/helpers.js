module.exports.errorHandle = function errorHandle (error) {
    if (error) {
        throw error;
    }
};

module.exports.isEmpty = function isEmpty (obj) {
    for (let _ in obj) {
        return false;
    }
    return true;
};
