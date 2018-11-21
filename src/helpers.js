/**
 * If you want to enable logs from datafeed set it to `true`
 */
var isLoggingEnabled = true;
export function logMessage(message) {
    if (isLoggingEnabled) {
        var now = new Date();
        console.log(now.toLocaleTimeString() +  " > " + message);
    }
}
export function getErrorMessage(error) {
    if (error === undefined) {
        return '';
    }
    else if (typeof error === 'string') {
        return error;
    }
    return error.message;
}
