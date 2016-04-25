(function (root, definition) {

    /* istanbul ignore else: untestable */
    if (typeof exports === 'object') {
        /* CommonJS/Node.js */
        module.exports = definition;
    } else if (typeof define === 'function' && define.amd) {
        /* RequireJS */
        root.define(['bluebird'], definition);
    } else {
        /* <script> */
        if (typeof root.P === 'undefined') {
            throw new Error('bluebird library is missing');
        }
        root.ChainCommander = definition(root.P);
    }

})(this, function (Q) {
    'use strict';

    /* istanbul ignore next:polyfill should not be tested*/
    var isArray = Array.isArray || function (val) {
        return val && typeof val === 'object' && val.constructor === Array;
    };

    function convert(obj) {
        if (typeof obj === 'string') {
            obj = JSON.parse(obj);
        }

        /* Normalize it to always create an array from the obj */
        return Array.prototype.concat.call(obj);
    }

    function parser(obj, initial, context) {
        var _top;
        var _inner;
        var i;
        var j;
        var ilen;
        var jlen;
        /*jshint validthis:true */
        var self = this;

        function log() {
            /* istanbul ignore next: untestable */
            if (self.debug === true) {
                var args = Array.prototype.slice.call(arguments);
                if (typeof args[1] === 'function' && typeof args[1].__debug !== 'undefined') {
                    args[1] = args[1]();
                }
                console.log.apply(console, args);
            }
        }

        obj = convert(obj);

        initial = Q.resolve(initial);

        /*istanbul ignore next:debug stuff*/
        var inspect = function () {
            return initial.reflect();
        };

        inspect.__debug = true;

        /*istanbul ignore next:debug stuff*/
        log('initial promise state', inspect);

        function exec(parsing) {
            log('exec before');
            /* create a promise from any return value from the "exec" functions, including other promises */
            return function execPromise(currentValue) {
                return new Q(function execPromiseItself(resolve, reject) {
                    log('exec after');
                    /* we need to separate from the main promise chain, since, we don't want it to fail, we need it
                      to keep going regardless of rejected, since its up to the user on how to deal with the value */

                    Q.try(function tryExecPromise() {
                        /* Does the exec function return a value or a promise? Doesn't matter */
                        /* Pass in the current value as the last parameter, always. */
                        if (self.throws === true && typeof context[parsing[0]] !== 'function') {
                            throw new Error('"exec" function "' + parsing[0] + '" doesnt exists');
                        }
                        var args = parsing.slice(1).concat(currentValue);

                        if (self.context) {
                            args.push(self.context);
                        }

                        log('exec try', parsing, context[parsing[0]], args);

                        return context[parsing[0]].apply(context, args);
                    })
                    .then(function successExecPromise(val) {
                        log('exec done', val);

                        if (val === void 0) {
                            /* resolve with the current value, the function had no "return" */
                            resolve(currentValue);
                        } else {
                            /* everything went well, resolve with the new value */
                            resolve(val);
                        }

                        return null;
                    })
                    .catch(function catchExecPromise(err) {
                        log('exec fail', err);
                        /* The function threw an exception, we need to continue with the unchanged value */
                        if (self.throws === true) {
                            reject(err instanceof Error ? err : /*istanbul ignore next*/ new Error(err));
                        } else {
                            resolve(currentValue);
                        }

                        return null;
                    });
                });
            };
        }

        function ifblock(parsing) {
            log('ifblock before');
            /* return a promise from an ifblock, and add it do the promise chain */
            return function ifblockPromise(currentValue) {
                log('ifblock after', currentValue);
                return new Q(function ifblockPromiseItself(resolve, reject) {
                    var i, len;

                    if (typeof parsing['check'] !== 'undefined') {
                        /* side promise */
                        var conditions = Q.resolve(true);

                        var conditional = function (condition) {
                            log('ifblock conditional out');
                            return function conditionalPromise(bool) {
                                log('ifblock conditional after', bool);
                                /* starts at undefined, that if it doesnt become true, it will be typecasted to boolean false */
                                if (bool === false) {
                                    /* previous if check failed, just stop it before calling the other function */
                                    return Q.resolve(false);
                                } else {
                                    return Q.try(function tryConditional() {
                                        /* the function return a future value, regardless if it's a promise or a primitive value */
                                        log('ifblock conditional try', condition[0]);

                                        if (self.throws === true) {
                                            /* istanbul ignore else */
                                            if (typeof context[condition[0]] !== 'function') {
                                                throw new Error('"if" function "' + condition[0] + '" doesnt exists');
                                            }
                                        }

                                        var args = condition.slice(1).concat(currentValue);

                                        if (self.context) {
                                            args.push(self.context);
                                        }

                                        return context[condition[0]].apply(context, args);
                                    })
                                    .then(function successConditional(val) {
                                        /* typecast the result and convert to a boolean */
                                        val = !!val;
                                        log('ifblock conditional done', val);

                                        return val;
                                    })
                                    .catch(function catchConditional(err) {
                                        /* in case the "if" function were rejected, resolve to false */
                                        log('ifblock conditional fail');

                                        if (self.throws === true) {
                                            /*istanbul ignore else */
                                            if (err instanceof Error) {
                                                reject(err);
                                            } else {
                                                reject(new Error(err));
                                            }
                                        } else {
                                            return false;
                                        }

                                        return null;
                                    });

                                }
                            };
                        };

                        var conditionalelse = function (_else) {
                            log('ifblock conditionalelse out');
                            return function conditionalelsePromise(currentValue) {
                                log('ifblock conditionalelse after');
                                /* try to return a future "else" value, since parser always return a new promise */
                                log('ifblock conditionalelse try', _else);

                                return parser.call(self, _else, currentValue, context)
                                /* parser never fails */
                                .then(function successConditionalElse(val) {
                                    /* only resolve with the new value if it isn't undefined (that means the value had no "return" value */
                                    /* parser always return the currentValue if there are none */
                                    log('conditionalelse done', val);

                                    return val;
                                });
                            };
                        };

                        for (i = 0, len = parsing['check'].length; i < len; i++) {
                            conditions = conditions.then(conditional(parsing['check'][i]));
                        }

                        conditions.then(function successConditions(val) {
                            log('ifblock check', val);
                            /* side promise chain, true or false */
                            var inpromise = Q.resolve(currentValue);

                            /* we should either check if the "if" was successiful, if so, execute */
                            if (val === true && typeof parsing['exec'] !== 'undefined') {
                                for (i = 0, len = parsing['exec'].length; i < len; i++) {
                                    inpromise = inpromise.then(exec(parsing['exec'][i]));
                                }
                            } else if (val === false && typeof parsing['else'] !== 'undefined') {
                                inpromise = inpromise.then(conditionalelse(parsing['else']));
                            }

                            resolve(inpromise);

                            return null;
                        });
                    } else {
                        if (self.throws === true) {
                            reject(new Error('Missing "check" in "if"'));
                        } else {
                            resolve(currentValue);
                        }
                    }
                });
            };
        }

        for (i = 0, ilen = obj.length; i < ilen; i++) {
            _top = obj[i];
            if (typeof _top['if'] !== 'undefined') {
                _inner = _top['if'];
                initial = initial.then(ifblock(_inner));
            }

            if (typeof _top['exec'] !== 'undefined') {
                for (j = 0, jlen = _top['exec'].length; j < jlen; j++) {
                    _inner = _top['exec'][j];
                    initial = initial.then(exec(_inner));
                }
            }
        }

        return initial;
    }

    /**
     * Creates a new ChainCommander instance
     *
     * @param {Array|String|Object} obj JSON string or array
     * @param {Object} [opts] {{debug: Boolean, throws: Boolean, member: String}}
     * @constructor
     */
    function ChainCommander(obj, opts) {
        if (!(this instanceof ChainCommander)) {
            return new ChainCommander(obj, opts);
        }

        opts = opts || {};

        /* istanbul ignore next:debug flag */
        this.debug = opts.debug !== void 0 ? opts.debug : false;
        this.throws = opts.throws !== void 0 ? opts.throws : false;
        this.member = typeof obj === 'object' &&
            typeof opts.member === 'string' &&
            typeof obj[opts.member] !== 'undefined' ? opts.member : false;

        if (this.throws && typeof obj === 'object' && typeof opts.member === 'string' && this.member === false) {
            throw new Error('Object provided doesnt have member "' + opts.member + '"');
        }

        if (this.member !== false) {
            this.context = obj;
            this.defs = convert(this.context[this.member]);
        } else {
            this.defs = convert(obj);
        }
    }

    /**
     * Execute all items in chain, with the same context
     *
     * @param {*} value
     * @param {Array} arr Array of ChainCommander or Array of Arrays of ChainCommander
     * @param {Object} context
     * @param {Function} [tap] Optional array of functions that are executed in order as a side-effect
     *
     * @returns {Promise}
     */
    ChainCommander.all = function (value, arr, context, tap) {

        var result = Q.resolve(value);
        var curry = function (item) {
            var arr = isArray(item) && item.length;

            var tapped = function (r) {
                if (tap) {
                    r.then(function (v) {
                        tap(v, item.context);

                        return null;
                    });
                }
                return r;
            };

            return function allFn(val) {
                var r;
                if (arr) {
                    r = Q.resolve(val);
                    for (var i = 0; i < arr; i++) {
                        r = r.then(curry(item[i]));
                    }
                    return r;
                } else if (item instanceof ChainCommander) {
                    return tapped(item.execute(val, context), item);
                } else {
                    return val;
                }
            };
        };

        for (var i = 0; i < arr.length; i++) {
            result = result.then(curry(arr[i]));
        }

        return result;
    };

    /**
     *
     * @param {*} initial Any initial value, can be literals, objects and arrays
     * @param {Object} context Context to run the chain on
     *
     * @returns {Promise}
     */
    ChainCommander.prototype.execute = function (initial, context) {
        return parser.call(this, this.defs, initial, context);
    };

    return ChainCommander;
});
