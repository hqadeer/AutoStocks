module.exports.errorHandle = function errorHandle (error, results, fields) {
    if (error) {
        throw error;
    }
}

module.exports.isEmpty = function isEmpty (obj) {
    for (var i in obj) {
        return false;
    }
    return true;
}
